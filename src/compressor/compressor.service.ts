import {BadRequestException, Injectable} from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { Express } from 'express';
import path from "node:path";


interface VideoMetadata {
    format: {
        duration?: number;
        size?: string;
        bit_rate?: string;
    };
}

@Injectable()
export class CompressorService {
constructor(){
    ffmpeg.setFfmpegPath(ffmpegPath as string);
    ffmpeg.setFfprobePath(ffprobeStatic.path);
}

    async compressVideo(file: Express.Multer.File,targetSize:number) {
try{
    let tempInputPath: string | null = null;
    console.log('File path exists:', !!file.path); // Проверяем, есть ли path

    console.log('File info:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path // Явно выводим path
    });



    const duration = await this.getDuration(file.path);
    const bitrate = this.calculateBitrate(targetSize,duration);
    console.log("video bitrate:", bitrate);
    const outputPath= 'test-files/result.mp4' //TODO fix a problem where a result.mp4 is created
    await this.encodeVideo(file.path,outputPath,bitrate);
    console.log("video is done:")

}
   catch(err){
    throw new BadRequestException(err.message);
   }


     /*   async function test() {
            const input = 'test-files/test2.mp4';
            const output= 'test-files/result.mp4'
            try {
                const duration = await getDuration(input);
                console.log("duration:",duration)
                const bitrate = calculateBitrate(9, duration);
                console.log("video bitrate", bitrate);
                await encodeVideo(input,output,bitrate);
                console.log('Видео готово:', output);
            } catch (err) {
                console.log("An error:", err.message)
            }
        }*/


    }
    private calculateBitrate(targetMb:number, durationSec:number) {
        const targetBits = targetMb * 1024 * 1024 * 8;
        const overhead = 1.03;
        const totalBps = targetBits / durationSec / overhead;
        console.log("total bps:", totalBps)
        let audioKbps = 128;
        let videoKbps = (totalBps / 1000)-audioKbps;
        while (videoKbps < 1 && audioKbps > 1) {
            audioKbps = Math.floor(audioKbps / 2);
            videoKbps = (totalBps / 1000)-audioKbps;
        }
        console.log('videoKbps:', videoKbps, 'audioKbps:', audioKbps);

        console.log("video kbps:", videoKbps)



        return Math.max(16, Math.floor(videoKbps));

    }

    private encodeVideo(input:string, output:string, videoSize:number)  {
        return new Promise((resolve, reject) => {
            const tmpPass = path.join(path.dirname(output), `ffpass-${Date.now()}.mp4`);
            const pass1 = ffmpeg(input)
                .videoCodec('libx264')
                .videoBitrate(videoSize)
                .audioCodec('aac')
                .audioBitrate("128k")
                .outputOptions([
                    '-pass 1',
                    '-f mp4', // обязательный формат для pass1
                    '-y'      // перезапись, если файл уже есть
                ])
                .output(tmpPass) // временный файл

                pass1.on('end', () => {
                    const pass2= ffmpeg(input)
                        .videoCodec('libx264')
                        .videoBitrate(videoSize)
                        .audioCodec('aac')
                        .audioBitrate('128k')
                        .outputOptions(['-pass 2', '-movflags +faststart', '-tune film', '-y', '-profile:v high'])

                        pass2.on('end', () => {resolve(output)})
                        pass2.on('error', (err:Error)=>{reject(err)}) .save(output);
                    pass2.run();
                }).on('error', reject).run();
            pass1.run();
        });
    }

    private async getDuration(filePath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err:Error, metadata:VideoMetadata ) => {
                if (err) return reject(err)
                const duration = metadata?.format?.duration;
                if (typeof duration !== 'number' || Number.isNaN(duration)) {
                    return reject(new Error('Could not read duration from file'));
                }
                resolve(duration);
            })
        })


    }


}
