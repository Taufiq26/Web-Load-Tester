# 🚀 Web Load Tester (k6 + PDF Report)

Repositori ini berisi sistem pengujian beban (*load testing*) otomatis menggunakan **k6** untuk simulasi trafik dan **Puppeteer** untuk menghasilkan laporan analisis performa dalam format PDF yang profesional.

## 🛠️ Fitur Utama
- **Simulasi Concurrent Users**: Menggunakan k6 untuk mensimulasikan trafik tinggi secara bersamaan.
- **Kategorisasi Log**: Output terminal yang rapi (TOTAL RESULTS, HTTP, EXECUTION, NETWORK).
- **Laporan PDF Profesional**: Analisis otomatis hasil pengujian dengan indikator status (BAIK, PERLU PERHATIAN, BAHAYA).
- **Deep Dive Metrik**: Penjelasan mendalam untuk 9+ metrik teknis (TTFB, Handshake, Duration, dll).

---

## 📋 Prasyarat
Sebelum memulai, pastikan Anda sudah menginstal:
1. **Node.js** (v18 atau lebih baru)
2. **k6** (Instalasi: `brew install k6` untuk Mac atau cek [dokumentasi k6](https://k6.io/docs/getting-started/installation/))

---

## 🚀 Cara Penggunaan

### 1. Instalasi Dependensi
Jalankan perintah berikut di direktori proyek:
```bash
npm install
```

### 2. Menjalankan Uji Beban & Generate PDF
Gunakan perintah satu langkah ini untuk menjalankan test dan langsung mendapatkan laporan PDF:
```bash
npm test
```
*Script akan menjalankan k6 selama 30 detik (default) dan menghasilkan file `loadtest_report.pdf`.*

### 3. Menjalankan Test Tanpa PDF
Jika Anda hanya ingin melihat hasil di terminal:
```bash
k6 run loadtest.ts
```

### 4. Membuat PDF dari Hasil Sebelumnya
Jika Anda sudah menjalankan `k6 run` dan ingin membuat PDF-nya saja:
```bash
npm run report
```

---

## 🖥️ Menjalankan Web UI
Web UI menyediakan antarmuka grafis (GUI) untuk menjalankan pengujian tanpa harus menggunakan terminal secara manual.

### 🏗️ Local Development
1. Jalankan server lokal:
   ```bash
   npm run server
   ```
2. Buka browser dan akses [http://localhost:3000](http://localhost:3000).

### 🚀 Production Server
Untuk lingkungan production, disarankan menggunakan *process manager* seperti **PM2** agar server tetap berjalan di latar belakang:

1. **Instal PM2** (jika belum ada):
   ```bash
   npm install pm2 -g
   ```

2. **Jalankan Aplikasi**:
   ```bash
   pm2 start server.ts --interpreter ./node_modules/.bin/tsx --name web-tester-ui
   ```

3. **Monitor Status**:
   ```bash
   pm2 status
   pm2 logs web-tester-ui
   ```

---

## 📊 Penjelasan Metrik Utama

| Metrik | Deskripsi | Standar Baik |
| :--- | :--- | :--- |
| **http_req_duration** | Total waktu respon dari awal sampai akhir. | < 500ms |
| **http_req_waiting** | Time to First Byte (TTFB) / Waktu proses backend. | < 300ms |
| **http_req_failed** | Persentase request yang gagal/error. | 0.00% |
| **http_req_connecting** | Waktu untuk jabat tangan TCP (Network layer). | < 50ms |
| **tls_handshaking** | Waktu negosiasi enkripsi SSL/TLS. | < 100ms |

---

## 📁 Struktur Proyek
- `loadtest.ts`: Skrip utama k6 (TypeScript).
- `scripts/generate-report.ts`: Script Node.js untuk konversi JSON ke PDF.
- `summary.json`: Data mentah hasil pengujian terakhir (auto-generated).
- `loadtest_report.pdf`: Laporan visual akhir (auto-generated).

---

## ⚙️ Konfigurasi Target
Untuk mengubah jumlah user atau target URL, edit file `loadtest.ts`:
```typescript
export let options = {
  vus: 100,      // Jumlah simulasi user
  duration: '30s', // Durasi pengujian
};

// Ubah URL di dalam fungsi default
let res = http.get('https://example.com');
```

---
## 📄 Lisensi
Proyek ini dilisensikan di bawah **MIT License**. Anda bebas menggunakan, menyalin, dan memodifikasi proyek ini selama menyertakan referensi pembuat aslinya (**gwetaufiq**).

**Taufiq26** &bull; 2026
