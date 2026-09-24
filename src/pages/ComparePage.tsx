import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardPaste,
  Clock,
  FileWarning,
  GitCompareArrows,
  History,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { parseCycloneDx } from '../lib/parse';
import { compareBom } from '../lib/compare';
import {
  applyImport,
  findImportByBatch,
  type Decision,
  type ImportRecord,
  type ItemResult,
} from '../lib/storage';
import { SAMPLE_CYCLONEDX } from '../lib/sample';
import type { CompareResult, Dep, DiffKind, ParsedBom } from '../types';

type Phase = 'input' | 'review' | 'record';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const KIND_META: Record<DiffKind, { label: string; cls: string }> = {
  mismatch: { label: '许可证不一致', cls: 'mismatch' },
  missing: { label: '供应商缺失', cls: 'missing' },
  added: { label: '新增组件', cls: 'added' },
  same: { label: '两边一致', cls: 'same' },
};

function KindBadge({ kind }: { kind: DiffKind }) {
  const meta = KIND_META[kind];
  return <span className={`kind-badge ${meta.cls}`}>{meta.label}</span>;
}

function CountChip({ cls, label, value }: { cls: string; label: string; value: number }) {
  return (
    <div className={`count-chip ${cls}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

/** 单项的两个选项：供应商值 / 本地值 */
function Choice({
  active,
  side,
  title,
  value,
  effect,
  onClick,
}: {
  active: boolean;
  side: 'supplier' | 'local';
  title: string;
  value: string;
  effect: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`choice ${side} ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="choice-radio">{active && <Check size={11} />}</span>
      <span className="choice-body">
        <b>{title}</b>
        <i>{value || '未声明'}</i>
        <small>{effect}</small>
      </span>
    </button>
  );
}

export default function ComparePage({
  deps,
  records,
  onApply,
}: {
  deps: Dep[];
  records: ImportRecord[];
  onApply: (nextDeps: Dep[], record: ImportRecord) => void;
}) {
  const [phase, setPhase] = useState<Phase>('input');
  const [text, setText] = useState('');
  const [parseError, setParseError] = useState('');
  const [bom, setBom] = useState<ParsedBom | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [diff, setDiff] = useState<CompareResult | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [duplicateOf, setDuplicateOf] = useState<ImportRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ImportRecord | null>(null);
  const [recordReturn, setRecordReturn] = useState<Phase>('input');

  const startParse = () => {
    const res = parseCycloneDx(text);
    if (!res.ok) {
      setParseError(res.error);
      return;
    }
    const result = compareBom(deps, res.bom.components);
    const prev = findImportByBatch(records, res.bom.batchId);
    // 同一批再次导入：预填上次的逐项处理结果，应用时按键判重不会重复增删
    const prefill: Record<string, Decision> = {};
    if (prev) {
      for (const it of prev.items) if (it.decision) prefill[it.key] = it.decision;
    }
    setBom(res.bom);
    setSourceLabel(res.bom.sourceLabel);
    setDiff(result);
    setDecisions(prefill);
    setDuplicateOf(prev ?? null);
    setParseError('');
    setPhase('review');
  };

  const openRecord = (record: ImportRecord, backTo: Phase) => {
    setViewRecord(record);
    setRecordReturn(backTo);
    setPhase('record');
  };

  const actionable = diff ? diff.items.filter((i) => i.kind !== 'same') : [];
  const resolvedCount = actionable.filter((i) => decisions[i.key]).length;
  const allResolved = actionable.length === resolvedCount;

  const choose = (key: string, decision: Decision) =>
    setDecisions((prev) => ({ ...prev, [key]: decision }));

  const confirm = () => {
    if (!bom || !diff || !allResolved) return;
    const effectiveBom: ParsedBom = { ...bom, sourceLabel: sourceLabel.trim() || bom.sourceLabel };
    const maxId = deps.reduce((m, d) => Math.max(m, d.id), 0);
    const { deps: nextDeps, record } = applyImport(
      deps,
      effectiveBom,
      diff,
      decisions,
      { id: maxId + 1 },
    );
    onApply(nextDeps, record);
    setDuplicateOf(null);
    openRecord(record, 'input');
  };

  // —— 记录视图：本次确认结果或历史旧记录均可打开 ——
  if (phase === 'record' && viewRecord) {
    const actionText: Record<ItemResult['action'], string> = {
      added: '已加入清单',
      updated: '已更新许可证',
      removed: '已从清单移除',
      kept: '已保留本地值',
      none: '无需处理',
    };
    return (
      <div className="compare-page">
        <button className="ghost-back" onClick={() => setPhase(recordReturn)}>
          <ArrowLeft size={14} /> 返回
        </button>
        <div className="record-card">
          <div className="record-head">
            <div className="record-icon">
              <Check size={20} />
            </div>
            <div>
              <span className="eyebrow">IMPORT REPORT</span>
              <h2>{viewRecord.sourceLabel}</h2>
              <p className="record-meta">
                <Clock size={12} /> 导入时间 {formatTime(viewRecord.importedAt)}
                <span className="dot" />
                {viewRecord.bomFormat} {viewRecord.specVersion}
                <span className="dot" />
                批次 {viewRecord.batchId.length > 42 ? viewRecord.batchId.slice(0, 42) + '…' : viewRecord.batchId}
              </p>
            </div>
          </div>

          <div className="record-chips">
            <CountChip cls="added" label="新增" value={viewRecord.counts.added} />
            <CountChip cls="missing" label="缺失" value={viewRecord.counts.missing} />
            <CountChip cls="mismatch" label="不一致" value={viewRecord.counts.mismatch} />
            <CountChip cls="same" label="一致" value={viewRecord.counts.same} />
          </div>

          <div className="record-list">
            {viewRecord.items.map((it) => (
              <div className={`record-item ${it.kind}`} key={it.key}>
                <div className="record-item-main">
                  <KindBadge kind={it.kind} />
                  <b>{it.name}</b>
                  <span className="muted">{it.version}</span>
                  {it.kind === 'mismatch' && (
                    <span className="license-flow">
                      <i className="license">{it.localLicense || '未声明'}</i>
                      <ArrowLeft size={11} />
                      <i className="license">{it.supplierLicense || '未声明'}</i>
                    </span>
                  )}
                </div>
                <div className="record-item-result">
                  <span className={`action-tag a-${it.action}`}>{actionText[it.action]}</span>
                  <small>{it.summary}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="record-actions">
            <button className="primary" onClick={() => { setText(''); setPhase('input'); }}>
              <RotateCcw size={15} /> 再比对一批
            </button>
          </div>
        </div>
      </div>
    );
  }

  // —— 输入视图 ——
  if (phase === 'input') {
    return (
      <div className="compare-page">
        <div className="compare-head">
          <div>
            <div className="crumb">WORKSPACE / <b>VENDOR SBOM RECONCILE</b></div>
            <h1>清单比对区</h1>
            <p>粘贴供应商提供的 CycloneDX JSON，自动列出新增、缺失与许可证不一致的组件，逐项确认后再写入扫描清单。</p>
          </div>
        </div>

        <div className="paste-card">
          <div className="paste-title">
            <ClipboardPaste size={16} />
            <b>CycloneDX JSON</b>
            <button className="link-btn" onClick={() => setText(SAMPLE_CYCLONEDX)}>
              <Sparkles size={13} /> 填入示例清单
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setParseError(''); }}
            placeholder={'{\n  "bomFormat": "CycloneDX",\n  "specVersion": "1.5",\n  "components": [ ... ]\n}'}
            spellCheck={false}
          />
          {parseError && (
            <div className="parse-error">
              <FileWarning size={14} /> {parseError}
            </div>
          )}
          <div className="paste-actions">
            <span className="muted tiny">支持 CycloneDX 1.2–1.5，许可证可为 SPDX id 或 expression</span>
            <button className="primary" disabled={!text.trim()} onClick={startParse}>
              <GitCompareArrows size={15} /> 开始比对
            </button>
          </div>
        </div>

        <div className="history-card">
          <div className="history-title">
            <History size={15} />
            <b>导入记录</b>
            <span>{records.length} 批</span>
          </div>
          {records.length === 0 ? (
            <p className="history-empty">还没有导入过供应商清单。</p>
          ) : (
            records.map((r) => (
              <button key={r.id} className="history-item" onClick={() => openRecord(r, 'input')}>
                <div>
                  <b>{r.sourceLabel}</b>
                  <small>
                    <Clock size={11} /> {formatTime(r.importedAt)}
                    <span className="dot" />
                    {r.counts.total} 个组件
                  </small>
                </div>
                <div className="history-counts">
                  {r.counts.added > 0 && <span className="tag-added">+{r.counts.added}</span>}
                  {r.counts.missing > 0 && <span className="tag-missing">-{r.counts.missing}</span>}
                  {r.counts.mismatch > 0 && <span className="tag-mismatch">≠{r.counts.mismatch}</span>}
                  {r.counts.added === 0 && r.counts.missing === 0 && r.counts.mismatch === 0 && (
                    <span className="tag-same">全部一致</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // —— 逐项裁决视图 ——
  const sameItems = diff!.items.filter((i) => i.kind === 'same');
  return (
    <div className="compare-page review">
      <button className="ghost-back" onClick={() => setPhase('input')}>
        <ArrowLeft size={14} /> 返回修改
      </button>

      <div className="review-head">
        <div>
          <span className="eyebrow">REVIEW DIFFERENCES</span>
          <h1>逐项确认差异</h1>
          <p className="muted tiny">
            {bom!.bomFormat} {bom!.specVersion}
            {bom!.serialNumber && <> · 序列号 {bom!.serialNumber}</>}
            {' · 共 '}{diff!.items.length} 个组件
          </p>
        </div>
        <label className="source-label">
          导入来源（写入扫描清单）
          <input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
        </label>
      </div>

      {duplicateOf && (
        <div className="dup-banner">
          <AlertTriangle size={15} />
          <div>
            <b>该批次此前已导入过</b>
            <span>
              上次导入时间 {formatTime(duplicateOf.importedAt)}，已按上次选择预填。再次确认不会重复添加组件、不会重复移除，
              <button className="link-inline" onClick={() => openRecord(duplicateOf, 'review')}>点此查看旧记录</button>。
            </span>
          </div>
        </div>
      )}

      <div className="review-chips">
        <CountChip cls="added" label="新增" value={diff!.added} />
        <CountChip cls="missing" label="供应商缺失" value={diff!.missing} />
        <CountChip cls="mismatch" label="许可证不一致" value={diff!.mismatch} />
        <CountChip cls="same" label="一致" value={diff!.same} />
      </div>

      <div className="diff-list">
        {actionable.length === 0 && (
          <div className="no-diff">
            <Check size={18} /> 供应商清单与本地扫描结果完全一致，可以直接提交留档。
          </div>
        )}
        {actionable.map((item) => {
          const decision = decisions[item.key];
          return (
            <div className={`diff-item ${item.kind} ${decision ? 'resolved' : ''}`} key={item.key}>
              <div className="diff-item-head">
                <KindBadge kind={item.kind} />
                <b>{item.name}</b>
                <span className="muted">{item.version}</span>
                {decision && <span className="resolved-tag"><Check size={11} /> 已选择{decision === 'supplier' ? '供应商值' : '本地值'}</span>}
              </div>

              {item.kind === 'added' && (
                <div className="choices">
                  <Choice
                    side="supplier"
                    active={decision === 'supplier'}
                    title="供应商值"
                    value={item.supplierLicense || '未声明'}
                    effect="供应商清单包含此组件 → 加入扫描清单"
                    onClick={() => choose(item.key, 'supplier')}
                  />
                  <Choice
                    side="local"
                    active={decision === 'local'}
                    title="本地值"
                    value="本地无此组件"
                    effect="不加入扫描清单"
                    onClick={() => choose(item.key, 'local')}
                  />
                </div>
              )}

              {item.kind === 'missing' && (
                <div className="choices">
                  <Choice
                    side="supplier"
                    active={decision === 'supplier'}
                    title="供应商值"
                    value="供应商清单未包含"
                    effect="以供应商清单为准 → 从扫描清单移除"
                    onClick={() => choose(item.key, 'supplier')}
                  />
                  <Choice
                    side="local"
                    active={decision === 'local'}
                    title="本地值"
                    value={item.localLicense || '未声明'}
                    effect="保留本地扫描结果 → 继续留在清单"
                    onClick={() => choose(item.key, 'local')}
                  />
                </div>
              )}

              {item.kind === 'mismatch' && (
                <div className="choices">
                  <Choice
                    side="supplier"
                    active={decision === 'supplier'}
                    title="供应商值"
                    value={item.supplierLicense || '未声明'}
                    effect={`本地当前为 ${item.localLicense || '未声明'} → 更新为供应商许可证`}
                    onClick={() => choose(item.key, 'supplier')}
                  />
                  <Choice
                    side="local"
                    active={decision === 'local'}
                    title="本地值"
                    value={item.localLicense || '未声明'}
                    effect="维持本地扫描许可证，不做修改"
                    onClick={() => choose(item.key, 'local')}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sameItems.length > 0 && (
        <details className="same-block">
          <summary>
            两边一致的组件（{sameItems.length}），无需处理
          </summary>
          <div className="same-list">
            {sameItems.map((i) => (
              <span key={i.key}>
                {i.name} <em>{i.version}</em> <i className="license">{i.localLicense}</i>
              </span>
            ))}
          </div>
        </details>
      )}

      <div className="review-footer">
        <div className="progress">
          <div className="progress-bar" style={{ width: `${actionable.length ? (resolvedCount / actionable.length) * 100 : 100}%` }} />
        </div>
        <span>
          已处理 <b>{resolvedCount}</b> / {actionable.length} 项
          {!allResolved && <em className="wait-hint">——处理完所有差异后才能提交</em>}
        </span>
        <button className="primary" disabled={!allResolved} onClick={confirm}>
          <Check size={15} /> 确认并写入扫描清单
        </button>
      </div>
    </div>
  );
}
