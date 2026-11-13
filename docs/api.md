# API Reference

Base URL lokal: `http://localhost:3000` (produksi: URL backend Render).

Seluruh endpoint (kecuali yang ditandai publik) memerlukan header:

```
Authorization: Bearer <JWT>
```

## Health (publik)

| Method | Path | Deskripsi |
| --- | --- | --- |
| GET | `/health` | Status aplikasi + koneksi database |

## Auth (publik)

| Method | Path | Body | Deskripsi |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{ email, password, name? }` | Registrasi user baru |
| POST | `/auth/login` | `{ email, password }` | Login, mengembalikan `{ token, user }` |

## Users

| Method | Path | Deskripsi |
| --- | --- | --- |
| GET | `/users/me` | Profil user yang sedang login |

## Datasets

| Method | Path | Deskripsi |
| --- | --- | --- |
| GET | `/datasets` | Daftar dataset + metadata kolom |
| GET | `/datasets/:id` | Detail satu dataset |
| POST | `/datasets/upload` | Upload file (form-data field `file`; CSV/XLSX/JSON, maks. 10 MB). Membuat dataset, versi, kolom, dan baris data (dedup otomatis) |

## Forecasting

`POST /forecasting/run`

```json
{
  "datasetId": "<uuid>",
  "dateColumn": "transaction_date",
  "metricColumn": "sales_amount",
  "granularity": "monthly",
  "aggregation": "sum",
  "method": "auto",
  "horizon": 6,
  "startDate": "2025-01-01",
  "endDate": "2025-12-31"
}
```

- `method`: `auto` \| `moving_average` \| `exponential_smoothing` \| `linear_regression`
- Respons: `adequate`, `history[]`, `forecast[]` (dengan `lower`/`upper`), `metrics.rmse`, `metrics.mape`, `limitations[]`
- Minimal 8 titik data periode; jika kurang, `adequate=false` + pesan

## Clustering

| Method | Path | Body | Deskripsi |
| --- | --- | --- | --- |
| POST | `/clustering/run` | `{ datasetId, featureColumn, secondFeatureColumn?, clusters }` | K-Means pada kolom numerik (z-score standardized) |
| POST | `/clustering/segmentation` | `{ datasetId, customerColumn, dateColumn, revenueColumn?, segments }` | Segmentasi RFM (min. 10 pelanggan unik). Respons: `segments[]` (label, share, avg RFM) + `customers[]` |

## Anomaly Detection

`POST /anomaly-detection/run`

```json
{
  "datasetId": "<uuid>",
  "dateColumn": "transaction_date",
  "metricColumn": "sales_amount",
  "granularity": "monthly",
  "method": "zscore"
}
```

- `method`: `zscore` \| `iqr`
- Respons: `series[]`, `anomalies[]` (period, value, direction, severity), `bounds` (lower/upper)
- Minimal 4 titik data periode

## Reports

| Method | Path | Deskripsi |
| --- | --- | --- |
| POST | `/reports/generate` | Buat laporan (lihat di bawah) |
| GET | `/reports` | Daftar laporan yang pernah dibuat |
| GET | `/reports/:id/download` | Unduh file laporan |

Body `POST /reports/generate`:

```json
{
  "datasetId": "<uuid>",
  "reportType": "sales_report",
  "format": "pdf",
  "dateColumn": "transaction_date",
  "metricColumn": "sales_amount",
  "costColumn": "cost_amount",
  "groupColumn": "product_name",
  "granularity": "monthly",
  "title": "Laporan Penjualan Q1"
}
```

- `reportType`: `sales_report` \| `profit_report` \| `product_performance_report` \| `branch_performance_report` \| `customer_analysis_report` \| `monthly_business_report` \| `executive_summary`
- `format`: `pdf` \| `xlsx` \| `csv`
- `costColumn` opsional — profit hanya dihitung bila diisi
- Laporan berisi: KPI, tabel analisis, insight (berlabel `Fakta:`), rekomendasi (berlabel `Saran:`), keterbatasan

## Conversations / AI Chat

Semua endpoint memerlukan JWT. Untuk analisis memerlukan `OPENAI_API_KEY` ter-set di backend; jika kosong, chat mengembalikan 503.

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/conversations` | Daftar percakapan user (urut terbaru) |
| POST | `/conversations` | Buat percakapan baru (`{title?, datasetId?}`) |
| GET | `/conversations/:id` | Detail + seluruh pesan |
| DELETE | `/conversations/:id` | Hapus percakapan |
| POST | `/conversations/chat` | Kirim pertanyaan → percakapan baru otomatis dibuat (`{message, datasetId?}`) |
| POST | `/conversations/:id/chat` | Kirim pertanyaan ke percakapan existing |

Contoh chat:

```json
POST /conversations/chat
{ "message": "Apa tren penjualan bulanan 6 bulan terakhir?", "datasetId": "uuid" }
```

Respons:

```json
{
  "conversationId": "uuid",
  "assistantMessage": {
    "role": "assistant",
    "content": "ringkasan jawaban",
    "data": {
      "text": "...",
      "kpis": [{ "label": "Total Revenue", "value": "123.456.789" }],
      "table": { "columns": ["Bulan", "Revenue"], "rows": [["2025-06", 15000000]] },
      "chart": { "type": "line", "xKey": "bulan", "seriesKeys": ["revenue"], "data": [...] },
      "source": { "dataset": "Penjualan 2025", "tool": "trend_series" }
    }
  }
}
```

- `datasetId` opsional jika hanya ada satu dataset; jika tidak ada dataset sama sekali respons 400.
- Asisten hanya boleh menggunakan angka dari hasil tool analisis backend (tidak mengarang).
- Tool tersedia: `dataset_info`, `summary_kpi`, `group_breakdown`, `trend_series`, `growth`, `forecast`, `customer_segmentation`, `anomaly_detection`, `run_sql` (query speck read-only, whitelist kolom dataset, limit maks 200 baris).

## Format Error

Error NestJS standar:

```json
{ "statusCode": 400, "message": "..." }
```

400 validasi/badan request · 401 tanpa/invalid JWT · 404 tidak ditemukan · 422 data tidak memadai
