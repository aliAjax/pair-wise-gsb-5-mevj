import type { Dep, Status } from '../types';

// 初始扫描清单
export const initialDeps: Dep[] = [
  { id: 1, name: 'react', version: '18.3.1', license: 'MIT', source: 'npm', status: 'ok', note: '宽松许可，可商用' },
  { id: 2, name: 'lodash', version: '4.17.21', license: 'MIT', source: 'npm', status: 'ok', note: '宽松许可，可商用' },
  { id: 3, name: 'chart.js', version: '4.4.4', license: 'MIT', source: 'npm', status: 'ok', note: '宽松许可，可商用' },
  { id: 4, name: 'highlight.js', version: '11.10.0', license: 'BSD-3-Clause', source: 'npm', status: 'warn', note: '再发布需保留版权声明' },
  { id: 5, name: 'legacy-parser', version: '2.1.0', license: 'GPL-3.0', source: '手动', status: 'risk', note: '可能与闭源分发冲突' },
];

// 按许可证推导风险等级（与既有添加逻辑保持一致）
export function statusForLicense(license: string): Status {
  if (license.startsWith('GPL')) return 'risk';
  if (license === 'MIT') return 'ok';
  return 'warn';
}
