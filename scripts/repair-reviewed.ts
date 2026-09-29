import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {load} from 'cheerio';
import {parseOfficial, type Article} from './official-parser.ts';
import {writeCategoryRows} from './data-lib.ts';
import type {OfficialBalanceDatabase, ChangeTrend} from '../src/types.ts';

// Explicitly reviewed omissions only. The full audit queue is not auto-published.
const additions: [string,string,string,string,string,string,ChangeTrend][] = [
  ['692','ГДР','идентичны крейсеру Azuma','主炮精度','—','提升至吾妻（Azuma）水准','buff'],
  ['692','Budapest','идентичны Ohio','主炮精度','—','提升至俄亥俄（Ohio）水准','buff'],
  ['690','Akagi','Снижена точность сброса бомб','常规轰炸机投弹精度','—','降低约20%','nerf'],
  ['689','Наварин','Бронепробитие снаряда','双联130毫米副炮高爆弹穿深','—','22 毫米','adjustment'],
  ['689','Наварин','Начальная скорость полёта снаряда','双联130毫米副炮高爆弹初速','—','950 米/秒','adjustment'],
  ['689','Наварин','Шанс поджога','双联130毫米副炮高爆弹起火率','—','8%','adjustment'],
];

const dbPath='data/database/korabli-official.json';
const database=JSON.parse(await readFile(dbPath,'utf8')) as OfficialBalanceDatabase;
const articles=JSON.parse(await readFile('outputs/official-review/articles.json','utf8')) as Article[];
const added:string[]=[], corrected:string[]=[];
const parsed = new Map<string,ReturnType<typeof parseOfficial>>();
for(const id of ['689','690','692']) {
  const article=articles.find(a=>a.id===id);
  if(!article) throw new Error(`Missing audited article ${id}`);
  parsed.set(id,parseOfficial(article,await readFile(`outputs/official-review/snapshots/${id}.html`,'utf8'),database.records,{}));
}
for(const [id,ship,marker,attribute,oldValue,newValue,trend] of additions) {
  const candidates=parsed.get(id)!.records.filter(r=>r.targetName===ship&&r.originalText.includes(marker));
  if(candidates.length!==1) throw new Error(`Review source changed: ${id}/${ship}/${marker}`);
  const candidate=candidates[0];
  const prior=database.records.find(r=>r.id===candidate.id || (r.announcementId===id&&r.targetName===ship&&r.attribute===attribute));
  if(prior) {
    if(prior.oldValue!==oldValue||prior.newValue!==newValue) throw new Error(`Value conflict: ${prior.id}`);
    continue;
  }
  const shipStatus=id==='689'?'released':candidate.shipStatus;
  database.records.push({...candidate,attribute,oldValue,newValue,trend,shipStatus,tags:shipStatus==='released'?'released-ship':'test-ship',analysisConfidence:'high',analysisRule:'reviewed-2026-09-30',notes:`官方公告：${candidate.sourceUrl}\n人工复查补入；未公布的旧值保留为未知，不推断数值增减。`});
  added.push(candidate.id);
}
// Correct legacy HTML-encoded names and section leakage, preserving IDs and source text.
for(const row of database.records.filter(r=>r.announcementId==='689')) {
  if(!/Bol|Наварин/.test(row.targetName)) continue;
  const before=JSON.stringify(row);
  row.targetName=load(`<span>${row.targetName}</span>`)('span').text();
  row.canonicalName=load(`<span>${row.canonicalName}</span>`)('span').text();
  row.shipStatus='released'; row.tags=row.tags.replace(/test-ship/g,'released-ship');
  if(row.targetName==='Наварин'&&row.originalText.includes('1900')&&row.oldValue==='—'&&row.newValue==='—') {
    row.attribute='双联130毫米副炮高爆弹伤害'; row.newValue='1900';
    row.trend='adjustment';
    row.notes+='\n复查689：替换弹种后的参数，旧值未知；其余三项参数另列。';
  }
  if(before!==JSON.stringify(row)) corrected.push(row.id);
}
for(const a of database.announcements) a.recordIds=database.records.filter(r=>r.announcementId===a.id||r.sources?.some(s=>s.announcementId===a.id)).map(r=>r.id);
await mkdir('outputs/official-review',{recursive:true});
await writeFile('outputs/official-review/repaired.json',JSON.stringify({added,corrected},null,2)+'\n');
await writeFile(dbPath,JSON.stringify(database,null,2)+'\n');
await writeCategoryRows('ship',database.records.filter(r=>r.category==='ship'));
console.log(`Reviewed repairs: ${added.length} added, ${corrected.length} corrected`);
