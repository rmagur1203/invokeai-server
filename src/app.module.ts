import { InvokeModule } from '@invoke/wrapper';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppGateway } from './app.gateway';
import { ConfigModule } from '@nestjs/config/dist';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    InvokeModule.register({
      servers: [
        {
          name: 'plebea',
          url: 'http://plebea.com:9090/',
        },
        {
          name: 'rmagur1203',
          url: 'http://210.103.126.185:9090/',
        },
        {
          name: 'goorm-1',
          url: 'https://invoke.run-asia-northeast1.goorm.io/',
        },
        {
          name: 'goorm-2',
          url: 'https://invokeai-gtjcv.run-asia-northeast1.goorm.io',
        },
      ],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, AppGateway],
})
export class AppModule {}
