import { digest } from './official-parser.ts';
import type { ChangeTrend, OfficialBalanceRecord } from '../src/types.ts';

export const ngaUrl = 'https://bbs.nga.cn/read.php?tid=47645187';
export const officialUrl = 'https://blog.korabli.su/blog/697';
export const translator = 'ViisasSusi';
export const title = '[Lesta服] [WoWS新闻] 26.10版本——测试舰艇平衡性调整';
type Metric = [string, string, string, ChangeTrend, string, string?];
type Ship = [string, string, string, string, string, Metric[]];
// Reviewed from the rendered NGA main post; official text guards each accepted change.
const ships: Ship[] = [
  ["Бородино '04", '博罗季诺04', '苏联', '3', '战列舰', [
    ['中口径火炮弹着群系数','1.8','1.65','nerf','Параметр сигма орудий СК уменьшен с 1,8 до 1,65'],
  ]],
  ['Моонзунд','莫昂宗德','苏联','10','巡洋舰',[
    ['转向半径','1130 米','980 米','buff','Радиус циркуляции уменьшен с 1130 до 980 м.'],
  ]],
  ['Иван Грозный','伊凡雷帝','苏联','11','巡洋舰',[
    ['第一轮齐射装填时间','26 秒','24.5 秒','buff','Время перезарядки первого залпа уменьшено с 26 до 24,5 с.'],
  ]],
  ['Isonzo','伊松佐','意大利','9','巡洋舰',[
    ['主炮炮弹初速','775 米/秒','805 米/秒','buff','Баллистика снарядов стала более настильной — начальная скорость полёта снаряда увеличена с 775 до 805 м/с','弹道更加平缓。'],
  ]],
  ["Mikasa '04",'三笠04','日本','3','战列舰',[
    ['中口径火炮弹着群系数','1.9','1.8','nerf','Параметр сигма орудий СК уменьшен с 1,9 до 1,8','用户确认采用官网三笠04段落；NGA译文为1.8→1.65，保留差异供追溯。'],
    ['中口径火炮装填时间','8 秒','7.5 秒','buff','Время перезарядки СК уменьшено с 8 до 7,5 с'],
    ['鱼雷装填时间','90 秒','75 秒','buff','Время перезарядки ТА уменьшено с 90 до 75 с.'],
  ]],
  ['Piorun','霹雳','欧洲','7','驱逐舰',[
    ['穿甲弹跳弹角度','—','提升至果敢（Daring）水准','buff','Бронебойным снарядам добавлены улучшенные углы рикошета как у Daring','旧值未公布；官网明确为改进跳弹角度，不猜测具体角度。'],
    ['对海隐蔽','7.1 千米','6.9 千米','buff','Заметность с кораблей уменьшена с 7,1 до 6,9 км.','其他类型的隐蔽也将进行相应调整。'],
  ]],
  ['Schwaben','施瓦本','德国','11','战列舰',[
    ['主炮命中推进的战斗指令进度','17%','13%','nerf','Прогресс боевых инструкций за попадание снарядом ГК уменьшен с 17 до 13%.'],
    ['战斗指令第三层-炮弹最大误差加成','-7.5%','-8%','buff','Бонус к точности увеличен с 7,5 до 8%'],
    ['战斗指令第三层-主炮装填时间加成','-4.5%','-6.5%','buff','Бонус ко времени перезарядки ГК увеличен с 4,5 до 6,5%'],
    ['战斗指令第三层-主炮180度回转时间加成','-15%','-17%','buff','Бонус ко времени поворота орудий ГК увеличен с 15 до 17%'],
    ['战斗指令第三层-方向舵换挡时间加成','-15%','-18%','buff','Бонус ко времени перекладки руля увеличен с 15 до 18%'],
    ['战斗指令第四层-炮弹最大误差加成','-10%','-15%','buff','Бонус к точности увеличен с 10 до 15%'],
    ['战斗指令第四层-主炮装填时间加成','-6%','-12%','buff','Бонус ко времени перезарядки ГК увеличен с 6 до 12%'],
    ['战斗指令第四层-主炮180度回转时间加成','-20%','-25%','buff','Бонус ко времени поворота орудий ГК увеличен с 20 до 25%'],
    ['战斗指令第四层-方向舵换挡时间加成','-20%','-25%','buff','Бонус ко времени перекладки руля увеличен с 20 до 25%'],
  ]],
  ['Hakusan','白山','日本','9','战列舰',[
    ['主炮射程','19.4 千米','18.9 千米','nerf','Дальность стрельбы ГК уменьшена с 19,4 до 18,9 км.'],
    ['主炮装填时间','32 秒','32.5 秒','nerf','Время перезарядки орудий ГК увеличено с 32 до 32,5 сек.'],
    ['100mm副炮装填时间','3.3 秒','3.5 秒','nerf','Время перезарядки 100-мм орудий ПМК увеличено с 3,3 до 3,5 сек.'],
    ['鱼雷最大伤害','19668','14718','nerf','Максимальный урон торпед уменьшен с 19668 до 14718'],
  ]],
];
export const resolvedDiscrepancy = {
  ship: "三笠04 (Mikasa '04')", attribute:'中口径火炮弹着群系数',
  nga: '1.8 → 1.65', official:'1.9 → 1.8',
  reason:'用户确认采用当前官网三笠04段落的1.9→1.8，已导入。',
};
export function reviewedNgaRecords(): OfficialBalanceRecord[] {
  return ships.flatMap(([targetName, chinese, nation, tier, type, metrics]) => metrics.map(([attribute, oldValue, newValue, trend, originalText, note]) => ({
    id:digest(`697|${targetName}|${attribute}`).slice(0,16),category:'ship',
    targetName,canonicalName:targetName,previousNames:'',nation,tier,type,attribute,oldValue,newValue,trend,
    version:'26.10',shipStatus:'test',tags:'test-ship',sourceSheet:'NGA 47645187 / blog 697',
    announcementId:'697',sourceUrl:officialUrl,publishedAt:'2026-09-29T12:00:00.000Z',originalText,
    analysisRule:'reviewed-nga-47645187',analysisConfidence:'high',
    notes:[note,attribute.includes('层-')?'保留 NGA 的负数减益表示；官网用正数表示加成幅度，幅度增大判为增强。':null,`中文译名：${chinese}；译者：${translator}`,`NGA 中文来源：${ngaUrl}`,`官方公告：${officialUrl}`].filter(Boolean).join('\n'),
    sources:[{announcementId:'697',url:officialUrl,originalText},{announcementId:'nga-47645187',url:ngaUrl,originalText:`${chinese}：${attribute} ${targetName==="Mikasa '04"&&attribute.includes('系数')?'1.8 → 1.65':`${oldValue} → ${newValue}`}`,notes:`结构化转录；译者：${translator}`}],
  })));
}
