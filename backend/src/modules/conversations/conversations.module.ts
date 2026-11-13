import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller.js';
import { ConversationalAiService } from './conversational-ai.service.js';
import { AiEngineModule } from '../ai-engine/ai-engine.module.js';

@Module({
  imports: [AiEngineModule],
  controllers: [ConversationsController],
  providers: [ConversationalAiService],
})
export class ConversationsModule {}
