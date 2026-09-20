import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeCategoryRows, readSiteConfig, writeSiteConfig } from './data-lib.ts';
import { parseOfficial, clean, type Article, type ParseIssue } from './official-parser.ts';
import { reviewedTranslations } from './official-vocabulary.ts';
import { reconcile } from './reconcile-official.ts';
import { coverage } from './coverage.ts';
import { explicitVersion, normalizeTier } from '../src/utils/normalization.ts';
import type { OfficialBalanceDatabase, ChineseTranslationDatabase, ChangeCategory } from '../src/types.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dbPath = path.join(root,'data/database/korabli-official.json');
const output = path.join(root,'outputs/official-review');

export async function fetchText(url:string):Promise<string> {
  let error:unknown;
  for (let attempt=0;attempt<3;attempt++) {
    try {
      if (process.platform === 'win32') {
        // Use the Windows system proxy, which Node fetch does not inherit.
        const {stdout}=await promisify(execFile)('pwsh',['-NoProfile','-Command',
          '[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); $ErrorActionPreference="Stop"; $r=Invoke-WebRequest -Uri $env:WOWS_FETCH_URL -Headers @{"X-Requested-With"="XMLHttpRequest"} -TimeoutSec 40; if($r.Content -is [byte[]]){[Text.Encoding]::UTF8.GetString($r.Content)}else{$r.Content}'
        ],{env:{...process.env,WOWS_FETCH_URL:url},windowsHide:true,timeout:45000,maxBuffer:32*1024*1024,encoding:'utf8'});
        return stdout;
      }
      const response = await fetch(url,{headers:{'X-Requested-With':'XMLHttpRequest','User-Agent':'WoWS-change-history/2.0'},signal:AbortSignal.timeout(30000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch(e) {error=e; if(attempt<2) await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
  }
  throw new Error(`Fetch failed: ${url}: ${String(error)}`);
}

async function discoverBlog(since:Date):Promise<Article[]> {
  const results = new Map<string,Article>();
  const max = Number(process.env.KORABLI_MAX_PAGES ?? 80);
  for(let page=1;page<=max;page++) {
    const $ = load(await fetchText(`https://blog.korabli.su/?page=${page}`));
    const cards = $('article');
    if(!cards.length) throw new Error(`Blog listing is empty or changed (page ${page}); no data written.`);
    let oldest = Infinity;
    cards.each((_,el)=>{
      const card=$(el), url=card.find('a[href*="/blog/"]').first().attr('href');
      const time=Number(card.find('time').attr('data-timestamp'))*1000;
      const title=clean(card.find('.article__title').text());
      if(!url || !Number.isFinite(time)) return;
      oldest=Math.min(oldest,time);
      if(time<since.getTime()) return;
      const id=url.match(/\/blog\/(\d+)/)?.[1];
      if(id) results.set(id,{id,url:new URL(url,'https://blog.korabli.su').href,title,publishedAt:new Date(time).toISOString(),sourceKind:'blog'});
    });
    if(oldest<since.getTime()) return [...results.values()];
  }
  throw new Error('Blog discovery hit the page limit before the date boundary.');
}

async function discoverPortal():Promise<Article[]> {
  const result:Article[]=[];
  for(let page=1;page<=20;page++) {
    const payload=JSON.parse(await fetchText(`https://korabli.su/ru/news/all/?page=${page}&category=game-updates&initial=true`)) as {news:Array<{id:number;link:string;title:string;publication_start:number}>;has_next:boolean};
    if(!Array.isArray(payload.news) || !payload.news.length) throw new Error('Portal listing is empty or changed.');
    let older=false;
    for(const n of payload.news) {
      const version=explicitVersion(n.title);
      if(!version) continue;
      const [major,minor]=version.split('.').map(Number);
      if(major<26 || (major===26 && minor<9)) {older=true;continue;}
      const url=new URL(n.link,'https://korabli.su');
      if(url.origin!=='https://korabli.su' || !url.pathname.startsWith('/ru/news/game-updates/')) continue;
      result.push({id:`portal-${n.id}`,url:url.href,title:n.title,publishedAt:new Date(n.publication_start*1000).toISOString(),sourceKind:'portal'});
    }
    if(older || !payload.has_next) return result;
  }
  throw new Error('Portal discovery exceeded the page limit.');
}

async function main() {
  const original=JSON.parse(await readFile(process.env.KORABLI_BASELINE ?? dbPath,'utf8')) as OfficialBalanceDatabase;
  const dictionary=JSON.parse(await readFile(path.join(root,'data/database/korabli-zh.json'),'utf8')) as ChineseTranslationDatabase;
  const translations={...dictionary.translations,...reviewedTranslations};
  const now=new Date(); const days=Number(process.env.KORABLI_DAYS ?? 730);
  if(!Number.isFinite(days) || days<=0) throw new Error('KORABLI_DAYS must be positive.');
  const since=new Date(now.getTime()-days*86400000);
  const replay=process.argv.includes('--replay');
  const replayDir=process.env.KORABLI_REPLAY_DIR ?? output;
  const articles:Article[]=replay ? JSON.parse(await readFile(path.join(replayDir,'articles.json'),'utf8')) : [...await discoverBlog(since),...await discoverPortal()];
  console.log(`Discovered ${articles.length} blog/portal announcements.`);
  const announcements=new Map(original.announcements.map(a=>[a.id,{...a,sourceKind:a.sourceKind ?? (a.url.startsWith('manual:')?'manual' as const:'blog' as const)}]));
  const baseline=original.records.map(r=>({...r,tier:normalizeTier(r.tier),version:/^\d{4}\./.test(r.version)?explicitVersion(announcements.get(r.announcementId)?.title ?? '') ?? '待确认':r.version}));
  const incoming:OfficialBalanceDatabase['records']=[];
  const issues:ParseIssue[]=[];
  const coverageReport:unknown[]=[];
  await mkdir(path.join(output,'snapshots'),{recursive:true});
  if(!replay) await writeFile(path.join(output,'articles.json'),JSON.stringify(articles,null,2),'utf8');
  if (process.argv.includes('--audit-only')) {
    let next = 0;
    await Promise.all(Array.from({length:3},async()=>{
      while(next<articles.length) {
        const article=articles[next++];
        const file=path.join(output,'snapshots',`${article.id}.html`);
        const url=article.sourceKind==='portal'?`${article.url}?pjax=1&consumer=pc-browser`:article.url;
        await writeFile(file,await fetchText(url),'utf8');
        console.log(`Captured ${article.id}: ${article.title}`);
      }
    }));
    console.log('Audit snapshots captured. Source database unchanged.');
    return;
  }
  for(const article of articles) {
    // Keep historical reviewed blog records. Portal corrections are always rechecked.
    const url=article.sourceKind==='portal'?`${article.url}?pjax=1&consumer=pc-browser`:article.url;
    const html=replay ? await readFile(path.join(replayDir,'snapshots',`${article.id}.html`),'utf8') : await fetchText(url);
    const parsed=parseOfficial(article,html,baseline,translations);
    coverageReport.push({article,blocks:coverage(article,html,parsed.records)});
    await writeFile(path.join(output,'snapshots',`${article.id}.html`),html,'utf8');
    announcements.set(article.id,{...parsed.announcement,sourceKind:article.sourceKind,parserVersion:3});
    incoming.push(...parsed.records); issues.push(...parsed.issues);
    console.log(`${article.id}: ${parsed.records.length} candidate records, ${parsed.issues.length} issues`);
  }
  const result=reconcile(baseline,incoming,translations);
  await writeFile(path.join(output,'coverage.json'),JSON.stringify(coverageReport,null,2)+'\n','utf8');
  if(process.argv.includes('--review-only')) {
    await writeFile(path.join(output,'audit-candidates.json'),JSON.stringify(result,null,2)+'\n','utf8');
    console.log(`Review only: ${result.added.length} new candidates; ${result.conflicts.length} conflicts. Source unchanged.`);
    return;
  }
  // Re-parsing old HTML can expose differently segmented historical changes.
  // Never publish these as new events until the candidate is reviewed.
  const unreviewed=result.added.filter(r=>r.announcementId!=='695');
  const heldIds=new Set(unreviewed.map(r=>r.id));
  result.records=result.records.filter(r=>!heldIds.has(r.id));
  result.added=result.added.filter(r=>!heldIds.has(r.id));
  result.pending.push(...unreviewed.map(candidate=>({candidate,reason:'全量复查新增候选：需确认漏项/拆分/重复及翻译后再入库'})));
  for(const a of announcements.values()) {
    a.recordIds=result.records.filter(r=>r.announcementId===a.id || r.sources?.some(s=>s.announcementId===a.id)).map(r=>r.id);
  }
  const database:OfficialBalanceDatabase={...original,schemaVersion:2,source:'korabli-multi-source',syncedAt:now.toISOString(),rangeEnd:now.toISOString(),announcements:[...announcements.values()],records:result.records};
  const report={generatedAt:now.toISOString(),scope:'Portal 26.9+; blog existing two-year range; local only',baselineCount:original.records.length,recordCount:result.records.length,added:result.added,merged:result.merged,conflicts:result.conflicts,pending:result.pending,parseIssues:issues,analysisReview:result.added.filter(r=>r.analysisConfidence!=='high'),legacyUnknownVersions:baseline.filter(r=>r.version==='待确认').map(r=>r.id)};
  // Finish every network read and reconciliation before replacing source files.
  await writeFile(path.join(output,'review.json'),JSON.stringify(report,null,2)+'\n','utf8');
  await writeFile(dbPath,JSON.stringify(database,null,2)+'\n','utf8');
  for(const category of ['ship','mechanic','misc'] as ChangeCategory[]) await writeCategoryRows(category,database.records.filter(r=>r.category===category));
  const site=await readSiteConfig();
  await writeSiteConfig({...site,lastUpdated:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(now)});
  console.log(`Local sync: ${result.added.length} added; ${result.merged.length} merged; ${result.conflicts.length} conflicts; ${result.pending.length} pending. Report: outputs/official-review/review.json`);
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(e=>{console.error(e);process.exitCode=1;});
