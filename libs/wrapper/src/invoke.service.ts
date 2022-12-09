import { GenerationResult, ProgressUpdate, SocketIOApi } from '@invoke/api';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { EventEmitter } from 'events';
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
    setInterval(this.checkQueue.bind(this), 1000);
  }

  public get servers(): InvokeServer[] {
    return this.options.servers;
  }

  public get queue() {
    return this.$queue;
  }

  public enqueue(config: GenerationConfig) {
    const uuid = uuidv4();
    this.$queue.push([uuid, config]);
    return uuid;
  }

  public async dequeue(serverName: string) {
    if (this.$queue.length > 0) {
      const [uuid, config] = this.$queue.shift();
      this.emit('generateStart', uuid);
      this.$wrapper[serverName].generate(config).then((result) => {
        result.thumbnail = this.$wrapper[serverName].getImage(result.thumbnail);
        result.url = this.$wrapper[serverName].getImage(result.url);
        this.$result[uuid] = result;
        this.emit('generateEnd', uuid, result);
      });
    }
  }

  public clearQueue() {
    this.$queue = [];
  }

  public shuffleQueue() {
    this.$queue = this.$queue.sort(() => Math.random() - 0.5);
  }

  public checkQueue() {
    this.availableServers.forEach((server) => {
      if (!this.$wrapper[server].isProcessing) this.dequeue(server);
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

  public get processing(): Record<string, any> {
    return Object.entries(this.$wrapper)
      .map(([key, value]) => {
        return { [key]: value.processing };
      })
      .reduce((acc, cur) => ({ ...acc, ...cur }));
  }

  public getProcessing(name: string): ProgressUpdate {
    return this.$wrapper[name].processing;
  }

  public get results(): Record<string, GenerationResult> {
    return this.$result;
  }

  public getResult(uuid: string): GenerationResult {
    return this.$result[uuid];
  }
}
