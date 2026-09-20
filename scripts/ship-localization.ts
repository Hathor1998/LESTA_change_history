import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { BalanceChange, OfficialBalanceRecord, ShipStatus } from '../src/types.ts';

const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'').toUpperCase();
export function currentShipStatuses(history: Array<{shipId: string; shipStatus: ShipStatus; releaseEvidence: string[]; changeStage?: 'public-test'}>): Map<string, ShipStatus> {
  const facts = new Map<string, { tested: boolean; released: boolean }>();
  for (const row of history) {
    const previous = facts.get(row.shipId);
    facts.set(row.shipId, {
      tested: !!previous?.tested || row.shipStatus === 'test',
      released: !!previous?.released || row.releaseEvidence.length > 0,
    });
  }
  return new Map([...facts].map(([id, fact]) => [id, fact.released ? 'released' : fact.tested ? 'test' : 'released']));
}
export function readMo(buffer:Buffer):Record<string,string> {
  if(buffer.length<28) throw new Error('Invalid MO header');
  const magic=buffer.readUInt32LE(0);
  if(magic!==0x950412de && magic!==0xde120495) throw new Error('Invalid MO magic');
  const read=(at:number)=>magic===0x950412de?buffer.readUInt32LE(at):buffer.readUInt32BE(at);
  const count=read(8), originals=read(12), values=read(16), result:Record<string,string>={};
  if(originals+count*8>buffer.length || values+count*8>buffer.length) throw new Error('Invalid MO tables');
  for(let i=0;i<count;i++) {
    const str=(offset:number)=>{const length=read(offset),start=read(offset+4);if(start+length>buffer.length)throw new Error('Invalid MO string');return buffer.subarray(start,start+length).toString('utf8');};
    const key=str(originals+i*8), value=str(values+i*8);
    if(/^IDS_P[A-Z]S[A-Z]\d+(?:_FULL)?$/.test(key) || /^IDS_P[A-Z]UH\d+_[A-Z0-9_]+$/.test(key)) {
      if(value.length<50 && /[\u3400-\u9fff]/.test(value)) result[key]=value;
    }
  }
  return result;
}

export async function enrichShips(records:BalanceChange[], official:OfficialBalanceRecord[], translate:(s:string)=>string) {
  // Repository snapshot makes production builds independent of local MO paths.
  const dictionary=JSON.parse(await readFile('data/database/ship-localization.json','utf8')) as Record<string,string>;
  const overrides=JSON.parse(await readFile('data/database/ship-name-overrides.json','utf8')) as Array<{sourceName:string;nation:string;tier:string;type:string;gameCode:string;originalName:string}>;
  const names=new Map<string,Set<string>>();
  for(const [key,value] of Object.entries(dictionary)) {
    const suffix=key.match(/^IDS_P[A-Z]UH\d+_(?:HULL_)?(.+)$/)?.[1];
    if(suffix) {const k=norm(suffix);names.set(k,new Set([...(names.get(k)??[]),value]));}
  }
  const lookup=(name:string)=>{const values=names.get(norm(name));return values?.size===1?[...values][0]:undefined;};
  const registry=new Map<string,{shipId:string;name:string;originalNames:string[];searchAliases:string[];currentShipStatus:ShipStatus;releaseEvidence:string[]}>();
  const statusHistory: Parameters<typeof currentShipStatuses>[0] = [];
  const output=records.map(record=>{
    if(record.category!=='ship')return record;
    const sourceNames=[record.targetName,record.canonicalName,...record.previousNames];
    const override=overrides.find(o=>sourceNames.includes(o.sourceName)&&o.nation===record.nation&&o.tier===record.tier&&o.type===record.type);
    const compatible=official.filter(r=>r.nation===record.nation && r.tier===record.tier && r.type===record.type);
    const direct=compatible.filter(r=>[r.targetName,r.canonicalName,...r.previousNames.split('|')].some(n=>sourceNames.includes(n)));
    const translated=compatible.filter(r=>sourceNames.some(s=>/[\u3400-\u9fff]/.test(s)&&translate(s)===translate(r.canonicalName)));
    const foreignKeys=new Set(translated.map(r=>r.canonicalName).filter(n=>!/[\u3400-\u9fff]/.test(n)).map(norm));
    const peers=foreignKeys.size<=1?[...new Set([...direct,...translated])]:direct;
    const originals=[...new Set([...sourceNames,...peers.flatMap(r=>[r.targetName,r.canonicalName,...r.previousNames.split('|')])])].filter(n=>n && !/[\u3400-\u9fff]/.test(n));
    if(override) originals.unshift(override.originalName);
    const reliable=originals.map(lookup).filter(Boolean) as string[];
    const localized=(override && (dictionary[`IDS_${override.gameCode}`]??dictionary[`IDS_${override.gameCode}_FULL`])) || (new Set(reliable).size===1?reliable[0]:translate(record.canonicalName));
    const entityIds=[...new Set(peers.map(r=>r.entityId).filter(Boolean))];
    const identity=override?`code:${override.gameCode}`:entityIds.length===1?`entity:${entityIds[0]}`:[norm(originals[0]??record.canonicalName),record.nation,record.tier,record.type].join('|');
    const shipId=createHash('sha256').update(identity).digest('hex').slice(0,16);
    const releaseEvidence=peers.flatMap(r=>r.shipStatus==='released'&&r.changeStage!=='public-test'?(r.sources??[]).filter(s=>s.url.includes('korabli.su/ru/news/game-updates/')).map(s=>s.url):[]);
    statusHistory.push({shipId, shipStatus: record.shipStatus, releaseEvidence});
    for (const peer of peers) statusHistory.push({shipId, shipStatus: peer.shipStatus, releaseEvidence: []});
    const currentShipStatus:ShipStatus=releaseEvidence.length?'released':record.shipStatus==='test'?'test':'unknown';
    const aliases=[...new Set([...sourceNames.map(translate),...sourceNames])].filter(n=>n!==localized);
    const previous=registry.get(shipId);
    registry.set(shipId,{shipId,name:localized,originalNames:[...new Set([...(previous?.originalNames??[]),...originals])],searchAliases:[...new Set([...(previous?.searchAliases??[]),...aliases])],currentShipStatus:previous?.currentShipStatus==='released'||currentShipStatus==='released'?'released':previous?.currentShipStatus==='test'||currentShipStatus==='test'?'test':'unknown',releaseEvidence:[...new Set([...(previous?.releaseEvidence??[]),...releaseEvidence])]});
    return {...record,shipId,canonicalName:localized,targetName:localized,originalNames:originals,searchAliases:aliases,currentShipStatus};
  });
  const statuses = currentShipStatuses(statusHistory);
  for (const entry of registry.values()) entry.currentShipStatus = statuses.get(entry.shipId)!;
  await writeFile('data/database/ship-identities.json',JSON.stringify([...registry.values()],null,2)+'\n');
  return output.map(r=>r.shipId?{...r,...registry.get(r.shipId),canonicalName:registry.get(r.shipId)!.name}:r);
}
