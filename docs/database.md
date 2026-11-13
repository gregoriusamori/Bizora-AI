# Database Design

PostgreSQL via Prisma ORM. Schema sumber: `backend/prisma/schema.prisma`.
Migrasi SQL awal: `backend/prisma/migrations/0001_init/migration.sql`.

## Tabel

| Tabel | Fungsi |
| --- | --- |
| `organizations` | Batas isolasi data multi-tenant (SaaS-ready) |
| `users` | Akun (email unik, password bcrypt, role, relasi organisasi) |
| `datasets` | Registry dataset per organisasi (nama, source type, deskripsi) |
| `dataset_versions` | Versioning dataset (`version`, `source_hash`) |
| `dataset_columns` | Metadata kolom dynamic schema (`column_name`, `data_type`, `is_nullable`, `is_primary`) |
| `dataset_data` | Baris data sebagai `JSONB` (`row_data`) — struktur fleksibel antar dataset |
| `semantic_models` | Semantic layer per dataset (konfigurasi arti kolom) |
| `semantic_mappings` | Pemetaan `source_column → target_column` + `meaning` (mis. `sales_amount = total penjualan`) |
| `metric_definitions` | Definisi rumus KPI per semantic model |

## Pola Dynamic Schema

Data transaksi bisnis **tidak** menggunakan tabel fixed-column. Setiap baris disimpan
sebagai JSON di `dataset_data.row_data`, sehingga:

- Nama tabel/kolom tidak di-hardcode.
- Dataset baru dengan struktur berbeda dapat ditambah kapan saja.
- Kolom tersimpan dalam `dataset_columns` sehingga AI/analytics tahu struktur tiap dataset.
- Semantic mapping menerjemahkan kolom mentah menjadi makna bisnis.

## Relasi

```
organizations 1─* users
organizations 1─* datasets
datasets 1─* dataset_versions (cascade)
datasets 1─* dataset_columns  (cascade, unique per [dataset_id, column_name])
datasets 1─* dataset_data     (cascade)
datasets 1─* semantic_models  (cascade)
semantic_models 1─* semantic_mappings  (cascade)
semantic_models 1─* metric_definitions (cascade)
```

## Index

Index dibuat pada semua foreign key + unique index `users.email`.
Lihat `migration.sql` untuk daftar lengkap.

## Menjalankan Migrasi

```bash
cd backend
# .env → DATABASE_URL=postgresql://... (Neon)
npm run db:migrate:deploy
```

## Catatan Produksi (Neon)

- Gunakan connection pooling (Neon pooler) untuk serverless/instance kecil.
- Aktifkan backup/PITR di dashboard Neon untuk environment production.
- Jangan pernah mengekspos `DATABASE_URL` ke frontend atau commit ke Git.
