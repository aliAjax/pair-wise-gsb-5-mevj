import {type Dep} from './types';
import type {AppliedResult} from './diff';
import type {DiffKind,Choice} from './diff';

/** 一次供应商清单导入批次的留痕：来源、时间、逐项处理结果 */
export type ImportRecord={
  id:number;
  fingerprint:string;
  source:string;
  fileName:string;
  bomRef:string;
  importedAt:string;
  componentCount:number;
  stats:AppliedResult['stats'];
  outcomes:{key:string;kind:DiffKind;choice:Choice;detail:string}[];
};

export type Store={deps:Dep[];imports:ImportRecord[];nextId:number};

const KEY_V2='license-lens-v2';
const KEY_V1='license-lens';

export const initialDeps:Dep[]=[
  {id:1,name:'react',version:'18.3.1',license:'MIT',source:'npm',status:'ok',note:'宽松许可，可商用'},
  {id:2,name:'lodash',version:'4.17.21',license:'MIT',source:'npm',status:'ok',note:'宽松许可，可商用'},
  {id:3,name:'chart.js',version:'4.4.4',license:'MIT',source:'npm',status:'ok',note:'宽松许可，可商用'},
  {id:4,name:'highlight.js',version:'11.10.0',license:'BSD-3-Clause',source:'npm',status:'warn',note:'再发布需保留版权声明'},
  {id:5,name:'legacy-parser',version:'2.1.0',license:'GPL-3.0',source:'手动',status:'risk',note:'可能与闭源分发冲突'},
];

export function loadStore():Store{
  try{
    const raw=localStorage.getItem(KEY_V2);
    if(raw){
      const data=JSON.parse(raw) as Store;
      if(Array.isArray(data.deps))return {deps:data.deps,imports:Array.isArray(data.imports)?data.imports:[],nextId:data.nextId||Date.now()};
    }
  }catch{/* 落到迁移逻辑 */}
  // 迁移旧版记录：旧清单仍能打开，不丢数据
  try{
    const legacy=localStorage.getItem(KEY_V1);
    if(legacy){
      const deps=JSON.parse(legacy) as Dep[];
      if(Array.isArray(deps)&&deps.length){
        const nextId=Math.max(...deps.map(d=>d.id),0)+1;
        const store={deps,imports:[],nextId};
        saveStore(store);
        return store;
      }
    }
  }catch{/* 落到初始数据 */}
  return {deps:initialDeps,imports:[],nextId:6};
}

export function saveStore(store:Store):void{
  localStorage.setItem(KEY_V2,JSON.stringify(store));
}

/** 同内容批次是否已导入过（用于去重提示） */
export function findImport(store:Store,fp:string):ImportRecord|undefined{
  return store.imports.find(r=>r.fingerprint===fp);
}
