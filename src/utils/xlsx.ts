export interface ParsedWorkbook {
  sheets: Array<{ name: string; rows: string[][] }>;
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z0-9:_-]+)="([^"]*)"/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1]] = decodeXmlEntities(match[2]);
  }
  return attributes;
}

function stripXmlDeclaration(xml: string): string {
  return xml.replace(/<\?xml[\s\S]*?\?>/, '');
}

function parseSharedStrings(xml: string): string[] {
  const values: string[] = [];
  const itemPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  for (const match of stripXmlDeclaration(xml).matchAll(itemPattern)) {
    const text = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((item) => decodeXmlEntities(item[1]))
      .join('');
    values.push(text);
  }
  return values;
}

function getCellText(cellMarkup: string, sharedStrings: string[]): string {
  const openTagMatch = cellMarkup.match(/^<c\b([^>]*)>/);
  const attributes = parseAttributes(openTagMatch?.[1] ?? '');
  const type = attributes.t ?? '';
  const inlineText = [...cellMarkup.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
    .map((item) => decodeXmlEntities(item[1]))
    .join('');

  if (type === 'inlineStr') {
    return inlineText;
  }

  const value = cellMarkup.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? '';
  if (type === 's') {
    const index = Number.parseInt(value, 10);
    return Number.isNaN(index) ? '' : (sharedStrings[index] ?? '');
  }

  return decodeXmlEntities(value);
}

function columnRefToIndex(reference: string): number {
  const letters = reference.replace(/[0-9]/g, '');
  let result = 0;
  for (let index = 0; index < letters.length; index += 1) {
    result = result * 26 + letters.charCodeAt(index) - 64;
  }
  return result - 1;
}

function parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/g;

  for (const rowMatch of stripXmlDeclaration(xml).matchAll(rowPattern)) {
    const values: string[] = [];
    const cellPattern = /<c\b[\s\S]*?\/>|<c\b[\s\S]*?<\/c>/g;
    for (const cellMatch of rowMatch[1].matchAll(cellPattern)) {
      const cellMarkup = cellMatch[0];
      const attributes = parseAttributes(cellMarkup.match(/^<c\b([^>]*)>/)?.[1] ?? '');
      const reference = attributes.r ?? '';
      const columnIndex = reference ? columnRefToIndex(reference) : values.length;
      values[columnIndex] = getCellText(cellMarkup, sharedStrings).trim();
    }
    rows.push(values);
  }

  return rows;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const decompressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(decompressed);
}

export async function unzipEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocdOffset = -1;

  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 66000); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error('Unable to recognize the ZIP structure. The selected file is not a valid xlsx workbook.');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const entries = new Map<string, Uint8Array>();
  let pointer = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) {
      throw new Error('The xlsx ZIP central directory is corrupted.');
    }

    const compressionMethod = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const fileNameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localHeaderOffset = view.getUint32(pointer + 42, true);
    const fileName = new TextDecoder().decode(bytes.slice(pointer + 46, pointer + 46 + fileNameLength));
    const localHeaderNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localHeaderExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localHeaderNameLength + localHeaderExtraLength;
    const compressedData = bytes.slice(dataOffset, dataOffset + compressedSize);

    let fileData = compressedData;
    if (compressionMethod === 8) {
      fileData = await inflateRaw(compressedData);
    } else if (compressionMethod !== 0) {
      throw new Error(`Unsupported xlsx compression method: ${compressionMethod}`);
    }

    entries.set(fileName, fileData);
    pointer += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function decodeEntry(entries: Map<string, Uint8Array>, entryPath: string): string {
  const bytes = entries.get(entryPath);
  if (!bytes) {
    throw new Error(`The workbook is missing a required entry: ${entryPath}`);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

export function parseWorkbookEntries(entries: Map<string, Uint8Array>): ParsedWorkbook {
  const workbookXml = decodeEntry(entries, 'xl/workbook.xml');
  const workbookRelsXml = decodeEntry(entries, 'xl/_rels/workbook.xml.rels');
  const sharedStrings = entries.has('xl/sharedStrings.xml')
    ? parseSharedStrings(decodeEntry(entries, 'xl/sharedStrings.xml'))
    : [];

  const relMap = new Map<string, string>();
  for (const match of workbookRelsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attributes = parseAttributes(match[1]);
    if (attributes.Id && attributes.Target) {
      relMap.set(attributes.Id, attributes.Target.startsWith('xl/') ? attributes.Target : `xl/${attributes.Target}`);
    }
  }

  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)].map((match) => {
    const attributes = parseAttributes(match[1]);
    const relationId = attributes['r:id'];
    const sheetName = attributes.name ?? 'Sheet';
    const target = relationId ? relMap.get(relationId) : null;

    if (!target || !entries.has(target)) {
      return { name: sheetName, rows: [] };
    }

    return {
      name: sheetName,
      rows: parseSheetRows(decodeEntry(entries, target), sharedStrings),
    };
  });

  return { sheets };
}

export async function parseWorkbookBuffer(buffer: ArrayBuffer): Promise<ParsedWorkbook> {
  const entries = await unzipEntries(buffer);
  return parseWorkbookEntries(entries);
}
