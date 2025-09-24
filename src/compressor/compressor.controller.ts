import {
    Controller,
    Post,
    Body,
    UseInterceptors,
    Res,
    BadRequestException,
    UploadedFile, Get  // ДОБАВЛЕНО: импорт декоратора UploadedFile
} from '@nestjs/common';
import type { Express } from 'express';
import { CompressorService } from "./compressor.service";
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import {extname} from "node:path";

@Controller('compressor')
export class CompressorController {
    constructor(private readonly compressorService: CompressorService) {}


    @Post()
    @UseInterceptors(FileInterceptor('file',{
        storage: diskStorage({
            destination:'./test-files',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = extname(file.originalname);
                cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
            },
        }), limits: {
            fileSize: 100 * 1024 * 1024,
        },
    }))
    async compress(
        @UploadedFile() file: Express.Multer.File,
        @Body('targetSize') targetSize: string,
        ){
        try{
            if (!file) {
                throw new BadRequestException('File is required');
            }
            const targetSizeNumber = parseFloat(targetSize);
            console.log('Processing file:', file.originalname);
            console.log('Target size:', targetSizeNumber, 'MB');
            return await this.compressorService.compressVideo(file,targetSizeNumber);
        }catch(err){
            throw new BadRequestException(err.message);
        }


    }


}
