import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Download, FileCode2, Info, Plus, Search } from 'lucide-react';
import { statusForLicense } from '../lib/data';
import type { Dep } from '../types';

const colors: Record<string, string> = {
  MIT: '#35b995',
  'BSD-3-Clause': '#6d9ee8',
  'GPL-3.0': '#ec8c75',
  'Apache-2.0': '#b18ee4',
};

export default function OverviewPage({
  deps,
  selected,
  onSelect,
  onAdd,
  onExport,
}: {
  deps: Dep[];
  selected: number;
  onSelect: (id: number) => void;
  onAdd: (dep: Dep) => void;
  onExport: () => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('全部');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [license, setLicense] = useState('MIT');

  const current = deps.find((d) => d.id === selected);
  const filtered = useMemo(
    () =>
      deps.filter(
        (d) =>
          (filter === '全部' || d.status === filter) &&
          `${d.name}${d.license}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [deps, filter, query],
  );

  const add = () => {
    if (!name.trim()) return;
    const id = Date.now();
    onAdd({
      id,
      name: name.trim(),
      version: '1.0.0',
      license,
      source: '手动',
      status: statusForLicense(license),
      note: license === 'MIT' ? '宽松许可，可商用' : '请核对分发义务',
    });
    onSelect(id);
    setName('');
    setShowAdd(false);
  };

  return (
    <>
      <header>
        <div>
          <div className="crumb">WORKSPACE / <b>PROJECT SCAN</b></div>
          <h1>许可证兼容性分析</h1>
          <p>检查依赖许可，放心发布你的项目。</p>
        </div>
        <div className="head-actions">
          <button className="outline" onClick={onExport}><Download size={15} />导出报告</button>
          <button className="primary" onClick={() => setShowAdd(true)}><Plus size={16} />添加依赖</button>
        </div>
      </header>
      <section className="hero">
        <div>
          <span className="tag">PROJECT · AURORA-WEB</span>
          <h2>发布前，再确认一次。</h2>
          <p>我们扫描了 <b>{deps.length} 个依赖</b>，发现 <b className="warning">{deps.filter((d) => d.status !== 'ok').length} 个项目</b>需要你的关注。</p>
        </div>
        <div className="scan-score">
          <div className="score-ring">
            <strong>{deps.length ? Math.round((deps.filter((d) => d.status === 'ok').length / deps.length) * 100) : 100}<small>%</small></strong>
          </div>
          <div>
            <span>兼容评分</span>
            <b>良好</b>
            <small>上次扫描 2 分钟前</small>
          </div>
        </div>
      </section>
      <section className="summary">
        <div><span>全部依赖</span><b>{deps.length}</b><small>含供应商导入</small></div>
        <div><span>安全许可</span><b className="teal">{deps.filter((d) => d.status === 'ok').length}</b><small>可直接分发</small></div>
        <div><span>需要复核</span><b className="orange">{deps.filter((d) => d.status === 'warn').length}</b><small>保留声明即可</small></div>
        <div><span>高风险</span><b className="red">{deps.filter((d) => d.status === 'risk').length}</b><small>建议替换或隔离</small></div>
      </section>
      <section className="workspace">
        <div className="table-pane">
          <div className="pane-head">
            <div>
              <h2>依赖清单</h2>
              <p>逐项查看许可证义务</p>
            </div>
            <div className="tools">
              <div className="search">
                <Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索依赖" />
              </div>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="全部">全部状态</option>
                <option value="ok">安全</option>
                <option value="warn">复核</option>
                <option value="risk">高风险</option>
              </select>
            </div>
          </div>
          <div className="table">
            <div className="tr th"><span>依赖名称</span><span>版本</span><span>许可证</span><span>状态</span></div>
            {filtered.map((d) => (
              <button className={d.id === selected ? 'tr selected' : 'tr'} key={d.id} onClick={() => onSelect(d.id)}>
                <span className="dep-name"><span className="pkg-dot" /> {d.name}</span>
                <span className="muted">{d.version}</span>
                <span><i className="license" style={{ color: colors[d.license] || '#888', background: (colors[d.license] || '#888') + '18' }}>{d.license}</i></span>
                <span className={'status ' + d.status}>
                  {d.status === 'ok' ? <Check size={13} /> : <AlertTriangle size={13} />} {d.status === 'ok' ? '安全' : d.status === 'warn' ? '复核' : '高风险'}
                </span>
              </button>
            ))}
          </div>
        </div>
        {current && (
          <div className="detail">
            <div className="detail-head">
              <div className="detail-icon" style={{ background: (colors[current.license] || '#888') + '1c', color: colors[current.license] }}>
                <FileCode2 size={20} />
              </div>
              <div>
                <span>SELECTED DEPENDENCY</span>
                <h2>{current.name}</h2>
              </div>
              <button className="close" onClick={() => onSelect(0)}>×</button>
            </div>
            <div className="detail-grid">
              <div><label>版本</label><b>{current.version}</b></div>
              <div><label>来源</label><b>{current.source}</b></div>
              <div><label>许可证</label><b>{current.license}</b></div>
            </div>
            <div className={'finding ' + current.status}>
              <div className="finding-icon">{current.status === 'ok' ? <Check size={16} /> : <AlertTriangle size={16} />}</div>
              <div>
                <b>{current.status === 'ok' ? '可以放心使用' : current.status === 'warn' ? '需要保留声明' : '存在分发限制'}</b>
                <p>{current.note}。扫描结果基于 package 元数据，请在发布前查看完整许可证文本。</p>
              </div>
            </div>
            <div className="full-license">
              <div><Info size={15} /><span>许可证摘要</span></div>
              <p>{current.license} 允许在满足其条款的前提下使用和分发代码。详细义务请参考项目仓库中的 LICENSE 文件。</p>
              <button>查看原文 <ChevronDown size={14} /></button>
            </div>
          </div>
        )}
      </section>
      {showAdd && (
        <div className="backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>添加依赖</h2>
              <button onClick={() => setShowAdd(false)}>×</button>
            </div>
            <label>依赖名称<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 date-fns" /></label>
            <label>许可证
              <select value={license} onChange={(e) => setLicense(e.target.value)}>
                <option>MIT</option>
                <option>BSD-3-Clause</option>
                <option>Apache-2.0</option>
                <option>GPL-3.0</option>
              </select>
            </label>
            <button className="primary full" onClick={add}>加入扫描</button>
          </div>
        </div>
      )}
    </>
  );
}
