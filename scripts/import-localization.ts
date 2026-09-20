import { readFile, writeFile } from 'node:fs/promises';
import { readMo } from './ship-localization.ts';
const input=process.argv[2]??'E:/Download/8863954.0.mo';
const dictionary=readMo(await readFile(input));
await writeFile('data/database/ship-localization.json',JSON.stringify(dictionary,null,2)+'\n');
console.log(`Imported ${Object.keys(dictionary).length} ship localization keys.`);
