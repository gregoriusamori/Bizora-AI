export interface StructuredPayload {
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: unknown;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  datasetId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatResponse {
  conversationId: string;
  title: string;
  datasetId: string;
  userMessageId: string;
  assistantMessage: ChatMessage;
}

export function parseStructured(data: unknown): StructuredPayload | null {
  if (typeof data === 'object' && data !== null && 'text' in data) {
    return data as StructuredPayload;
  }
  return null;
}
