import { createHash } from 'node:crypto';
import type { OfficialBalanceRecord } from '../src/types.ts';

// Reviewed against blog/695. Cumulative effects describe the same mechanic,
// not a second set of balance changes. Missing historical values stay unknown.
export function schwaben695(url: string, publishedAt: string): OfficialBalanceRecord[] {
  const rows = [
    ['战斗指令：作战组 оперативное управление','新增“作战组协同指挥”','adjustment','Добавлены многоуровневые боевые инструкции','每场最多激活四次，效果叠加并持续至战斗结束；主炮命中积累进度，达到100%自动激活。机制名称为暂译。'],
    ['战斗指令：每次主炮命中积累进度','17%','adjustment','Прогресс за одно попадание: 17%',''],
    ['战斗指令：进度衰减前延迟','60 秒','adjustment','Задержка перед потерей прогресса: 60 с',''],
    ['战斗指令：每秒进度衰减','17%','adjustment','Потеря прогресса в секунду: 17%',''],
    ['战斗指令：每次激活主炮最大散布半径','-2.5%','buff','-2,5% к максимальному радиусу рассеивания снарядов ГК','四次累计：-10%。'],
    ['战斗指令：每次激活主炮转速','+5%','buff','+5% к скорости поворота орудий ГК','四次累计：+20%。'],
    ['战斗指令：每次激活方向舵换挡时间','-5%','buff','-5% ко времени перекладки рулей','四次累计：-20%。'],
    ['战斗指令：每次激活主炮装填时间','-1.5%','buff','-1,5% ко времени перезарядки орудий ГК','四次累计：-6%。'],
    ['主炮180度旋转时间','50 秒','buff','Время поворота орудий ГК на 180 градусов уменьшено с 60 до 50 с',''],
    ['主炮装填时间','36 秒','nerf','Время перезарядки орудий ГК увеличено с 35 до 36 с',''],
  ];
  return rows.map(([attribute,newValue,trend,originalText,notes],i)=>({
    id:createHash('sha256').update(`695|Schwaben|${i}`).digest('hex').slice(0,16),category:'ship',
    announcementId:'695',sourceUrl:url,publishedAt,originalText,targetName:'Schwaben',canonicalName:'Schwaben',previousNames:'',
    nation:'德国',tier:'11',type:'战列舰',attribute:attribute.replace(' оперативное управление',''),oldValue:i===8?'60 秒':i===9?'35 秒':'—',newValue,
    version:'26.9',notes:`官方公告：${url}\n${notes}`,trend:trend as OfficialBalanceRecord['trend'],shipStatus:'test',tags:'',sourceSheet:'blog 695',
    analysisRule:'reviewed-blog-695',analysisConfidence:i<4?'medium':'high',sources:[{announcementId:'695',url,originalText}],
  }));
}
