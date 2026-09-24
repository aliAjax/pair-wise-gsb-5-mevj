import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,Check,ChevronDown,Download,FileCode2,GitCompareArrows,Info,Layers3,Plus,Search,ShieldCheck,Sparkles,X} from 'lucide-react';
import {classifyLicense,licenseNote,type Dep} from './types';
import {loadStore,saveStore,type ImportRecord,type Store} from './storage';
import {applyDiff,type Choice,type DiffItem} from './diff';
import CompareView,{type ImportMeta} from './CompareView';

const colors:Record<string,string>={MIT:'#35b995','BSD-3-Clause':'#6d9ee8','GPL-3.0':'#ec8c75','Apache-2.0':'#b18ee4'};
type View='overview'|'compare';

export default function App(){
  const [store,setStore]=useState<Store>(loadStore);
  const [view,setView]=useState<View>('overview');
  useEffect(()=>saveStore(store),[store]);

  const deps=store.deps;

  /** 比对页确认后：应用逐项选择、写入扫描清单并留下导入批次记录 */
  const handleCommit=(meta:ImportMeta,items:DiffItem[],choices:Record<string,Choice>)=>{
    setStore(prev=>{
      if(prev.imports.some(r=>r.fingerprint===meta.fp))return prev; // 双重保险：同批不重复添加
      const applied=applyDiff(prev.deps,items,choices,prev.nextId);
      const record:ImportRecord={
        id:Date.now(),
        fingerprint:meta.fp,
        source:'CycloneDX JSON',
        fileName:meta.fileName,
        bomRef:meta.bomRef,
        importedAt:new Date().toISOString(),
        componentCount:meta.components.length,
        stats:applied.stats,
        outcomes:applied.outcomes,
      };
      return {deps:applied.deps,imports:[record,...prev.imports],nextId:Math.max(prev.nextId,...applied.deps.map(d=>d.id))+1};
    });
  };

  if(view==='compare'){
    return <Shell view={view} onNav={setView} depsCount={deps.length} riskCount={deps.filter(d=>d.status==='risk').length}>
      <CompareView deps={deps} imports={store.imports} onCommit={handleCommit} onBack={()=>setView('overview')}/>
    </Shell>;
  }
  return <Shell view={view} onNav={setView} depsCount={deps.length} riskCount={deps.filter(d=>d.status==='risk').length}>
    <Overview deps={deps} setDeps={updater=>setStore(p=>({...p,deps:updater(p.deps)}))}/>
  </Shell>;
}

type SetDeps=(fn:(ds:Dep[])=>Dep[])=>void;

function Shell({view,onNav,depsCount,riskCount,children}:{view:View;onNav:(v:View)=>void;depsCount:number;riskCount:number;children:React.ReactNode}){
  return <div className="shell">
    <aside>
      <div className="brand"><div className="brand-icon"><ShieldCheck size={18}/></div><div><b>License Lens</b><small>dependency clarity</small></div></div>
      <div className="nav-title">WORKSPACE</div>
      <button className={'nav'+(view==='overview'?' active':'')} onClick={()=>onNav('overview')}><Layers3 size={16}/>依赖总览</button>
      <button className={'nav'+(view==='compare'?' active':'')} onClick={()=>onNav('compare')}><GitCompareArrows size={16}/>供应商清单比对</button>
      <button className="nav"><FileCode2 size={16}/>许可证清单 <span>{depsCount}</span></button>
      <button className="nav"><AlertTriangle size={16}/>待处理风险 <span className="red">{riskCount}</span></button>
      <div className="aside-bottom">
        <div className="mini-card"><Sparkles size={16}/><div><b>扫描已更新</b><small>供应商清单可随时导入核对</small></div></div>
        <div className="user"><div className="avatar">ZL</div><span>Zen Li</span><ChevronDown size={14}/></div>
      </div>
    </aside>
    <main>{children}</main>
  </div>;
}

function Overview({deps,setDeps}:{deps:Dep[];setDeps:SetDeps}){
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('全部');
  const [selected,setSelected]=useState(1);
  const [showAdd,setShowAdd]=useState(false);
  const [name,setName]=useState('');
  const [license,setLicense]=useState('MIT');
  const current=deps.find(d=>d.id===selected);
  const filtered=useMemo(()=>deps.filter(d=>(filter==='全部'||d.status===filter)&&`${d.name}${d.license}`.toLowerCase().includes(query.toLowerCase())),[deps,filter,query]);
  const add=()=>{
    if(!name.trim())return;
    const id=Date.now();
    setDeps(ds=>[...ds,{id,name:name.trim(),version:'1.0.0',license,source:'手动',status:classifyLicense(license),note:licenseNote(license)}]);
    setSelected(id);setName('');setShowAdd(false);
  };
  const exportMd=()=>{
    const text=`# License Lens\n\n| 依赖 | 版本 | 许可证 | 状态 |\n|---|---|---|---|\n${deps.map(d=>`| ${d.name} | ${d.version} | ${d.license} | ${d.status} |`).join('\n')}`;
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([text],{type:'text/markdown'}));
    a.download='license-report.md';a.click();URL.revokeObjectURL(a.href);
  };
  return <>
    <header>
      <div>
        <div className="crumb">WORKSPACE / <b>PROJECT SCAN</b></div>
        <h1>许可证兼容性分析</h1>
        <p>检查依赖许可，放心发布你的项目。</p>
      </div>
      <div className="head-actions">
        <button className="outline" onClick={exportMd}><Download size={15}/>导出报告</button>
        <button className="primary" onClick={()=>setShowAdd(true)}><Plus size={16}/>添加依赖</button>
      </div>
    </header>
    <section className="hero">
      <div>
        <span className="tag">PROJECT · AURORA-WEB</span>
        <h2>发布前，再确认一次。</h2>
        <p>我们扫描了 <b>{deps.length} 个依赖</b>，发现 <b className="warning">{deps.filter(d=>d.status!=='ok').length} 个项目</b>需要你的关注。</p>
      </div>
      <div className="scan-score">
        <div className="score-ring"><strong>{deps.length?Math.round(deps.filter(d=>d.status==='ok').length/deps.length*100):0}<small>%</small></strong></div>
        <div><span>兼容评分</span><b>良好</b><small>上次扫描 2 分钟前</small></div>
      </div>
    </section>
    <section className="summary">
      <div><span>全部依赖</span><b>{deps.length}</b><small>含供应商导入</small></div>
      <div><span>安全许可</span><b className="teal">{deps.filter(d=>d.status==='ok').length}</b><small>可直接分发</small></div>
      <div><span>需要复核</span><b className="orange">{deps.filter(d=>d.status==='warn').length}</b><small>保留声明即可</small></div>
      <div><span>高风险</span><b className="red">{deps.filter(d=>d.status==='risk').length}</b><small>建议替换或隔离</small></div>
    </section>
    <section className="workspace">
      <div className="table-pane">
        <div className="pane-head">
          <div><h2>依赖清单</h2><p>逐项查看许可证义务</p></div>
          <div className="tools">
            <div className="search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索依赖"/></div>
            <select value={filter} onChange={e=>setFilter(e.target.value)}>
              <option value="全部">全部状态</option><option value="ok">安全</option><option value="warn">复核</option><option value="risk">高风险</option>
            </select>
          </div>
        </div>
        <div className="table">
          <div className="tr th"><span>依赖名称</span><span>版本</span><span>许可证</span><span>状态</span></div>
          {filtered.map(d=>(
            <button className={d.id===selected?'tr selected':'tr'} key={d.id} onClick={()=>setSelected(d.id)}>
              <span className="dep-name"><span className="pkg-dot"/> {d.name}</span>
              <span className="muted">{d.version}</span>
              <span><i className="license" style={{color:colors[d.license]||'#888',background:(colors[d.license]||'#888')+'18'}}>{d.license}</i></span>
              <span className={'status '+d.status}>{d.status==='ok'?<Check size={13}/>:<AlertTriangle size={13}/>} {d.status==='ok'?'安全':d.status==='warn'?'复核':'高风险'}</span>
            </button>
          ))}
          {filtered.length===0&&<div className="table-empty">没有匹配的依赖</div>}
        </div>
      </div>
      {current&&<div className="detail">
        <div className="detail-head">
          <div className="detail-icon" style={{background:(colors[current.license]||'#888')+'1c',color:colors[current.license]}}><FileCode2 size={20}/></div>
          <div><span>SELECTED DEPENDENCY</span><h2>{current.name}</h2></div>
          <button className="close" onClick={()=>setSelected(0)}><X size={16}/></button>
        </div>
        <div className="detail-grid">
          <div><label>版本</label><b>{current.version}</b></div>
          <div><label>来源</label><b>{current.source}</b></div>
          <div><label>许可证</label><b>{current.license}</b></div>
        </div>
        <div className={'finding '+current.status}>
          <div className="finding-icon">{current.status==='ok'?<Check size={16}/>:<AlertTriangle size={16}/>}</div>
          <div><b>{current.status==='ok'?'可以放心使用':current.status==='warn'?'需要保留声明':'存在分发限制'}</b>
            <p>{current.note}。扫描结果基于 package 元数据，请在发布前查看完整许可证文本。</p></div>
        </div>
        <div className="full-license">
          <div><Info size={15}/><span>许可证摘要</span></div>
          <p>{current.license} 允许在满足其条款的前提下使用和分发代码。详细义务请参考项目仓库中的 LICENSE 文件。</p>
          <button>查看原文 <ChevronDown size={14}/></button>
        </div>
      </div>}
    </section>
    {showAdd&&<div className="backdrop" onClick={()=>setShowAdd(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><h2>添加依赖</h2><button onClick={()=>setShowAdd(false)}>×</button></div>
        <label>依赖名称<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="例如 date-fns"/></label>
        <label>许可证<select value={license} onChange={e=>setLicense(e.target.value)}>
          <option>MIT</option><option>BSD-3-Clause</option><option>Apache-2.0</option><option>GPL-3.0</option>
        </select></label>
        <button className="primary full" onClick={add}>加入扫描</button>
      </div>
    </div>}
  </>;
}
