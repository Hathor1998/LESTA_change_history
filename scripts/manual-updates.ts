import type { ChangeCategory, ChangeTrend, OfficialAnnouncement, OfficialBalanceRecord, ShipStatus } from '../src/types.ts';

type Ship = readonly [name: string, nation: string, tier: string, type: string];
type Spec = readonly [Ship, attribute: string, oldValue: string, newValue: string, trend: ChangeTrend];

const manualSourceUrl = 'manual://user-provided/2026-08-17';
const note = '人工录入：用户提供，待官方公告核验';
const ship = (name: string, nation: string, tier: string, type: string): Ship => [name, nation, tier, type];
const add = (items: Spec[], ships: Ship[], attribute: string, oldValue: string, newValue: string, trend: ChangeTrend) => {
  ships.forEach((entry) => items.push([entry, attribute, oldValue, newValue, trend]));
};

function recordsFor(id: string, version: string, status: ShipStatus, specs: Spec[]): OfficialBalanceRecord[] {
  return specs.map(([entry, attribute, oldValue, newValue, trend], index) => ({
    id: `${id}-${index + 1}`,
    category: 'ship' as ChangeCategory,
    announcementId: id,
    sourceUrl: manualSourceUrl,
    publishedAt: '2026-08-17T00:00:00.000Z',
    originalText: `${attribute}: ${oldValue} -> ${newValue}`,
    analysisRule: 'manual-user-provided',
    analysisConfidence: 'high',
    targetName: entry[0], canonicalName: entry[0], previousNames: '', nation: entry[1], tier: entry[2], type: entry[3],
    attribute, oldValue, newValue, version, notes: note, trend, shipStatus: status, tags: '', sourceSheet: `Manual ${version}`,
  }));
}

const test268: Spec[] = [
  [ship('布达佩斯', '欧洲', '9', '战列舰'), '鱼雷发射角度（每侧）', '—', '减少3度', 'nerf'],
  [ship('白山', '日本', '9', '战列舰'), '鱼雷发射角度（每侧）', '—', '增加10度', 'buff'],
  [ship('民主德国', '苏联', '10', '战列舰'), '主炮射击模式', '常规射击', '仅连发射击：连发2次，单轮装填27秒，开火间隔6秒', 'adjustment'],
  [ship('民主德国', '苏联', '10', '战列舰'), '鱼雷发射器机制', '装填手和单点发射能力', '移除；改为常规鱼雷发射器机制', 'adjustment'],
  [ship('民主德国', '苏联', '10', '战列舰'), '鱼雷装填时间', '—', '80秒', 'adjustment'],
  [ship('民主德国', '苏联', '10', '战列舰'), '“维修小组”可用数量', '3', '4', 'buff'],
];

const update269: Spec[] = [
  [ship('迪米特里·顿斯科伊', '苏联', '9', '巡洋舰'), '主炮装填时间', '12.5秒', '10.5秒', 'buff'],
  [ship('塔尔萨', '美国', '9', '巡洋舰'), '主炮精度', '—', '提升至同级驱逐舰平均水平', 'buff'],
  [ship('里加', '苏联', '9', '巡洋舰'), '对海隐蔽', '14.9公里', '14.5公里', 'buff'],
  [ship('欧根亲王', '德国', '8', '巡洋舰'), '主炮精度', '—', '提升至同级驱逐舰平均水平', 'buff'],
  [ship('欧根亲王', '德国', '8', '巡洋舰'), '主炮装填时间', '13秒', '12秒', 'buff'],
  [ship('新罕布什尔', '美国', '10', '战列舰'), '主炮第1、4座炮塔旋转角度', '受限', '全角度旋转', 'buff'],
  [ship('新罕布什尔', '美国', '10', '战列舰'), '穿甲弹参数', '—', '与得梅因穿甲弹相同', 'adjustment'],
  [ship("让·巴尔 '43", '法国', '9', '战列舰'), '副炮（127毫米）射程', '13公里', '14公里', 'buff'],
  [ship("让·巴尔 '43", '法国', '9', '战列舰'), '副炮（127毫米）弹道', '—', '更平直，最大射程飞行时间不变', 'adjustment'],
  [ship('祖国', '法国', '11', '战列舰'), '“引擎增压”消耗品作用时间', '120秒', '180秒', 'buff'],
  [ship('肥前', '日本', '9', '战列舰'), '穿甲弹参数', '—', '与出云穿甲弹相同', 'adjustment'],
  [ship('肥前', '日本', '9', '战列舰'), '主炮装填时间', '35秒', '34秒', 'buff'],
  [ship('八戒', '泛亚', '9', '战列舰'), '主炮装填时间', '32秒', '31秒', 'buff'],
  [ship('萨摩', '日本', '11', '战列舰'), '主炮装填时间', '35秒', '34秒', 'buff'],
  [ship('波多黎各', '美国', '10', '巡洋舰'), '主炮装填时间', '22秒', '20.5秒', 'buff'],
  [ship('奥丁', '德国', '8', '战列舰'), '血量', '52800', '58700', 'buff'],
  [ship('白龙', '日本', '10', '航空母舰'), '可研发轰炸机血量', '1790', '2000', 'buff'],
  [ship('射水鱼', '美国', '10', '潜艇'), '声导鱼雷最大伤害', '11913', '13497', 'buff'],
  [ship('U-4501', '德国', '10', '潜艇'), '声导鱼雷最大伤害', '11055', '12540', 'buff'],
  [ship('乌拉尔', '苏联', '9', '巡洋舰'), '“主炮装填助推器”可用次数', '—', '增加1次', 'buff'],
  [ship('乌拉尔', '苏联', '9', '巡洋舰'), '“主炮装填助推器”作用时间', '15秒', '20秒', 'buff'],
  [ship('柴郡', '英国', '8', '巡洋舰'), '主炮射程', '16.1公里', '16.9公里', 'buff'],
  [ship('柴郡', '英国', '8', '巡洋舰'), '主炮精度', '—', '提升至炽热水平', 'buff'],
  [ship('乌尔皮乌斯·图拉真', '意大利', '10', '巡洋舰'), '“维修小组”可用次数', '—', '增加1次', 'buff'],
  [ship('乌尔皮乌斯·图拉真', '意大利', '10', '巡洋舰'), '主炮炮弹弹道', '—', '更平直', 'adjustment'],
  [ship('乌尔皮乌斯·图拉真', '意大利', '10', '巡洋舰'), '主炮射程', '14.8公里', '15.5公里', 'buff'],
  [ship('哈巴罗夫斯克', '苏联', '10', '驱逐舰'), '鱼雷射程', '6公里', '8.5公里', 'buff'],
  [ship('哈巴罗夫斯克', '苏联', '10', '驱逐舰'), '鱼雷装填时间', '127秒', '145秒', 'nerf'],
  [ship('哈巴罗夫斯克', '苏联', '10', '驱逐舰'), '方向舵换挡时间', '11.1秒', '6.7秒', 'buff'],
  [ship('巨浪', '泛亚', '9', '战列舰'), '主炮射程', '18.4公里', '19.2公里', 'buff'],
  [ship('巨浪', '泛亚', '9', '战列舰'), '主炮装填时间', '24秒', '22秒', 'buff'],
  [ship('巴塔哥尼亚', '泛美', '9', '巡洋舰'), '主炮炮弹弹着群系数', '1.6', '1.7', 'buff'],
  [ship('卡瓦哈尔', '泛美', '8', '巡洋舰'), '“维修小组”可用次数', '—', '增加1次', 'buff'],
  [ship('新埃斯帕塔', '泛美', '10', '驱逐舰'), '消耗品栏位', '“鱼雷装填助推器”', '新增“监视雷达”，参数与七月二十日相同', 'adjustment'],
];

add(update269, [ship('黎塞留', '法国', '8', '战列舰'), ship('阿尔萨斯', '法国', '9', '战列舰'), ship('悟净', '泛亚', '9', '战列舰'), ship('共和国', '法国', '10', '战列舰'), ship('香槟', '法国', '8', '战列舰'), ship('加斯科涅', '法国', '8', '战列舰'), ship('让·巴尔', '法国', '9', '战列舰'), ship("让·巴尔 '43", '法国', '9', '战列舰')], '“引擎增压”航速加成', '8%', '15%', 'buff');
add(update269, [ship('河内', '日本', '3', '战列舰'), ship('妙义', '日本', '4', '战列舰'), ship('金刚', '日本', '5', '战列舰'), ship('扶桑', '日本', '6', '战列舰'), ship('长门', '日本', '7', '战列舰'), ship('天城', '日本', '8', '战列舰'), ship('出云', '日本', '9', '战列舰'), ship('八戒', '泛亚', '9', '战列舰'), ship('弓张', '日本', '8', '战列舰'), ship('安达太良', '日本', '9', '战列舰'), ship('丰后', '日本', '10', '战列舰'), ship('三笠', '日本', '2', '战列舰'), ship('石槌', '日本', '4', '战列舰'), ship('陆奥', '日本', '6', '战列舰'), ship('伊势', '日本', '6', '战列舰'), ship('日向', '日本', '7', '战列舰'), ship('天城', '日本', '7', '战列舰'), ship('纪伊', '日本', '8', '战列舰'), ship('武藏', '日本', '9', '战列舰'), ship('肥前', '日本', '9', '战列舰'), ship('大山', '日本', '9', '战列舰'), ship('石见', '日本', '9', '战列舰'), ship('大和', '日本', '10', '战列舰'), ship('敷岛', '日本', '10', '战列舰'), ship('雷兽', '日本', '10', '战列舰'), ship('萨摩', '日本', '11', '战列舰')], '主炮炮弹散布投影面积', '—', '减少约10%', 'buff');
add(update269, [ship('天城', '日本', '8', '战列舰'), ship('出云', '日本', '9', '战列舰'), ship('大和', '日本', '10', '战列舰')], '主炮装填时间', '30秒', '29秒', 'buff');
add(update269, [ship('西雅图', '美国', '9', '巡洋舰'), ship('伍斯特', '美国', '10', '巡洋舰')], '主炮炮弹弹道', '—', '更平直', 'adjustment');
add(update269, [ship('翔鹤', '日本', '8', '航空母舰')], '基础鱼雷机血量', '1600', '1730', 'buff');
add(update269, [ship('翔鹤', '日本', '8', '航空母舰')], '可研发鱼雷机血量', '1670', '1800', 'buff');
add(update269, [ship('翔鹤', '日本', '8', '航空母舰')], '基础轰炸机血量', '1580', '1710', 'buff');
add(update269, [ship('翔鹤', '日本', '8', '航空母舰')], '可研发轰炸机血量', '1650', '1780', 'buff');
add(update269, [ship('天龙', '日本', '3', '巡洋舰'), ship('卡利登', '英国', '3', '巡洋舰'), ship('岩木A', '日本', '4', '巡洋舰'), ship('夕张', '日本', '4', '巡洋舰'), ship('球磨', '日本', '4', '巡洋舰'), ship('达娜厄', '英国', '4', '巡洋舰'), ship('翡翠', '英国', '5', '巡洋舰'), ship('科尔多瓦', '泛美', '4', '巡洋舰'), ship('塞尔韦拉上将', '泛美', '4', '巡洋舰'), ship('加利西亚', '泛美', '5', '巡洋舰')], '装甲区甲板装甲', '—', '增加至40毫米', 'buff');

const skill269: OfficialBalanceRecord = {
  id: 'manual-26.9-skill-1', category: 'mechanic', announcementId: 'manual-26.9', sourceUrl: manualSourceUrl,
  publishedAt: '2026-08-17T00:00:00.000Z', originalText: '深潜大师减伤 -50% -> -33%', analysisRule: 'manual-user-provided', analysisConfidence: 'high',
  targetName: '指挥官潜艇技能：深潜大师（4技能点）', canonicalName: '指挥官潜艇技能：深潜大师（4技能点）', previousNames: '', nation: '', tier: '', type: '', attribute: '最大深度时敌方深水炸弹伤害降低', oldValue: '-50%', newValue: '-33%', version: '26.9', notes: note, trend: 'nerf', shipStatus: 'unknown', tags: '', sourceSheet: 'Manual 26.9',
};

export const manualAnnouncements: OfficialAnnouncement[] = [
  { id: 'manual-26.8', url: manualSourceUrl, title: '封闭测试 26.8 — 测试舰艇平衡性调整（人工录入）', publishedAt: '2026-08-17T00:00:00.000Z', contentHash: 'manual-26.8', recordIds: recordsFor('manual-26.8', '26.8', 'test', test268).map((record) => record.id) },
  { id: 'manual-26.9', url: manualSourceUrl, title: '26.9 — 平衡性调整（人工录入，待官方公告核验）', publishedAt: '2026-08-17T00:00:00.000Z', contentHash: 'manual-26.9', recordIds: [...recordsFor('manual-26.9', '26.9', 'released', update269), skill269].map((record) => record.id) },
];

export const manualRecords: OfficialBalanceRecord[] = [...recordsFor('manual-26.8', '26.8', 'test', test268), ...recordsFor('manual-26.9', '26.9', 'released', update269), skill269];
