import { load } from 'cheerio';
import { clean, digest } from './official-parser.ts';
import type { OfficialBalanceRecord } from '../src/types.ts';

export const release2611Url = 'https://korabli.su/ru/news/game-updates/update-26-11-black-friday/';
export const release2611Start = '2026-10-28T07:00:00.000Z';
const submarineText = 'Одно, но заметное изменение затронет сразу целый класс — подводные лодки. С выходом версии 26.11 субмарины будут заметны авиации на перископной глубине с двух километров.';
const rows = [
  ['所有潜艇', '潜望镜深度的对空被发现距离', '2 千米', submarineText],
  ['所有舰船', '搁浅后的脱浅处理', '改善脱浅处理，减少在岛屿附近卡住的情况', 'Сделаны доработки выталкивания кораблей при попадании на мель вблизи островов. Благодаря доработкам корабли будут реже застревать у островов.'],
  ['所有舰船', '切换深水炸弹空袭时的目标锁定', '保留锁定，主炮及鱼雷发射管继续跟随目标，直至目标隐蔽或被击沉', 'При переключении на авиаудар ГБ теперь не будет пропадать захват цели. Благодаря этому вооружение (например, ГК и ТА) будет продолжать «следовать» за захваченной целью, пока она не «отсветится» или не будет уничтожена.'],
  ['具有逐管鱼雷发射能力的舰船', '鱼雷扇区显示、生成位置及方向', '改善鱼雷扇区显示和位置，并小幅调整鱼雷生成点与方向', 'Улучшено отображение и позиция веера торпед для кораблей с потрубным пуском. Также для таких кораблей несколько скорректированы точки появления торпед и их направление.'],
];

export function parseReviewedRelease2611(html: string): OfficialBalanceRecord[] {
  const $ = load(html), root = $('.news-detail');
  const heading = root.find('h3').filter((_, el) => clean($(el).text()) === 'Балансные правки субмарин');
  const timestamp = Number(html.match(/publication-start="([\d.]+)"/)?.[1]);
  const startText = clean(root.find('.introduction__text-secondary').text());
  const maintenance = root.find('vue-local-time').filter((_, el) => $(el).attr('time-list')?.includes('1793170800000') ?? false);
  if (root.length !== 1 || heading.length !== 1 || !root.find('h1').text().includes('26.11') || timestamp !== 1793091600 ||
    !startText.includes('28.10.2026, 10:00') || !maintenance.length) throw new Error('26.11 release identity/date changed');
  const balanceText = clean(heading.nextUntil('h1,h2,h3').text());
  if (balanceText !== submarineText) throw new Error('26.11 submarine balance section changed');
  const other = root.find('h2').filter((_, el) => clean($(el).text()) === 'Прочие изменения').next('ul');
  const texts = other.children('li').toArray().map(el => clean($(el).text()));
  return rows.map(([targetName, attribute, newValue, originalText], index) => {
    if (index && !texts.includes(originalText)) throw new Error(`26.11 mechanism changed: ${attribute}`);
    return {
      id: digest(`portal-16888|${targetName}|${attribute}`).slice(0, 16), category: 'mechanic', targetName, canonicalName: targetName,
      previousNames: '', nation: '', tier: '', type: '', attribute, oldValue: '—', newValue, version: '26.11',
      trend: 'adjustment', shipStatus: 'unknown', tags: '', sourceSheet: 'reviewed release 26.11', announcementId: 'portal-16888',
      sourceUrl: release2611Url, publishedAt: new Date(timestamp * 1000).toISOString(), originalText,
      analysisRule: index ? 'reviewed-mechanism-description' : 'release-new-value-only', analysisConfidence: index ? 'high' : 'medium',
      notes: `26.11正式版本公告确认；主服务器维护计划结束于2026-10-28 07:00 UTC。${index ? '公告仅描述行为调整，旧参数未提供，按中性调整展示。' : '公告未给出统一旧距离，不能按一个假定旧值判定整个潜艇类别的增强或削弱。26.11公测历史单独保留。'}\n官方公告：${release2611Url}`,
      sources: [{ announcementId: 'portal-16888', url: release2611Url, originalText }],
    } satisfies OfficialBalanceRecord;
  });
}
