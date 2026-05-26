import { Injectable, Logger } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  async uploadImage(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder: 'blog-portfolio' },
        (error, result) => {
          if (error) return reject(new Error(error.message));
          resolve(result);
        },
      );
      Readable.from(file.buffer).pipe(upload);
    });
  }

  generateUploadSignature(params: Record<string, any>) {
    const config = cloudinary.config();
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { ...params, timestamp },
      config.api_secret,
    );
    return {
      signature,
      timestamp,
      cloudName: config.cloud_name,
      apiKey: config.api_key,
    };
  }

  async getImages(next_cursor?: string) {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'blog-portfolio', // filter by folder
        max_results: 50,
        next_cursor,
        direction: 'desc',
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to fetch images: ${error.message}`);
    }
  }

  async deleteImage(publicId: string) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  extractPublicId(url: string): string {
    if (!url || typeof url !== 'string') return null;
    try {
      // Match URL with version segment: /v1234567890/folder/image.jpg
      const versionMatch = url.match(/\/v\d+\/(.+?)(?:\.[a-z0-9]+)?$/i);
      if (versionMatch && versionMatch[1]) {
        return versionMatch[1];
      }
      // Fallback: match URL without version segment: /upload/folder/image.jpg
      const uploadMatch = url.match(/\/upload\/(.+?)(?:\.[a-z0-9]+)?$/i);
      if (uploadMatch && uploadMatch[1]) {
        return uploadMatch[1];
      }
      return null;
    } catch {
      return null;
    }
  }

  deleteImagesSafely(urls: string[]): void {
    const validUrls = urls.filter(
      (url): url is string => !!url && url.includes('cloudinary.com'),
    );
    if (validUrls.length === 0) return;

    // Fire and forget to avoid blocking
    Promise.all(
      validUrls.map(async (url) => {
        const publicId = this.extractPublicId(url);
        if (publicId) {
          try {
            await this.deleteImage(publicId);
          } catch (error) {
            this.logger.error(
              `Failed to cleanup image ${publicId}:`,
              error.message,
            );
          }
        }
      }),
    ).catch((_e) => this.logger.error('Error in batch image deletion:', _e));
  }
}
