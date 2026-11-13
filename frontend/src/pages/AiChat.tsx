import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Plus, Send, Trash2 } from 'lucide-react';
import { apiDelete, apiGet, apiPost } from '../services/api';
import type { Dataset } from '../services/predictive';
import type {
  ChatMessage,
  ChatResponse,
  ConversationSummary,
  StructuredPayload,
} from '../services/chat';
import { parseStructured } from '../services/chat';

interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structured: StructuredPayload | null;
}

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none';

function StructuredBlock({ payload }: { payload: StructuredPayload }) {
  return (
    <div className="mt-3 space-y-4">
      {payload.kpis && payload.kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {payload.kpis.map((kpi, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">{kpi.label}</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {payload.chart && payload.chart.data.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {payload.chart.title && (
            <div className="mb-2 text-sm font-medium text-slate-700">{payload.chart.title}</div>
          )}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {payload.chart.type === 'bar' ? (
                <BarChart data={payload.chart.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={payload.chart.xKey} fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  {payload.chart.seriesKeys.map((key) => (
                    <Bar key={key} dataKey={key} fill="#6366f1" />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={payload.chart.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={payload.chart.xKey} fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  {payload.chart.seriesKeys.map((key) => (
                    <Line key={key} type="monotone" dataKey={key} stroke="#6366f1" dot={false} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {payload.table && payload.table.rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {payload.table.columns.map((col, i) => (
                  <th key={i} className="px-3 py-2 font-medium text-slate-700">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payload.table.rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-slate-600">
                      {typeof cell === 'number' ? cell.toLocaleString('id-ID') : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {payload.table.rows.length > 50 && (
            <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              Menampilkan 50 dari {payload.table.rows.length} baris.
            </div>
          )}
        </div>
      )}

      {payload.source && (
        <div className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-500">
          Sumber: {payload.source.dataset ?? '-'}
          {payload.source.period ? ` · Periode: ${payload.source.period}` : ''}
          {payload.source.tool ? ` · Tool: ${payload.source.tool}` : ''}
        </div>
      )}
    </div>
  );
}

export default function AiChat() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState('');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<Dataset[]>('/datasets')
      .then((list) => {
        setDatasets(list);
        if (list.length > 0) setDatasetId(list[0].id);
      })
      .catch(() => setDatasets([]));
    apiGet<ConversationSummary[]>('/conversations')
      .then(setConversations)
      .catch(() => setConversations([]));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const toUiMessage = (m: ChatMessage): UiMessage => ({
    id: m.id,
    role: m.role,
    content: m.content,
    structured: parseStructured(m.data),
  });

  const openConversation = async (id: string) => {
    setError(null);
    try {
      const detail = await apiGet<{ id: string; datasetId: string | null; messages: ChatMessage[] }>(
        `/conversations/${id}`,
      );
      setConversationId(detail.id);
      if (detail.datasetId) setDatasetId(detail.datasetId);
      setMessages(detail.messages.map(toUiMessage));
    } catch (e) {
      setError(String((e as Error).message));
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  };

  const deleteConversation = async (id: string) => {
    try {
      await apiDelete(`/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) startNewChat();
    } catch (e) {
      setError(String((e as Error).message));
    }
  };

  const send = async () => {
    const message = input.trim();
    if (!message || sending) return;
    if (!datasetId) {
      setError('Pilih dataset terlebih dahulu atau import dataset di halaman Data.');
      return;
    }
    setSending(true);
    setError(null);
    setInput('');
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: 'user', content: message, structured: null },
    ]);
    try {
      const path = conversationId
        ? `/conversations/${conversationId}/chat`
        : '/conversations/chat';
      const res = await apiPost<ChatResponse>(path, { message, datasetId });
      setConversationId(res.conversationId);
      setMessages((prev) => [...prev, toUiMessage(res.assistantMessage)]);
      apiGet<ConversationSummary[]>('/conversations')
        .then(setConversations)
        .catch(() => undefined);
    } catch (e) {
      setError(String((e as Error).message));
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-6 py-4">
          <BarChart3 className="h-6 w-6 text-indigo-600" />
          <span className="font-semibold">AI BI</span>
        </div>
        <nav className="space-y-1 px-4">
          {[
            ['Overview', '/dashboard'],
            ['Sales', '/dashboard'],
            ['Profit', '/dashboard'],
            ['Products', '/dashboard'],
            ['Branches', '/dashboard'],
            ['Predictive', '/dashboard/predictive'],
            ['AI Chat', '/dashboard/chat'],
            ['Reports', '/dashboard/reports'],
          ].map(([item, to]) => (
            <Link
              key={item}
              to={to}
              className={`block rounded-md px-3 py-2 text-sm hover:bg-slate-100 ${
                item === 'AI Chat'
                  ? 'bg-indigo-50 font-medium text-indigo-700'
                  : 'text-slate-700'
              }`}
            >
              {item}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Riwayat</span>
          <button
            onClick={startNewChat}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" /> Baru
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {conversations.length === 0 && (
            <p className="px-2 py-4 text-xs text-slate-500">Belum ada percakapan.</p>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center justify-between rounded-md px-2 py-2 text-sm ${
                conversationId === c.id ? 'bg-indigo-50' : 'hover:bg-slate-100'
              }`}
            >
              <button
                onClick={() => openConversation(c.id)}
                className="flex-1 truncate text-left text-slate-700"
                title={c.title}
              >
                {c.title}
              </button>
              <button
                onClick={() => deleteConversation(c.id)}
                className="ml-1 hidden text-slate-400 hover:text-red-500 group-hover:block"
                aria-label="Hapus percakapan"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <h1 className="text-lg font-semibold">AI Chat — Tanya Data</h1>
          <select
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            className={`${inputClass} w-64`}
          >
            <option value="">Pilih dataset…</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.length === 0 && !sending && (
            <div className="mx-auto max-w-xl rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="font-medium text-slate-700">Belum ada pertanyaan.</p>
              <p className="mt-1 text-sm text-slate-500">
                Ajukan pertanyaan analisis tentang dataset yang dipilih, misalnya tren penjualan
                bulanan, produk terlaris, atau pertumbuhan revenue.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-3xl rounded-lg p-4 ${
                m.role === 'user'
                  ? 'ml-auto bg-indigo-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-800'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{m.content}</p>
              {m.role === 'assistant' && m.structured && (
                <StructuredBlock payload={m.structured} />
              )}
            </div>
          ))}
          {sending && (
            <div className="max-w-3xl rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Menganalisis data…
            </div>
          )}
          {error && (
            <div className="max-w-3xl rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-slate-200 bg-white p-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Tanya apa saja tentang data Anda…"
              className={`${inputClass} resize-none`}
              disabled={sending}
            />
            <button
              onClick={() => void send()}
              disabled={sending || !input.trim()}
              className="flex items-center gap-1 self-end rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Kirim
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
