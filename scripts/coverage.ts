import { load } from 'cheerio';
import { clean, digest, type Article } from './official-parser.ts';
import type { OfficialBalanceRecord } from '../src/types.ts';

export function coverage(article: Article, html: string, records: OfficialBalanceRecord[]) {
  const $=load(html);
  const root=$(article.sourceKind==='blog'?'.article__content':'.news-detail');
  return root.find('h1,h2,h3,h4,h5,p,li,tr').toArray().flatMap((el,index)=>{
    const node=$(el); if(node.is('p') && node.closest('li,td,th').length) return [];
    const own=node.clone(); own.find('ul,ol,table').remove(); const text=clean(own.text()); if(!text)return [];
    const linked=records.filter(r=>text.includes(clean(r.originalText)) || clean(r.originalText).includes(text));
    const heading=/^h/.test(el.tagName);
    const disclaimer=/^Обращаем ваше внимание|^Обсудить на форуме/.test(text);
    const cumulative=article.id==='695' && /^(-10%|\+20%|-20%|-6%|Таким образом|Инструкции активируются|Для накопления|Новый рекордсмен)/.test(text);
    return [{blockId:digest(`${article.id}|${index}|${text}`).slice(0,16),text,recordIds:linked.map(r=>r.id),
      disposition:linked.length?'record':cumulative?'note':heading||disclaimer?'excluded':'review',
      reason:linked.length?'对应候选记录，最终入库结果见合并报告':cumulative?'695机制触发条件或累计说明已并入对应记录':heading?'结构标题':disclaimer?'免责声明/讨论入口':'尚未可靠对应记录；包括新舰介绍、活动及潜在漏项，需审核'}];
  });
}
