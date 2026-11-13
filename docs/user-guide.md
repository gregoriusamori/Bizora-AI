# User Guide — AI Business Intelligence Platform

Panduan penggunaan aplikasi untuk pemilik bisnis, manajer, dan analis.

## 1. Memulai

1. Buka aplikasi (lokal: `http://localhost:5173`).
2. Klik **Login User** di navbar, atau daftar akun baru di halaman Register.
3. Setelah login Anda masuk ke Dashboard.

> Catatan: fitur belum memiliki UI admin penuh — dataset di-upload via menu yang tersedia
> di dashboard atau API (`POST /datasets/upload`).

## 2. Upload Dataset

Sistem menerima **CSV, Excel (XLSX), dan JSON**. Dataset diproses otomatis:

- Deteksi kolom dan tipe data.
- Pembersihan: trim spasi + hapus baris duplikat.
- Struktur disimpan sebagai *dynamic schema* — tiap dataset boleh punya kolom berbeda.

Dataset contoh (penjualan) idealnya memiliki kolom: tanggal transaksi, nama produk,
kategori, cabang, pelanggan, jumlah terjual, nilai penjualan, dan (opsional) biaya.

## 3. Predictive Analytics

Menu **Predictive** menyediakan tiga analisis:

### a. Forecasting
1. Pilih dataset, kolom tanggal, kolom metrik (mis. nilai penjualan).
2. Pilih granularitas (harian/mingguan/bulanan/kuartalan/tahunan) dan metode.
3. Tentukan jumlah periode prediksi (1–24).
4. Klik **Jalankan Analisis**.

Grafik menampilkan garis aktual (biru), prediksi (oranye putus-putus), dan batas
keyakinan. Jika data kurang dari 8 periode, sistem menolak memprediksi — ini
sesuai rancangan agar tidak ada angka karangan.

### b. Segmentasi Pelanggan
1. Pilih kolom pelanggan, tanggal, dan metrik (revenue).
2. Tentukan jumlah segmen (2–6).
3. Sistem menghitung RFM (Recency, Frequency, Monetary) lalu mengelompokkan dengan K-Means.

Hasil: tabel segmen (`Best Customers`, `Loyal Customers`, `Promising`, `At Risk`,
`Low Value`) dengan persentase kepemilikan.

### c. Deteksi Anomali
1. Pilih kolom tanggal dan metrik.
2. Pilih metode `zscore` atau `iqr`.

Titik anomali ditandai merah pada grafik dengan arah (`above`/`below`) dan tingkat
keparahan (`medium`/`high`).

## 4. Laporan (Reports)

1. Buka menu **Reports**.
2. Pilih dataset, jenis laporan, format (PDF / Excel / CSV), dan pemetaan kolom.
3. Klik **Buat Laporan**, lalu unduh dari daftar.

Jenis laporan: Sales, Profit, Product/Branch/Customer Performance, Monthly Business,
Executive Summary.

- **Profit hanya dihitung** bila kolom biaya ditentukan — sistem tidak mengarang angka biaya.
- Bagian *Insight* berisi fakta dari data (dilabeli `Fakta:`).
- Bagian *Rekomendasi* berisi saran (dilabeli `Saran:`) — bukan kesimpulan sebab-akibat.

## 5. Limitasi yang Perlu Diketahui

- Perhitungan selalu berdasarkan dataset yang dipilih; tanpa dataset, aplikasi
  menampilkan empty state, bukan data dummy.
- Prediksi adalah estimasi statistik — lihat bagian *Keterbatasan* pada setiap hasil.
- Periode terakhir data bisa belum lengkap (parsial) dan dapat memengaruhi pertumbuhan.
- Laporan tersimpan di filesystem server; pada deployment ephemeral (Render free),
  file laporan lama bisa hilang saat redeploy — unduh laporan penting segera.
