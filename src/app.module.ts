import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CompressorController } from './compressor/compressor.controller';

import { AppService } from './app.service';
import { CompressorService } from './compressor/compressor.service';



@Module({
  imports: [],
  controllers: [AppController, CompressorController],
  providers: [AppService,CompressorService],
})
export class AppModule {}
