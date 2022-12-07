import { InvokeService } from '@invoke/wrapper';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly invokeService: InvokeService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('status')
  getStatus(): Record<string, string> {
    return this.invokeService.statusMessages;
  }

  @Get('status/:name')
  getStatusByName(name: string): string {
    return this.invokeService.getStatusMessage(name);
  }
}
