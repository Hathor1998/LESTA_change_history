import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { translationLookup } from './official-vocabulary.ts';
import type { OfficialBalanceRecord, GeneratedBalanceData } from '../src/types.ts';
import type { ReviewEntry } from './reconcile-official.ts';

const dir='outputs/official-review';
const report=JSON.parse(await readFile(`${dir}/review.json`,'utf8')) as {
  generatedAt:string; baselineCount:number; recordCount:number; added:OfficialBalanceRecord[];
  merged:ReviewEntry[]; conflicts:ReviewEntry[]; pending:ReviewEntry[];
  analysisReview:OfficialBalanceRecord[]; parseIssues:Array<{reason:string;text:string;sourceUrl:string}>; legacyUnknownVersions:string[];
};
const translations=JSON.parse(await readFile('data/database/korabli-zh.json','utf8')).translations;
const translate=translationLookup(translations);
const generated=JSON.parse(await readFile('src/data/generated/balanceChanges.json','utf8')) as GeneratedBalanceData;
const identities=JSON.parse(await readFile('data/database/ship-identities.json','utf8')) as Array<{shipId:string;name:string;originalNames:string[];searchAliases:string[];currentShipStatus:string}>;
const coverage=JSON.parse(await readFile(`${dir}/coverage.json`,'utf8')) as Array<{article:{id:string};blocks:Array<{disposition:string}>}>;
const coverageCounts=coverage.flatMap(a=>a.blocks).reduce((counts,b)=>({...counts,[b.disposition]:(counts[b.disposition]??0)+1}),{} as Record<string,number>);
const auditBaseline=await readFile(`${dir}/audit-baseline.json`,'utf8').then(s=>JSON.parse(s).records.length as number).catch(()=>report.baselineCount);
const uncertainNames=identities.filter(s=>!/[\u3400-\u9fff]/.test(s.name));
const untranslated=generated.records.flatMap(r=>(['targetName','canonicalName','attribute','oldValue','newValue','notes'] as const).filter(k=>/[\u0400-\u04ff]/.test(r[k])).map(k=>({id:r.id,targetName:r.targetName,field:k,value:r[k]})));
const escaped=(s:string)=>s.replace(/\|/g,'\\|').replace(/\s+/g,' ');
const row=(r:OfficialBalanceRecord)=>[r.version,translate(r.targetName),r.shipStatus==='test'?'测试':'正式',translate(r.attribute),translate(r.oldValue),translate(r.newValue),r.trend].map(escaped).join(' | ');
const table=(rs:OfficialBalanceRecord[])=>['版本 | 舰船/目标 | 阶段 | 属性 | 原值 | 新值 | 判定','--- | --- | --- | --- | --- | --- | ---',...rs.map(row)].join('\n');
const lines=[
  '# 本地数据更新审核',`生成时间：${report.generatedAt}`,`当前版本：${generated.meta.currentVersion}。仅本地构建，未提交、未推送、未触发部署。`,
  '## 汇总',`- 原有 ${report.baselineCount} 条，现有 ${report.recordCount} 条；新增 ${report.added.length} 条。`,
  `- 本轮开始时 ${auditBaseline} 条，累计新增 ${report.recordCount-auditBaseline} 条；上行“新增”仅表示最近一次同步（重复执行应为0）。`,
  `- 已检查 ${coverage.length} 篇文章，逐块结果：${JSON.stringify(coverageCounts)}。待审块不能当作已解决漏项。`,
  `- ${uncertainNames.length} 个舰船名称未确认中文，${identities.filter(s=>s.currentShipStatus==='unknown').length} 个身份缺少可确认上线证据。`,
  '## 施瓦本状态核实','695 的10条改动已收录。其关联官网26.8页面将施瓦本列为“Новые корабли для тестирования”（新增测试舰船），所以保留测试状态。四项累计效果是备注，不重复计数。',
  `- 合并 ${report.merged.length} 条候选；冲突 ${report.conflicts.length} 条；身份待审 ${report.pending.length} 条；解析问题 ${report.parseIssues.length} 条。`,
  `- 新增趋势待审 ${report.analysisReview.length} 条；展示字段俄文残留 ${untranslated.length} 项。`,
  `- ${report.legacyUnknownVersions.length} 条历史记录版本无明确证据，保留为“待确认”，没有猜测映射。`,
  '## 新增记录',table(report.added),'## 冲突：保持原值，不覆盖',
  ...report.conflicts.map(x=>`### ${translate(x.candidate.targetName)} / ${x.candidate.version}\n${x.reason}\n\n现有：${translate(x.existing!.attribute)}，${translate(x.existing!.oldValue)} → ${translate(x.existing!.newValue)}\n\n官网候选：${translate(x.candidate.attribute)}，${translate(x.candidate.oldValue)} → ${translate(x.candidate.newValue)}\n\n原文：${x.candidate.originalText}\n\n[公告](${x.candidate.sourceUrl})`),
  '## 趋势需人工确认',table(report.analysisReview),
  '## 翻译说明','新字段沿用游戏词典、用户提供的中文和本地翻译网关。无俄文残留不代表每个术语都已经人工审核。',
  ...untranslated.map(x=>`- ${x.targetName} / ${x.field}: ${x.value}`),
  '## 未解析与搁置候选',...report.parseIssues.map(x=>`- ${x.reason}: ${x.text} (${x.sourceUrl})`),...report.pending.map(x=>`- ${x.reason}: ${x.candidate.targetName} / ${x.candidate.originalText}`),
  '## 追溯','review.json 包含完整原文、来源和逐条合并结果；snapshots/ 保留本次抓取的原始页面。待确认后再手动发布。',
];
await mkdir(dir,{recursive:true});
await writeFile(`${dir}/README.md`,lines.join('\n\n')+'\n','utf8');
await writeFile(`${dir}/translation-review.json`,JSON.stringify({untranslated,uncertainNames,identities},null,2)+'\n','utf8');
console.log(`Review report: ${dir}/README.md; Cyrillic display fields: ${untranslated.length}`);
