import {UNDECLARED} from './types';

/** 供应商清单中一个组件（只保留比对需要的字段） */
export type VendorComponent={name:string;version:string;license:string};

/**
 * CycloneDX 解析层：只依赖 JSON.parse，不引入任何第三方库。
 * 兼容 CycloneDX 1.2–1.6 常见字段：
 *  - components[].licenses[].license.id | .name
 *  - components[].licenses[].expression（SPDX 表达式，原样保留）
 *  - components[].license（个别老版本直接放字符串或对象）
 */

function readLicense(value:unknown):string{
  if(typeof value==='string')return value.trim()||UNDECLARED;
  if(value&&typeof value==='object'){
    const v=value as Record<string,unknown>;
    if(typeof v.id==='string'&&v.id.trim())return v.id.trim();
    if(typeof v.name==='string'&&v.name.trim())return v.name.trim();
  }
  return UNDECLARED;
}

function readLicenses(comp:Record<string,unknown>):string{
  const list=comp.licenses;
  if(Array.isArray(list)){
    const found:string[]=[];
    for(const item of list){
      if(item&&typeof item==='object'){
        const it=item as Record<string,unknown>;
        if(typeof it.expression==='string'&&it.expression.trim())found.push(it.expression.trim());
        else if(it.license!==undefined)found.push(readLicense(it.license));
      }else if(typeof item==='string'){
        found.push(item.trim());
      }
    }
    const valid=found.filter(s=>s&&s!==UNDECLARED);
    if(valid.length)return [...new Set(valid)].join(' OR ');
    return UNDECLARED;
  }
  if(comp.license!==undefined)return readLicense(comp.license);
  return UNDECLARED;
}

export type ParseResult=
  |{ok:true;bomRef:string;components:VendorComponent[]}
  |{ok:false;error:string};

export function parseCycloneDX(text:string):ParseResult{
  let data:unknown;
  try{
    data=JSON.parse(text);
  }catch(e){
    return {ok:false,error:'JSON 格式无效：'+(e instanceof Error?e.message:String(e))};
  }
  if(!data||typeof data!=='object')return {ok:false,error:'文件内容不是 JSON 对象'};
  const bom=data as Record<string,unknown>;
  if(bom.bomFormat!==undefined&&bom.bomFormat!=='CycloneDX'){
    return {ok:false,error:`bomFormat 为 “${String(bom.bomFormat)}”，不是 CycloneDX`};
  }
  if(!Array.isArray(bom.components)){
    return {ok:false,error:'缺少 components 数组，请确认是 CycloneDX SBOM'};
  }
  const components:VendorComponent[]=[];
  for(const raw of bom.components){
    if(!raw||typeof raw!=='object')continue;
    const c=raw as Record<string,unknown>;
    if(typeof c.name!=='string'||!c.name.trim())continue;
    components.push({
      name:c.name.trim(),
      version:typeof c.version==='string'&&c.version.trim()?c.version.trim():UNDECLARED,
      license:readLicenses(c),
    });
  }
  if(!components.length)return {ok:false,error:'components 中没有可导入的组件'};
  const serial=typeof bom.serialNumber==='string'?bom.serialNumber:'';
  const version=typeof bom.version==='number'||typeof bom.version==='string'?String(bom.version):'';
  const meta=bom.metadata as Record<string,unknown>|undefined;
  const ts=meta&&typeof meta.timestamp==='string'?meta.timestamp:'';
  return {ok:true,bomRef:[serial,version&&`v${version}`,ts].filter(Boolean).join(' · ')||'未带编号',components};
}
