# KURJAL Blitar

Aplikasi operasional mobile-first untuk mencatat order driver, menghitung setoran mingguan, dan mengecek ongkir KURJAL Blitar. Aplikasi ini berfungsi sebagai ledger operasional, bukan sistem dispatch.

**Production:** [kurjal-blitar.web.app](https://kurjal-blitar.web.app)

## Fitur Utama

- Autentikasi Email/Password dengan role `ADMIN` dan `DRIVER`.
- Registrasi driver dengan alur persetujuan Admin (`PENDING` → `APPROVED`).
- Pencatatan order selesai dan dashboard statistik berbasis data realtime.
- Perhitungan settlement mingguan sebesar 10% dari ongkir driver.
- Upload bukti settlement ke bucket Cloudflare R2 privat melalui Worker.
- Kalkulator ongkir bersama untuk Admin, Driver, dan form Catat Order.
- Pengaturan tarif ongkir realtime melalui Firestore.
- PWA dengan antarmuka responsif untuk perangkat mobile dan desktop.

## Arsitektur

```text
React + Vite
├── Firebase Authentication
├── Cloud Firestore (database: default)
└── Cloudflare Worker
    └── Cloudflare R2 (private bucket)
```

| Area | Teknologi |
| --- | --- |
| Frontend | React 19, Vite 7, Lucide React, CSS native |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore Enterprise |
| Object storage | Cloudflare R2 melalui Cloudflare Worker |
| Testing | Node.js test runner, Firebase Emulator Suite |
| Hosting | Firebase Hosting |

## Prasyarat

- Node.js `^20.19.0` atau `>=22.12.0`
- npm
- Java Runtime untuk menjalankan Firestore Emulator
- Project Firebase dan akun Cloudflare untuk deployment

## Menjalankan Secara Lokal

```bash
git clone https://github.com/mhdverel/kurjal-blitar.git
cd kurjal-blitar
npm install
cp .env.example .env.local
npm run dev
```

Aplikasi tersedia di `http://localhost:5173` selama development server berjalan.

## Environment Variables

Isi `.env.local` dengan konfigurasi berikut:

| Variable | Keterangan |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | API key Firebase Web App |
| `VITE_FIREBASE_AUTH_DOMAIN` | Domain Firebase Authentication |
| `VITE_FIREBASE_PROJECT_ID` | ID project Firebase |
| `VITE_FIREBASE_APP_ID` | App ID Firebase Web App |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID Firebase |
| `VITE_R2_WORKER_URL` | URL Cloudflare Worker untuk akses R2 |

Aktifkan provider Email/Password di Firebase Authentication. Aplikasi menggunakan Firestore database `default` di region `asia-southeast2`.

## Konfigurasi Akses

Driver baru dibuat dengan status `PENDING` dan baru dapat mengakses fitur operasional setelah disetujui Admin.

Akun Admin pertama harus dibuat melalui Firebase Console atau Admin SDK. Buat dokumen `users/{uid}` dengan schema profil pengguna yang digunakan aplikasi, lalu set:

```json
{
  "role": "ADMIN",
  "accountStatus": "APPROVED"
}
```

Role Admin tidak dapat dibuat dari browser.

## Cloudflare R2

Bukti settlement disimpan di bucket privat `kurjal`. Browser berkomunikasi dengan Cloudflare Worker sehingga kredensial R2 tidak pernah dikirim ke client.

Binding bucket dan environment Worker sudah didefinisikan di `wrangler.jsonc`. Sesuaikan `ALLOWED_ORIGINS` jika domain frontend berubah, kemudian deploy:

```bash
npx wrangler login
npx wrangler deploy
```

Gunakan URL Worker hasil deployment sebagai nilai `VITE_R2_WORKER_URL`.

## Struktur Data

| Path | Kegunaan |
| --- | --- |
| `users/{uid}` | Profil, role, dan status akun |
| `orders/{autoId}` | Ledger order yang immutable |
| `settlements/{weekKey_uid}` | Status dan bukti settlement mingguan |
| `settings/deliveryFee` | Konfigurasi tarif ongkir dan audit perubahan Admin |
| R2 `settlement-proofs/{uid}/{weekKey}` | Bukti settlement privat, maksimal 5 MB |

## Kalkulator Ongkir

Tarif dibaca realtime dari `settings/deliveryFee` dan memakai konfigurasi bawaan jika dokumen belum tersedia. Kalkulator mendukung:

- Tarif dasar hingga 4, 5, dan 6 km.
- Tambahan jarak di atas 6 km dengan pembulatan total ke atas per Rp1.000.
- Tambahan Heavy, Obrok, Kue Tart satu tangan, dan layanan Ojek.
- Tambahan waktu pukul 22.00–23.59 dan 00.00–04.59.
- Perjalanan Ojek sekali jalan atau pulang-pergi.

Hasil kalkulasi tidak termasuk biaya parkir. Kalkulator standalone tidak membuat order atau menyimpan histori.

## Scripts

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Menjalankan development server |
| `npm run build` | Membuat production build |
| `npm run preview` | Menjalankan preview production build |
| `npm test` | Menjalankan unit test |
| `npm run test:rules` | Menjalankan pengujian Firestore Rules melalui emulator |

## Verifikasi

```bash
npm test
npm run test:rules
npm run build
```

## Deployment

Deploy Firestore Rules dan indexes sebelum frontend agar listener tidak mengalami permission atau index error:

```bash
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes
npm run build
npx -y firebase-tools@latest deploy --only hosting
```

Project tidak menyediakan seed data. Database kosong akan menampilkan empty state sampai akun driver dan order dibuat.
