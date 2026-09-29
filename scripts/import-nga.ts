import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load } from 'cheerio';
import { digest } from './official-parser.ts';
import { reviewedNgaRecords, resolvedDiscrepancy, ngaUrl, officialUrl, title } from './nga-47645187.ts';
import { writeCategoryRows, readSiteConfig, writeSiteConfig } from './data-lib.ts';
import type { OfficialBalanceRecord, OfficialBalanceDatabase } from '../src/types.ts';

export function mergeReviewedNga(existing: OfficialBalanceRecord[], incoming: OfficialBalanceRecord[]) {
  const records = structuredClone(existing);
  const added: string[] = [], merged: string[] = [];
  for (const candidate of incoming) {
    const matches = records.filter(r => r.id === candidate.id ||
      (r.announcementId === candidate.announcementId && r.targetName === candidate.targetName &&
       r.nation === candidate.nation && r.tier === candidate.tier && r.type === candidate.type &&
       r.shipStatus === candidate.shipStatus && r.changeStage === candidate.changeStage &&
       (r.originalText === candidate.originalText || r.attribute === candidate.attribute)));
    if (matches.length > 1) throw new Error(`Ambiguous existing rows: ${candidate.targetName}/${candidate.attribute}`);
    const prior = matches[0];
    if (prior) {
      if (prior.oldValue !== candidate.oldValue || prior.newValue !== candidate.newValue) throw new Error(`Existing value conflict: ${candidate.targetName}/${candidate.attribute}; no source files written`);
      prior.sources = [...new Map([...(prior.sources ?? []), ...candidate.sources!].map(s=>[`${s.announcementId}|${s.originalText}`,s])).values()];
      if (!prior.notes.includes(ngaUrl)) prior.notes += `\n${candidate.notes}`;
      merged.push(prior.id);
    } else { records.push(candidate); added.push(candidate.id); }
  }
  return {records, added, merged};
}

export function verifyOfficial(html: string) {
  const dom = load(html); dom('script,style').remove();
  const body = dom('body').text().replace(/\s+/g,' ').trim();
  if (!body.includes('Обновление 26.10') || !body.includes('29.09.2026')) throw new Error('Wrong official announcement');
  const sections = new Map<string,string[]>();
  let ship = '';
  dom('.article__content').children().each((_,element)=>{
    const node=dom(element), entities=node.find('span.ship');
    const residue=node.clone(); residue.find('span.ship').remove();
    if(entities.length===1 && !residue.text().trim()) {
      ship=entities.text().trim().replace(/^[IVX]+\s+/, '');
      if(!sections.has(ship)) sections.set(ship,[]);
    } else if(ship) sections.get(ship)!.push(node.text().replace(/\s+/g,' ').trim());
  });
  for (const record of reviewedNgaRecords()) {
    if (!sections.get(record.targetName)?.some(text=>text.includes(record.originalText))) {
      throw new Error(`Official ship section changed: ${record.targetName}/${record.attribute}`);
    }
  }
}

async function main() {
  const dir = 'outputs/nga-review';
  const response = await fetch(officialUrl, {signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`Official source unavailable (${response.status}); no files written`);
  const html = await response.text(); verifyOfficial(html);
  const dbPath = 'data/database/korabli-official.json';
  const database = JSON.parse(await readFile(dbPath,'utf8')) as OfficialBalanceDatabase;
  const incoming = reviewedNgaRecords();
  const result = mergeReviewedNga(database.records, incoming);
  database.records = result.records;
  for (const announcement of [
    {id:'697',sourceKind:'blog' as const,url:officialUrl,title:'Обновление 26.10 — изменения тестовых кораблей',publishedAt:incoming[0].publishedAt,contentHash:digest(html)},
    {id:'nga-47645187',sourceKind:'nga' as const,url:ngaUrl,title,publishedAt:'2026-09-29T23:58:00+08:00',contentHash:digest(JSON.stringify(incoming))},
  ]) {
    const recordIds = database.records.filter(r=>r.announcementId===announcement.id||r.sources?.some(s=>s.announcementId===announcement.id)).map(r=>r.id);
    const index = database.announcements.findIndex(a=>a.id===announcement.id);
    if (index < 0) database.announcements.push({...announcement,recordIds});
    else database.announcements[index] = {...database.announcements[index],...announcement,recordIds};
  }
  await mkdir(dir,{recursive:true});
  await writeFile(`${dir}/official-697.html`,html);
  await writeFile(`${dir}/review.json`,JSON.stringify({source:ngaUrl,added:result.added,merged:result.merged,pending:[],resolvedDiscrepancies:[resolvedDiscrepancy],records:incoming},null,2)+'\n');
  await writeFile(`${dir}/README.md`, `# NGA 47645187 核对结果\n\n译者：ViisasSusi。8艘舰船、22项改动全部接纳。\n\n本次新增 ${result.added.length} 条，已存在 ${result.merged.length} 条。重复运行新增应为0。\n\n三笠04弹着群系数按用户确认采用官网1.9→1.8；NGA的1.8→1.65保留为来源差异。\n\n施瓦本保留第三层和第四层各4项效果；进度17%→13%为削弱，8项加成为增强。\n\n[中文来源](${ngaUrl}) · [官方公告](${officialUrl})\n`);
  await writeFile(dbPath,JSON.stringify(database,null,2)+'\n');
  await writeCategoryRows('ship',database.records.filter(r=>r.category==='ship'));
  if (result.added.length) {const config=await readSiteConfig();await writeSiteConfig({...config,lastUpdated:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date())});}
  console.log(`NGA: ${result.added.length} added, ${result.merged.length} existing, 0 pending conflicts. Site version unchanged.`);
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(e=>{console.error(e);process.exitCode=1;});
