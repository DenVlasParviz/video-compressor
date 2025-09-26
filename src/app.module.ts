import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CompressorController } from './compressor/compressor.controller';

import { AppService } from './app.service';
import { CompressorService } from './compressor/compressor.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'test-files'),
      serveRoot: '/static',
    }),
  ],
  controllers: [AppController, CompressorController],
  providers: [AppService, CompressorService],
})
export class AppModule {}
