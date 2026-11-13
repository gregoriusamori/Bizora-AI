import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import DashboardLayout from '../components/DashboardLayout';
import { apiGet, apiPost } from '../services/api';
import type { Dataset } from '../services/predictive';
import type { AnalysisResult, AnalyticsView, AnalyzePayload } from '../services/analytics';
import { autoDetect } from '../services/analytics';

const VIEW_TITLES: Record<AnalyticsView, string> = {
  overview: 'Dashboard Overview',
  sales: 'Analisis Sales',
  profit: 'Analisis Profit',
  products: 'Performa Produk',
  branches: 'Performa Cabang',
};

const GRANULARITIES = [
  ['monthly', 'Bulanan'],
  ['weekly', 'Mingguan'],
  ['daily', 'Harian'],
  ['quarterly', 'Triwulanan'],
  ['yearly', 'Tahunan'],
];

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none';

function fmtNum(value: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
}

function KpiCards({ kpis }: { kpis: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">{kpi.label}</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{kpi.value}</div>
        </div>
      ))}
    </div>
  );
}

function NotesList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-medium text-slate-700">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrendChart({ result, view }: { result: AnalysisResult; view: AnalyticsView }) {
  if (result.trend.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        Tidak ada data seri waktu yang valid untuk kolom yang dipilih.
      </div>
    );
  }

  if (view === 'profit' && result.trend.some((p) => p.cost !== null)) {
    return (
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={result.trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(v) => fmtNum(Number(v))} />
            <Tooltip formatter={(v) => fmtNum(Number(v))} />
            <Legend />
            <Bar dataKey="revenue" name="Revenue" fill="#6366f1" />
            <Bar dataKey="cost" name="Biaya" fill="#f43f5e" />
            <Line dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (view === 'sales' && result.growth.length > 1) {
    return (
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={result.growth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" fontSize={12} />
            <YAxis yAxisId="left" fontSize={12} tickFormatter={(v) => fmtNum(Number(v))} />
            <YAxis yAxisId="right" orientation="right" fontSize={12} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
            <Tooltip formatter={(v) => fmtNum(Number(v))} />
            <Legend />
            <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#6366f1" />
            <Line yAxisId="right" dataKey="growthPercent" name="Pertumbuhan %" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if ((view === 'products' || view === 'branches') && result.items.length > 0) {
    return (
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={result.items} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" fontSize={12} tickFormatter={(v) => fmtNum(Number(v))} />
            <YAxis type="category" dataKey="label" width={140} fontSize={11} />
            <Tooltip formatter={(v) => fmtNum(Number(v))} />
            <Bar dataKey="revenue" name="Revenue" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={result.trend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={(v) => fmtNum(Number(v))} />
          <Tooltip formatter={(v) => fmtNum(Number(v))} />
          <Line dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardAnalytics({ view }: { view: AnalyticsView }) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState('');
  const [dateColumn, setDateColumn] = useState('');
  const [revenueColumn, setRevenueColumn] = useState('');
  const [costColumn, setCostColumn] = useState('');
  const [groupColumn, setGroupColumn] = useState('');
  const [granularity, setGranularity] = useState('monthly');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Dataset[]>('/datasets')
      .then((list) => {
        setDatasets(list);
        if (list.length > 0) setDatasetId(list[0].id);
      })
      .catch((e) => setError(String(e.message)));
  }, []);

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === datasetId) ?? null,
    [datasets, datasetId],
  );
  const columns = activeDataset?.columns ?? [];

  useEffect(() => {
    if (!activeDataset) return;
    const detected = autoDetect(activeDataset.columns);
    setDateColumn(detected.date);
    setRevenueColumn(detected.revenue);
    setCostColumn(view === 'profit' || detected.cost ? detected.cost : '');
    setGroupColumn(
      view === 'products'
        ? detected.group && /(product|produk|item|sku)/i.test(detected.group)
          ? detected.group
          : detected.group
        : view === 'branches'
          ? detected.group
          : '',
    );
  }, [activeDataset, view]);

  const runAnalysis = useCallback(async () => {
    if (!datasetId || !dateColumn || !revenueColumn) {
      setError('Pilih dataset beserta kolom tanggal dan kolom revenue terlebih dahulu.');
      setResult(null);
      return;
    }
    if (view === 'profit' && !costColumn) {
      setError('Analisis Profit memerlukan kolom biaya. Pilih kolom biaya dataset Anda.');
      setResult(null);
      return;
    }
    if ((view === 'products' || view === 'branches') && !groupColumn) {
      setError(
        view === 'products'
          ? 'Analisis Produk memerlukan kolom nama produk.'
          : 'Analisis Cabang memerlukan kolom nama cabang/toko.',
      );
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload: AnalyzePayload = {
        datasetId,
        dateColumn,
        revenueColumn,
        granularity,
      };
      if (costColumn) payload.costColumn = costColumn;
      if (groupColumn) payload.groupColumn = groupColumn;
      if (view === 'products' || view === 'branches') payload.topN = 10;
      const res = await apiPost<AnalysisResult>(`/analytics/${view}`, payload);
      setResult(res);
    } catch (e) {
      setError(String((e as Error).message));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [datasetId, dateColumn, revenueColumn, costColumn, groupColumn, granularity, view]);

  useEffect(() => {
    if (datasetId && dateColumn && revenueColumn) {
      void runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, dateColumn, revenueColumn, costColumn, groupColumn, granularity, view]);

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{VIEW_TITLES[view]}</h1>
          {result && (
            <p className="mt-1 text-sm text-slate-500">
              Dataset: {result.datasetName} · {fmtNum(result.rowCount)} baris · Rentang:{' '}
              {result.dataRange}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-6">
        <div className="col-span-2 md:col-span-1">
          <label className="mb-1 block text-xs text-slate-500">Dataset</label>
          <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)} className={inputClass}>
            <option value="">Pilih…</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Kolom Tanggal</label>
          <select value={dateColumn} onChange={(e) => setDateColumn(e.target.value)} className={inputClass}>
            <option value="">Pilih…</option>
            {columns.map((c) => (
              <option key={c.id} value={c.columnName}>
                {c.columnName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Kolom Revenue</label>
          <select value={revenueColumn} onChange={(e) => setRevenueColumn(e.target.value)} className={inputClass}>
            <option value="">Pilih…</option>
            {columns.map((c) => (
              <option key={c.id} value={c.columnName}>
                {c.columnName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">
            Kolom Biaya{view === 'profit' ? ' (wajib)' : ' (opsional)'}
          </label>
          <select value={costColumn} onChange={(e) => setCostColumn(e.target.value)} className={inputClass}>
            <option value="">—</option>
            {columns.map((c) => (
              <option key={c.id} value={c.columnName}>
                {c.columnName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">
            Kolom Kelompok{(view === 'products' || view === 'branches') ? ' (wajib)' : ''}
          </label>
          <select value={groupColumn} onChange={(e) => setGroupColumn(e.target.value)} className={inputClass}>
            <option value="">—</option>
            {columns.map((c) => (
              <option key={c.id} value={c.columnName}>
                {c.columnName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Granularitas</label>
          <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className={inputClass}>
            {GRANULARITIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {datasets.length === 0 && !error && (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Belum ada dataset. Import dataset terlebih dahulu untuk melihat analisis.
        </div>
      )}

      {loading && <p className="mt-6 text-sm text-slate-500">Menghitung analisis…</p>}

      {result && !loading && (
        <div className="mt-6 space-y-6">
          <KpiCards kpis={result.kpis} />

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-700">
              {view === 'products' || view === 'branches'
                ? 'Peringkat Revenue'
                : view === 'sales'
                  ? 'Revenue & Pertumbuhan'
                  : 'Tren Revenue'}
            </h3>
            <TrendChart result={result} view={view} />
          </div>

          {(view === 'sales' || view === 'overview' || view === 'profit') &&
            result.growth.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 font-medium text-slate-700">Periode</th>
                      <th className="px-4 py-2 font-medium text-slate-700">Revenue</th>
                      <th className="px-4 py-2 font-medium text-slate-700">Pertumbuhan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.growth
                      .slice()
                      .reverse()
                      .slice(0, 12)
                      .map((g) => (
                        <tr key={g.period} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-600">{g.period}</td>
                          <td className="px-4 py-2 text-slate-600">{fmtNum(g.revenue)}</td>
                          <td
                            className={`px-4 py-2 ${
                              g.growthPercent === null
                                ? 'text-slate-400'
                                : g.growthPercent > 0
                                  ? 'text-emerald-600'
                                  : g.growthPercent < 0
                                    ? 'text-rose-600'
                                    : 'text-slate-600'
                            }`}
                          >
                            {g.growthPercent === null
                              ? '—'
                              : `${g.growthPercent > 0 ? '+' : ''}${fmtNum(g.growthPercent)}%`}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

          {(view === 'products' || view === 'branches') && result.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 font-medium text-slate-700">Nama</th>
                    <th className="px-4 py-2 font-medium text-slate-700">Revenue</th>
                    <th className="px-4 py-2 font-medium text-slate-700">Kontribusi</th>
                    {result.items.some((i) => i.profit !== null) && (
                      <th className="px-4 py-2 font-medium text-slate-700">Profit</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <tr key={item.label} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-600">{item.label}</td>
                      <td className="px-4 py-2 text-slate-600">{fmtNum(item.revenue)}</td>
                      <td className="px-4 py-2 text-slate-600">{fmtNum(item.sharePercent)}%</td>
                      {result.items.some((i) => i.profit !== null) && (
                        <td className="px-4 py-2 text-slate-600">
                          {item.profit === null ? '—' : fmtNum(item.profit)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.insights.length > 0 && (
            <NotesList title="Insight" items={result.insights} emptyText="Tidak ada insight." />
          )}
          <NotesList
            title="Keterbatasan"
            items={result.limitations}
            emptyText="Tidak ada catatan keterbatasan."
          />
        </div>
      )}
    </DashboardLayout>
  );
}
