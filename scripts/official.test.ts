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
import { readMo } from './ship-localization.ts';
import { coverage } from './coverage.ts';
import { parsePublicTest2610 } from './import-public-test-2610.ts';

const article:Article={id:'portal-test',sourceKind:'portal',url:'https://korabli.su/ru/news/game-updates/test/',title:'Обновление 26.9',publishedAt:'2026-09-01T00:00:00Z'};

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
