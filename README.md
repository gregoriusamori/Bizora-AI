# AI Business Intelligence Platform

Platform analisis bisnis cerdas yang menggabungkan Business Intelligence, Data Analytics, Predictive Analytics, dan Conversational AI dalam satu aplikasi. Dirancang untuk membantu perusahaan mengambil keputusan berdasarkan data aktual — bukan angka dummy.

## Fitur Utama

- **Authentication & multi-user** — JWT, role (admin/user), organisasi.
- **Dataset Management** — upload CSV / Excel XLSX / JSON, parsing, cleaning (trim + deduplikasi), dynamic schema, metadata kolom, semantic mapping, dan metric definitions.
- **Business Analytics** — revenue, profit, margin, pertumbuhan, agregasi harian/mingguan/bulanan/kuartalan/tahunan.
- **Predictive Analytics**
  - Forecasting: Moving Average, Holt Exponential Smoothing, Linear Regression + mode auto (holdout validation), interval keunggulan, cek kelengkapan data.
  - Segmentasi pelanggan: RFM + K-Means (k-means++, standardisasi z-score).
  - Deteksi anomali: z-score dan IQR dengan severity.
- **Reporting** — 7 jenis laporan (Sales, Profit, Product/Branch/Customer Performance, Monthly Business, Executive Summary) dalam PDF, Excel XLSX, dan CSV; insight `Fakta` dipisahkan dari `Saran` (rekomendasi).
- **Predictive Analytics UI** — grafik aktual vs prediksi dengan confidence band, tabel segmen, tabel anomali (Recharts).

## Struktur Project

```
├── backend/          NestJS + Prisma (PostgreSQL), REST API
├── frontend/         React + Vite + Tailwind + Recharts + Zustand
├── database/         folder migrasi/schema/seed (referensi)
├── docs/             dokumentasi (deployment.md)
├── storage/          uploads & laporan yang dihasilkan
└── .github/          GitHub Actions (CI, deploy)
```

## Menjalankan Lokal

### 1. Backend

```bash
cd backend
cp .env.example .env          # isi DATABASE_URL & JWT_SECRET
npm install
npm run prisma:generate
npm run db:migrate:deploy     # atau: npx prisma db push
npm run start:dev             # http://localhost:3000
```

Health check: `GET http://localhost:3000/health`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Set `VITE_API_URL` bila backend tidak berjalan di `http://localhost:3000`.

## Testing

```bash
cd backend && npm test        # Vitest — 33 unit tests
```

Mencakup: forecasting (MA/ES/regresi, time-series util), K-Means & segmentasi RFM, deteksi anomali (z-score/IQR), perhitungan laporan (KPI, profit, growth, breakdown), serta ekspor CSV/XLSX/PDF.

## Deployment

Lihat [docs/deployment.md](docs/deployment.md) untuk panduan lengkap:
Cloudflare Pages (frontend), Render (backend), Neon (PostgreSQL), GitHub Actions, DNS, dan integrasi Google Sites.

## Keamanan

- Password hashing (bcrypt), JWT, role-based access.
- CORS configurable, Helmet, validasi env di production.
- Kredensial & API key hanya via environment variable (lihat `.env.example`).
- Perhitungan numerik penting dilakukan di backend, bukan oleh LLM.
