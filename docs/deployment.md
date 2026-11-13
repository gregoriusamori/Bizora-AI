# Deployment Guide — AI Business Intelligence Platform

Target stack (biaya serendah mungkin):

| Komponen | Layanan | Keterangan |
| --- | --- | --- |
| Frontend (React + Vite) | Cloudflare Pages | Build otomatis dari GitHub |
| Backend (NestJS) | Render | Free plan, deploy hook + `render.yaml` |
| Database (PostgreSQL) | Neon | Serverless Postgres, connection string via env |
| Version control & CI/CD | GitHub | Actions untuk CI dan trigger deploy |
| Portal informasi | Google Sites | Embed/tombol menuju aplikasi |

---

## 1. Persiapan GitHub

1. Buat repository di GitHub (mis. `ai-business-intelligence`).
2. Hubungkan repo lokal:

```bash
git remote add origin <GITHUB_REPOSITORY_URL>
git push -u origin main
```

3. Jangan commit file `.env`, API key, atau kredensial database (sudah dilindungi `.gitignore`).

## 2. Database — Neon

1. Daftar di [neon.tech](https://neon.tech), buat project baru.
2. Salin connection string (`postgresql://...`) dari dashboard Neon.
3. Set sebagai `DATABASE_URL` di environment backend (Render).
4. Jalankan migrasi sekali dari lokal (atau dari CI):

```bash
cd backend
# isi .env dengan DATABASE_URL milik Neon
npm run db:migrate:deploy
```

Migrasi SQL awal tersedia di `backend/prisma/migrations/0001_init`.

## 3. Backend — Render

1. Buat akun Render, pilih **New + → Blueprint** dan arahkan ke repository.
   Blueprint `render.yaml` di root otomatis membuat service `aibi-backend`.
2. Isi environment variable yang ditandai `sync: false`:
   - `DATABASE_URL` — connection string Neon.
   - `FRONTEND_URL` — URL frontend Cloudflare Pages (mis. `https://aibi.pages.dev`).
   - `CORS_ORIGINS` — daftar origin yang diizinkan, dipisah koma.
   - `OPENAI_API_KEY` / `GEMINI_API_KEY` / `AI_DEFAULT_PROVIDER` — opsional untuk fitur AI.
3. Health check: `GET /health` (dipakai Render untuk monitoring).
4. Build command: `npm ci && npx prisma generate && npm run build`.
   Start command: `npm run start:prod`.
5. Catatan: filesystem Render ephemeral — laporan tersimpan di `/tmp/storage/reports`
   dan hilang saat redeploy. Untuk penyimpanan permanen, sambungkan object storage.

## 4. Frontend — Cloudflare Pages

1. Dashboard Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pilih repository, konfigurasi:
   - **Build command**: `cd frontend && npm ci && npm run build`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: `/` (atau set `Root path: frontend` dan output `dist`)
3. Environment variable (Production):
   - `VITE_API_URL` = URL backend Render (mis. `https://aibi-backend.onrender.com`).
4. SPA routing sudah ditangani `frontend/public/_redirects` (`/* /index.html 200`).
5. Alternatif deploy manual via GitHub Actions: jalankan workflow
   **Deploy Frontend (Cloudflare Pages)** dengan secrets:
   - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - Variables: `CLOUDFLARE_PAGES_PROJECT`, `VITE_API_URL`, `DEPLOY_FRONTEND_ENABLED=true`.

## 5. Deploy otomatis backend via GitHub Actions

Workflow **Deploy Backend (Render)** memanggil Render Deploy Hook:

1. Di Render dashboard → service → **Settings → Deploy Hook**, salin URL hook.
2. Tambahkan secret GitHub: `RENDER_DEPLOY_HOOK_URL`.
3. Tambahkan variable GitHub: `DEPLOY_BACKEND_ENABLED=true`.
4. Workflow berjalan otomatis pada push ke `main`, atau manual via `workflow_dispatch`.

## 6. Cloudflare DNS & Security (opsional, jika memiliki domain)

Contoh record:

| Record | Nama | Isi | Proxy |
| --- | --- | --- | --- |
| CNAME | `app.example.com` | `<project>.pages.dev` | Proxied |
| CNAME | `api.example.com` | `aibi-backend.onrender.com` | Proxied |

- Cloudflare Pages/Render sudah menyediakan HTTPS; aktifkan SSL/TLS mode **Full (strict)**.
- Setelah DNS aktif, perbarui `FRONTEND_URL`, `CORS_ORIGINS`, dan `VITE_API_URL`.
- Untuk custom domain di Pages: Pages project → **Custom domains**; di Render: service → **Settings → Custom domain**.

## 7. Google Sites

Google Sites tidak dapat menjalankan backend/PostgreSQL. Gunakan sebagai portal informasi:

1. Buat situs di [sites.google.com](https://sites.google.com) berisi profil produk, fitur, dokumentasi, dan kontak.
2. Tambahkan tombol/menuju aplikasi utama:
   - Link tombol: URL frontend (`https://app.example.com` atau `https://<project>.pages.dev`).
   - Embed via **Insert → Embed → URL** jika ingin menampilkan aplikasi dalam frame.
   - Jika iframe diblokir header (X-Frame-Options/CSP), gunakan tombol "Open Application" sebagai alternatif.
3. Portal utama aplikasi tetap berjalan di Cloudflare Pages.

## 8. Checklist pasca-deploy

- [ ] `GET <backend>/health` mengembalikan `{"status":"ok"}` dan `database: connected`.
- [ ] Register/Login dari frontend berhasil (CORS tidak diblokir).
- [ ] Upload dataset (CSV/XLSX/JSON) berhasil tersimpan.
- [ ] Analisis, forecasting, segmentasi, anomali, dan laporan berfungsi.
- [ ] `VITE_API_URL`, `FRONTEND_URL`, `CORS_ORIGINS` konsisten (https semua).
- [ ] Secrets GitHub tidak berisi nilai yang sama dengan yang ter-commit.
- [ ] Backup: aktifkan PITR/backup di Neon untuk production.
