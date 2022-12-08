import 'reflect-metadata';
import { Logger } from '@nestjs/common/services';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);

  Logger.log(`Listening on port ${port}`, 'Bootstrap');
}
bootstrap();
