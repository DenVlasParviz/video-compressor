import { Test, TestingModule } from '@nestjs/testing';
import { CompressorController } from './compressor.controller';

describe('CompressorController', () => {
  let controller: CompressorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompressorController],
    }).compile();

    controller = module.get<CompressorController>(CompressorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
