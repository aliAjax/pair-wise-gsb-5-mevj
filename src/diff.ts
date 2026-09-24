import {classifyLicense,licenseNote,UNDECLARED,type Dep} from './types';
import type {VendorComponent} from './parser';

export type DiffKind='added'|'missing'|'mismatch'|'same';
/** vendor=采用供应商值；local=保留本地（扫描）值 */
export type Choice='vendor'|'local';

export type DiffItem={
  key:string;
  kind:DiffKind;
  name:string;
  vendorVersion:string;
  vendorLicense:string;
  localVersion:string;
  localLicense:string;
};

export type OutcomeStats={added:number;removed:number;licenseChanged:number;kept:number;ignored:number};

const norm=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
export const keyOf=(name:string,version:string)=>`${norm(name)}@${norm(version)||UNDECLARED}`;

/** 同一 name@version 在供应商清单中出现多次时合并许可证 */
function indexVendor(list:VendorComponent[]):Map<string,DiffItem>{
  const map=new Map<string,DiffItem>();
  for(const c of list){
    const key=keyOf(c.name,c.version);
    const prev=map.get(key);
    if(prev){
      const licenses=[...new Set([prev.vendorLicense,c.license].filter(l=>l&&l!==UNDECLARED))];
      prev.vendorLicense=licenses.join(' OR ')||UNDECLARED;
    }else{
      map.set(key,{key,kind:'same',name:c.name.trim(),vendorVersion:c.version,vendorLicense:c.license,localVersion:'',localLicense:''});
    }
  }
  return map;
}

/** 计算新增 / 缺失 / 许可证不一致 / 一致 四组结果（纯函数） */
export function buildDiff(local:Dep[],vendor:VendorComponent[]):DiffItem[]{
  const vMap=indexVendor(vendor);
  const lMap=new Map<string,Dep>();
  for(const d of local){if(!lMap.has(keyOf(d.name,d.version)))lMap.set(keyOf(d.name,d.version),d)}

  const items:DiffItem[]=[];
  for(const item of vMap.values()){
    const localDep=lMap.get(item.key);
    if(!localDep){
      item.kind='added';
    }else if(norm(localDep.license)!==norm(item.vendorLicense)){
      item.kind='mismatch';
      item.localVersion=localDep.version;
      item.localLicense=localDep.license;
    }else{
      item.kind='same';
      item.localVersion=localDep.version;
      item.localLicense=localDep.license;
    }
    items.push(item);
  }
  for(const [key,dep] of lMap){
    if(!vMap.has(key)){
      items.push({key,kind:'missing',name:dep.name,vendorVersion:'',vendorLicense:'',localVersion:dep.version,localLicense:dep.license});
    }
  }
  const order:Record<DiffKind,number>={mismatch:0,added:1,missing:2,same:3};
  return items.sort((a,b)=>order[a.kind]-order[b.kind]||a.name.localeCompare(b.name));
}

export const needsDecision=(i:DiffItem)=>i.kind!=='same';
export const pendingOf=(items:DiffItem[],choices:Record<string,Choice>)=>
  items.filter(i=>needsDecision(i)&&!choices[i.key]).length;

/** 批次内容指纹：同一份 CycloneDX 批次重复导入时可识别，不重复添加 */
export function fingerprint(components:VendorComponent[]):string{
  const rows=components.map(c=>`${norm(c.name)}|${norm(c.version)}|${norm(c.license)}`).sort();
  // FNV-1a 32 位，两次哈希避免短串碰撞，零依赖
  const fnv=(s:string)=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}return (h>>>0).toString(16)};
  return fnv(rows.join('\n'))+fnv(rows.length+'#'+rows.join(''));
}

export type AppliedResult={deps:Dep[];stats:OutcomeStats;outcomes:{key:string;kind:DiffKind;choice:Choice;detail:string}[]};

/** 按逐项选择把比对结果应用到扫描清单（纯函数，不碰存储） */
export function applyDiff(deps:Dep[],items:DiffItem[],choices:Record<string,Choice>,nextId:number):AppliedResult{
  const stats:OutcomeStats={added:0,removed:0,licenseChanged:0,kept:0,ignored:0};
  const outcomes:AppliedResult['outcomes']=[];
  const removeKeys=new Set<string>();
  const licenseByKey=new Map<string,string>();

  for(const item of items){
    const choice=choices[item.key];
    if(item.kind==='added'){
      if(choice==='vendor'){stats.added++;outcomes.push({key:item.key,kind:item.kind,choice,detail:`新增 ${item.name}@${item.vendorVersion}（${item.vendorLicense}）`})}
      else if(choice==='local'){stats.ignored++;outcomes.push({key:item.key,kind:item.kind,choice,detail:`跳过 ${item.name}@${item.vendorVersion}，未加入清单`})}
    }else if(item.kind==='missing'){
      if(choice==='vendor'){removeKeys.add(item.key);stats.removed++;outcomes.push({key:item.key,kind:item.kind,choice,detail:`移除 ${item.name}@${item.localVersion}（供应商清单无此组件）`})}
      else{stats.kept++;outcomes.push({key:item.key,kind:item.kind,choice:choice??'local',detail:`保留 ${item.name}@${item.localVersion}`})}
    }else if(item.kind==='mismatch'){
      if(choice==='vendor'){licenseByKey.set(item.key,item.vendorLicense);stats.licenseChanged++;outcomes.push({key:item.key,kind:item.kind,choice,detail:`${item.name} 许可证改为 ${item.vendorLicense}`})}
      else{stats.kept++;outcomes.push({key:item.key,kind:item.kind,choice:choice??'local',detail:`${item.name} 保留本地许可证 ${item.localLicense}`})}
    }else{
      stats.kept++;outcomes.push({key:item.key,kind:'same',choice:'local',detail:`${item.name}@${item.localVersion} 双方一致（${item.localLicense}）`});
    }
  }

  let id=nextId;
  const result:Dep[]=[];
  for(const d of deps){
    const key=keyOf(d.name,d.version);
    if(removeKeys.has(key))continue;
    const newLicense=licenseByKey.get(key);
    if(newLicense!==undefined){
      result.push({...d,license:newLicense,source:'供应商核对',status:classifyLicense(newLicense),note:licenseNote(newLicense)});
    }else{
      result.push(d);
    }
  }
  for(const item of items){
    if(item.kind==='added'&&choices[item.key]==='vendor'){
      result.push({id:id++,name:item.name,version:item.vendorVersion,license:item.vendorLicense,source:'供应商导入',status:classifyLicense(item.vendorLicense),note:licenseNote(item.vendorLicense)});
    }
  }
  return {deps:result,stats,outcomes};
}
