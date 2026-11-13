import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions.js';

export interface LLMProvider {
  generate(prompt: string): Promise<string>;
}

type ChatMessage = ChatCompletionMessageParam;

@Injectable()
export class LlmProviderService implements LLMProvider {
  private readonly client: OpenAI | null;
  private readonly logger = new Logger(LlmProviderService.name);

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private model(): string {
    return process.env.AI_DEFAULT_MODEL ?? 'gpt-4o-mini';
  }

  async generate(prompt: string): Promise<string> {
    if (!this.client) {
      return `LLM placeholder response for: ${prompt}`;
    }

    const completion = await this.client.chat.completions.create({
      model: this.model(),
      messages: [{ role: 'user', content: prompt }],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return `LLM placeholder response for: ${prompt}`;
    }
    return content;
  }

  async chat(
    messages: ChatMessage[],
    tools?: ChatCompletionTool[],
  ): Promise<{
    content: string | null;
    toolCalls: Array<{ id: string; name: string; arguments: string }>;
  }> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI provider belum dikonfigurasi. Set OPENAI_API_KEY pada environment backend.',
      );
    }

    const completion = await this.client.chat.completions.create({
      model: this.model(),
      messages,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' as const } : {}),
      temperature: 0.2,
    });

    const message = completion.choices[0]?.message;
    const toolCalls = (message?.tool_calls ?? [])
      .filter((tc): tc is Extract<typeof tc, { type: 'function' }> => tc.type === 'function')
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

    this.logger.debug(
      `LLM response: content=${message?.content ? 'yes' : 'no'}, toolCalls=${toolCalls.length}`,
    );

    return {
      content: message?.content ?? null,
      toolCalls,
    };
  }
}
