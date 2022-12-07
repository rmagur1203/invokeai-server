import { ModuleMetadata, Type } from '@nestjs/common';

export interface InvokeServer {
  /**
   * name of the server
   */
  name: string;
  /**
   * url of the server
   */
  url: string;
}

export interface InvokeModuleOptions {
  servers: InvokeServer[];
}

export interface InvokeOptionsFactory {
  createInvokeOptions(): Promise<InvokeModuleOptions> | InvokeModuleOptions;
}

export interface InvokeModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<InvokeOptionsFactory>;
  useClass?: Type<InvokeOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<InvokeModuleOptions> | InvokeModuleOptions;
  inject?: any[];
}
