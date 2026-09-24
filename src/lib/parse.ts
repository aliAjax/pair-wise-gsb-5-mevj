import type { ParseResult, ParsedBom, SbomComponent } from '../types';

// —— CycloneDX 解析层 ——
// 只负责把 CycloneDX JSON 文本解析为结构化数据，不涉及比对与存储。

/** 兼容 license 对象、SPDX expression、名称数组等 CycloneDX 许可证写法 */
function extractLicense(input: unknown): string {
  if (typeof input === 'string') return input.trim();
  if (Array.isArray(input)) {
    const values = input.map(extractLicense).filter(Boolean);
    return [...new Set(values)].join(' OR ');
  }
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    if (typeof obj.expression === 'string' && obj.expression.trim()) return obj.expression.trim();
    const lic = obj.license;
    if (lic && typeof lic === 'object') {
      const l = lic as Record<string, unknown>;
      if (typeof l.id === 'string' && l.id.trim()) return l.id.trim();
      if (typeof l.name === 'string' && l.name.trim()) return l.name.trim();
    }
  }
  return '';
}

function toComponents(input: unknown): SbomComponent[] {
  if (!Array.isArray(input)) return [];
  const result: SbomComponent[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.name !== 'string' || !obj.name.trim()) continue;
    result.push({
      name: obj.name.trim(),
      version: typeof obj.version === 'string' && obj.version.trim() ? obj.version.trim() : '未声明',
      license: extractLicense(obj.licenses) || '未声明',
    });
  }
  // 同名同版本只保留一条，避免供应商清单内部重复
  const seen = new Set<string>();
  return result.filter((c) => {
    const key = `${c.name}@${c.version}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 组件清单内容指纹：同一批内容再次粘贴时指纹一致 */
function contentFingerprint(components: SbomComponent[]): string {
  const rows = components.map((c) => `${c.name}@${c.version}:${c.license}`);
  let hash = 0;
  const s = rows.join('|');
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return `c${(hash >>> 0).toString(36)}`;
}

function makeBatchId(obj: Record<string, unknown>, components: SbomComponent[]): string {
  const serial = typeof obj.serialNumber === 'string' ? obj.serialNumber.trim() : '';
  const version = obj.version !== undefined ? String(obj.version) : '';
  if (serial) return `bom:${serial}${version ? `:${version}` : ''}`;
  return `bom:anon-${contentFingerprint(components)}`;
}

function makeSourceLabel(obj: Record<string, unknown>): string {
  const meta = obj.metadata as Record<string, unknown> | undefined;
  const componentName =
    meta && typeof (meta.component as Record<string, unknown> | undefined)?.name === 'string'
      ? ((meta.component as Record<string, unknown>).name as string)
      : undefined;
  let supplier: string | undefined;
  const supplierRaw = meta?.supplier ?? (meta?.component as Record<string, unknown> | undefined)?.supplier;
  if (supplierRaw && typeof supplierRaw === 'object') {
    const name = (supplierRaw as Record<string, unknown>).name;
    if (typeof name === 'string' && name.trim()) supplier = name.trim();
  }
  return supplier
    ? `供应商 SBOM · ${supplier}`
    : `供应商 SBOM${componentName ? ` · ${componentName}` : ''}`;
}

export function parseCycloneDx(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: '请先粘贴 CycloneDX JSON 内容。' };

  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'JSON 解析失败，请检查格式（括号、引号是否完整）。' };
  }
  if (!obj || typeof obj !== 'object') {
    return { ok: false, error: '文件内容不是有效的 JSON 对象。' };
  }
  const root = obj as Record<string, unknown>;
  if (root.bomFormat !== 'CycloneDX') {
    return { ok: false, error: '不是 CycloneDX 清单（缺少 "bomFormat": "CycloneDX"）。' };
  }
  const components = toComponents(root.components);
  if (components.length === 0) {
    return { ok: false, error: '清单中没有可识别的组件（components 为空）。' };
  }

  const meta = root.metadata as Record<string, unknown> | undefined;
  const componentName =
    meta && typeof (meta.component as Record<string, unknown> | undefined)?.name === 'string'
      ? ((meta.component as Record<string, unknown>).name as string)
      : undefined;
  let supplier: string | undefined;
  const supplierRaw = meta?.supplier ?? (meta?.component as Record<string, unknown> | undefined)?.supplier;
  if (supplierRaw && typeof supplierRaw === 'object') {
    const name = (supplierRaw as Record<string, unknown>).name;
    if (typeof name === 'string' && name.trim()) supplier = name.trim();
  }

  const bom: ParsedBom = {
    rawText: trimmed,
    bomFormat: String(root.bomFormat),
    specVersion: typeof root.specVersion === 'string' ? root.specVersion : '未知',
    serialNumber: typeof root.serialNumber === 'string' ? root.serialNumber : undefined,
    bomVersion: root.version !== undefined ? String(root.version) : undefined,
    supplier,
    componentName,
    sourceLabel: makeSourceLabel(root),
    batchId: makeBatchId(root, components),
    components,
  };
  return { ok: true, bom };
}
