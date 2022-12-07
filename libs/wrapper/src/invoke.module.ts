import { DynamicModule, Module, Provider } from '@nestjs/common';
import {
  InvokeModuleAsyncOptions,
  InvokeModuleOptions,
  InvokeOptionsFactory,
} from './interfaces';
import { INVOKE_MODULE_OPTIONS } from './invoke.constants';
import { createInvokeProvider } from './invoke.providers';
import { InvokeService } from './invoke.service';

@Module({
  providers: [InvokeService],
  exports: [InvokeService],
})
export class InvokeModule {
  static register(options: InvokeModuleOptions): DynamicModule {
    return {
      module: InvokeModule,
      providers: createInvokeProvider(options),
    };
  }

  static registerAsync(options: InvokeModuleAsyncOptions): DynamicModule {
    return {
      module: InvokeModule,
      imports: options.imports || [],
      providers: [InvokeService],
    };
  }

  private static createAsyncProviders(
    options: InvokeModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: options.useClass,
        useClass: options.useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: InvokeModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: INVOKE_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }
    return {
      provide: INVOKE_MODULE_OPTIONS,
      useFactory: async (optionsFactory: InvokeOptionsFactory) =>
        await optionsFactory.createInvokeOptions(),
      inject: [options.useExisting || options.useClass],
    };
  }
}
