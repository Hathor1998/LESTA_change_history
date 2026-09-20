import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { explicitVersion, normalizeTier } from '../src/utils/normalization.ts';
import type { OfficialAnnouncement, OfficialBalanceRecord, ShipStatus } from '../src/types.ts';
import { schwaben695 } from './schwaben.ts';

export type Article = { id: string; url: string; title: string; publishedAt: string; sourceKind: 'blog' | 'portal' };
export type ParseIssue = { sourceUrl: string; text: string; reason: string };
export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
export const nameKey = (text: string) => clean(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[«»"'’‘\s.·-]/g, '').toLowerCase();

const nations: Record<string, string> = { usa:'美国', uk:'英国', germany:'德国', japan:'日本', ussr:'苏联', russia:'苏联', france:'法国', italy:'意大利', pan_asia:'泛亚', pan_america:'泛美', europe:'欧洲', netherlands:'荷兰', spain:'西班牙', commonwealth:'英联邦' };
const types: Record<string, string> = { destroyer:'驱逐舰', cruiser:'巡洋舰', battleship:'战列舰', carrier:'航空母舰', aircarrier:'航空母舰', submarine:'潜艇' };
const nationPrefixes: [string, string][] = [['американ','美国'],['британ','英国'],['немец','德国'],['япон','日本'],['совет','苏联'],['француз','法国'],['итальян','意大利'],['паназиат','泛亚'],['панамерикан','泛美'],['европей','欧洲'],['нидерланд','荷兰'],['испан','西班牙']];
const typePrefixes: [string, string][] = [['подводная лодка','潜艇'],['подлодка','潜艇'],['авианосец','航空母舰'],['эсминец','驱逐舰'],['крейсер','巡洋舰'],['линкор','战列舰']];

export function parseChange(text: string) {
  const line = clean(text).replace(/[–−]/g, '-').replace(/\.$/, '');
  const qualitative: Record<string,[string,string]> = {
    'Точность орудий ГК улучшена до средней для эсминцев на своём уровне':['主炮精度','提升至同级驱逐舰平均水平'],
    '1-я (носовая) и 4-я (кормовая) башни ГК теперь могут вращаться на 360 градусов':['主炮第1、4座炮塔旋转角度','全角度旋转'],
    'Изменена траектория полёта снарядов ГК — она стала более настильной':['主炮炮弹弹道','更平直'],
    'Улучшены характеристики ББ-снарядов — теперь они аналогичны ББ-снарядам X Des Moines':['穿甲弹参数','与得梅因穿甲弹相同'],
    'Улучшены характеристики ББ-снарядов — теперь они аналогичны ББ-снарядам IX Izumo':['穿甲弹参数','与出云穿甲弹相同'],
    'Точность стрельбы орудий ГК повышена до уровня эсминца IX Огненный':['主炮精度','提升至炽热水平'],
  };
  if (qualitative[line]) return {attribute:qualitative[line][0],oldValue:/360/.test(line)?'受限':'—',newValue:qualitative[line][1]};
  if (/^В слот.*Поисковая РЛС/.test(line)) return {attribute:'消耗品栏位',oldValue:'“鱼雷装填助推器”',newValue:'新增“监视雷达”，参数与七月二十日相同'};
  if (/^Изменена траектория.*127мм/.test(line)) return {attribute:'主炮（127毫米）弹道',oldValue:'—',newValue:'更平直，最大射程飞行时间不变'};
  const verb = '(?:уменьшен[аоы]?|увеличен[аоы]?|снижен[аоы]?|повышен[аоы]?|измен[её]н[аоы]?)';
  const ranged = line.match(new RegExp(`^(.+?)\\s+${verb}\\s+(?:с|со|c)\\s+(.+?)\\s+(?:до|на)\\s+(.+?)(?:\\.(?!\\d)|$)`, 'i'));
  if (ranged) return { attribute: ranged[1], oldValue: ranged[2], newValue: ranged[3] };
  const one = line.match(new RegExp(`^(.+?)\\s+(${verb})\\s+(примерно\\s+)?(до|на)\\s+(.+)$`, 'i'));
  if (one) return { attribute: one[1], oldValue: '—', newValue: one[4] === 'до' ? one[5] : `${/уменьш|сниж/i.test(one[2]) ? '-' : '+'}${one[3] ? '~' : ''}${one[5]}` };
  const parameter=line.match(/^(.+?):\s*([+-]?\d[\d\s.,]*(?:%|с|км|мм|ед\.?|узлов)?)/i);
  if(parameter) return {attribute:parameter[1],oldValue:'—',newValue:parameter[2].trim()};
  const effect=line.match(/^([+-]\d+(?:[.,]\d+)?%)\s+к[о]?\s+(.+)$/i);
  if(effect) return {attribute:effect[2],oldValue:'—',newValue:effect[1]};
  return { attribute: line, oldValue: '—', newValue: '—' };
}

export function analyze(change: ReturnType<typeof parseChange>): Pick<OfficialBalanceRecord, 'trend' | 'analysisRule' | 'analysisConfidence'> {
  const number = (s: string) => { const m = s.replace(/\s/g, '').replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };
  const old = number(change.oldValue), next = number(change.newValue);
  const attr = change.attribute.toLowerCase();
  if (old !== null && next !== null) {
    if (/снижение урона|伤害降低/.test(attr)) return {trend:next > old ? 'nerf':'buff',analysisRule:'damage-reduction',analysisConfidence:'high'};
    // Consumable charges/duration must win over the word "reload" inside its name.
    const higher = /^(количество|время работы|время действия)|сигм|бронепробит|боеспособност|максимальный урон|дальность|бонус к скорости|шанс|вероятность|восстановление повреждений|бронирование|задержка до потери/.test(attr);
    const lower = !higher && /перезаряд|заметност|разброс|перекладки|поворота|радиус циркуляции|интервал между/.test(attr);
    if (old === next) return { trend:'neutral', analysisRule:'equal', analysisConfidence:'high' };
    if (higher || lower) return { trend: (next > old) === higher ? 'buff' : 'nerf', analysisRule: higher ? 'higher-is-better' : 'lower-is-better', analysisConfidence:'high' };
  }
  return { trend:'adjustment', analysisRule:'needs-review', analysisConfidence:'low' };
}

export function parseOfficial(article: Article, html: string, known: OfficialBalanceRecord[], translations: Record<string,string>) {
  const $ = load(html);
  $('script,style').remove();
  const issues: ParseIssue[] = [];
  const records: OfficialBalanceRecord[] = [];
  const version = explicitVersion(article.title);
  const root = article.sourceKind === 'blog' ? $('.article__content') : $('.news-detail');
  if (!root.length || clean(root.text()).length < 50) throw new Error(`Missing announcement body: ${article.url}`);
  const contentHash = digest(root.html() ?? '');
  if (article.id === '695') {
    for (const marker of ['Прогресс за одно попадание: 17%', 'с 60 до 50', 'с 35 до 36', '-2,5%', '+20%']) {
      if (!clean(root.text()).includes(marker)) throw new Error(`695 fixture changed: ${marker}`);
    }
    const reviewed = schwaben695(article.url,article.publishedAt);
    const blocks=root.find('p,li').toArray().map(el=>{const own=$(el).clone();own.find('ul,ol').remove();return clean(own.text());});
    for(const record of reviewed) {
      const original=blocks.find(text=>text.includes(record.originalText));
      if(!original) throw new Error(`695 reviewed parameter changed: ${record.originalText}`);
      record.originalText=original;
      record.sources![0].originalText=original;
    }
    return {announcement:{...article,contentHash,recordIds:reviewed.map(r=>r.id)},records:reviewed,issues};
  }
  if (!version) issues.push({sourceUrl:article.url,text:article.title,reason:'没有明确版本号，候选记录不入库'});
  type Context = { name:string; nation:string; tier:string; type:string; entityId?:string };
  const titleMatches=known.filter(r=>r.category==='ship' && r.nation && r.type && r.tier &&
    r.targetName.length>=4 && new RegExp(`(^|[^\\p{L}\\p{N}])${r.targetName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^\\p{L}\\p{N}])`,'iu').test(article.title));
  const titleContexts:Context[]=[];
  for(const name of new Set(titleMatches.map(r=>r.targetName))) {
    const matches=titleMatches.filter(r=>r.targetName===name);
    if(new Set(matches.map(r=>[r.nation,r.tier,r.type].join('|'))).size!==1) continue;
    const r=matches[0];titleContexts.push({name,nation:r.nation,tier:r.tier,type:r.type,entityId:r.entityId});
  }
  let contexts: Context[] = article.sourceKind==='blog'?[...titleContexts]:[];
  let mechanic = '';
  let active = article.sourceKind === 'blog';
  let foundSection = active;
  let status: ShipStatus = /тест/i.test(article.title) ? 'test' : 'released';
  let last: OfficialBalanceRecord[] = [];
  let parent = '';
  let parentDepth = 0;
  const lookup = (name:string, tier:string) => {
    const key = nameKey(translations[name] ?? name);
    let matches = known.filter(r => r.nation && r.type && normalizeTier(r.tier) === tier && [r.targetName,r.canonicalName,...r.previousNames.split('|')].some(n => nameKey(translations[n] ?? n) === key));
    const manual = matches.filter(r=>r.sourceUrl.startsWith('manual:'));
    if (manual.length) matches = manual;
    const identities = new Set(matches.map(r=>`${r.nation}|${r.type}`));
    return identities.size === 1 ? matches[0] : undefined;
  };
  root.find('h1,h2,h3,h4,h5,p,li,tr').each((_, element) => {
    const el = $(element);
    // Process leaf text once, not a parent LI's flattened descendant list.
    if (el.is('p') && el.closest('li,td,th').length) return;
    const own = el.clone(); own.find('ul,ol').remove();
    const line = clean(own.text());
    if (!line) return;
    if(/^Обращаем ваше внимание|^Обсудить на форуме/.test(line)) return;
    if (/^h[1-5]$/.test(element.tagName)) {
      if (article.sourceKind === 'portal' && el.is('h2')) {
        active = /балансировк|балансн|изменения (кораблей|навыков|характеристик)/i.test(line);
        foundSection ||= active;
      }
      // Subheadings (consumables/instructions/balance) retain the current ship.
      if (el.is('h1,h2')) { contexts = article.sourceKind==='blog'?[...titleContexts]:[]; mechanic = ''; }
      parent = ''; last = [];
      if (/тестов/i.test(line)) status = 'test';
      if (/основн|релиз/i.test(line)) status = 'released';
      if(!el.find('vue-mk-entity,span.ship').length && !/^(?:[А-ЯЁа-яё]+)\s+(?:подводная лодка|подлодка|авианосец|эсминец|крейсер|линкор)\s/i.test(line)) return;
    }
    if (!active) return;
    if (el.is('p,h1,h2,h3,h4,h5')) {
      const entities = el.find('vue-mk-entity,span.ship');
      // Ship mentions in introductory prose or comparisons are not headings.
      const residue = el.clone(); residue.find('vue-mk-entity,span.ship').remove();
      if (entities.length && !clean(residue.text()).replace(/[,;:、.\s]/g,'')) {
        contexts = entities.toArray().map(e => {
          const node = $(e); const text = clean(node.text());
          const tier = normalizeTier(node.attr('data-level') ?? text.match(/^([IVXХ]+|[★⭐])\s/)?.[1] ?? '');
          const name = text.replace(/^([IVXХ]+|[★⭐])\s+/, '');
          const match = lookup(name,tier);
          return {name,nation:nations[node.attr('data-nation') ?? ''] ?? match?.nation ?? '',tier,type:types[node.attr('data-type') ?? ''] ?? match?.type ?? '',entityId:node.attr(':entity')?.match(/id:\s*['"](\d+)/)?.[1]};
        });
        mechanic = ''; parent = ''; last = []; return;
      }
      const fallback = line.match(/^([А-ЯЁа-яё]+)\s+(подводная лодка|подлодка|авианосец|эсминец|крейсер|линкор)\s+(.+?),\s*([IVXХ]+|[★⭐])\s+уров/i);
      if (fallback) {
        contexts = [{name:fallback[3].replace(/[«»]/g,''),nation:nationPrefixes.find(([p])=>fallback[1].toLowerCase().startsWith(p))?.[1] ?? '',type:typePrefixes.find(([p])=>fallback[2].toLowerCase()===p)?.[1] ?? '',tier:normalizeTier(fallback[4])}];
        parent = ''; last = []; return;
      }
      if (/очка навыков|очков навыков/i.test(line)) {mechanic=line; contexts=[]; last=[]; return;}
      if (last.length && (/alert-success/.test(el.attr('class') ?? '') || (article.sourceKind==='blog' && /^(Теперь|При этом|Соответственно|Таким образом)/i.test(line)))) {last.forEach(r=>r.notes += `\n${line}`);return;}
      if(contexts.length && /(?:характеристик|параметр|снаряжени)/i.test(line) && /:$/.test(line)) {parent=line;parentDepth=0;return;}
      if(!/(?:уменьшен|увеличен|снижен|повышен|добавлен|изменен|изменён|удален|удалён)/i.test(line)) return;
    }
    if (/^соответственно|другие виды заметности/i.test(line)) {last.forEach(r=>r.notes += `\n${line}`); return;}
    const ancestor = el.parents('li').first().clone(); ancestor.find('ul,ol').remove();
    const ancestorText = clean(ancestor.text());
    const hasChildren = el.find('li').length > 0;
    const depth = el.parents('ul,ol').length;
    if (!ancestorText && depth<=parentDepth) parent='';
    if (hasChildren && /характеристик|параметр|следующ|снаряжени/i.test(line) && !/\s(?:с|со)\s+\d.+\sдо\s/.test(line)) {parent = line; parentDepth=depth; return;}
    if (!contexts.length && !mechanic) {
      issues.push({sourceUrl:article.url,text:line,reason:'缺少可靠舰船/机制上下文'}); return;
    }
    if (!version) return;
    let change = parseChange(line);
    if(el.is('tr')) {
      const cells=el.children('td').map((_,cell)=>clean($(cell).text())).get();
      if(cells.length!==3) {issues.push({sourceUrl:article.url,text:line,reason:'表格列无法可靠映射，待审核'});return;}
      change={attribute:cells[0],oldValue:cells[1]||'—',newValue:cells[2]||'—'};
    }
    const contextText = ancestorText || parent;
    if (contextText) change.attribute = `${contextText} — ${change.attribute}`;
    if (!hasChildren && !ancestorText && !contextText) parent = '';
    last = [];
    const targets = contexts.length ? contexts : [{name:mechanic,nation:'',tier:'',type:''}];
    for (const ship of targets) {
      const id = digest([article.id,ship.entityId ?? ship.name,ship.tier,line,contextText].join('|')).slice(0,16);
      const record: OfficialBalanceRecord = {
        id, category:contexts.length ? 'ship':'mechanic', announcementId:article.id,sourceUrl:article.url,publishedAt:article.publishedAt,originalText:line,
        targetName:ship.name,canonicalName:ship.name,previousNames:'',nation:ship.nation,tier:ship.tier,type:ship.type,entityId:ship.entityId,
        ...change,version,notes:`官方公告：${article.url}`, ...analyze(change),shipStatus:contexts.length ? status:'unknown',tags:'',sourceSheet:`${article.sourceKind} ${article.id}`,
        sources:[{announcementId:article.id,url:article.url,originalText:line}],
      };
      if (/не балансной правкой/.test(line)) {
        record.trend='adjustment'; record.analysisRule='explicit-configuration-bugfix'; record.analysisConfidence='high';
      }
      if (contexts.length && (!ship.nation || !ship.type || !ship.tier)) {
        issues.push({sourceUrl:article.url,text:`${ship.name}: ${line}`,reason:'舰船身份信息不完整，保留为候选'});
      }
      records.push(record); last.push(record);
    }
  });
  if (!foundSection) throw new Error(`No recognized balance section: ${article.url}`);
  if (!records.length) issues.push({sourceUrl:article.url,text:article.title,reason:'正文未生成记录，需要人工确认无相关内容或解析漏项'});
  const announcement: OfficialAnnouncement = {...article,contentHash,recordIds:records.map(r=>r.id)};
  return {announcement,records,issues};
}
