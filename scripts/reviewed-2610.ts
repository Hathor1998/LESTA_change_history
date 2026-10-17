import {load} from 'cheerio';
import {clean,digest} from './official-parser.ts';
import {submarine2610Rows} from './import-public-test-2610.ts';
import type {ChangeTrend,OfficialBalanceRecord} from '../src/types.ts';

type Metric=[string,string,string,ChangeTrend,string];
const blogShips: [string,string,string,string,Metric[]][]=[
  ['Vestfold','欧洲','9','巡洋舰',[
    ['主炮装填时间','13.2 秒','13.5 秒','nerf','Время перезарядки орудий ГК увеличено с 13,2 до 13,5 с.'],
  ]],
  ['Konung','欧洲','10','巡洋舰',[
    ['主炮装填时间','13 秒','12 秒','buff','Время перезарядки орудий ГК уменьшено с 13 до 12 с.'],
    ['主炮射程','17.4 千米','17.9 千米','buff','Дальность стрельбы орудий ГК увеличена с 17,4 до 17,9 км.'],
  ]],
  ['Troll','欧洲','11','巡洋舰',[
    ['主炮装填时间','13.7 秒','13 秒','buff','Время перезарядки орудий ГК уменьшено с 13,7 до 13 с.'],
    ['主炮射程','17.9 千米','18.2 千米','buff','Дальность стрельбы орудий ГК увеличена с 17,9 до 18,2 км.'],
  ]],
  ['Waterloo','英国','11','驱逐舰',[
    ['主炮射程','12.8 千米','14 千米','buff','Дальность стрельбы орудий ГК увеличена с 12,8 до 14 км.'],
    ['主炮装填时间','3.6 秒','3.5 秒','buff','Время перезарядки орудий ГК уменьшено с 3,6 до 3,5 с.'],
    ['监视雷达-舰船发现距离','7 千米','10 千米','buff','Дальность обнаружения кораблей увеличена с 7 до 10 км.'],
    ['监视雷达-作用时间','60 秒','12 秒','nerf','Время работы уменьшено с 60 до 12 с.'],
    ['监视雷达-可用次数','2','3','buff','Количество снаряжения увеличено с 2 до 3.'],
    ['深水炸弹投放动画与轨迹','—','抛射高度提高，落点略远','adjustment','Теперь глубинные бомбы при пуске взлетают выше и отлетают несколько дальше (в первую очередь призвано исправить некорректную анимацию пуска бомб).'],
  ]],
  ['Songun','泛亚','9','战列舰',[
    ['主炮装填时间','28 秒','27 秒','buff','Время перезарядки орудий ГК уменьшено с 28 до 27 с.'],
    ['中口径炮装填时间','9 秒','7.5 秒','buff','Время перезарядки орудий СК уменьшено с 9 до 7,5 с.'],
    ['战斗指令-中口径炮装填时间缩减加成','50%','65%','buff','Бонус ко времени перезарядки орудий СК при активации боевых инструкций увеличен с 50 до 65%.'],
    ['战斗指令-中口径炮高爆弹穿深加成','—','新增+30%','buff','В боевые инструкции добавлен бонус: +30% к бронепробитию ОФ-снарядов СК.'],
  ]],
  ['Hakusan','日本','9','战列舰',[
    ['主炮装填时间','32.5 秒','33 秒','nerf','Время перезарядки орудий ГК увеличено с 32,5 до 33 с.'],
    ['100毫米副炮装填时间','3.5 秒','3.7 秒','nerf','Время перезарядки 100-мм орудий ПМК увеличено с 3,5 до 3,7 с.'],
    ['140毫米副炮装填时间','5.3 秒','5.5 秒','nerf','Время перезарядки 140-мм орудий ПМК увеличено с 5.3 до 5.5 с.'],
  ]],
];

export const blog698Url='https://blog.korabli.su/blog/698';
export const release2610Url='https://korabli.su/ru/news/game-updates/update-26-10-lukomorye/';
export const publicTest2611Url='https://korabli.su/ru/news/public-test/public-test-2611/';

export function parseReviewedPublicTest2611(html:string):OfficialBalanceRecord[] {
  const $=load(html),root=$('.news-detail');
  const originalText='Изменение настроек подводных лодок: теперь субмарины будут заметны авиации на перископной глубине с двух километров.';
  const text=clean(root.text()),timestamp=Number(html.match(/publication-start="([\d.]+)"/)?.[1]);
  if(!timestamp||!text.includes('26.11')||!root.find('li').toArray().some(el=>clean($(el).text())===originalText))throw new Error('26.11 public-test source changed');
  const targetName='所有潜艇',attribute='潜望镜深度的对空被发现距离',announcementId='portal-public-test-2611';
  return [{id:digest(`${announcementId}|${targetName}|${attribute}`).slice(0,16),category:'mechanic',targetName,canonicalName:targetName,previousNames:'',nation:'',tier:'',type:'',attribute,oldValue:'—',newValue:'2 千米',trend:'adjustment',version:'26.11',shipStatus:'unknown',changeStage:'public-test',tags:'',sourceSheet:announcementId,announcementId,sourceUrl:publicTest2611Url,publishedAt:new Date(timestamp*1000).toISOString(),originalText,analysisRule:'new-value-only-needs-review',analysisConfidence:'low',notes:`26.11公测。公告未给出旧距离；不同潜艇的原参数可能不同，暂不统一判为增强或削弱。\n官方公告：${publicTest2611Url}`,sources:[{announcementId,url:publicTest2611Url,originalText}]}];
}

export function parseReviewedBlog698(html:string):OfficialBalanceRecord[] {
  const $=load(html), root=$('.article__content');
  if(!root.length||!clean($('body').text()).includes('15.10.2026')) throw new Error('Missing blog 698 body/date');
  const groups=new Map<string,{nation:string;tier:string;type:string;texts:string[]}>();
  let current='';
  root.children().each((_,element)=>{
    const node=$(element), ships=node.find('span.ship'),rest=node.clone();rest.find('span.ship').remove();
    if(ships.length===1&&!clean(rest.text())) {
      current=clean(ships.text()).replace(/^[IVX★⭐]+\s+/,'');
      if(groups.has(current))throw new Error(`Repeated ship section: ${current}`);
      groups.set(current,{nation:ships.attr('data-nation')??'',tier:ships.attr('data-level')??'',type:ships.attr('data-type')??'',texts:[]});
    } else if(current&&node.is('ul,ol')) {
      node.find('li').each((_,li)=>{const own=$(li).clone();own.find('ul,ol').remove();groups.get(current)!.texts.push(clean(own.text()));});
    }
  });
  if(groups.size!==blogShips.length)throw new Error('Blog 698 ship sections changed');
  const nationCodes:Record<string,string>={'欧洲':'europe','英国':'uk','泛亚':'pan_asia','日本':'japan'};
  const typeCodes:Record<string,string>={'巡洋舰':'cruiser','驱逐舰':'destroyer','战列舰':'battleship'};
  return blogShips.flatMap(([name,nation,tier,type,metrics])=>{
    const section=groups.get(name);
    if(!section||section.tier!==tier||section.nation!==nationCodes[nation]||section.type!==typeCodes[type])throw new Error(`Ship identity changed: ${name}`);
    // Parent radar context is independently verified; each leaf must match its own ship.
    if(name==='Waterloo'&&!section.texts.includes('Изменены параметры «Поисковой РЛС»:'))throw new Error('Waterloo radar context changed');
    const expected=new Set(metrics.map(m=>m[4]));
    for(const text of section.texts) if(!expected.has(text)&&text!=='Изменены параметры «Поисковой РЛС»:')throw new Error(`Unreviewed blog block: ${name}: ${text}`);
    return metrics.map(([attribute,oldValue,newValue,trend,originalText])=>{
      if(!section.texts.includes(originalText))throw new Error(`Blog source changed: ${name}/${attribute}`);
      return {id:digest(`698|${name}|${attribute}`).slice(0,16),category:'ship' as const,targetName:name,canonicalName:name,previousNames:'',nation,tier,type,attribute,oldValue,newValue,trend,version:'26.10',shipStatus:'test' as const,tags:'test-ship',sourceSheet:'reviewed blog 698',announcementId:'698',sourceUrl:blog698Url,publishedAt:'2026-10-15T09:00:00.000Z',originalText,analysisRule:'reviewed-blog-698',analysisConfidence:'high' as const,notes:`26.10测试舰艇调整，10月15日生效。${name==='Songun'&&attribute.includes('缩减')?'官网以正数表示装填时间缩减幅度；50%→65%代表增强。':''}${attribute.includes('动画')?'官网说明主要用于修复不正确的投放动画，按中性调整展示。':''}${['Vestfold','Konung','Troll'].includes(name)?'中文名暂用音译，公告原文名保留供搜索。':''}\n官方公告：${blog698Url}`,sources:[{announcementId:'698',url:blog698Url,originalText}]};
    });
  });
}

export function parseReviewedRelease2610(html:string):OfficialBalanceRecord[] {
  const $=load(html),heading=$('.news-detail h2').filter((_,el)=>clean($(el).text())==='Балансные изменения подводных лодок');
  const title=clean($('.news-detail').text());
  if(heading.length!==1||!title.includes('26.10'))throw new Error('Missing 26.10 release balance section');
  const root=$('<div></div>');
  heading.nextUntil('h2').each((_,el)=>{root.append($(el).clone());});
  const timestamp=Number(html.match(/publication-start="([\d.]+)"/)?.[1]);
  if(!timestamp)throw new Error('Missing release publication date');
  const groups=new Map<string,string[]>();
  const ids=new Map<string,string>();
  let current='';groups.set('',[]);
  root.find('p,li').each((_,el)=>{
    const node=$(el),ship=node.find('vue-mk-entity');
    if(ship.length===1){current=clean(ship.text()).replace(/^[IVX★⭐]+\s+/,'');groups.set(current,[]);const id=ship.attr(':entity')?.match(/id:\s*['"](\d+)/)?.[1];if(id)ids.set(current,id);}
    else if(node.is('li')){const own=node.clone();own.find('ul,ol').remove();groups.get(current)!.push(clean(own.text()));}
  });
  const expected=new Map<string,Set<string>>();
  const records=submarine2610Rows.map(([targetName,nation,tier,attribute,oldValue,newValue,trend,text]):OfficialBalanceRecord=>{
    const originalText=text.replace('(не авиаудар)','(не авиаударом)');
    const key=tier?targetName:'';
    if(!groups.get(key)?.includes(originalText))throw new Error(`Release source changed: ${targetName}/${attribute}`);
    if(!expected.has(key))expected.set(key,new Set());expected.get(key)!.add(originalText);
    return {id:digest(`portal-16861|${targetName}|${attribute}`).slice(0,16),category:tier?'ship':'mechanic',targetName,canonicalName:targetName,previousNames:'',nation,tier,type:tier?'潜艇':'',attribute,oldValue,newValue,trend,version:'26.10',shipStatus:tier?'released':'unknown',tags:tier?'released-ship':'',sourceSheet:'reviewed release 26.10',announcementId:'portal-16861',sourceUrl:release2610Url,publishedAt:new Date(timestamp*1000).toISOString(),originalText,entityId:ids.get(targetName),analysisRule:'reviewed-release-2610',analysisConfidence:'high',notes:`26.10正式版本公告确认采用。公测阶段记录另行保留。${tier?'':'通用机制，不重复展开到每艘潜艇。'}\n官方公告：${release2610Url}`,sources:[{announcementId:'portal-16861',url:release2610Url,originalText}]};
  });
  for(const [name,texts] of groups)for(const text of texts)if(!expected.get(name)?.has(text)&&text!=='Изменены параметры снаряжения «Гидроакустический поиск»:')throw new Error(`Unreviewed release block: ${name}: ${text}`);
  return records;
}

export function mergeReviewed2610(existing:OfficialBalanceRecord[],incoming:OfficialBalanceRecord[]) {
  const records=structuredClone(existing),added:string[]=[];
  for(const candidate of incoming){
    const matches=records.filter(r=>r.id===candidate.id||(r.announcementId===candidate.announcementId&&r.targetName===candidate.targetName&&r.nation===candidate.nation&&r.tier===candidate.tier&&r.type===candidate.type&&r.changeStage===candidate.changeStage&&(r.originalText===candidate.originalText||r.attribute===candidate.attribute)));
    if(matches.length>1)throw new Error(`Ambiguous reviewed change: ${candidate.id}`);
    if(matches.length){const prior=matches[0];if(prior.oldValue!==candidate.oldValue||prior.newValue!==candidate.newValue)throw new Error(`Reviewed value conflict: ${candidate.id}`);}
    else {records.push(candidate);added.push(candidate.id);}
  }
  return {records,added};
}
