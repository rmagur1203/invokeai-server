import { generateSeed } from '@invoke/core';
import { InvokeService } from '@invoke/wrapper';
import { InvokeServer } from '@invoke/wrapper/interfaces';
import { DefaultGenerationConfig } from '@invoke/wrapper/wrapper';
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  Body,
  Query,
} from '@nestjs/common/decorators/http/route-params.decorator';
import { AppGateway } from './app.gateway';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly invokeService: InvokeService,
    private readonly gateway: AppGateway,
  ) {
    this.invokeService.on('connect', (server) => {
      console.log(`Connected to ${server.name}`);
      this.gateway.socket?.emit('serverConnected', server.name);
    });
    this.invokeService.on('generateStart', (server, uuid) => {
      console.log(`Generation ${uuid} started on ${server.name}`);
      this.gateway.socket?.emit('generateStart', server, uuid);
    });
    this.invokeService.on('generateEnd', (server, uuid, result) => {
      console.log(`Generation ${uuid} finished on ${server.name}`);
      this.gateway.socket?.emit('generateEnd', server, uuid, result);
    });
    this.invokeService.on('generateResult', (server, result) => {
      this.gateway.socket?.emit('generateResult', result);
    });
    this.invokeService.on('disconnect', (server) => {
      console.log(`Disconnected from ${server.name}`);
      this.gateway.socket?.emit('serverDisconnected', server.name);
    });
  }

  @Get()
  getServers(): InvokeServer[] {
    return this.invokeService.servers.map((server) => ({
      ...server,
      status: this.invokeService.getStatusMessage(server.name),
      progress: this.invokeService.getProgress(server.name),
    }));
  }

  @Get('status')
  getStatus(): Record<string, string> {
    return this.invokeService.statusMessages;
  }

  @Get('status/:name')
  getStatusByName(name: string): string {
    return this.invokeService.getStatusMessage(name);
  }

  @Get('progress')
  getProgress(): Record<string, any> {
    return this.invokeService.progress;
  }

  @Get('progress/reset')
  resetProgress() {
    this.invokeService.resetProgress();
    return this.invokeService.progress;
  }

  @Get('progress/:name')
  getProgressByName(name: string): any {
    return this.invokeService.getProgress(name);
  }

  @Get('queue')
  getQueue() {
    return this.invokeService.queue;
  }

  @Get('queue/clear')
  clearQueue() {
    this.invokeService.clearQueue();
    return this.invokeService.queue;
  }

  @Get('queue/shuffle')
  shuffleQueue() {
    this.invokeService.shuffleQueue();
    return this.invokeService.queue;
  }

  @Get('queue/freeze')
  freezeQueue() {
    this.invokeService.stopChecker();
    return this.invokeService.queue;
  }

  @Get('queue/unfreeze')
  unfreezeQueue() {
    this.invokeService.startChecker();
    return this.invokeService.queue;
  }

  @Get('generate')
  generate(
    @Query('prompt') prompt: string,
    @Query('images') images: string,
    @Query('steps') steps: string,
    @Query('width') width: string,
    @Query('height') height: string,
    @Query('cfg_scale') cfg_scale: string,
    @Query('sampler') sampler: string,
    @Query('seed') seed: string,
    @Query('highres') highres: boolean,
  ) {
    if (!prompt) {
      throw new HttpException('Missing prompt', HttpStatus.BAD_REQUEST);
    }
    const uuids: string[] = [];
    for (let i = 0; i < Number(images ?? 1); i++) {
      uuids.push(
        this.invokeService.enqueue({
          ...DefaultGenerationConfig,
          prompt,
          images: 1,
          steps: steps ? Number(steps) : DefaultGenerationConfig.steps,
          width: width ? (Number(width) as any) : DefaultGenerationConfig.width,
          height: height
            ? (Number(height) as any)
            : DefaultGenerationConfig.height,
          cfg_scale: cfg_scale
            ? Number(cfg_scale)
            : DefaultGenerationConfig.cfg_scale,
          sampler: sampler ? (sampler as any) : DefaultGenerationConfig.sampler,
          seed: seed ? Number(seed) + i : generateSeed(),
          hires_fix: !!highres,
        }),
      );
    }
    return uuids;
  }

  @Post('generate')
  generatePost(
    @Body('prompt') prompt: string,
    @Body('images') images: string,
    @Body('steps') steps: string,
    @Body('width') width: string,
    @Body('height') height: string,
    @Body('cfg_scale') cfg_scale: string,
    @Body('sampler') sampler: string,
    @Body('seed') seed: string,
    @Body('highres') highres: boolean,
  ) {
    if (!prompt) {
      throw new HttpException('Missing prompt', HttpStatus.BAD_REQUEST);
    }
    const uuids: string[] = [];
    for (let i = 0; i < Number(images ?? 1); i++) {
      uuids.push(
        this.invokeService.enqueue({
          ...DefaultGenerationConfig,
          prompt,
          images: 1,
          steps: steps ? Number(steps) : DefaultGenerationConfig.steps,
          width: width ? (Number(width) as any) : DefaultGenerationConfig.width,
          height: height
            ? (Number(height) as any)
            : DefaultGenerationConfig.height,
          cfg_scale: cfg_scale
            ? Number(cfg_scale)
            : DefaultGenerationConfig.cfg_scale,
          sampler: sampler ? (sampler as any) : DefaultGenerationConfig.sampler,
          seed: seed ? Number(seed) + i : generateSeed(),
          hires_fix: !!highres,
        }),
      );
    }
    return uuids;
  }

  @Get('result')
  getResults() {
    return this.invokeService.results;
  }

  @Get('result/:uuid')
  getResult(uuid: string) {
    return this.invokeService.getResult(uuid);
  }
}
