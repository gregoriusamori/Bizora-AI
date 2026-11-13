import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { LlmProviderService } from '../ai-engine/llm-provider.service.js';
import {
  AnalysisToolsService,
  ToolArgs,
} from '../ai-engine/analysis-tools.service.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import type { Dataset } from '../../../generated/prisma/client.js';
import * as PrismaGenerated from '../../../generated/prisma/client.js';

export interface ChatPayload {
  conversationId?: string;
  datasetId?: string;
  message: string;
}

export interface StructuredAiResponse {
  text: string;
  kpis?: Array<{ label: string; value: string }>;
  table?: { columns: string[]; rows: Array<Array<string | number>> };
  chart?: {
    type: 'line' | 'bar';
    title?: string;
    xKey: string;
    seriesKeys: string[];
    data: Array<Record<string, unknown>>;
  };
  source?: {
    dataset?: string;
    period?: string;
    tool?: string;
    sql?: string;
  };
}

const MAX_TOOL_ROUNDS = 4;
const HISTORY_LIMIT = 10;

const SYSTEM_PROMPT = `Anda adalah asisten analisis bisnis (BI) berbahasa Indonesia pada platform AI Business Intelligence.

ATURAN MUTLAK:
1. JANGAN PERNAH mengarang angka, persentase, tren, atau hasil perhitungan. Semua angka HARUS berasal dari hasil tool.
2. Untuk setiap pertanyaan analisis, panggil tool yang relevan terlebih dahulu sebelum menjawab.
3. Jika belum tahu nama kolom yang tepat, panggil tool "dataset_info" terlebih dahulu.
4. Jika data tidak tersedia atau pertanyaan tidak dapat dijawab dengan data, sampaikan keterbatasannya secara jujur.
5. Bedakan fakta (dari data) dengan dugaan/penyebab. Jangan mengklaim sebab-akibat bila data hanya menunjukkan korelasi.
6. Jawab akhir HANYA dalam satu objek JSON valid tanpa teks lain di luar JSON:
{
  "text": "ringkasan jawaban singkat (markdown sederhana)",
  "kpis": [{"label": "Total Revenue", "value": "1.234.500"}],
  "table": {"columns": ["Nama Kolom", "Nilai"], "rows": [["A", 100]]},
  "chart": {"type": "line|bar", "title": "...", "xKey": "period", "seriesKeys": ["value"], "data": [{"period": "2024-01", "value": 100}]},
  "source": {"dataset": "nama dataset", "period": "periode analisis", "tool": "nama tool", "sql": "SQL jika run_sql dipakai"}
}
7. kpis/table/chart/source opsional — sertakan hanya jika relevan. Angka pada kpis/table/chart HARUS disalin dari hasil tool.
8. text memuat interpretasi singkat merujuk angka hasil tool, plus (jika relevan) 1-3 saran tindak lanjut yang ditandai jelas sebagai saran.`;

@Injectable()
export class ConversationalAiService {
  private readonly logger = new Logger(ConversationalAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmProviderService,
    private readonly tools: AnalysisToolsService,
  ) {}

  async listConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        datasetId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createConversation(
    userId: string,
    dto: { title?: string; datasetId?: string },
  ) {
    return this.prisma.conversation.create({
      data: {
        userId,
        title: dto.title ?? 'Percakapan baru',
        datasetId: dto.datasetId,
      },
      select: {
        id: true,
        title: true,
        datasetId: true,
        createdAt: true,
      },
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) {
      throw new NotFoundException('Percakapan tidak ditemukan.');
    }
    if (conversation.userId !== userId) {
      throw new ForbiddenException('Percakapan bukan milik Anda.');
    }
    return conversation;
  }

  async deleteConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Percakapan tidak ditemukan.');
    }
    if (conversation.userId !== userId) {
      throw new ForbiddenException('Percakapan bukan milik Anda.');
    }
    await this.prisma.conversation.delete({ where: { id: conversationId } });
    return { deleted: true };
  }

  async chat(userId: string, payload: ChatPayload) {
    const message = (payload.message ?? '').trim();
    if (!message) {
      throw new BadRequestException('Pesan tidak boleh kosong.');
    }

    const dataset = await this.resolveDataset(
      userId,
      payload.datasetId,
      payload.conversationId,
    );
    if (!dataset) {
      throw new BadRequestException(
        'Belum ada dataset. Import dataset terlebih dahulu atau sertakan datasetId.',
      );
    }

    let conversation = payload.conversationId
      ? await this.prisma.conversation.findUnique({
          where: { id: payload.conversationId },
        })
      : null;
    if (conversation && conversation.userId !== userId) {
      throw new ForbiddenException('Percakapan bukan milik Anda.');
    }
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
          datasetId: dataset.id,
          title: message.slice(0, 60),
        },
      });
    }

    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
      },
    });

    if (!payload.conversationId) {
      payload.conversationId = conversation.id;
    }

    const context = await this.tools.loadContext(dataset.id);
    const history = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT + 1,
    });
    const priorHistory = history.filter((m) => m.id !== userMessage.id);

    const llmMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'system',
        content: `Konteks dataset aktif:
- Nama: ${context.datasetName}
- Jumlah baris: ${context.rowCount}
- Kolom: ${context.columns.map((c) => `${c.columnName} (${c.dataType})`).join(', ')}
- Contoh data: ${JSON.stringify(context.sampleRows.slice(0, 2))}`,
      },
      ...priorHistory.map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const structured = await this.runToolLoop(llmMessages, context);

    const content = JSON.stringify(structured);
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: structured.text,
        data: JSON.parse(JSON.stringify({
          kpis: structured.kpis ?? null,
          table: structured.table ?? null,
          chart: structured.chart ?? null,
          source: structured.source ?? null,
        })) as PrismaGenerated.Prisma.InputJsonValue,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { datasetId: dataset.id },
    });

    return {
      conversationId: conversation.id,
      title: conversation.title,
      datasetId: dataset.id,
      userMessageId: userMessage.id,
      assistantMessage,
    };
  }

  private async resolveDataset(
    userId: string,
    datasetId?: string,
    conversationId?: string,
  ): Promise<Dataset | null> {
    if (datasetId) {
      const dataset = await this.prisma.dataset.findUnique({
        where: { id: datasetId },
      });
      if (!dataset) {
        throw new NotFoundException('Dataset tidak ditemukan.');
      }
      return dataset;
    }
    if (conversationId) {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (conversation?.datasetId) {
        const dataset = await this.prisma.dataset.findUnique({
          where: { id: conversation.datasetId },
        });
        if (dataset) {
          return dataset;
        }
      }
    }
    const count = await this.prisma.dataset.count();
    if (count === 1) {
      const [only] = await this.prisma.dataset.findMany({ take: 1 });
      return only;
    }
    return null;
  }

  private async runToolLoop(
    llmMessages: ChatCompletionMessageParam[],
    context: Awaited<ReturnType<AnalysisToolsService['loadContext']>>,
  ): Promise<StructuredAiResponse> {
    const definitions = this.tools.toolDefinitions();
    const messages = [...llmMessages];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.llm.chat(messages, definitions as never[]);

      if (response.toolCalls.length === 0) {
        return this.parseStructured(response.content ?? '');
      }

      messages.push({
        role: 'assistant',
        content: response.content,
        tool_calls: response.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      for (const toolCall of response.toolCalls) {
        let output: unknown;
        try {
          const args = this.parseArgs(toolCall.arguments);
          output = await this.executeTool(toolCall.name, context, args);
        } catch (e) {
          output = { error: String((e as Error).message) };
        }
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(output).slice(0, 12000),
        });
      }
    }

    const final = await this.llm.chat(messages);
    return this.parseStructured(final.content ?? '');
  }

  private parseArgs(raw: string): ToolArgs {
    try {
      const parsed = JSON.parse(raw || '{}');
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      throw new BadRequestException('Argumen tool LLM bukan JSON valid.');
    }
  }

  private async executeTool(
    name: string,
    context: Awaited<ReturnType<AnalysisToolsService['loadContext']>>,
    args: ToolArgs,
  ): Promise<unknown> {
    const str = (key: string): string | undefined =>
      typeof args[key] === 'string' ? (args[key] as string) : undefined;
    const nbr = (key: string): number | undefined =>
      typeof args[key] === 'number' ? (args[key] as number) : undefined;

    switch (name) {
      case 'dataset_info':
        return context;
      case 'summary_kpi':
        return this.tools.summaryKpi(context, {
          metricColumn: str('metricColumn') ?? '',
          dateColumn: str('dateColumn'),
          startDate: str('startDate'),
          endDate: str('endDate'),
        });
      case 'group_breakdown':
        return this.tools.groupBreakdown(context, {
          groupColumn: str('groupColumn') ?? '',
          metricColumn: str('metricColumn') ?? '',
          dateColumn: str('dateColumn'),
          agg: str('agg') as 'sum' | 'avg' | 'count' | undefined,
          limit: nbr('limit'),
          startDate: str('startDate'),
          endDate: str('endDate'),
        });
      case 'trend_series':
        return this.tools.trendSeries(context, {
          dateColumn: str('dateColumn') ?? '',
          metricColumn: str('metricColumn') ?? '',
          granularity: str('granularity') as never,
          aggregation: str('aggregation') as 'sum' | 'avg' | 'count' | undefined,
        });
      case 'growth':
        return this.tools.growth(context, {
          dateColumn: str('dateColumn') ?? '',
          metricColumn: str('metricColumn') ?? '',
          granularity: str('granularity') as never,
        });
      case 'forecast':
        return this.tools.forecast(context, {
          dateColumn: str('dateColumn') ?? '',
          metricColumn: str('metricColumn') ?? '',
          granularity: str('granularity') as never,
          horizon: nbr('horizon'),
        });
      case 'customer_segmentation':
        return this.tools.segmentation(context, {
          customerColumn: str('customerColumn') ?? '',
          dateColumn: str('dateColumn') ?? '',
          revenueColumn: str('revenueColumn'),
          segments: nbr('segments'),
        });
      case 'anomaly_detection':
        return this.tools.anomaly(context, {
          dateColumn: str('dateColumn') ?? '',
          metricColumn: str('metricColumn') ?? '',
          granularity: str('granularity') as never,
          method: str('method') as 'zscore' | 'iqr' | undefined,
        });
      case 'run_sql':
        return this.tools.runSql(context, args as never);
      default:
        throw new BadRequestException(`Tool tidak dikenal: ${name}`);
    }
  }

  private parseStructured(raw: string): StructuredAiResponse {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed === 'object' && parsed !== null && 'text' in parsed) {
        return parsed as StructuredAiResponse;
      }
    } catch {
      this.logger.warn('LLM final response bukan JSON valid; fallback ke teks polos.');
    }
    return { text: raw || 'Tidak ada jawaban dari asisten AI.' };
  }
}
