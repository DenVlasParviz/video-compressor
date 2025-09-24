import { Test, TestingModule } from '@nestjs/testing';
import { CompressorService } from './compressor.service';

describe('CompressorService', () => {
  let service: CompressorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompressorService],
    }).compile();

    service = module.get<CompressorService>(CompressorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
