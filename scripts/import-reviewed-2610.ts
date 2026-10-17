import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {digest} from './official-parser.ts';
import {fetchText} from './sync-korabli.ts';
import {writeCategoryRows,readSiteConfig,writeSiteConfig} from './data-lib.ts';
import {parseReviewedBlog698,parseReviewedRelease2610,parseReviewedPublicTest2611,mergeReviewed2610,blog698Url,release2610Url,publicTest2611Url} from './reviewed-2610.ts';
import type {OfficialBalanceDatabase,ChangeCategory} from '../src/types.ts';

const sources=[
  {id:'698',url:blog698Url,title:'Обновление 26.10 - изменение тестовых кораблей',kind:'blog' as const,parse:parseReviewedBlog698},
  {id:'portal-16861',url:release2610Url,title:'Обновление 26.10. Там чудеса, там крейсер бродит…',kind:'portal' as const,parse:parseReviewedRelease2610},
  {id:'portal-public-test-2611',url:publicTest2611Url,title:'Успейте опробовать новинки 26.11 на Общем тесте',kind:'portal' as const,parse:parseReviewedPublicTest2611},
];
const dbPath='data/database/korabli-official.json';
const db=JSON.parse(await readFile(dbPath,'utf8')) as OfficialBalanceDatabase;
const captured=[];
for(const source of sources){
  const html=process.argv.includes('--replay')?await readFile(`outputs/official-review/snapshots/${source.id}.html`,'utf8'):await fetchText(source.kind==='portal'?`${source.url}?pjax=1&consumer=pc-browser`:source.url);
  captured.push({...source,html,records:source.parse(html)});
}
const incoming=captured.flatMap(s=>s.records),result=mergeReviewed2610(db.records,incoming);
db.records=result.records;
for(const source of captured){
  const announcement={id:source.id,url:source.url,title:source.title,sourceKind:source.kind,publishedAt:source.records[0].publishedAt,contentHash:digest(source.html),recordIds:db.records.filter(r=>r.announcementId===source.id||r.sources?.some(s=>s.announcementId===source.id)).map(r=>r.id)};
  const index=db.announcements.findIndex(a=>a.id===source.id);
  if(index<0)db.announcements.push(announcement);else db.announcements[index]={...db.announcements[index],...announcement};
}
const dir='outputs/official-review';await mkdir(`${dir}/snapshots`,{recursive:true});
for(const source of captured)await writeFile(`${dir}/snapshots/${source.id}.html`,source.html);
const now=new Date().toISOString();
await writeFile(`${dir}/update-2026-10.json`,JSON.stringify({reviewedAt:now,added:result.added,verified:incoming.length,blogChanges:18,releaseChanges:25,publicTestChanges:1,conflicts:[],trendReview:incoming.filter(r=>r.analysisConfidence==='low').map(r=>r.id),records:incoming},null,2)+'\n');
await writeFile(dbPath,JSON.stringify(db,null,2)+'\n');
for(const category of ['ship','mechanic','misc'] as ChangeCategory[])await writeCategoryRows(category,db.records.filter(r=>r.category===category));
const site=await readSiteConfig();
const currentVersion=site.currentVersion.split('.').map(Number).reduce((s,n)=>s*100+n,0)>2610?site.currentVersion:'26.10';
await writeSiteConfig({...site,currentVersion,lastUpdated:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date())});
console.log(`Reviewed October update: ${result.added.length} added; ${incoming.length} verified; current version ${currentVersion}.`);
