import { SocketIOApi } from '@invoke/api';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { InvokeModuleOptions } from './interfaces';
import { INVOKE_MODULE_OPTIONS } from './invoke.constants';
import SocketIOApiWrapper from './wrapper';

interface Stored {
  api: SocketIOApi;
}

@Injectable()
export class InvokeService {
  private $store: Record<string, any> = {};
  private $wrapper: Record<string, SocketIOApiWrapper> = {};
  private get $api(): Record<string, SocketIOApi> {
    return Object.entries(this.$wrapper)
      .map(([key, value]) => {
        return { [key]: value.api };
      })
      .reduce((acc, cur) => ({ ...acc, ...cur }));
  }

  constructor(
    @Optional()
    @Inject(INVOKE_MODULE_OPTIONS)
    private readonly options: InvokeModuleOptions,
  ) {
    options.servers.forEach((server) => {
      this.$wrapper[server.name] = new SocketIOApiWrapper(server.url);
      this.$api[server.name] = this.$wrapper[server.name].api;
    });
  }

  public get statusMessages(): Record<string, string> {
    return Object.entries(this.$wrapper)
      .map(([key, value]) => {
        return { [key]: value.statusMessage };
      })
      .reduce((acc, cur) => ({ ...acc, ...cur }));
  }

  public getStatusMessage(name: string): string {
    return this.$wrapper[name].statusMessage;
  }
}
