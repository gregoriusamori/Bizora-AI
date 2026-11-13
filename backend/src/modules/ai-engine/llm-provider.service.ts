import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

export interface LLMProvider {
  generate(prompt: string): Promise<string>;
}

@Injectable()
export class LlmProviderService implements LLMProvider {
  private readonly client: OpenAI | null;
  private readonly logger = new Logger(LlmProviderService.name);

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async generate(prompt: string): Promise<string> {
    if (!this.client) {
      return `LLM placeholder response for: ${prompt}`;
    }

    const completion = await this.client.chat.completions.create({
      model: process.env.AI_DEFAULT_MODEL ?? 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return `LLM placeholder response for: ${prompt}`;
    }
    return content;
  }
}
