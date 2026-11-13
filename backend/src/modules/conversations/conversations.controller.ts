import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ConversationalAiService } from './conversational-ai.service.js';
import type { JwtPayload } from '../auth/jwt.strategy.js';

class ChatDto {
  @IsString()
  @MaxLength(2000)
  message: string;

  @IsUUID()
  @IsOptional()
  datasetId?: string;
}

class CreateConversationDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;

  @IsUUID()
  @IsOptional()
  datasetId?: string;
}

@Controller('conversations')
@UseGuards(AuthGuard('jwt'))
export class ConversationsController {
  constructor(private readonly conversationalAi: ConversationalAiService) {}

  private userId(req: Request): string {
    return (req.user as JwtPayload).sub;
  }

  @Get()
  async list(@Req() req: Request) {
    return this.conversationalAi.listConversations(this.userId(req));
  }

  @Post()
  async create(
    @Req() req: Request,
    @Body(new ValidationPipe()) dto: CreateConversationDto,
  ) {
    return this.conversationalAi.createConversation(this.userId(req), dto);
  }

  @Get(':id')
  async detail(@Req() req: Request, @Param('id') id: string) {
    return this.conversationalAi.getConversation(this.userId(req), id);
  }

  @Delete(':id')
  async delete(@Req() req: Request, @Param('id') id: string) {
    return this.conversationalAi.deleteConversation(this.userId(req), id);
  }

  @Post(':id/chat')
  async chat(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ValidationPipe()) dto: ChatDto,
  ) {
    return this.conversationalAi.chat(this.userId(req), {
      conversationId: id,
      datasetId: dto.datasetId,
      message: dto.message,
    });
  }

  @Post('chat')
  async chatNew(@Req() req: Request, @Body(new ValidationPipe()) dto: ChatDto) {
    return this.conversationalAi.chat(this.userId(req), {
      datasetId: dto.datasetId,
      message: dto.message,
    });
  }
}
