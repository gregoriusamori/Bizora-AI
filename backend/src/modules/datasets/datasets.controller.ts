import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/common';
import { DatasetsService } from './datasets.service.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@Controller('datasets')
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async list() {
    return this.datasetsService.list();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.datasetsService.detail(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(@UploadedFile() file: { originalname: string; mimetype: string; buffer?: Buffer }) {
    if (!file || !file.buffer) {
      throw new BadRequestException('File tidak ditemukan. Gunakan form-data dengan field "file".');
    }
    return this.datasetsService.upload(file);
  }
}
