import { useEffect, useState } from 'react';
import { apiDownload, apiGet, apiPost } from '../services/api';
import type { Dataset, ReportMeta } from '../services/predictive';

const REPORT_TYPES = [
  ['sales_report', 'Sales Report'],
  ['profit_report', 'Profit Report'],
  ['product_performance_report', 'Product Performance Report'],
  ['branch_performance_report', 'Branch Performance Report'],
  ['customer_analysis_report', 'Customer Analysis Report'],
  ['monthly_business_report', 'Monthly Business Report'],
  ['executive_summary', 'Executive Summary'],
];

const selectClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function Reports() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState('');
  const [reportType, setReportType] = useState('sales_report');
  const [format, setFormat] = useState<'pdf' | 'xlsx' | 'csv'>('pdf');
  const [dateColumn, setDateColumn] = useState('');
  const [metricColumn, setMetricColumn] = useState('');
  const [costColumn, setCostColumn] = useState('');
  const [groupColumn, setGroupColumn] = useState('');
  const [granularity, setGranularity] = useState('monthly');
  const [title, setTitle] = useState('');

  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadReports = () => {
    apiGet<ReportMeta[]>('/reports')
      .then(setReports)
      .catch((e) => setError(String(e.message)));
  };

  useEffect(() => {
    apiGet<Dataset[]>('/datasets')
      .then((list) => {
        setDatasets(list);
        if (list.length > 0) {
          setDatasetId(list[0].id);
        }
      })
      .catch((e) => setError(String(e.message)));
    loadReports();
  }, []);

  const activeDataset = datasets.find((d) => d.id === datasetId) ?? null;
  const columns = activeDataset?.columns.map((c) => c.columnName) ?? [];

  const handleGenerate = async () => {
    if (!datasetId || !dateColumn || !metricColumn) {
      setError('Pilih dataset, kolom tanggal, dan kolom metrik terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const meta = await apiPost<ReportMeta>('/reports/generate', {
        datasetId,
        reportType,
        format,
        dateColumn,
        metricColumn,
        costColumn: costColumn || undefined,
        groupColumn: groupColumn || undefined,
        granularity,
        title: title || undefined,
      });
      setSuccess(
        `Laporan "${meta.title}" (${meta.format.toUpperCase()}) berhasil dibuat. Silakan unduh dari daftar di bawah.`,
      );
      loadReports();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (report: ReportMeta) => {
    try {
      await apiDownload(`/reports/${report.id}/download`, report.fileName);
    } catch (e) {
      setError(String((e as Error).message));
    }
  };

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
                href={item === 'Reports' ? '/dashboard/reports' : '/dashboard'}
                className={`block rounded-md px-3 py-2 text-sm ${
                  item === 'Reports'
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
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Buat laporan otomatis (PDF, Excel, CSV) berdasarkan data aktual dataset.
        </p>

        {datasets.length === 0 && !error ? (
          <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Belum ada dataset. Import dataset terlebih dahulu di menu Dataset Management.
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="font-semibold">Buat Laporan Baru</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
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
                  <label className="block text-sm font-medium">Jenis laporan</label>
                  <select className={`${selectClass} mt-1`} value={reportType} onChange={(e) => setReportType(e.target.value)}>
                    {REPORT_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Format</label>
                  <select
                    className={`${selectClass} mt-1`}
                    value={format}
                    onChange={(e) => setFormat(e.target.value as 'pdf' | 'xlsx' | 'csv')}
                  >
                    <option value="pdf">PDF</option>
                    <option value="xlsx">Excel (XLSX)</option>
                    <option value="csv">CSV</option>
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
                  <label className="block text-sm font-medium">Kolom metrik (revenue)</label>
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
                  <label className="block text-sm font-medium">Kolom biaya (opsional)</label>
                  <select className={`${selectClass} mt-1`} value={costColumn} onChange={(e) => setCostColumn(e.target.value)}>
                    <option value="">Tidak ada</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Kolom kelompok (opsional)</label>
                  <select className={`${selectClass} mt-1`} value={groupColumn} onChange={(e) => setGroupColumn(e.target.value)}>
                    <option value="">Tidak ada</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Granularitas</label>
                  <select className={`${selectClass} mt-1`} value={granularity} onChange={(e) => setGranularity(e.target.value)}>
                    {['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Judul kustom (opsional)</label>
                  <input
                    type="text"
                    className={`${selectClass} mt-1`}
                    placeholder="Laporan Penjualan Q1 2026"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="mt-4 rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? 'Membuat laporan...' : 'Buat Laporan'}
              </button>
            </div>

            {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {success && <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

            <div className="mt-8">
              <h2 className="font-semibold">Daftar Laporan</h2>
              {reports.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                  Belum ada laporan yang dibuat.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2">Judul</th>
                        <th className="px-4 py-2">Jenis</th>
                        <th className="px-4 py-2">Periode</th>
                        <th className="px-4 py-2">Format</th>
                        <th className="px-4 py-2">Ukuran</th>
                        <th className="px-4 py-2">Dibuat</th>
                        <th className="px-4 py-2">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100">
                          <td className="px-4 py-2 font-medium">{r.title}</td>
                          <td className="px-4 py-2 text-slate-600">{r.reportType}</td>
                          <td className="px-4 py-2 text-slate-600">{r.period}</td>
                          <td className="px-4 py-2 uppercase">{r.format}</td>
                          <td className="px-4 py-2 text-slate-600">{formatBytes(r.sizeBytes)}</td>
                          <td className="px-4 py-2 text-slate-600">{new Date(r.createdAt).toLocaleString('id-ID')}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => handleDownload(r)}
                              className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                            >
                              Unduh
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
