import { Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/common';
import { DatasetsService } from './datasets.service.js';

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
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: { originalname: string; mimetype: string; buffer?: Buffer }) {
    return this.datasetsService.upload(file);
  }
}
