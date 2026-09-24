import type { CompareResult, Dep, DiffItem, SbomComponent } from '../types';

// —— 比对层 ——
// 输入本地扫描清单与供应商组件列表，输出新增 / 缺失 / 许可证不一致三类差异。
// 不修改任何数据，也不关心数据存到哪里。

export function componentKey(name: string, version: string): string {
  return `${name.trim().toLowerCase()}@${version.trim().toLowerCase()}`;
}

/** 许可证归一化：去空白、统一大小写写法，SPDX 短横线两端去空格 */
export function normalizeLicense(license: string): string {
  return license
    .trim()
    .replace(/\s*\|\s*/g, ' OR ')
    .replace(/\s*\bor\b\s*/gi, ' OR ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function licensesEqual(a: string, b: string): boolean {
  const na = normalizeLicense(a);
  const nb = normalizeLicense(b);
  return na === nb || (na !== '未声明' && nb !== '未声明' && na.replace(/-only$|-or-later$/g, '') === nb.replace(/-only$|-or-later$/g, ''));
}

const KIND_ORDER: Record<DiffItem['kind'], number> = { mismatch: 0, missing: 1, added: 2, same: 3 };

export function compareBom(localDeps: Dep[], supplierComponents: SbomComponent[]): CompareResult {
  const supplierMap = new Map<string, SbomComponent>();
  for (const c of supplierComponents) supplierMap.set(componentKey(c.name, c.version), c);

  const localMap = new Map<string, Dep>();
  for (const d of localDeps) localMap.set(componentKey(d.name, d.version), d);

  const items: DiffItem[] = [];

  for (const [key, s] of supplierMap) {
    const local = localMap.get(key);
    if (!local) {
      items.push({ key, kind: 'added', name: s.name, version: s.version, supplierLicense: s.license });
    } else if (!licensesEqual(s.license, local.license)) {
      items.push({ key, kind: 'mismatch', name: s.name, version: s.version, supplierLicense: s.license, localLicense: local.license });
    } else {
      items.push({ key, kind: 'same', name: s.name, version: s.version, supplierLicense: s.license, localLicense: local.license });
    }
  }

  for (const [key, l] of localMap) {
    if (!supplierMap.has(key)) {
      items.push({ key, kind: 'missing', name: l.name, version: l.version, localLicense: l.license });
    }
  }

  items.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name));

  return {
    items,
    added: items.filter((i) => i.kind === 'added').length,
    missing: items.filter((i) => i.kind === 'missing').length,
    mismatch: items.filter((i) => i.kind === 'mismatch').length,
    same: items.filter((i) => i.kind === 'same').length,
  };
}
