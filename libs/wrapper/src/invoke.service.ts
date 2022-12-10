import { GenerationResult, ProgressUpdate, SocketIOApi } from '@invoke/api';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { TypedEmitter } from 'tiny-typed-emitter';
import { v4 as uuidv4 } from 'uuid';
import { InvokeModuleOptions, InvokeServer } from './interfaces';
import { INVOKE_MODULE_OPTIONS } from './invoke.constants';
import SocketIOApiWrapper, { GenerationConfig } from './wrapper';

interface Stored {
  api: SocketIOApi;
}

interface Events {
  connect: (server: InvokeServer) => void;
  generateStart: (uuid: string) => void;
  generateEnd: (uuid: string, result: GenerationResult) => void;
  generateResult: (result: GenerationResult) => void;
  disconnect: (server: InvokeServer) => void;
}

@Injectable()
export class InvokeService extends TypedEmitter<Events> {
  private $checker: NodeJS.Timer | null = null;
  private $store: Record<string, any> = {};
  private $wrapper: Record<string, SocketIOApiWrapper> = {};
  private $queue: [string, GenerationConfig][] = [];
  private $result: Record<string, GenerationResult> = {};
  private get $api(): Record<string, SocketIOApi> {
    return Object.fromEntries(
      Object.entries(this.$wrapper).map(([key, value]) => {
        return [key, value.api];
      }),
    );
  }
  // private get availableServerNames(): string[] {
  //   return Object.entries(this.$wrapper)
  //     .filter(([key, value]) => value.connected)
  //     .map(([key, value]) => key);
  // }
  // private get availableServers(): InvokeServer[] {
  //   return Object.entries(this.$wrapper)
  //     .filter(([key, value]) => value.connected)
  //     .map(([key, value]) => this.serverRecords[key]);
  // }
  private get availableServers(): string[] {
    return Object.entries(this.$wrapper)
      .filter(([key, value]) => value.connected)
      .map(([key, value]) => key);
  }

  constructor(
    @Optional()
    @Inject(INVOKE_MODULE_OPTIONS)
    private readonly options: InvokeModuleOptions,
  ) {
    super();
    options.servers.forEach((server) => {
      this.$wrapper[server.name] = new SocketIOApiWrapper(server.url);
      this.$api[server.name] = this.$wrapper[server.name].api;

      this.$api[server.name].onConnect(() => {
        this.emit('connect', server);
        // this.dequeue(server.name);
      });
      this.$api[server.name].onDisconnect(() => {
        this.emit('disconnect', server);
      });
      // this.$api[server.name].onProgressUpdate((progress) => {
      //   if (!progress.isProcessing) {
      //     this.dequeue(server.name);
      //   }
      // });
      // this.$api[server.name].onProcessingCanceled(() => {
      //   this.dequeue(server.name);
      // });
      this.$api[server.name].onGenerationResult((result) => {
        result.thumbnail = this.$wrapper[server.name].getImage(
          result.thumbnail,
        );
        result.url = this.$wrapper[server.name].getImage(result.url);
        this.emit('generateResult', result);
      });
    });
    this.$checker = setInterval(this.checkQueue.bind(this), 10 * 1000);
  }

  public get servers(): InvokeServer[] {
    return this.options.servers;
  }
  public get serverRecords(): Record<string, InvokeServer> {
    return Object.fromEntries(
      this.options.servers.map((server) => [server.name, server]),
    );
  }

  public get queue() {
    return this.$queue;
  }

  public get topQueue() {
    return this.$queue[0];
  }

  public enqueue(config: GenerationConfig) {
    const uuid = uuidv4();
    this.$queue.push([uuid, config]);
    return uuid;
  }

  public async dequeue(serverName: string) {
    if (this.$queue.length > 0) {
      if (
        this.serverRecords[serverName].maxSize &&
        this.serverRecords[serverName].maxSize <
          this.topQueue[1].width * this.topQueue[1].height
      )
        return;
      const work = this.$queue.shift();
      this.generate(work, serverName);
    }
  }

  public clearQueue() {
    this.$queue = [];
  }

  public shuffleQueue() {
    this.$queue = this.$queue.sort(() => Math.random() - 0.5);
  }

  public checkQueue() {
    if (this.$queue.length <= 0) return;
    this.availableServers.forEach((server) => {
      if (this.$wrapper[server].isProcessing) return;
      if (this.serverRecords[server].maxSize) {
        const index = this.$queue.findIndex(
          ([uuid, config]) =>
            this.serverRecords[server].maxSize >= config.width * config.height,
        );
        if (index < 0) return;
        const work = this.$queue.splice(index, 1)[0];
        this.generate(work, server);
      } else this.dequeue(server);
    });
  }

  public stopChecker() {
    if (this.$checker) clearInterval(this.$checker);
  }

  public startChecker() {
    if (!this.$checker)
      this.$checker = setInterval(this.checkQueue.bind(this), 10 * 1000);
  }

  public generate(
    [uuid, config]: [string, GenerationConfig],
    serverName: string,
  ) {
    this.emit('generateStart', uuid);
    this.$wrapper[serverName].generate(config).then((result) => {
      result.thumbnail = this.$wrapper[serverName].getImage(result.thumbnail);
      result.url = this.$wrapper[serverName].getImage(result.url);
      this.$result[uuid] = result;
      this.emit('generateEnd', uuid, result);
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

  public get progress(): Record<string, any> {
    return Object.entries(this.$wrapper)
      .map(([key, value]) => {
        return { [key]: value.progress };
      })
      .reduce((acc, cur) => ({ ...acc, ...cur }));
  }

  public getProgress(name: string): ProgressUpdate {
    return this.$wrapper[name].progress;
  }

  public get results(): Record<string, GenerationResult> {
    return this.$result;
  }

  public getResult(uuid: string): GenerationResult {
    return this.$result[uuid];
  }
}
