import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOfficial, parseChange, analyze, type Article } from './official-parser.ts';
import { reconcile } from './reconcile-official.ts';
import { normalizeTier, explicitVersion } from '../src/utils/normalization.ts';
import { manualRecords } from './manual-updates.ts';
import { reviewedTranslations } from './official-vocabulary.ts';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { schwaben695 } from './schwaben.ts';
import { readMo, resolveLocalizedName, isShipName } from './ship-localization.ts';

test('ship localization uses exact constrained keys and rejects equipment and ambiguous rules',()=>{
  const dict={'IDS_PWSC109':'西福尔','IDS_PWSC110':'君王','IDS_PGSD516':'卡尔·冯·勋伯格','IDS_PJUH105':'三笠 / 中口径炮：穿甲弹'};
  const rule={sourceNames:['Vestfold'],nation:'欧洲',tier:'9',type:'巡洋舰',localizationKey:'IDS_PWSC109'};
  assert.equal(resolveLocalizedName(dict,[rule],['Vestfold'],'欧洲','9','巡洋舰'),'西福尔');
  assert.equal(resolveLocalizedName(dict,[rule],['Vestfold'],'欧洲','10','巡洋舰'),undefined);
  assert.equal(resolveLocalizedName(dict,[rule],['Vestfold'],'日本','9','巡洋舰'),undefined);
  assert.equal(resolveLocalizedName(dict,[rule],['Vestfold'],'欧洲','9','战列舰'),undefined);
  const german={...rule,sourceNames:['Karl von Schönberg'],nation:'德国',tier:'6',type:'驱逐舰',localizationKey:'IDS_PGSD516'};
  assert.equal(resolveLocalizedName(dict,[german],['Karl von Sch&ouml;nberg'],'德国','6','驱逐舰'),'卡尔·冯·勋伯格');
  assert.throws(()=>resolveLocalizedName(dict,[rule,{...rule,localizationKey:'IDS_PWSC110'}],['Vestfold'],'欧洲','9','巡洋舰'),/Ambiguous/);
  assert.equal(isShipName(dict.IDS_PJUH105),false);
  assert.throws(()=>resolveLocalizedName(dict,[{...rule,localizationKey:'IDS_PJUH105'}],['Vestfold'],'欧洲','9','巡洋舰'),/invalid/);
});
import { coverage } from './coverage.ts';
import { parsePublicTest2610 } from './import-public-test-2610.ts';
import { reviewedNgaRecords } from './nga-47645187.ts';
import { mergeReviewedNga, verifyOfficial } from './import-nga.ts';
import {parseReviewedBlog698,parseReviewedRelease2610,parseReviewedPublicTest2611,mergeReviewed2610} from './reviewed-2610.ts';
import { parseReviewedBlog699 } from './reviewed-699.ts';
import { parseReviewedRelease2611 } from './reviewed-release-2611.ts';

test('26.11 release keeps public test history and unknown submarine old distance', async () => {
  const html = await readFile('scripts/fixtures/release-2611-balance.html', 'utf8');
  const release = parseReviewedRelease2611(html);
  assert.equal(release.length, 4);
  assert.ok(release.every(r => r.category === 'mechanic' && r.version === '26.11' && !r.changeStage));
  assert.equal(release[0].oldValue, '—');
  assert.equal(release[0].newValue, '2 千米');
  assert.equal(release[0].trend, 'adjustment');
  const history = parseReviewedPublicTest2611(await readFile('scripts/fixtures/public-test-2611-balance.html', 'utf8'));
  const combined = mergeReviewed2610(history, release);
  assert.equal(combined.records.length, 5);
  assert.equal(mergeReviewed2610(combined.records, release).added.length, 0);
  assert.equal(combined.records.filter(r => r.changeStage === 'public-test').length, 1);
  assert.throws(() => parseReviewedRelease2611(html.replace('с двух километров', 'с трёх километров')), /changed/);
  assert.throws(() => parseReviewedRelease2611(html.replace('28.10.2026, 10:00', '29.10.2026, 10:00')), /changed/);
});

test('699 covers shared ship headings, repair and new smoke context with idempotent merge', async () => {
  const html = await readFile('scripts/fixtures/blog-699.html', 'utf8');
  const rows = parseReviewedBlog699(html);
  assert.equal(rows.length, 27);
  assert.equal(new Set(rows.map(r => r.targetName)).size, 11);
  assert.equal(rows.filter(r => r.trend === 'buff').length, 20);
  assert.equal(rows.filter(r => r.trend === 'nerf').length, 6);
  assert.ok(rows.every(r => r.version === '26.11' && r.shipStatus === 'test'));
  const shared = rows.filter(r => ['Konung', 'Troll'].includes(r.targetName));
  assert.equal(shared.length, 2);
  assert.ok(shared.every(r => r.oldValue === '25.7 秒' && r.newValue === '18 秒'));
  const repair = rows.filter(r => r.attribute.startsWith('维修小组-'));
  assert.deepEqual(repair.map(r => r.trend), ['nerf', 'buff', 'buff']);
  assert.ok(repair.every(r => r.originalText.includes('Ремонтная команда')));
  const smoke = rows.filter(r => r.targetName === 'Isonzo');
  assert.equal(smoke.length, 4);
  assert.ok(smoke.every(r => r.oldValue === '—' && r.originalText.includes('В отдельный слот')));
  assert.equal(rows.find(r => r.targetName === '25 de Mayo')?.analysisConfidence, 'medium');
  const merged = mergeReviewed2610([], rows);
  assert.equal(merged.added.length, 27);
  assert.equal(mergeReviewed2610(merged.records, rows).added.length, 0);
  assert.throws(() => parseReviewedBlog699(html.replace('с 12 до 15 с.', 'с 12 до 16 с.')), /changed/);
  assert.throws(() => parseReviewedBlog699(html.replace('Время работы: 30 с.', 'Время работы: 31 с.')), /changed/);
  assert.throws(() => parseReviewedBlog699(html.replace('data-nation="italy"', 'data-nation="uk"')), /identity/);
});

test('October 26.10 reviewed sources retain radar context, bonus direction and release phase',async()=>{
  const blogHtml=await readFile('scripts/fixtures/blog-698.html','utf8');
  const releaseHtml=await readFile('scripts/fixtures/release-2610-submarines.html','utf8');
  const blog=parseReviewedBlog698(blogHtml),release=parseReviewedRelease2610(releaseHtml);
  assert.equal(blog.length,18);assert.equal(new Set(blog.map(r=>r.targetName)).size,6);
  assert.equal(blog.filter(r=>r.trend==='buff').length,12);
  assert.equal(blog.filter(r=>r.trend==='nerf').length,5);
  const radar=blog.filter(r=>r.attribute.startsWith('监视雷达'));
  assert.deepEqual(radar.map(r=>[r.oldValue,r.newValue,r.trend]),[['7 千米','10 千米','buff'],['60 秒','12 秒','nerf'],['2','3','buff']]);
  assert.equal(blog.find(r=>r.targetName==='Songun'&&r.oldValue==='50%')?.trend,'buff');
  assert.equal(release.length,25);assert.equal(release.filter(r=>r.category==='ship').length,20);
  assert.ok(release.filter(r=>r.category==='ship').every(r=>r.shipStatus==='released'&&!r.changeStage));
  const database=JSON.parse(await readFile('data/database/korabli-official.json','utf8'));
  const saved=database.records.filter((r:{announcementId:string})=>r.announcementId==='portal-public-test-2610');
  const history=parsePublicTest2610(`<div publication-start="1789648135.0" class="news-detail">Балансные изменения подводных лодок ${saved.map((r:{originalText:string})=>r.originalText).join(' ')}</div>`,[]);
  const first=mergeReviewed2610(history,[...blog,...release]);
  assert.equal(first.added.length,43);assert.equal(first.records.length,68);
  assert.equal(mergeReviewed2610(first.records,[...blog,...release]).added.length,0);
  assert.throws(()=>parseReviewedBlog698(blogHtml.replace('с 60 до 12','с 60 до 14')),/Unreviewed|changed/);
  assert.throws(()=>parseReviewedRelease2610(releaseHtml.replace('с 375 до 450','с 375 до 460')),/changed/);
  const bad=structuredClone(blog);bad[0].newValue='99 秒';
  assert.throws(()=>mergeReviewed2610(first.records,bad),/conflict/);
  const publicTest=parseReviewedPublicTest2611(await readFile('scripts/fixtures/public-test-2611-balance.html','utf8'));
  assert.equal(publicTest.length,1);assert.equal(publicTest[0].version,'26.11');
  assert.equal(publicTest[0].newValue,'2 千米');assert.equal(publicTest[0].oldValue,'—');
  assert.equal(publicTest[0].changeStage,'public-test');assert.equal(publicTest[0].analysisConfidence,'low');
});

test('NGA reviewed batch retains layers, resolved discrepancy and is idempotent', () => {
  const rows = reviewedNgaRecords();
  assert.equal(rows.length,22);
  assert.equal(new Set(rows.map(r=>r.targetName)).size,8);
  const schwaben = rows.filter(r=>r.targetName==='Schwaben');
  assert.equal(schwaben.length,9);
  assert.equal(schwaben.filter(r=>r.trend==='buff').length,8);
  assert.equal(schwaben.filter(r=>r.attribute.includes('第三层')).length,4);
  assert.equal(schwaben.filter(r=>r.attribute.includes('第四层')).length,4);
  const mikasa = rows.find(r=>r.targetName==="Mikasa '04"&&r.attribute.includes('系数'))!;
  assert.equal(mikasa.oldValue,'1.9');
  assert.equal(mikasa.newValue,'1.8');
  assert.match(mikasa.sources![1].originalText,/1.8 → 1.65/);
  assert.equal(rows.find(r=>r.attribute==='穿甲弹跳弹角度')!.oldValue,'—');
  const first = mergeReviewedNga([],rows);
  const second = mergeReviewedNga(first.records,rows);
  assert.equal(second.added.length,0);
  assert.deepEqual(second.records,first.records);
  const changed = structuredClone(rows); changed[0].newValue='999';
  assert.throws(()=>mergeReviewedNga(first.records,changed),/conflict/);
  assert.deepEqual(first.records,rows);
  assert.throws(()=>verifyOfficial('<html>Access denied</html>'),/Wrong/);
  const html = `<body>Обновление 26.10 29.09.2026<div class="article__content">${[...new Set(rows.map(r=>r.targetName))].map(name=>`<p><span class="ship">${name}</span></p><ul>${rows.filter(r=>r.targetName===name).map(r=>`<li>${r.originalText}</li>`).join('')}</ul>`).join('')}</div></body>`;
  verifyOfficial(html);
  assert.throws(()=>verifyOfficial(html.replace("Mikasa '04",'Wrong ship')),/ship section/);
  const older = {...rows[0],id:'older',announcementId:'696',oldValue:'2',newValue:'1.8'};
  assert.equal(mergeReviewedNga([older],rows).records.length,23);
});

const article:Article={id:'portal-test',sourceKind:'portal',url:'https://korabli.su/ru/news/game-updates/test/',title:'Обновление 26.9',publishedAt:'2026-09-01T00:00:00Z'};

test('mixed article sections reset stage and publication date is not a ship change',()=>{
  const a={...article,sourceKind:'blog' as const};
  const ship=(name:string)=>`<p><span class="ship" data-level="10" data-nation="usa" data-type="cruiser">X ${name}</span></p>`;
  const result=parseOfficial(a,`<div class="article__content"><h4>Изменения тестовых кораблей</h4>${ship('Test')}<ul><li>Время перезарядки уменьшено с 10 до 9 с.</li></ul><h4>Изменения Release</h4>${ship('Release')}<ul><li>Время перезарядки уменьшено с 10 до 9 с.</li></ul><p>Изменения вступят в силу на основном сервере 30 сентября.</p></div>`,[],{});
  assert.deepEqual(result.records.map(r=>r.shipStatus),['test','released']);
});

test('26.10 public-test dataset has 20 ship and 5 system changes with independent phase',async()=>{
  const database=JSON.parse(await readFile('data/database/korabli-official.json','utf8'));
  const saved=database.records.filter((r:{announcementId:string})=>r.announcementId==='portal-public-test-2610');
  const html=`<div publication-start="1789648135.0" class="news-detail">Балансные изменения подводных лодок ${saved.map((r:{originalText:string})=>r.originalText).join(' ')}</div>`;
  const records=parsePublicTest2610(html,database.records);
  assert.equal(records.length,25);
  assert.equal(records.filter(r=>r.category==='ship').length,20);
  assert.equal(records.filter(r=>r.category==='mechanic').length,5);
  assert.ok(records.every(r=>r.version==='26.10'&&r.changeStage==='public-test'));
  assert.equal(records.filter(r=>r.oldValue==='—').length,3);
  assert.equal(records.find(r=>r.targetName==='К-1'&&r.attribute==='最大航速')?.trend,'buff');
  assert.equal(records.filter(r=>r.targetName==='U-796').length,5);
  const released={...records[5],id:'future-release',announcementId:'future-release',changeStage:undefined};
  assert.equal(reconcile([records[5]],[released],{}).records.length,2);
  assert.throws(()=>parsePublicTest2610(html.replace('с 375 до 450','с 375 до 460'),database.records),/Source changed/);
});
const ship=(name:string,id:string)=>`<vue-mk-entity :entity="{id:'${id}',type:'ship'}">VIII ${name}</vue-mk-entity>`;
const parse=(body:string)=>parseOfficial(article,`<div class="news-detail"><h2>Балансировка кораблей</h2>${body}<h2>Сезонные типы боя</h2><p>${ship('Richelieu','1')}</p><ul><li>Урон увеличен с 1 до 2.</li></ul></div>`,manualRecords,reviewedTranslations);

test('695 has ten changes, unknown old values and four cumulative notes, independent test phase',()=>{
  const records=schwaben695('https://blog.korabli.su/blog/695','2026-08-28');
  assert.equal(records.length,10);
  assert.equal(records.filter(r=>r.notes.includes('四次累计')).length,4);
  assert.equal(records.filter(r=>r.oldValue==='—').length,8);
  assert.equal(records[8].newValue,'50 秒'); assert.equal(records[9].trend,'nerf');
  assert.ok(records.every(r=>r.canonicalName==='Schwaben'&&r.shipStatus==='test'));
  assert.equal(reconcile(records,records,{}).added.length,0);
});

test('695 fixed HTML fixture is fully accounted for and changed source is rejected',async()=>{
  const html=await readFile('scripts/fixtures/blog-695.html','utf8');
  const source:Article={...article,id:'695',sourceKind:'blog',title:'Обновление 26.9 — боевые инструкции Schwaben'};
  const parsed=parseOfficial(source,html,[],{});
  assert.equal(parsed.records.length,10);
  assert.equal(coverage(source,html,parsed.records).filter(b=>b.disposition==='review').length,0);
  assert.throws(()=>parseOfficial(source,html.replace('с 35 до 36','с 35 до 38'),[],{}),/695 fixture changed/);
});

test('coverage ledger retains unparsed table and prose for review',()=>{
  const html='<div class="article__content"><h4>Параметры</h4><p>Неизвестная механика корабля</p><table><tr><td>Урон</td><td>100</td></tr></table></div>';
  const rows=coverage({...article,sourceKind:'blog'},html,[]);
  assert.equal(rows.length,3);assert.equal(rows.filter(r=>r.disposition==='review').length,2);
});

test('ship localization rejects truncated or invalid binary',()=>{
  assert.throws(()=>readMo(Buffer.alloc(4)),/Invalid MO/);
  assert.throws(()=>readMo(Buffer.alloc(28)),/Invalid MO/);
});

test('historical context prefix and missing class merge without duplicate IDs',()=>{
  const candidate=schwaben695('https://blog.korabli.su/blog/695','2026-08-28')[8];
  const old={...candidate,id:'legacy',type:'',originalText:`Контекст: ${candidate.originalText}`};
  const merged=reconcile([old],[candidate],{});
  assert.equal(merged.records.length,1);assert.equal(merged.records[0].type,'战列舰');
  assert.equal(merged.records[0].id,'legacy');
});

test('numeric changes: decimals, Latin c, shared units, damage reduction',()=>{
  assert.deepEqual(parseChange('Прогресс за одно попадание: 17%.'),{attribute:'Прогресс за одно попадание',oldValue:'—',newValue:'17%'});
  assert.equal(parseChange('-2,5% к максимальному радиусу рассеивания').newValue,'-2,5%');
  assert.deepEqual(parseChange('Время перезарядки уменьшено с 12,5 до 10,5 с.'),{attribute:'Время перезарядки',oldValue:'12,5',newValue:'10,5 с'});
  assert.equal(parseChange('Урон увеличен c 11 913 до 13 497 ед.').newValue,'13 497 ед');
  assert.equal(analyze(parseChange('Время перезарядки увеличено с 18.5 до 20 с.')).trend,'nerf');
  assert.equal(analyze(parseChange('Количество зарядов снаряжения «Ускорение перезарядки ГК» увеличено с 2 до 3.')).trend,'buff');
  assert.equal(analyze(parseChange('Эффект (снижение урона) уменьшен с –50% до –33%.')).trend,'nerf');
});
test('shared multi-ship changes expand and seasonal modifiers stay outside',()=>{
  const result=parse(`<p>${ship('Richelieu','1')}, ${ship('Champagne','2')}</p><ul><li>Время перезарядки уменьшено с 30 до 29 с.</li></ul>`);
  assert.equal(result.records.length,2); assert.deepEqual(result.records.map(r=>r.targetName),['Richelieu','Champagne']);
});
test('nested consumable children inherit context; concealment notes do not become records',()=>{
  const result=parse(`<p>${ship('Richelieu','1')}</p><ul><li>Заметность с кораблей уменьшена с 14 до 13 км.<ul><li>Соответственно уменьшены другие виды заметности.</li></ul></li><li>Изменены параметры снаряжения «Форсаж»:<ul><li>Время работы увеличено с 120 до 180 с.</li><li>Количество зарядов увеличено с 2 до 3.</li></ul></li></ul>`);
  assert.equal(result.records.length,3); assert.match(result.records[0].notes,/другие виды/); assert.match(result.records[1].attribute,/Форсаж/); assert.match(result.records[2].attribute,/Форсаж/);
});

test('ship headings, paragraph changes and three-column parameter tables retain identity',()=>{
  const result=parse(`<h3>${ship('Richelieu','1')}</h3><p>Время перезарядки уменьшено с 30 до 29 с.</p><h4>Параметры</h4><table><tr><td>Дальность стрельбы</td><td>19 км</td><td>20 км</td></tr></table>`);
  assert.equal(result.records.length,2);
  assert.ok(result.records.every(r=>r.targetName==='Richelieu'));
  assert.equal(result.records[1].newValue,'20 км');
});
test('same-tier identity and values merge, conflicts remain, test history is independent',()=>{
  const existing=manualRecords.find(r=>r.targetName==='迪米特里·顿斯科伊')!;
  const candidate={...existing,id:'new',canonicalName:'Дмитрий Донской',targetName:'Дмитрий Донской',attribute:'Время перезарядки орудий ГК',oldValue:'12,5',newValue:'10,5 с',sourceUrl:article.url,announcementId:article.id};
  const merged=reconcile([existing],[candidate],reviewedTranslations);
  assert.equal(merged.records.length,1); assert.equal(merged.merged.length,1);
  assert.equal(reconcile(merged.records,[candidate],reviewedTranslations).records.length,1);
  const conflict=reconcile([existing],[{...candidate,newValue:'11 с'}],reviewedTranslations);
  assert.equal(conflict.conflicts.length,1); assert.equal(conflict.records[0].newValue,existing.newValue);
  assert.equal(reconcile([existing],[{...candidate,shipStatus:'test'}],reviewedTranslations).records.length,2);
  assert.equal(reconcile([existing],[{...candidate,tier:'8'}],reviewedTranslations).records.length,2);
});
test('no date-as-version, tiers normalized, empty bodies fail without writes',()=>{
  assert.equal(explicitVersion('Балансировка кораблей'),null);
  assert.equal(normalizeTier('IX'),'9'); assert.equal(normalizeTier('⭐'),'11'); assert.equal(normalizeTier('Х'),'10');
  assert.throws(()=>parseOfficial(article,'<html>error</html>',[],{}),/Missing announcement/);
});

test('failed acquisition leaves database, TSVs and site config unchanged',async()=>{
  const files=['data/database/korabli-official.json','data/raw/ship.tsv','data/raw/mechanic.tsv','data/raw/misc.tsv','data/config/site.json'];
  const before=await Promise.all(files.map(p=>readFile(p,'utf8')));
  const temp=await mkdtemp(path.join(tmpdir(),'wows-sync-test-'));
  try {
    await writeFile(path.join(temp,'articles.json'),JSON.stringify([article]));
    await assert.rejects(promisify(execFile)(process.execPath,['--experimental-strip-types','scripts/sync-korabli.ts','--replay'],{env:{...process.env,KORABLI_REPLAY_DIR:temp},windowsHide:true}),/ENOENT/);
    assert.deepEqual(await Promise.all(files.map(p=>readFile(p,'utf8'))),before);
  } finally {
    assert.equal(path.dirname(path.resolve(temp)),path.resolve(tmpdir()));
    await rm(temp,{recursive:true,force:true});
  }
});
import { currentShipStatuses } from './ship-localization.ts';
import { collectSources } from './sync-sources.ts';

test('source failures are isolated and explicitly reported', async () => {
  const result = await collectSources([
    {name:'blog',read:async()=>['697']},
    {name:'portal',read:async()=>{throw new Error('network unavailable');}},
  ]);
  assert.deepEqual(result.items,['697']);
  assert.equal(result.failures[0].source,'portal');
  assert.match(result.failures[0].error,/network unavailable/);
  const failed = await collectSources([{name:'blog',read:async()=>{throw new Error('timeout');}}]);
  assert.equal(failed.items.length,0);
  assert.equal(failed.failures.length,1);
});

test('current ship status aggregates identity history without inventing release evidence', () => {
  const rows: Parameters<typeof currentShipStatuses>[0] = [
    {shipId:'no-test',shipStatus:'unknown',releaseEvidence:[]},
    {shipId:'test-only',shipStatus:'test',releaseEvidence:[]},
    {shipId:'converted',shipStatus:'test',releaseEvidence:[]},
    {shipId:'converted',shipStatus:'released',releaseEvidence:['https://korabli.su/ru/news/game-updates/example/']},
    {shipId:'public-test-released',shipStatus:'released',changeStage:'public-test',releaseEvidence:[]},
    {shipId:'same-name-other-ship',shipStatus:'unknown',releaseEvidence:[]},
    {shipId:'test-only',shipStatus:'released',releaseEvidence:[]},
  ];
  const before = JSON.stringify(rows);
  const statuses = currentShipStatuses(rows);
  assert.equal(statuses.get('no-test'),'released');
  assert.equal(statuses.get('test-only'),'test');
  assert.equal(statuses.get('converted'),'released');
  assert.equal(statuses.get('public-test-released'),'released');
  assert.equal(statuses.get('same-name-other-ship'),'released');
  assert.deepEqual(currentShipStatuses([...rows].reverse()), new Map([...statuses].reverse()));
  assert.equal(JSON.stringify(rows), before);
  // Filtering must consume the already enriched status, not recompute from visible history.
  const enriched = rows.map(row => ({...row,currentShipStatus:statuses.get(row.shipId)}));
  assert.equal(enriched.filter(row=>row.shipId==='converted'&&row.shipStatus==='test')[0].currentShipStatus,'released');
});
