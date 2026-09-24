// 内置示例：覆盖 新增 / 缺失 / 许可证不一致 三种差异
export const SAMPLE_CYCLONEDX = JSON.stringify(
  {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: 'urn:uuid:3a1f2c8e-7d4b-4a90-b5e2-9c1f7d8a2001',
    version: 1,
    metadata: {
      timestamp: '2026-09-24T08:30:00Z',
      supplier: { name: 'Aurora Systems' },
      component: {
        name: 'aurora-web',
        version: '3.2.0',
        type: 'application',
        supplier: { name: 'Aurora Systems' },
      },
    },
    components: [
      { type: 'library', name: 'react', version: '18.3.1', licenses: [{ license: { id: 'MIT' } }] },
      { type: 'library', name: 'lodash', version: '4.17.21', licenses: [{ license: { id: 'MIT' } }] },
      { type: 'library', name: 'chart.js', version: '4.4.4', licenses: [{ license: { id: 'Apache-2.0' } }] },
      { type: 'library', name: 'highlight.js', version: '11.10.0', licenses: [{ license: { id: 'BSD-3-Clause' } }] },
      { type: 'library', name: 'dayjs', version: '1.11.13', licenses: [{ license: { id: 'MIT' } }] },
      { type: 'library', name: 'p-limit', version: '6.1.0', licenses: [{ expression: 'MIT OR Apache-2.0' }] },
    ],
  },
  null,
  2,
);
