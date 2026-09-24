import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  FileCode2,
  GitCompareArrows,
  Layers3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import OverviewPage from './pages/OverviewPage';
import ComparePage from './pages/ComparePage';
import { initialDeps } from './lib/data';
import {
  appendImportRecord,
  loadDeps,
  loadImportRecords,
  saveDeps,
  type ImportRecord,
} from './lib/storage';
import type { Dep } from './types';

type View = 'overview' | 'compare';

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [deps, setDeps] = useState<Dep[]>(() => loadDeps(initialDeps));
  const [records, setRecords] = useState<ImportRecord[]>(() => loadImportRecords());
  const [selected, setSelected] = useState(0);

  useEffect(() => saveDeps(deps), [deps]);

  const handleApply = (nextDeps: Dep[], record: ImportRecord) => {
    setDeps(nextDeps);
    setRecords(appendImportRecord(record));
  };

  const exportMd = () => {
    const text = `# License Lens\n\n| 依赖 | 版本 | 许可证 | 状态 |\n|---|---|---|---|\n${deps
      .map((d) => `| ${d.name} | ${d.version} | ${d.license} | ${d.status} |`)
      .join('\n')}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    a.download = 'license-report.md';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div className="brand-icon"><ShieldCheck size={18} /></div>
          <div><b>License Lens</b><small>dependency clarity</small></div>
        </div>
        <div className="nav-title">WORKSPACE</div>
        <button className={view === 'overview' ? 'nav active' : 'nav'} onClick={() => setView('overview')}>
          <Layers3 size={16} />依赖总览
        </button>
        <button className={view === 'compare' ? 'nav active' : 'nav'} onClick={() => setView('compare')}>
          <GitCompareArrows size={16} />清单比对
          {records.length > 0 && <span>{records.length}</span>}
        </button>
        <button className="nav">
          <FileCode2 size={16} />许可证清单 <span>{deps.length}</span>
        </button>
        <button className="nav">
          <AlertTriangle size={16} />待处理风险 <span className="red">{deps.filter((d) => d.status === 'risk').length}</span>
        </button>
        <div className="aside-bottom">
          <div className="mini-card">
            <Sparkles size={16} />
            <div>
              <b>{records.length ? `已导入 ${records.length} 批供应商清单` : '扫描已更新'}</b>
              <small>{records.length ? '旧记录可在清单比对区查看' : `刚刚完成 ${deps.length} 个依赖的分析`}</small>
            </div>
          </div>
          <div className="user">
            <div className="avatar">ZL</div>
            <span>Zen Li</span>
            <ChevronDown size={14} />
          </div>
        </div>
      </aside>
      <main>
        {view === 'overview' ? (
          <OverviewPage
            deps={deps}
            selected={selected}
            onSelect={setSelected}
            onAdd={(dep) => setDeps((ds) => [...ds, dep])}
            onExport={exportMd}
          />
        ) : (
          <ComparePage deps={deps} records={records} onApply={handleApply} />
        )}
      </main>
    </div>
  );
}
