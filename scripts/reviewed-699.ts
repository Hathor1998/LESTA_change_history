import { load } from 'cheerio';
import { clean, digest } from './official-parser.ts';
import type { ChangeTrend, OfficialBalanceRecord } from '../src/types.ts';

export const blog699Url = 'https://blog.korabli.su/blog/699';
type Metric = [attribute: string, oldValue: string, newValue: string, trend: ChangeTrend, originalText: string];
const turn = (old: string): Metric => ['主炮180度回转时间', `${old.replace(',', '.')} 秒`, '18 秒', 'buff', `Время поворота орудий ГК на 180 градусов уменьшено с ${old} до 18 с.`];
const repairParent = 'Изменены параметры снаряжения «Ремонтная команда»:';
const smokeParent = 'В отдельный слот добавлено снаряжение «Дымогенератор полного хода» со следующими параметрами:';
const ships: [name: string, nation: string, tier: string, type: string, metrics: Metric[]][] = [
  ['Riddare', '欧洲', '5', '巡洋舰', [turn('20'),
    ['每轮深水炸弹数量', '20 枚', '6 枚', 'nerf', 'Количество глубинных бомб в одном заряде уменьшено с 20 до 6 ед.'],
  ]],
  ['Tre Kronor', '欧洲', '6', '巡洋舰', [turn('22,5'),
    ['每轮深水炸弹数量', '16 枚', '8 枚', 'nerf', 'Количество глубинных бомб в одном заряде уменьшено с 16 до 8 ед.'],
    ['鱼雷射程', '10 千米', '12 千米', 'buff', 'Дальность хода торпед увеличена с 10 до 12 км.'],
    ['鱼雷航速', '65 节', '76 节', 'buff', 'Скорость хода торпед увеличена с 65 до 76 уз.'],
    ['鱼雷被发现距离', '1.4 千米', '1.6 千米', 'nerf', 'Заметность торпед увеличена с 1,4 до 1,6 км.'],
    ['鱼雷装填时间', '90 秒', '100 秒', 'nerf', 'Время перезарядки торпед увеличено с 90 до 100 с.'],
  ]],
  ['Bärsärk', '欧洲', '7', '巡洋舰', [turn('22,5')]],
  ['Konung', '欧洲', '10', '巡洋舰', [turn('25,7')]],
  ['Troll', '欧洲', '11', '巡洋舰', [turn('25,7')]],
  ['Моонзунд', '苏联', '10', '巡洋舰', [
    ['维修小组-作用时间', '28 秒', '14 秒', 'nerf', 'Время работы уменьшено с 28 до 14 с.'],
    ['维修小组-每秒恢复生命值', '0.5%', '1%', 'buff', 'Восстановление боеспособности в секунду увеличено с 0,5% до 1%.'],
    ['维修小组-冷却时间', '80 秒', '60 秒', 'buff', 'Время перезарядки уменьшено с 80 до 60 с.'],
    ['主炮装填时间', '18 秒', '17.5 秒', 'buff', 'Время перезарядки орудий ГК уменьшено с 18 до 17,5 с.'],
    ['第一座主炮塔向舰艉射界', '—', '左右舷各扩大5度', 'buff', 'Максимальные углы наведения первой (расположенной ближе всего к носу) башни улучшены на 5 градусов в сторону кормы с левого и правого борта.'],
    ['第四座主炮塔向舰艏射界', '—', '左右舷各扩大5度', 'buff', 'Максимальные углы наведения четвёртой (расположенной ближе всего к корме) башни улучшены на 5 градусов в сторону носа с левого и правого борта.'],
  ]],
  ['Ханко', '苏联', '7', '巡洋舰', [
    ['主炮散布', '—', '改善至大多数驱逐舰的散布水平', 'buff', 'Улучшены параметры рассеивания снарядов ГК. Теперь они идентичны параметрам разброса снарядов у большинства эсминцев.'],
  ]],
  ['Waterloo', '英国', '11', '驱逐舰', [
    ['监视雷达-作用时间', '12 秒', '15 秒', 'buff', 'Время работы снаряжения «Поисковая РЛС» увеличено с 12 до 15 с.'],
    ['主炮射程', '14 千米', '13.4 千米', 'nerf', 'Дальность стрельбы орудий ГК уменьшена с 14 до 13.4 км.'],
  ]],
  ['Isonzo', '意大利', '9', '巡洋舰', [
    ['新增全速发烟器：可用次数', '—', '2 次', 'buff', 'Количество зарядов: 2.'],
    ['新增全速发烟器：作用时间', '—', '30 秒', 'buff', 'Время работы: 30 с.'],
    ['新增全速发烟器：烟幕消散时间', '—', '10 秒', 'buff', 'Время рассеивания дымов: 10 с.'],
    ['新增全速发烟器：冷却时间', '—', '180 秒', 'buff', 'Время перезарядки: 180 с.'],
  ]],
  ['Songun', '泛亚', '9', '战列舰', [
    ['战斗指令-每次主炮命中积累进度', '5%', '6%', 'buff', 'Прогресс боевых инструкций за попадание снарядом ГК увеличен с 5% до 6%.'],
    ['主炮装填时间', '27 秒', '25 秒', 'buff', 'Время перезарядки орудий ГК уменьшено о с 27 до 25 с.'],
  ]],
  ['25 de Mayo', '泛美', '7', '巡洋舰', [
    ['维修小组参数', '—', '与IX–X级巡洋舰的标准维修小组一致', 'adjustment', 'Изменены параметры снаряжения «Ремонтная команда». Теперь они идентичны стандартным параметрам это снаряжения у крейсеров IX-X уровня.'],
  ]],
];

export function parseReviewedBlog699(html: string): OfficialBalanceRecord[] {
  const $ = load(html), root = $('.article__content');
  if (root.length !== 1 || !$('body').text().includes('26.11') || $('time').first().attr('data-timestamp') !== '1792756800') {
    throw new Error('Blog 699 title/date/body changed');
  }
  const groups = new Map<string, { nation: string; tier: string; type: string; texts: string[] }>();
  let current: string[] = [];
  root.children().each((_, element) => {
    const node = $(element), headings = node.find('span.ship');
    // Introductory prose also mentions ships. Only standalone ship headings establish context.
    const remainder = node.clone(); remainder.find('span.ship').remove();
    if (headings.length && !clean(remainder.text()).replace(/^и$/, '')) {
      current = [];
      headings.each((_, ship) => {
        const s = $(ship), name = clean(s.text()).replace(/^[IVX★⭐]+\s+/, '');
        if (groups.has(name)) throw new Error(`Repeated 699 ship: ${name}`);
        groups.set(name, { nation: s.attr('data-nation') ?? '', tier: s.attr('data-level') ?? '', type: s.attr('data-type') ?? '', texts: [] });
        current.push(name);
      });
    } else if (node.is('ul,ol')) {
      if (!current.length) throw new Error('699 list has no ship context');
      node.find('li').each((_, li) => {
        const own = $(li).clone(); own.find('ul,ol').remove();
        for (const name of current) groups.get(name)!.texts.push(clean(own.text()));
      });
    }
  });
  if (groups.size !== ships.length) throw new Error('699 ship section count changed');
  const nationCodes: Record<string, string> = { 欧洲: 'europe', 苏联: 'ussr', 英国: 'uk', 意大利: 'italy', 泛亚: 'pan_asia', 泛美: 'pan_america' };
  return ships.flatMap(([name, nation, tier, type, metrics]) => {
    const group = groups.get(name), parent = name === 'Моонзунд' ? repairParent : name === 'Isonzo' ? smokeParent : undefined;
    if (!group || group.nation !== nationCodes[nation] || group.tier !== tier || group.type !== (type === '巡洋舰' ? 'cruiser' : type === '驱逐舰' ? 'destroyer' : 'battleship')) throw new Error(`699 ship identity changed: ${name}`);
    const expected = [...metrics.map(m => m[4]), ...(parent ? [parent] : [])];
    if (group.texts.length !== expected.length || expected.some(text => !group.texts.includes(text))) throw new Error(`699 unreviewed or changed block: ${name}`);
    return metrics.map(([attribute, oldValue, newValue, trend, text]) => {
      const originalText = parent ? `${parent}\n${text}` : text;
      return {
        id: digest(`699|${name}|${attribute}`).slice(0, 16), category: 'ship', targetName: name, canonicalName: name,
        previousNames: '', nation, tier, type, attribute, oldValue, newValue, trend, version: '26.11',
        shipStatus: 'test', tags: 'test-ship', sourceSheet: 'reviewed blog 699', announcementId: '699',
        sourceUrl: blog699Url, publishedAt: '2026-10-23T12:00:00.000Z', originalText,
        analysisRule: trend === 'adjustment' ? 'reviewed-comparison-without-old-parameters' : 'reviewed-blog-699',
        analysisConfidence: trend === 'adjustment' ? 'medium' : 'high',
        notes: `26.11测试舰艇调整；公告注明随26.11版本在主服务器生效，不改变当前正式版本号。${name === 'Моонзунд' && attribute.startsWith('维修小组') ? '单次基础总恢复量仍为14%；作用时间与每秒恢复速度分别展示，冷却时间另计。' : ''}${name === 'Isonzo' ? '在独立栏位新增全速发烟器；四个子项描述同一项新增消耗品，旧值未提供，增强判定针对新增能力。' : ''}${trend === 'adjustment' ? '未列出旧参数及具体新数值，保留平调判定待进一步确认。' : ''}\n官方公告：${blog699Url}`,
        sources: [{ announcementId: '699', url: blog699Url, originalText }],
      } satisfies OfficialBalanceRecord;
    });
  });
}
