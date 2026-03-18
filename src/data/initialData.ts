import { BalanceChange } from '../types';

export const initialData: BalanceChange[] = [
  // 舰船改动
  { id: '1', category: 'ship', targetName: '汉诺威', nation: '德国', tier: '11', type: '战列舰', attribute: '远程防空伤害', oldValue: '221', newValue: '298', version: '12.8', notes: '-', trend: 'buff' },
  { id: '2', category: 'ship', targetName: '汉诺威', nation: '德国', tier: '11', type: '战列舰', attribute: '一次齐射防空爆炸数', oldValue: '9', newValue: '11', version: '12.8', notes: '-', trend: 'buff' },
  { id: '3', category: 'ship', targetName: '汉诺威', nation: '德国', tier: '11', type: '战列舰', attribute: '黑云爆炸伤害', oldValue: '1820', newValue: '1680', version: '12.8', notes: '-', trend: 'nerf' },
  { id: '4', category: 'ship', targetName: '汉诺威', nation: '德国', tier: '11', type: '战列舰', attribute: '主炮组180度回转时间', oldValue: '22.5秒', newValue: '15秒', version: '12.2', notes: '-', trend: 'buff' },
  { id: '5', category: 'ship', targetName: '汉诺威', nation: '德国', tier: '11', type: '战列舰', attribute: '主炮装填时间', oldValue: '10秒', newValue: '8秒', version: '12.2', notes: '-', trend: 'buff' },
  { id: '6', category: 'ship', targetName: '诺丁汉', nation: '英国', tier: '8', type: '巡洋舰', attribute: '主炮装填时间', oldValue: '13秒', newValue: '12秒', version: '12.11', notes: '-', trend: 'buff' },
  { id: '7', category: 'ship', targetName: '诺丁汉', nation: '英国', tier: '8', type: '巡洋舰', attribute: '主炮装填时间', oldValue: '28秒', newValue: '29秒', version: '12.11', notes: '-', trend: 'nerf' },
  { id: '8', category: 'ship', targetName: '内布拉斯加', nation: '美国', tier: '8', type: '战列舰', attribute: '主炮全角度旋转', oldValue: '无360炮塔', newValue: '有360炮塔', version: '12.11', notes: '瞄准角度略有减小', trend: 'buff' },
  { id: '9', category: 'ship', targetName: '内布拉斯加', nation: '美国', tier: '8', type: '战列舰', attribute: '射击机制', oldValue: '连发齐射 (打) 2发', newValue: '单发齐射射击2次', version: '12.11', notes: '连发机制：单发开火间隔3s', trend: 'adjustment' },
  { id: '10', category: 'ship', targetName: '内布拉斯加', nation: '美国', tier: '8', type: '战列舰', attribute: 'HE炮弹起火率', oldValue: '0.05', newValue: '0.09', version: '12.11', notes: '-', trend: 'buff' },
  { id: '11', category: 'ship', targetName: '内布拉斯加', nation: '美国', tier: '8', type: '战列舰', attribute: '炸弹半径', oldValue: '750米', newValue: '660米', version: '12.11', notes: '-', trend: 'buff' },
  { id: '12', category: 'ship', targetName: '内布拉斯加', nation: '美国', tier: '8', type: '战列舰', attribute: '方向舵换挡时间', oldValue: '5.1秒', newValue: '3.7秒', version: '12.11', notes: '-', trend: 'buff' },
  { id: '13', category: 'ship', targetName: '马汉', nation: '美国', tier: '7', type: '驱逐舰', attribute: '消耗品调整', oldValue: '"防御型对空火力"消耗品', newValue: '移至单独栏', version: '13.1', notes: '-', trend: 'buff' },
  { id: '14', category: 'ship', targetName: '马汉', nation: '美国', tier: '7', type: '驱逐舰', attribute: '基础鱼雷射程', oldValue: '6.4', newValue: '7.1', version: '13.1', notes: '-', trend: 'buff' },
  { id: '15', category: 'ship', targetName: '马汉', nation: '美国', tier: '7', type: '驱逐舰', attribute: '二号主炮塔旋转角度', oldValue: '-', newValue: '360度炮塔', version: '13.1', notes: '-', trend: 'buff' },
  
  // 机制改动
  { id: 'm1', category: 'mechanic', targetName: '潜艇下潜机制', nation: '', tier: '', type: '全局机制', attribute: '被发现时下潜能力消耗', oldValue: '1单位/秒', newValue: '1.5单位/秒', version: '13.1', notes: '加快潜艇被点亮时的消耗', trend: 'nerf' },
  { id: 'm2', category: 'mechanic', targetName: '副炮精度机制', nation: '', tier: '', type: '全局机制', attribute: '基础散布公式', oldValue: '标准散布', newValue: '随距离线性衰减', version: '13.0', notes: '近距离副炮更准', trend: 'adjustment' },
  { id: 'm3', category: 'mechanic', targetName: '航母视野机制', nation: '', tier: '', type: '全局机制', attribute: '飞机点亮水面舰艇', oldValue: '全队共享视野', newValue: '仅小地图共享 (测试)', version: '13.2', notes: '视野机制重大重做', trend: 'adjustment' },

  // 杂项改动 (舰长/传奇插)
  { id: 'c1', category: 'misc', targetName: '吕特晏斯 (传奇舰长)', nation: '德国', tier: '', type: '舰长', attribute: '副炮天赋触发条件', oldValue: '100次副炮命中', newValue: '150次副炮命中', version: '12.10', notes: '削弱了副炮流触发速度', trend: 'nerf' },
  { id: 'c2', category: 'misc', targetName: '哈尔西 (传奇舰长)', nation: '美国', tier: '', type: '舰长', attribute: '隐蔽专家技能加成', oldValue: '-10%', newValue: '-11.5%', version: '12.9', notes: '强化了专属技能', trend: 'buff' },
  { id: 'u1', category: 'misc', targetName: '得梅因 (传奇插)', nation: '美国', tier: '10', type: '传奇插', attribute: '雷达持续时间惩罚', oldValue: '-10%', newValue: '-20%', version: '12.9', notes: '进一步限制了雷达时间', trend: 'nerf' },
  { id: 'u2', category: 'misc', targetName: '大和 (传奇插)', nation: '日本', tier: '10', type: '传奇插', attribute: '主炮装填时间收益', oldValue: '-6%', newValue: '-5%', version: '13.1', notes: '', trend: 'nerf' },
];
