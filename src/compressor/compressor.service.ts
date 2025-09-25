import {BadRequestException, Injectable} from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import {Express} from 'express';
import path from 'node:path';
import * as fs from 'node:fs';

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
            const outputPath = path.join(
                'test-files',
                `compressed-${Date.now()}.mp4`,
            );
            console.log('outputPath', outputPath);
            await this.encodeVideo(file.path, outputPath, bitrate);
            setTimeout(() => {
                this.cleanupFile(file.path);
            }, 1000);
            console.log('video is done');
            return {
                message: "Video compressed successfully",
            }


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

    private encodeVideo(input: string, output: string, videoSize: number, secondPass: boolean = false) {
        return new Promise((resolve, reject) => {
            const logFile = `ffmpeg2pass-${Date.now()}`;
            const tmpPass = path.join(
                path.dirname(output),
                `ffpass-${Date.now()}.mp4`,
            );
            console.log('Temp pass: ', tmpPass);
            ffmpeg(input)
                .videoCodec('libx264')
                .videoBitrate(videoSize)
                .audioCodec('aac')
                .audioBitrate('128k')
                .outputOptions(['-pass 1', '-f mp4', '-y', `-passlogfile ${logFile}`])
                .output("NUL")
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`progress: ${progress.percent.toFixed(2)}% done`);

                    }
                })
                .on('end', () => {
                    console.log('! First pass completed!');
                    if (secondPass) {
                        console.log('! starting second pass');

                        ffmpeg(input)
                            .videoCodec('libx264')
                            .videoBitrate(videoSize)
                            .audioCodec('aac')
                            .audioBitrate('128k')
                            .outputOptions([
                                '-pass 2',
                                '-movflags +faststart',
                                '-tune film',
                                '-y',
                                '-profile:v high',
                                `-passlogfile ${logFile}`
                            ])
                            .on('progress', (progress) => {
                                if (progress.percent) {
                                    console.log(`progress pass 2: ${progress.percent.toFixed(2)}% done`);

                                }
                            })

                            .on('end', () => {
                                console.log('! Done pass 2');
                                this.cleanupLogFiles(logFile)

                                resolve(output);

                            })

                            .on('error', (err: Error) => {
                                console.error('Second pass error:', err);
                                this.cleanupLogFiles(logFile);
                                reject(err);
                            })
                            .save(output);
                    } else {
                        ffmpeg(input).save(output)
                        this.cleanupLogFiles(logFile)
                            resolve(output);
                    }


                })
                .on('error', (err: Error) => {
                    console.error('First pass error:', err);
                    this.cleanupLogFiles(logFile);
                    reject(err);
                }).run();

        });
    }

    private cleanupFile(inputPath: string): void {
        try {
            if (fs.existsSync(inputPath)) {
                fs.unlinkSync(inputPath);
                console.log('! Input file removed')

            }
        } catch (e) {
            console.log('Could not delete input file:', e)
        }
    }

    private cleanupLogFiles(logFile: string): void {
        const logFiles = [`${logFile}-0.log`, `${logFile}-0.log.mbtree`];

        logFiles.forEach(file => {
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
}
