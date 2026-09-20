import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load } from 'cheerio';
import { clean, digest } from './official-parser.ts';
import { writeCategoryRows, readSiteConfig, writeSiteConfig } from './data-lib.ts';
import type { ChangeCategory, ChangeTrend, OfficialBalanceDatabase, OfficialBalanceRecord } from '../src/types.ts';

const url='https://korabli.su/ru/news/public-test/public-test-2610/';
const announcementId='portal-public-test-2610';
type Row=[string,string,string,string,string,string,ChangeTrend,string];
// Reviewed rows are guarded by the actual source text before any writes.
const rows:Row[]=[
  ['所有潜艇','','','最大深度受到的伤害（原始伤害占比）','10%','20%','nerf','Урон, получаемый подводными лодками на предельной глубине, увеличен с 10 до 20% от изначального.'],
  ['潜艇常规鱼雷（法国除外）','','','鱼雷起爆距离','—','1.5 千米','nerf','Дальность взведения всех термических торпед подводных лодок (кроме подводных лодок Франции) увеличена до 1,5 км.'],
  ['法国潜艇常规鱼雷','','','鱼雷起爆距离','—','1.2 千米','nerf','Дальность взведения термических торпед французских подводных лодок увеличена до 1,2 км.'],
  ['苏联及法国潜艇常规鱼雷','','','鱼雷被发现距离','—','1.4 千米','nerf','Заметность термических торпед подводных лодок СССР и Франции увеличена до 1,4 км.'],
  ['舰载深水炸弹','','','对水面舰与潜艇的杀伤半径（不含空袭）','375 米','450 米','buff','Радиус поражения кораблей и подводных лодок корабельными ГБ (не авиаудар) увеличен с 375 до 450 м.'],
  ['Б-4','苏联','11','基础船体潜航能力','234','162','nerf','Запас автономности базового модуля корпуса уменьшен с 234 до 162 ед.'],
  ['Б-4','苏联','11','水听器作用距离','10 千米','8 千米','nerf','Дальность ШП уменьшена с 10 до 8 км.'],
  ['К-1','苏联','10','基础及可研发鱼雷发射管的鱼雷航速','85 节','80 节','nerf','Скорость торпед у базового и исследуемого модуля ТА уменьшена с 85 до 80 уз.'],
  ['К-1','苏联','10','基础船体潜航能力','221','153','nerf','Запас автономности базового модуля корпуса уменьшен с 221 до 153 ед.'],
  ['К-1','苏联','10','水听器作用距离','10 千米','8 千米','nerf','Дальность шумопеленгатора уменьшена с 10 до 8 км.'],
  ['К-1','苏联','10','最大航速','32.5 节','34 节','buff','Максимальная скорость хода увеличена с 32,5 до 34 уз.'],
  ['Л-20','苏联','8','基础及可研发鱼雷发射管的鱼雷航速','85 节','80 节','nerf','Скорость торпед у базового и исследуемого модуля ТА уменьшена с 85 до 80 уз.'],
  ['Л-20','苏联','8','基础船体潜航能力','177','122','nerf','Запас автономности базового модуля корпуса уменьшен с 177 до 122 ед.'],
  ['Л-20','苏联','8','可研发船体潜航能力','208','144','nerf','Запас автономности исследуемого модуля корпуса уменьшен с 208 до 144 ед.'],
  ['С-1','苏联','6','基础及可研发鱼雷发射管的鱼雷航速','85 节','80 节','nerf','Скорость торпед у базового и исследуемого модуля ТА уменьшена с 85 до 80 уз.'],
  ['С-1','苏联','6','基础船体潜航能力','166','115','nerf','Запас автономности базового модуля корпуса уменьшен с 166 до 115 ед.'],
  ['С-1','苏联','6','可研发船体潜航能力','195','135','nerf','Запас автономности исследуемого модуля корпуса уменьшен с 195 до 135 ед.'],
  ['U-796','德国','11','水底搜索：舰船发现距离','6 千米','5.5 千米','nerf','Дальность обнаружения кораблей уменьшена с 6 до 5,5 км.'],
  ['U-796','德国','11','水底搜索：鱼雷发现距离','4 千米','3.8 千米','nerf','Дальность обнаружения торпед уменьшена с 4 до 3,8 км.'],
  ['U-796','德国','11','水底搜索：水雷发现距离','1 千米','0.95 千米','nerf','Дальность обнаружения мин уменьшена с 1 до 0,95 км.'],
  ['U-796','德国','11','最大航速','34 节','32 节','nerf','Максимальная скорость хода уменьшена с 34 до 32 уз.'],
  ['U-796','德国','11','最大下潜及上浮速度','4.1 米/秒','3.7 米/秒','nerf','Максимальная скорость погружения и всплытия уменьшена с 4,1 до 3,7 м/с.'],
  ['U-2501','德国','10','航速','27 节','29 节','buff','Скорость хода увеличена с 27 до 29 уз.'],
  ["L'Africaine",'法国','8','鱼雷航速','90 节','85 节','nerf','Скорость торпед уменьшена с 90 до 85 уз.'],
  ['Casabianca','法国','10','鱼雷航速','90 节','85 节','nerf','Скорость торпед уменьшена с 90 до 85 уз.'],
];

export function parsePublicTest2610(html:string,known:OfficialBalanceRecord[]) {
  const $=load(html); $('script,style').remove();
  const body=clean($('.news-detail').text());
  const timestamp=Number(html.match(/publication-start="([\d.]+)"/)?.[1]);
  if(!timestamp || !body.includes('Балансные изменения подводных лодок')) throw new Error('Missing public-test body/date');
  const publishedAt=new Date(timestamp*1000).toISOString();
  return rows.map(([targetName,nation,tier,attribute,oldValue,newValue,trend,originalText]):OfficialBalanceRecord=>{
    if(!body.includes(originalText)) throw new Error(`Source changed: ${targetName}: ${originalText}`);
    const status=known.find(r=>r.targetName===targetName&&r.tier===tier&&r.shipStatus==='released')?.shipStatus??'unknown';
    return {id:digest(`${announcementId}|${targetName}|${attribute}`).slice(0,16),category:tier?'ship':'mechanic',targetName,canonicalName:targetName,previousNames:'',nation,tier,type:tier?'潜艇':'',attribute,oldValue,newValue,trend,version:'26.10',shipStatus:status,changeStage:'public-test',tags:'',sourceSheet:announcementId,announcementId,sourceUrl:url,publishedAt,originalText,analysisRule:'reviewed-public-test-2610',analysisConfidence:'high',notes:`26.10 公测，正式服是否采用以最终公告为准。${tier?'':'通用机制，不重复展开到每艘潜艇。'}\n官方公告：${url}`,sources:[{announcementId,url,originalText}]};
  });
}

async function main() {
  const dbPath='data/database/korabli-official.json';
  const database=JSON.parse(await readFile(dbPath,'utf8')) as OfficialBalanceDatabase;
  const html=await readFile(process.argv[2]??'outputs/official-review/public-test-2610.html','utf8');
  const candidates=parsePublicTest2610(html,database.records);
  const added:OfficialBalanceRecord[]=[];
  for(const candidate of candidates) {
    const prior=database.records.find(r=>r.id===candidate.id);
    if(prior && (prior.oldValue!==candidate.oldValue||prior.newValue!==candidate.newValue)) throw new Error(`Conflict: ${candidate.id}; no files written`);
    if(!prior)added.push(candidate);
  }
  database.records.push(...added);
  if(!database.announcements.some(a=>a.id===announcementId))database.announcements.push({id:announcementId,sourceKind:'portal',url,title:'Общий тест 26.10 — балансные изменения подводных лодок',publishedAt:candidates[0].publishedAt,contentHash:digest(html),recordIds:candidates.map(r=>r.id)});
  await writeFile(dbPath,JSON.stringify(database,null,2)+'\n');
  for(const category of ['ship','mechanic','misc'] as ChangeCategory[])await writeCategoryRows(category,database.records.filter(r=>r.category===category));
  const config=await readSiteConfig();await writeSiteConfig({...config,lastUpdated:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date())});
  await writeFile('outputs/official-review/public-test-2610-review.json',JSON.stringify({url,added:added.length,records:candidates},null,2)+'\n');
  console.log(`26.10 public test: ${added.length} added, ${candidates.length} verified; currentVersion unchanged.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});
