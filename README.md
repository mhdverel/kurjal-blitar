# KURJAL BLITAR

Frontend mobile-first untuk operasional KURJAL Blitar berdasarkan PRD v2. Aplikasi berfungsi sebagai ledger order driver dan pencatatan setoran mingguan 10%—bukan sistem dispatch.

## Fitur

- Registrasi driver dengan status `PENDING` dan approval admin
- Pencatatan order selesai dengan dialog konfirmasi
- Dashboard driver: statistik order, total ongkir, dan setoran mingguan
- Dashboard admin: driver, seluruh order, laporan, dan settlement
- Dua role: `ADMIN` dan `DRIVER`
- PWA dan layout responsif hingga layar mobile

## Teknologi

- React 19
- Vite 7
- Lucide React
- CSS native dengan design tokens
- Node.js test runner

## Menjalankan project

```bash
npm install
npm run dev
```

Buka URL lokal yang ditampilkan Vite.

## Verifikasi

```bash
npm test
npm run build
```

## Catatan

Project ini masih berupa frontend prototype dengan state dan dummy data in-memory. Integrasi backend, autentikasi produksi, serta penyimpanan file belum diimplementasikan.
