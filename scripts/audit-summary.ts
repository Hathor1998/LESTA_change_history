import {readFile,writeFile} from 'node:fs/promises';
import type {OfficialBalanceDatabase,OfficialBalanceRecord} from '../src/types.ts';
import type {Article} from './official-parser.ts';
const dir='outputs/official-review';
const articles=JSON.parse(await readFile(`${dir}/articles.json`,'utf8')) as Article[];
const db=JSON.parse(await readFile('data/database/korabli-official.json','utf8')) as OfficialBalanceDatabase;
const audit=JSON.parse(await readFile(`${dir}/audit-candidates.json`,'utf8')) as {
  added:OfficialBalanceRecord[]; conflicts:{candidate:OfficialBalanceRecord}[];pending:{candidate:OfficialBalanceRecord}[];
};
const coverage=JSON.parse(await readFile(`${dir}/coverage.json`,'utf8')) as {article:Article;blocks:{disposition:string}[]}[];
const rows=articles.map(a=>({id:a.id,title:a.title,url:a.url,
  stored:db.records.filter(r=>r.announcementId===a.id||r.sources?.some(s=>s.announcementId===a.id)).length,
  candidates:audit.added.filter(r=>r.announcementId===a.id).length,
  conflicts:audit.conflicts.filter(r=>r.candidate.announcementId===a.id).length,
  pending:audit.pending.filter(r=>r.candidate.announcementId===a.id).length,
  blocks:coverage.find(c=>c.article.id===a.id)?.blocks.filter(b=>b.disposition==='review').length??0,
}));
const md=`# 公告复查报告\n\n复查 ${articles.length} 篇公告。候选 ${audit.added.length} 条，冲突候选 ${audit.conflicts.length} 条，身份等待审 ${audit.pending.length} 条。\n\n这些不是已确认漏项数量：含新舰初始参数、重复表达、单位差异、旧记录拆分和无关内容。未自动入库。\n\n## 本轮已核实\n\n- 697：22项已导入。三笠04按用户确认采用官网1.9→1.8，NGA差异保留。\n- 692：补入民主德国、布达佩斯精度调整。\n- 690：补入赤城常规轰炸机投弹精度降低约20%。\n- 689：补入纳瓦林3项副炮参数，整理已有伤害值；修正正式段落沿用测试状态以及HTML实体船名。\n\n## 仍待处理\n\n- 681：潜艇指挥官技能新旧对照表，当前解析器未生成记录，需要专用表格解析和中文逐项核验。\n- 693：多项候选实际已在人工26.8记录中，需要合并来源而非重复追加。\n- 697：通用解析器与已审核的负数加成/中文单位仍会产生重复冲突提示；已审核数据不覆盖。\n- 其余候选见JSON明细和逐块覆盖清单；不能宣称两年数据已完全补齐。\n\n## 同步故障\n\nActions #66日志确认官网新闻列表请求网络失败。现已隔离来源与单篇失败，历史保留，并上传审查附件；两个来源都不可用时明确失败。网络连通性本身仍取决于GitHub运行器。\n\n## 逐篇清单\n\n| 公告 | 库内关联记录 | 新候选 | 冲突 | 待审 | 未匹配块 | 标题 |\n|---|---:|---:|---:|---:|---:|---|\n${rows.map(r=>`| [${r.id}](${r.url}) | ${r.stored} | ${r.candidates} | ${r.conflicts} | ${r.pending} | ${r.blocks} | ${r.title.replace(/\|/g,'/')} |`).join('\n')}\n`;
await writeFile(`${dir}/audit-summary.md`,md);
await writeFile(`${dir}/audit-summary.json`,JSON.stringify(rows,null,2)+'\n');
console.log(`Audit summary: ${articles.length} articles, ${audit.added.length} candidates, ${audit.conflicts.length} conflicts`);
