import { InvokeModuleOptions } from './interfaces/invoke-module-options.interface';
import { INVOKE_MODULE_OPTIONS } from './invoke.constants';

export function createInvokeProvider(options: InvokeModuleOptions): any[] {
  return [{ provide: INVOKE_MODULE_OPTIONS, useValue: options || {} }];
}
