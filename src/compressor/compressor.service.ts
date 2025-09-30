import { BadRequestException, Injectable } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { Express } from 'express';
import path from 'node:path';
const FormData = require('form-data');
import * as fs from 'node:fs';
import axios from "axios";

interface VideoMetadata {
  format: {
    duration?: number;
    size?: string;
    bit_rate?: string;
  };
}

@Injectable()
export class CompressorService {
  constructor() {
    ffmpeg.setFfmpegPath(ffmpegPath as string);
    ffmpeg.setFfprobePath(ffprobeStatic.path);
  }

  async compressVideo(file: Express.Multer.File, targetSize: number) {
    try {
      console.log('File path exists:', !!file.path);

      console.log('File info:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
      });

      const duration = await this.getDuration(file.path);
      const bitrate = this.calculateBitrate(targetSize, duration);
      const uniqueFileName = `compressed-${Date.now()}.mp4`;
      const outputPath = path.join('test-files', uniqueFileName);
      console.log('outputPath', outputPath);
      await this.encodeVideo(file.path, outputPath, bitrate);
      const videoLink = await this.sendToBot(outputPath,uniqueFileName);
      setTimeout(() => {
        this.cleanupFile(file.path);
      }, 5000);
      console.log('video is done');
      return {
        message: 'Video compressed successfully',
        videoLink:videoLink,
      };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  private calculateBitrate(targetMb: number, durationSec: number) {
    const targetBits = targetMb * 1024 * 1024 * 8;
    const overhead = 1.03;
    const totalBps = targetBits / durationSec / overhead;
    let audioKbps = 128;
    let videoKbps = totalBps / 1000 - audioKbps;
    while (videoKbps < 1 && audioKbps > 1) {
      audioKbps = Math.floor(audioKbps / 2);
      videoKbps = totalBps / 1000 - audioKbps;
    }

    return Math.max(16, Math.floor(videoKbps));
  }

  private encodeVideo(
    input: string,
    output: string,
    videoSize: number,

  ) {
    return new Promise((resolve, reject) => {

      const tmpPass = path.join(
        path.dirname(output),
        `ffpass-${Date.now()}.mp4`,
      );
      console.log('Temp pass: ', tmpPass);
      const command = ffmpeg(input)
        .videoCodec('libx264')
        .videoBitrate(videoSize)
        .audioCodec('aac')
        .audioBitrate('128k')
        .outputOptions([
          '-preset ultrafast','-maxrate 1000k',
          '-bufsize 2000k',
          '-movflags +faststart',
          '-profile:v high',
          '-y',
        ]);

      command
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`progress: ${progress.percent.toFixed(2)}% done`);
          }
        })
        .on('end', () => {
          console.log('! Single pass encoding complete!');
          resolve(output);
        })
        .on('error', (err: Error) => {
          console.error('Encoding error:', err.message);
          reject(err);
        })

        .save(output);
    });
  }

  private async cleanupFile(
    inputPath: string,
    maxRetries: number = 10,
    delayMs: number = 1000,
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (!fs.existsSync(inputPath)) {
          return;
        }

        fs.unlinkSync(inputPath);
        console.log('! Input file removed successfully');
        return;
      } catch (e) {
        const error = e as NodeJS.ErrnoException;

        if (error.code === 'EBUSY' && i < maxRetries - 1) {
          console.log(
            `[Cleanup] File busy (${i + 1}/${maxRetries}), retrying in ${delayMs}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          console.error(
            `[Cleanup] Could not delete input file after retries: ${error.code} at path: ${inputPath}`,
            error.message,
          );
          return;
        }
      }
    }
  }

 /* private cleanupLogFiles(logFile: string): void {
    const logFiles = [`${logFile}-0.log`, `${logFile}-0.log.mbtree`];

    logFiles.forEach((file) => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`Cleaned up log file: ${file}`);
        }
      } catch (err) {
        console.error(` Could not delete log file ${file}:`, err.message);
      }
    });
  }
TODO: fix deleting logs file*/
  private async getDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err: Error, metadata: VideoMetadata) => {
        if (err) return reject(err);
        const duration = metadata?.format?.duration;
        if (typeof duration !== 'number' || Number.isNaN(duration)) {
          return reject(new Error('Could not read duration from file'));
        }
        resolve(duration);
      });
    });
  }
  private async sendToBot(filePath:string,fileName:string) {

      const formData = new FormData();

formData.append('video',fs.createReadStream(filePath),{filename:fileName});
try{
    const response = await axios.post(`${process.env.BACKEND_URL}/api/send-video`,formData,{
        headers:formData.getHeaders(),
    });
    const fileUrl:string = response.data.fileUrl;
    return fileUrl;
}catch(err){
    return Promise.reject(err);
}

  }
}
