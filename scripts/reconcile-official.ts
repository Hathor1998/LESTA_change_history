import { normalizeTier } from '../src/utils/normalization.ts';
import { nameKey } from './official-parser.ts';
import { translationLookup } from './official-vocabulary.ts';
import type { OfficialBalanceRecord } from '../src/types.ts';

export type ReviewEntry = { reason:string; existing?:OfficialBalanceRecord; candidate:OfficialBalanceRecord };

export function metricKey(value:string) {
  const text = value.replace(/[“”«»\s（）()—-]/g,'');
  if (/127/.test(text)) return /射程/.test(text) ? '127mm-range' : /弹道|траектори/.test(text) ? '127mm-trajectory' : text;
  if (/主炮精度/.test(text)) return '主炮精度';
  if (/穿甲弹参数/.test(text)) return '穿甲弹参数';
  if (/主炮.*弹道/.test(text)) return '主炮弹道';
  if (/第1.*4.*炮塔/.test(text)) return '炮塔旋转';
  if (/新增.*监视雷达|消耗品栏位/.test(text)) return '消耗品栏位';
  return text.replace(/消耗品/g,'').replace(/海上被侦测距离/g,'对海隐蔽').replace(/生命值/g,'血量');
}

export function valueKey(value:string) {
  return value.replace(/[–−]/g,'-').replace(/,/g,'.').replace(/减少约/g,'-~').replace(/增加至|增加到|减少至|减少到/g,'').replace(/增加/g,'+').replace(/减少/g,'-')
    .replace(/千米|公里|км|km/gi,'km').replace(/毫米|мм|mm/gi,'mm').replace(/秒|секунд[аы]?|с(?=\s|$|\.)/gi,'s').replace(/单位|点|次|ед\.?/g,'').replace(/\s/g,'').replace(/\.$/,'');
}
function equivalentValues(a:OfficialBalanceRecord,b:OfficialBalanceRecord,translate:(s:string)=>string) {
  if ([a.oldValue,a.newValue,b.oldValue,b.newValue].every(v=>v==='—') && translate(a.attribute)!==translate(b.attribute)) return false;
  const pairs = [[a.oldValue,a.newValue],[b.oldValue,b.newValue]].map(p=>p.map(v=>valueKey(translate(v))));
  // Russian ranged values commonly put the shared unit only after the new value.
  for (const pair of pairs) {
    const unit = pair[1].match(/(km|mm|s|%)$/)?.[1];
    if (unit && /^-?\d+(?:\.\d+)?$/.test(pair[0])) pair[0] += unit;
  }
  return JSON.stringify(pairs[0]) === JSON.stringify(pairs[1]);
}
export function reconcile(existing:OfficialBalanceRecord[],incoming:OfficialBalanceRecord[],translations:Record<string,string>) {
  const translate = translationLookup(translations);
  const key = (r:OfficialBalanceRecord) => [r.category,nameKey(translate(r.canonicalName)),r.nation,normalizeTier(r.tier),r.type,r.version,r.shipStatus,r.changeStage??'standard',metricKey(translate(r.attribute))].join('|');
  const records = structuredClone(existing);
  const merged: ReviewEntry[] = [], conflicts:ReviewEntry[] = [], added:OfficialBalanceRecord[] = [], pending:ReviewEntry[] = [];
  const byKey = new Map<string,OfficialBalanceRecord[]>();
  records.forEach(r=>byKey.set(key(r),[...(byKey.get(key(r)) ?? []),r]));
  for (const candidate of incoming) {
    if (candidate.category==='ship' && (!candidate.nation || !candidate.type || !normalizeTier(candidate.tier))) {pending.push({candidate,reason:'舰船身份待确认'}); continue;}
    const peers = byKey.get(key(candidate)) ?? [];
    const exact = peers.find(r=>equivalentValues(r,candidate,translate) && (r.attribute===candidate.attribute || metricKey(translate(r.attribute))===metricKey(translate(candidate.attribute))));
    const sameId = records.find(r=>r.id===candidate.id) ?? records.find(r=>
      r.announcementId===candidate.announcementId && r.shipStatus===candidate.shipStatus && r.changeStage===candidate.changeStage &&
      nameKey(translate(r.canonicalName))===nameKey(translate(candidate.canonicalName)) &&
      (!r.nation || r.nation===candidate.nation) && normalizeTier(r.tier)===normalizeTier(candidate.tier) && (!r.type || r.type===candidate.type) &&
      (r.originalText.trim()===candidate.originalText.trim() ||
       (r.originalText.trim().endsWith(candidate.originalText.trim()) && equivalentValues(r,candidate,translate))));
    const match = exact ?? sameId;
    const weaponConflict = match && /127mm/.test(key(candidate)) && /主炮/.test(translate(match.attribute)) !== /主炮/.test(translate(candidate.attribute));
    if (match && equivalentValues(match,candidate,translate) && !weaponConflict) {
      if(!match.type) match.type=candidate.type;
      if(!match.nation) match.nation=candidate.nation;
      const sources = [...(match.sources ?? [{announcementId:match.announcementId,url:match.sourceUrl,originalText:match.originalText}]), ...(candidate.sources ?? [{announcementId:candidate.announcementId,url:candidate.sourceUrl,originalText:candidate.originalText}]).map(s=>({...s,notes:candidate.notes}))];
      match.sources = [...new Map(sources.map(s=>[`${s.announcementId}|${s.originalText}`,s])).values()];
      if (candidate.entityId) match.entityId = candidate.entityId;
      if (!match.notes.includes(candidate.sourceUrl)) match.notes += `\n官网核验：${candidate.sourceUrl}`;
      match.notes=match.notes.replace('人工录入：用户提供，待官方公告核验','人工录入：用户提供，已与官方公告核对');
      merged.push({candidate,existing:structuredClone(match),reason:'相同改动合并来源，保留原展示值'});
      continue;
    }
    if (peers.length || sameId) {conflicts.push({candidate,existing:peers[0] ?? sameId,reason:'同对象同版本同属性的数值或描述不同，保留原值待审'}); continue;}
    records.push(candidate); added.push(candidate); byKey.set(key(candidate),[candidate]);
  }
  return {records,merged,conflicts,added,pending};
}
