import {
  GenerationResult,
  IntermediateResult,
  ProgressUpdate,
  SocketIOApi,
} from '@invoke/api';
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
  generateStart: (server: InvokeServer, uuid: string) => void;
  generateEnd: (
    server: InvokeServer,
    uuid: string,
    result: GenerationResult,
  ) => void;
  generateCancel: (server: InvokeServer) => void;
  generateResult: (server: InvokeServer, result: GenerationResult) => void;
  intermediateResult: (
    server: InvokeServer,
    result: IntermediateResult,
  ) => void;
  progressUpdate: (server: InvokeServer, progress: ProgressUpdate) => void;
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
      });
      this.$api[server.name].onDisconnect(() => {
        this.emit('disconnect', server);
      });
      this.$api[server.name].onIntermediateResult((result) => {
        this.emit('intermediateResult', server, result);
      });
      this.$api[server.name].onProgressUpdate((progress) => {
        this.emit('progressUpdate', server, progress);
      });
      this.$api[server.name].onProcessingCanceled(() => {
        this.emit('generateCancel', server);
      });
      this.$api[server.name].onGenerationResult((result) => {
        result.thumbnail = this.$wrapper[server.name].getImage(
          result.thumbnail,
        );
        result.url = this.$wrapper[server.name].getImage(result.url);
        this.emit('generateResult', server, result);
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
        this.$wrapper[server].forceSetProgress({
          currentStep: 1,
          totalSteps: 50,
          currentIteration: 1,
          totalIterations: 1,
          currentStatus: 'Preparing',
          isProcessing: true,
          currentStatusHasSteps: false,
          hasError: false,
        });
      } else this.dequeue(server);
    });
  }

  public stopChecker() {
    if (this.$checker) {
      clearInterval(this.$checker);
      this.$checker = null;
    }
  }

  public startChecker() {
    if (!this.$checker)
      this.$checker = setInterval(this.checkQueue.bind(this), 10 * 1000);
  }

  public generate(
    [uuid, config]: [string, GenerationConfig],
    serverName: string,
  ) {
    const server = this.serverRecords[serverName];
    this.emit('generateStart', server, uuid);
    this.$wrapper[serverName].generate(config).then((result) => {
      result.thumbnail = this.$wrapper[serverName].getImage(result.thumbnail);
      result.url = this.$wrapper[serverName].getImage(result.url);
      this.$result[uuid] = result;
      this.emit('generateEnd', server, uuid, result);
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

  public resetProgress() {
    Object.values(this.$wrapper).forEach((wrapper) => {
      wrapper.forceSetProgress({
        currentStep: 0,
        totalSteps: 0,
        currentIteration: 0,
        totalIterations: 0,
        currentStatus: 'Forced reset',
        isProcessing: false,
        currentStatusHasSteps: false,
        hasError: false,
      });
    });
  }
}
