export type DepStatus='ok'|'warn'|'risk';
export type Dep={id:number;name:string;version:string;license:string;source:string;status:DepStatus;note:string};

/** 根据许可证推断风险等级，规则与既有“添加依赖”保持一致 */
export function classifyLicense(license:string):DepStatus{
  if(license.startsWith('GPL'))return 'risk';
  if(license==='MIT')return 'ok';
  return 'warn';
}
export function licenseNote(license:string):string{
  if(license==='MIT')return '宽松许可，可商用';
  if(license.startsWith('GPL'))return '可能与闭源分发冲突';
  return '请核对分发义务';
}
export const UNDECLARED='未声明';
