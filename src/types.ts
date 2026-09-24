// 共享类型定义：扫描清单组件、CycloneDX 解析结果、比对结果

export type Status = 'ok' | 'warn' | 'risk';

export type Dep = {
  id: number;
  name: string;
  version: string;
  license: string;
  source: string;
  status: Status;
  note: string;
};

/** 从 CycloneDX BOM 中解析出的单个组件 */
export type SbomComponent = {
  name: string;
  version: string;
  license: string;
};

export type ParsedBom = {
  rawText: string;
  bomFormat: string;
  specVersion: string;
  serialNumber?: string;
  bomVersion?: string;
  supplier?: string;
  componentName?: string;
  sourceLabel: string;
  batchId: string;
  components: SbomComponent[];
};

export type ParseResult =
  | { ok: true; bom: ParsedBom }
  | { ok: false; error: string };

export type DiffKind = 'added' | 'missing' | 'mismatch' | 'same';

export type DiffItem = {
  key: string;
  kind: DiffKind;
  name: string;
  version: string;
  /** 供应商清单中的许可证（供应商值），未声明为 undefined */
  supplierLicense?: string;
  /** 本地扫描清单中的许可证（本地值），缺失时为 undefined */
  localLicense?: string;
};

export type CompareResult = {
  items: DiffItem[];
  added: number;
  missing: number;
  mismatch: number;
  same: number;
};
