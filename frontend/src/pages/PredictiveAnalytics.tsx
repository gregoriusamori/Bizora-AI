import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts';
import { apiGet, apiPost } from '../services/api';
import type {
  AnomalyResult,
  Dataset,
  ForecastResult,
  SegmentationResult,
} from '../services/predictive';

type Tab = 'forecast' | 'segmentation' | 'anomaly';

const GRANULARITIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
const METHODS = ['auto', 'moving_average', 'exponential_smoothing', 'linear_regression'];

const selectClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none';

export default function PredictiveAnalytics() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState('');
  const [tab, setTab] = useState<Tab>('forecast');
  const [error, setError] = useState<string | null>(null);

  const [dateColumn, setDateColumn] = useState('');
  const [metricColumn, setMetricColumn] = useState('');
  const [customerColumn, setCustomerColumn] = useState('');
  const [granularity, setGranularity] = useState('monthly');
  const [method, setMethod] = useState('auto');
  const [horizon, setHorizon] = useState(6);
  const [segments, setSegments] = useState(4);
  const [anomalyMethod, setAnomalyMethod] = useState('zscore');

  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [segmentation, setSegmentation] = useState<SegmentationResult | null>(null);
  const [anomaly, setAnomaly] = useState<AnomalyResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet<Dataset[]>('/datasets')
      .then((list) => {
        setDatasets(list);
        if (list.length > 0) {
          setDatasetId(list[0].id);
        }
      })
      .catch((e) => setError(String(e.message)));
  }, []);

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === datasetId) ?? null,
    [datasets, datasetId],
  );

  const columns = activeDataset?.columns.map((c) => c.columnName) ?? [];
  const hasRequiredColumns =
    Boolean(dateColumn) && Boolean(metricColumn) && Boolean(datasetId);

  const resetResults = () => {
    setForecast(null);
    setSegmentation(null);
    setAnomaly(null);
  };

  useEffect(() => {
    resetResults();
  }, [datasetId]);

  const runAnalysis = async () => {
    if (!hasRequiredColumns) {
      setError('Pilih dataset serta kolom tanggal dan metrik terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (tab === 'forecast') {
        const result = await apiPost<ForecastResult>('/forecasting/run', {
          datasetId,
          dateColumn,
          metricColumn,
          granularity,
          method,
          horizon,
        });
        setForecast(result);
      } else if (tab === 'segmentation') {
        const result = await apiPost<SegmentationResult>('/clustering/segmentation', {
          datasetId,
          customerColumn: customerColumn || columns[0],
          dateColumn,
          revenueColumn: metricColumn,
          segments,
        });
        setSegmentation(result);
      } else {
        const result = await apiPost<AnomalyResult>('/anomaly-detection/run', {
          datasetId,
          dateColumn,
          metricColumn,
          granularity,
          method: anomalyMethod,
        });
        setAnomaly(result);
      }
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const forecastChartData = useMemo(() => {
    if (!forecast?.adequate) {
      return [];
    }
    const history = forecast.history.map((h) => ({
      period: h.period,
      actual: h.value,
      forecast: null as number | null,
      lower: null as number | null,
      upper: null as number | null,
    }));
    const points = forecast.forecast.map((f) => ({
      period: f.period,
      actual: null as number | null,
      forecast: f.value,
      lower: f.lower,
      upper: f.upper,
    }));
    if (history.length > 0) {
      history[history.length - 1].forecast = history[history.length - 1].actual;
      history[history.length - 1].lower = history[history.length - 1].actual;
      history[history.length - 1].upper = history[history.length - 1].actual;
    }
    return [...history, ...points];
  }, [forecast]);

  const anomalyChartData = useMemo(() => {
    if (!anomaly?.adequate) {
      return [];
    }
    return anomaly.series.map((p) => {
      const flagged = anomaly.anomalies.find((a) => a.period === p.period && a.isAnomaly);
      const b = anomaly.bounds;
      return {
        period: p.period,
        value: p.value,
        anomaly: flagged ? p.value : null,
        lower: b.lower,
        upper: b.upper,
      };
    });
  }, [anomaly]);

  const renderEmpty = (text: string) => (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
      {text}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-6 py-4">
          <span className="text-lg font-semibold text-indigo-600">AI BI</span>
        </div>
        <nav className="space-y-1 px-4">
          {['Overview', 'Sales', 'Profit', 'Products', 'Branches', 'Predictive', 'AI Chat', 'Reports'].map(
            (item) => (
              <a
                key={item}
                href={item === 'Predictive' ? '/dashboard/predictive' : '/dashboard'}
                className={`block rounded-md px-3 py-2 text-sm ${
                  item === 'Predictive'
                    ? 'bg-indigo-50 font-medium text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item}
              </a>
            ),
          )}
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-semibold">Predictive Analytics</h1>
        <p className="mt-1 text-sm text-slate-600">
          Forecasting, segmentasi pelanggan, dan deteksi anomali berdasarkan data aktual dataset Anda.
        </p>

        {datasets.length === 0 && !error ? (
          <div className="mt-6">{renderEmpty('Belum ada dataset. Import dataset terlebih dahulu di menu Dataset Management.')}</div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="block text-sm font-medium">Dataset</label>
                <select className={`${selectClass} mt-1`} value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
                  <option value="">Pilih dataset</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Kolom tanggal</label>
                <select className={`${selectClass} mt-1`} value={dateColumn} onChange={(e) => setDateColumn(e.target.value)}>
                  <option value="">Pilih kolom</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Kolom metrik / nilai</label>
                <select className={`${selectClass} mt-1`} value={metricColumn} onChange={(e) => setMetricColumn(e.target.value)}>
                  <option value="">Pilih kolom</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Kolom pelanggan (segmentasi)</label>
                <select className={`${selectClass} mt-1`} value={customerColumn} onChange={(e) => setCustomerColumn(e.target.value)}>
                  <option value="">Pilih kolom</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-2 border-b border-slate-200">
              {(
                [
                  ['forecast', 'Forecasting'],
                  ['segmentation', 'Segmentasi Pelanggan'],
                  ['anomaly', 'Deteksi Anomali'],
                ] as Array<[Tab, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setTab(key);
                    setError(null);
                  }}
                  className={`px-4 py-2 text-sm font-medium ${
                    tab === key
                      ? 'border-b-2 border-indigo-600 text-indigo-600'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              {tab === 'forecast' && (
                <>
                  <div>
                    <label className="block text-sm font-medium">Granularitas</label>
                    <select className={`${selectClass} mt-1`} value={granularity} onChange={(e) => setGranularity(e.target.value)}>
                      {GRANULARITIES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Metode</label>
                    <select className={`${selectClass} mt-1`} value={method} onChange={(e) => setMethod(e.target.value)}>
                      {METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Periode prediksi</label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      className={`${selectClass} mt-1`}
                      value={horizon}
                      onChange={(e) => setHorizon(Number(e.target.value))}
                    />
                  </div>
                </>
              )}
              {tab === 'segmentation' && (
                <div>
                  <label className="block text-sm font-medium">Jumlah segmen</label>
                  <input
                    type="number"
                    min={2}
                    max={6}
                    className={`${selectClass} mt-1`}
                    value={segments}
                    onChange={(e) => setSegments(Number(e.target.value))}
                  />
                </div>
              )}
              {tab === 'anomaly' && (
                <>
                  <div>
                    <label className="block text-sm font-medium">Granularitas</label>
                    <select className={`${selectClass} mt-1`} value={granularity} onChange={(e) => setGranularity(e.target.value)}>
                      {GRANULARITIES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Metode</label>
                    <select className={`${selectClass} mt-1`} value={anomalyMethod} onChange={(e) => setAnomalyMethod(e.target.value)}>
                      <option value="zscore">zscore</option>
                      <option value="iqr">iqr</option>
                    </select>
                  </div>
                </>
              )}
              <div className="flex items-end">
                <button
                  onClick={runAnalysis}
                  disabled={loading || !hasRequiredColumns}
                  className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {loading ? 'Menganalisis...' : 'Jalankan Analisis'}
                </button>
              </div>
            </div>

            {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div className="mt-8">
              {tab === 'forecast' &&
                (!forecast ? (
                  renderEmpty('Jalankan analisis untuk melihat hasil forecasting.')
                ) : !forecast.adequate ? (
                  <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">{forecast.message}</div>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-600">
                        <span>Metode: <b>{forecast.method}</b></span>
                        <span>Titik data: {forecast.dataPoints}</span>
                        {forecast.metrics.rmse !== null && <span>RMSE: {forecast.metrics.rmse}</span>}
                        {forecast.metrics.mape !== null && <span>MAPE: {forecast.metrics.mape}%</span>}
                      </div>
                      <ResponsiveContainer width="100%" height={360}>
                        <ComposedChart data={forecastChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="actual" name="Aktual" stroke="#4f46e5" dot={false} connectNulls={false} />
                          <Line type="monotone" dataKey="lower" name="Batas bawah" stroke="#c7d2fe" dot={false} connectNulls={false} />
                          <Line type="monotone" dataKey="upper" name="Batas atas" stroke="#c7d2fe" dot={false} connectNulls={false} />
                          <Line type="monotone" dataKey="forecast" name="Prediksi" stroke="#f97316" strokeDasharray="6 4" dot={false} connectNulls={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                      <b>Keterbatasan model:</b>
                      <ul className="mt-1 list-disc pl-5">
                        {forecast.limitations.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}

              {tab === 'segmentation' &&
                (!segmentation ? (
                  renderEmpty('Jalankan analisis untuk melihat segmentasi pelanggan.')
                ) : !segmentation.adequate ? (
                  <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">{segmentation.message}</div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-sm text-slate-600">
                      Total {segmentation.totalCustomers} pelanggan dianalisis (RFM: Recency, Frequency, Monetary, K-Means).
                    </p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={segmentation.segments}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="customers" name="Jumlah pelanggan" fill="#6366f1" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-4 py-2">Segmen</th>
                            <th className="px-4 py-2">Pelanggan</th>
                            <th className="px-4 py-2">Share</th>
                            <th className="px-4 py-2">Avg Recency (hari)</th>
                            <th className="px-4 py-2">Avg Frequency</th>
                            <th className="px-4 py-2">Avg Monetary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {segmentation.segments.map((s) => (
                            <tr key={s.label} className="border-t border-slate-100">
                              <td className="px-4 py-2 font-medium">{s.label}</td>
                              <td className="px-4 py-2">{s.customers}</td>
                              <td className="px-4 py-2">{s.sharePercent}%</td>
                              <td className="px-4 py-2">{s.avgRecencyDays}</td>
                              <td className="px-4 py-2">{s.avgFrequency}</td>
                              <td className="px-4 py-2">{s.avgMonetary}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

              {tab === 'anomaly' &&
                (!anomaly ? (
                  renderEmpty('Jalankan analisis untuk melihat deteksi anomali.')
                ) : !anomaly.adequate ? (
                  <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">{anomaly.message}</div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-sm text-slate-600">
                      Metode <b>{anomaly.method}</b> ditemukan <b>{anomaly.anomalyCount}</b> anomali dari{' '}
                      {anomaly.totalPoints} titik data.
                    </p>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <ResponsiveContainer width="100%" height={340}>
                        <ComposedChart data={anomalyChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="value" name="Nilai" stroke="#4f46e5" dot={false} />
                          <Line type="monotone" dataKey="anomaly" name="Anomali" stroke="#ef4444" dot={{ r: 5 }} connectNulls={false} />
                          {anomaly.bounds.upper !== null && (
                            <Line type="linear" dataKey="upper" name="Batas atas" stroke="#9ca3af" strokeDasharray="4 4" dot={false} />
                          )}
                          {anomaly.bounds.lower !== null && (
                            <Line type="linear" dataKey="lower" name="Batas bawah" stroke="#9ca3af" strokeDasharray="4 4" dot={false} />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    {anomaly.anomalies.filter((a) => a.isAnomaly).length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                            <tr>
                              <th className="px-4 py-2">Periode</th>
                              <th className="px-4 py-2">Nilai</th>
                              <th className="px-4 py-2">Arah</th>
                              <th className="px-4 py-2">Severity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {anomaly.anomalies
                              .filter((a) => a.isAnomaly)
                              .map((a) => (
                                <tr key={a.index} className="border-t border-slate-100">
                                  <td className="px-4 py-2">{a.period}</td>
                                  <td className="px-4 py-2">{a.value}</td>
                                  <td className="px-4 py-2">{a.direction}</td>
                                  <td className="px-4 py-2 capitalize">{a.severity}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
