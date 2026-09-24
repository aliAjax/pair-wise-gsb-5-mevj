import {useMemo,useState} from 'react';
import {ArrowLeft,AlertTriangle,Check,ClipboardPaste,FileUp,GitCompareArrows,History,MinusCircle,PencilLine,PlusCircle,SearchCode,ShieldCheck,X} from 'lucide-react';
import {parseCycloneDX,type VendorComponent} from './parser';
import {buildDiff,fingerprint,pendingOf,type Choice,type DiffItem,type DiffKind} from './diff';
import type {ImportRecord} from './storage';
import type {Dep} from './types';

export type ImportMeta={fileName:string;bomRef:string;fp:string;components:VendorComponent[]};

type Props={
  deps:Dep[];
  imports:ImportRecord[];
  onCommit:(meta:ImportMeta,items:DiffItem[],choices:Record<string,Choice>)=>void;
  onBack:()=>void;
};

type Phase='input'|'review'|'done';

const SAMPLE=JSON.stringify({
  bomFormat:'CycloneDX',specVersion:'1.5',version:1,
  serialNumber:'urn:uuid:sample-demo-0001',
  metadata:{timestamp:'2026-09-24T08:00:00Z'},
  components:[
    {type:'library',name:'react',version:'18.3.1',licenses:[{license:{id:'MIT'}}]},
    {type:'library',name:'lodash',version:'4.17.21',licenses:[{license:{id:'MIT'}}]},
    {type:'library',name:'chart.js',version:'4.4.4',licenses:[{license:{id:'Apache-2.0'}}]},
    {type:'library',name:'dayjs',version:'1.11.13',licenses:[{license:{id:'MIT'}}]},
    {type:'library',name:'vendor-toolkit',version:'3.0.2',licenses:[{license:{id:'Apache-2.0'}}]},
  ],
},null,2);

const KIND_LABEL:Record<DiffKind,string>={added:'新增组件',missing:'本地多出',mismatch:'许可证不一致',same:'双方一致'};

function fmtTime(iso:string){try{return new Date(iso).toLocaleString('zh-CN',{hour12:false})}catch{return iso}}

export default function CompareView({deps,imports,onCommit,onBack}:Props){
  const [raw,setRaw]=useState('');
  const [fileName,setFileName]=useState('粘贴输入');
  const [error,setError]=useState('');
  const [meta,setMeta]=useState<ImportMeta|null>(null);
  const [choices,setChoices]=useState<Record<string,Choice>>({});
  const [phase,setPhase]=useState<Phase>('input');
  const [record,setRecord]=useState<ImportRecord|null>(null);

  const items=useMemo(()=>meta?buildDiff(deps,meta.components):[],
    // 比对结果只需跟随当前批次重新计算
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta]);

  const groups=useMemo(()=>{
    const g:Record<DiffKind,DiffItem[]>={added:[],missing:[],mismatch:[],same:[]};
    for(const i of items)g[i.kind].push(i);
    return g;
  },[items]);

  const pending=meta?pendingOf(items,choices):0;
  const duplicate=meta?imports.find(r=>r.fingerprint===meta.fp):undefined;

  const doParse=(text:string,name:string)=>{
    const r=parseCycloneDX(text);
    if(!r.ok){setError(r.error);return}
    setError('');
    setMeta({fileName:name,bomRef:r.bomRef,fp:fingerprint(r.components),components:r.components});
    setChoices({});
    setPhase('review');
  };

  const onFile=(f:File)=>{
    setFileName(f.name||'供应商清单.json');
    f.text().then(t=>{setRaw(t);doParse(t,f.name||'供应商清单.json')}).catch(()=>setError('读取文件失败'));
  };

  const choose=(key:string,c:Choice)=>setChoices(prev=>({...prev,[key]:c}));
  const chooseAll=(c:Choice)=>{
    const next:Record<string,Choice>={};
    for(const i of items)if(i.kind!=='same')next[i.key]=c;
    setChoices(next);
  };

  const confirm=()=>{
    if(!meta||pending>0||duplicate)return;
    onCommit(meta,items,choices);
    setPhase('done');
  };

  const reset=()=>{setMeta(null);setChoices({});setRaw('');setError('');setFileName('粘贴输入');setPhase('input')};
  const pickFile=()=>document.getElementById('cmp-file')?.click();

  return (
    <div className="compare">
      <div className="compare-head">
        <div>
          <button className="back-link" onClick={onBack}><ArrowLeft size={14}/> 返回依赖总览</button>
          <h1><GitCompareArrows size={22}/> 供应商清单比对</h1>
          <p>粘贴供应商提供的 CycloneDX JSON，逐项核对后再写入扫描清单。</p>
        </div>
        <button className="outline" onClick={pickFile}><FileUp size={15}/>选择文件</button>
        <input id="cmp-file" type="file" accept=".json,application/json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)onFile(f);e.target.value=''}}/>
      </div>

      {phase==='input'&&(
        <div className="cmp-grid">
          <div className="cmp-card">
            <div className="cmp-card-head"><ClipboardPaste size={16}/><h2>粘贴 CycloneDX JSON</h2></div>
            <textarea className="cmp-input" value={raw} onChange={e=>{setRaw(e.target.value);setError('')}} placeholder='{"bomFormat":"CycloneDX","components":[{"name":"...","version":"...","licenses":[...]}]}'/>
            {error&&<div className="cmp-error"><AlertTriangle size={14}/>{error}</div>}
            <div className="cmp-actions">
              <button className="linkish" onClick={()=>{setRaw(SAMPLE);setError('')}}>填入示例数据</button>
              <button className="primary" disabled={!raw.trim()} onClick={()=>doParse(raw,fileName)}><SearchCode size={15}/>解析并比对</button>
            </div>
            <p className="cmp-hint">按 名称@版本 匹配组件；仅识别 JSON 中的 components 名称、版本与许可证，数据不离开本机。</p>
          </div>
          <div className="cmp-card">
            <div className="cmp-card-head"><History size={16}/><h2>导入留痕（{imports.length}）</h2></div>
            {imports.length===0&&<p className="cmp-empty">还没有导入过供应商清单。确认写入后会在这里保留来源、时间与逐项处理结果。</p>}
            <div className="hist-list">
              {imports.map(r=>(
                <button className="hist-item" key={r.id} onClick={()=>setRecord(r)}>
                  <div className="hist-icon"><FileUp size={15}/></div>
                  <div className="hist-body">
                    <b>{r.fileName}</b>
                    <small>{fmtTime(r.importedAt)} · {r.componentCount} 个组件</small>
                    <span className="hist-tags">
                      {r.stats.added>0&&<i className="h-add">+{r.stats.added}</i>}
                      {r.stats.removed>0&&<i className="h-miss">-{r.stats.removed}</i>}
                      {r.stats.licenseChanged>0&&<i className="h-mis">改 {r.stats.licenseChanged}</i>}
                      {r.stats.ignored>0&&<i className="h-skip">跳过 {r.stats.ignored}</i>}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase==='review'&&meta&&(
        <div className="cmp-card review">
          <div className="review-top">
            <div>
              <h2>{meta.fileName}</h2>
              <p>批次标识：{meta.bomRef} · 解析于 {fmtTime(new Date().toISOString())} · 共 {meta.components.length} 个供应商组件</p>
            </div>
            <div className="review-counts">
              <span className="rc-add"><PlusCircle size={14}/>{groups.added.length} 新增</span>
              <span className="rc-miss"><MinusCircle size={14}/>{groups.missing.length} 缺失</span>
              <span className="rc-mis"><PencilLine size={14}/>{groups.mismatch.length} 许可证不一致</span>
              <span className="rc-same"><Check size={14}/>{groups.same.length} 一致</span>
            </div>
          </div>

          {duplicate&&(
            <div className="dup-banner">
              <AlertTriangle size={16}/>
              <div><b>这一批已经导入过</b><p>相同内容曾于 {fmtTime(duplicate.importedAt)} 导入（{duplicate.fileName}）。为避免重复添加，本次不能再次提交，可在右侧查看上次处理结果。</p></div>
              <button className="outline" onClick={()=>setRecord(duplicate)}>查看旧记录</button>
            </div>
          )}

          <div className="bulk-bar">
            <span>批量操作：</span>
            <button onClick={()=>chooseAll('vendor')}>全部采用供应商值</button>
            <button onClick={()=>chooseAll('local')}>全部保留本地值</button>
            <span className={pending>0?'bulk-ok':'bulk-pending'}>{pending===0?'全部项已处理':`还有 ${pending} 项未处理`}</span>
          </div>

          {(['mismatch','added','missing','same'] as DiffKind[]).map(kind=>(
            groups[kind].length>0&&(
              <div className="diff-group" key={kind}>
                <div className="diff-group-head"><span className={'dg-dot dg-'+kind}/>{KIND_LABEL[kind]}<b>{groups[kind].length}</b></div>
                {groups[kind].map(i=>{
                  const c=choices[i.key];
                  return <div className={'diff-row kind-'+i.kind+(c?' decided pick-'+c:'')} key={i.key}>
                    <div className="dr-main">
                      <b className="dr-name">{i.name}</b>
                      <div className="dr-vals">
                        <div className="dr-side vendor">
                          <label>供应商</label>
                          {i.kind==='missing'
                            ? <span className="dr-empty">未列出此组件</span>
                            : <span className="dr-coord">{i.vendorVersion} <em className="lic-badge" style={licStyle(i.vendorLicense)}>{i.vendorLicense}</em></span>}
                        </div>
                        <div className="dr-arrow">vs</div>
                        <div className="dr-side local">
                          <label>本地扫描</label>
                          {i.kind==='added'
                            ? <span className="dr-empty">无此组件</span>
                            : <span className="dr-coord">{i.localVersion} <em className="lic-badge" style={licStyle(i.localLicense)}>{i.localLicense}</em></span>}
                        </div>
                      </div>
                    </div>
                    {i.kind==='same'
                      ? <span className="dr-auto"><Check size={13}/>无需处理</span>
                      : <div className="dr-choice">
                          <button className={c==='vendor'?'on v':'v'} onClick={()=>choose(i.key,'vendor')}>{vendorLabel(i.kind)}</button>
                          <button className={c==='local'?'on l':'l'} onClick={()=>choose(i.key,'local')}>{localLabel(i.kind)}</button>
                        </div>}
                  </div>;
                })}
              </div>
            )
          ))}

          <div className="review-foot">
            <button className="outline" onClick={reset}>取消</button>
            <div className="foot-right">
              {pending>0&&<span className="foot-hint"><AlertTriangle size={14}/>未处理完不能提交</span>}
              <button className="primary" disabled={pending>0||!!duplicate} onClick={confirm}><ShieldCheck size={15}/>确认写入扫描清单</button>
            </div>
          </div>
        </div>
      )}

      {phase==='done'&&meta&&(
        <DoneCard meta={meta} record={imports.find(r=>r.fingerprint===meta.fp)??null}
          onViewRecord={r=>setRecord(r)} onClose={reset}/>
      )}

      {record&&<RecordModal record={record} onClose={()=>setRecord(null)}/>}
    </div>
  );
}

function vendorLabel(kind:DiffKind){return kind==='added'?'供应商值 · 加入':kind==='missing'?'供应商值 · 移除':'采用供应商许可证'}
function localLabel(kind:DiffKind){return kind==='added'?'本地值 · 跳过':kind==='missing'?'保留本地组件':'保留本地许可证'}

function licStyle(license:string){
  const colors:Record<string,string>={MIT:'#35b995','BSD-3-Clause':'#6d9ee8','GPL-3.0':'#ec8c75','Apache-2.0':'#b18ee4',未声明:'#9aa8ab'};
  const col=colors[license]||'#8d9ba0';
  return {color:col,background:col+'18'};
}

function DoneCard({meta,record,onViewRecord,onClose}:{meta:ImportMeta;record:ImportRecord|null;onViewRecord:(r:ImportRecord)=>void;onClose:()=>void}){
  const s=record?.stats;
  return <div className="cmp-card done-card">
    <div className="done-ring"><Check size={26}/></div>
    <h2>已写入扫描清单</h2>
    <p>{meta.fileName} 的核对结果已保存，导入来源、时间与逐项处理结果可在“导入留痕”中回看。</p>
    <div className="done-stats">
      <div><b className="teal">{s?.added??0}</b><span>新增</span></div>
      <div><b className="red">{s?.removed??0}</b><span>移除</span></div>
      <div><b className="orange">{s?.licenseChanged??0}</b><span>许可证更新</span></div>
      <div><b>{s?.kept??0}</b><span>保留</span></div>
      <div><b className="muted2">{s?.ignored??0}</b><span>跳过</span></div>
    </div>
    <div className="cmp-actions">
      <button className="outline" disabled={!record} onClick={()=>record&&onViewRecord(record)}>查看留痕</button>
      <button className="primary" onClick={onClose}>完成</button>
    </div>
  </div>;
}

function RecordModal({record,onClose}:{record:ImportRecord;onClose:()=>void}){
  const s=record.stats;
  return <div className="backdrop" onClick={onClose}>
    <div className="modal rec-modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-head">
        <div><h2>{record.fileName}</h2><small>{fmtTime(record.importedAt)} 导入 · {record.source}</small></div>
        <button onClick={onClose}><X size={18}/></button>
      </div>
      <div className="rec-meta">批次标识：{record.bomRef} · {record.componentCount} 个组件</div>
      <div className="done-stats">
        <div><b className="teal">{s.added}</b><span>新增</span></div>
        <div><b className="red">{s.removed}</b><span>移除</span></div>
        <div><b className="orange">{s.licenseChanged}</b><span>许可证更新</span></div>
        <div><b>{s.kept}</b><span>保留</span></div>
        <div><b className="muted2">{s.ignored}</b><span>跳过</span></div>
      </div>
      <div className="rec-outcomes">
        {record.outcomes.map((o,idx)=>(
          <div className="rec-row" key={o.key+idx}>
            <span className={'dg-dot dg-'+o.kind}/>
            <span className="rec-detail">{o.detail}</span>
            <i className={'rec-choice '+(o.choice==='vendor'?'v':'l')}>{o.choice==='vendor'?'供应商值':'本地值'}</i>
          </div>
        ))}
      </div>
    </div>
  </div>;
}
