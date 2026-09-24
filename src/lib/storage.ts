import { statusForLicense } from './data';
import { componentKey } from './compare';
import type { Dep, DiffItem, ParsedBom } from '../types';

// —— 保存层 ——
// 负责扫描清单与导入记录的持久化（localStorage），以及把比对决策应用到清单。
// 应用过程对同一批重复导入幂等：相同键的组件不会重复添加、不会重复移除。

const DEPS_KEY = 'license-lens';
const IMPORTS_KEY = 'license-lens-imports';

export type Decision = 'supplier' | 'local';

export type ItemResult = {
  key: string;
  kind: DiffItem['kind'];
  name: string;
  version: string;
  supplierLicense?: string;
  localLicense?: string;
  decision?: Decision;
  action: 'added' | 'updated' | 'removed' | 'kept' | 'none';
  summary: string;
};

export type ImportRecord = {
  id: string;
  batchId: string;
  sourceLabel: string;
  supplier?: string;
  componentName?: string;
  bomFormat: string;
  specVersion: string;
  importedAt: string;
  counts: { added: number; missing: number; mismatch: number; same: number; total: number };
  items: ItemResult[];
};

export function loadDeps(fallback: Dep[]): Dep[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEPS_KEY) || '');
    return Array.isArray(parsed) && parsed.length ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveDeps(deps: Dep[]): void {
  localStorage.setItem(DEPS_KEY, JSON.stringify(deps));
}

export function loadImportRecords(): ImportRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(IMPORTS_KEY) || '');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveImportRecords(records: ImportRecord[]): void {
  localStorage.setItem(IMPORTS_KEY, JSON.stringify(records));
}

export function findImportByBatch(records: ImportRecord[], batchId: string): ImportRecord | undefined {
  return records.find((r) => r.batchId === batchId);
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `imp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function noteFor(license: string): string {
  if (license.startsWith('GPL')) return '可能与闭源分发冲突';
  if (license === 'MIT') return '宽松许可，可商用';
  return '供应商清单导入，请核对分发义务';
}

/**
 * 将逐项决策应用到扫描清单，返回新清单与导入处理结果。
 * 所有写入都按键判重，因此同一份供应商清单再次导入并确认不会产生重复组件。
 */
export function applyImport(
  deps: Dep[],
  bom: ParsedBom,
  diff: { items: DiffItem[]; added: number; missing: number; mismatch: number; same: number },
  decisions: Record<string, Decision>,
  counts: Record<string, number>,
): { deps: Dep[]; record: ImportRecord } {
  let next = [...deps];
  const results: ItemResult[] = [];

  for (const item of diff.items) {
    const decision = decisions[item.key];
    let action: ItemResult['action'];
    let summary: string;

    if (item.kind === 'added') {
      // 新增项：采用供应商值 = 加入清单；保留本地值（本地没有）= 不加入
      if (decision === 'supplier') {
        const license = item.supplierLicense || '未声明';
        const exists = next.some((d) => componentKey(d.name, d.version) === item.key);
        if (exists) {
          action = 'none';
          summary = '清单中已存在，未重复添加';
        } else {
          next.push({
            id: counts.id++,
            name: item.name,
            version: item.version,
            license,
            source: bom.sourceLabel,
            status: statusForLicense(license),
            note: noteFor(license),
          });
          action = 'added';
          summary = `采用供应商值：新增组件，许可证 ${license}`;
        }
      } else {
        action = 'kept';
        summary = '保留本地值：该组件未加入扫描清单';
      }
    } else if (item.kind === 'missing') {
      // 缺失项（供应商清单没有）：采用供应商值 = 从清单移除；保留本地值 = 继续保留
      if (decision === 'supplier') {
        const before = next.length;
        next = next.filter((d) => componentKey(d.name, d.version) !== item.key);
        if (next.length < before) {
          action = 'removed';
          summary = '采用供应商值：供应商清单未包含，已从扫描清单移除';
        } else {
          action = 'none';
          summary = '此前已移除，本次未重复处理';
        }
      } else {
        action = 'kept';
        summary = `保留本地值：继续保留组件，许可证 ${item.localLicense || '未声明'}`;
      }
    } else if (item.kind === 'mismatch') {
      if (decision === 'supplier') {
        const license = item.supplierLicense || '未声明';
        let changed = false;
        next = next.map((d) => {
          if (componentKey(d.name, d.version) !== item.key) return d;
          changed = true;
          return {
            ...d,
            license,
            source: bom.sourceLabel,
            status: statusForLicense(license),
            note: `许可证已按供应商清单更新（原值 ${item.localLicense || '未声明'}）`,
          };
        });
        action = changed ? 'updated' : 'none';
        summary = changed
          ? `采用供应商值：许可证 ${item.localLicense || '未声明'} → ${license}`
          : '清单中未找到对应组件，未更新';
      } else {
        action = 'kept';
        summary = `保留本地值：许可证维持 ${item.localLicense || '未声明'}`;
      }
    } else {
      action = 'none';
      summary = '两边一致，无需处理';
    }

    results.push({
      key: item.key,
      kind: item.kind,
      name: item.name,
      version: item.version,
      supplierLicense: item.supplierLicense,
      localLicense: item.localLicense,
      decision,
      action,
      summary,
    });
  }

  const record: ImportRecord = {
    id: makeId(),
    batchId: bom.batchId,
    sourceLabel: bom.sourceLabel,
    supplier: bom.supplier,
    componentName: bom.componentName,
    bomFormat: bom.bomFormat,
    specVersion: bom.specVersion,
    importedAt: new Date().toISOString(),
    counts: { added: diff.added, missing: diff.missing, mismatch: diff.mismatch, same: diff.same, total: diff.items.length },
    items: results,
  };

  return { deps: next, record };
}

export function appendImportRecord(record: ImportRecord): ImportRecord[] {
  const records = [record, ...loadImportRecords()];
  saveImportRecords(records);
  return records;
}
