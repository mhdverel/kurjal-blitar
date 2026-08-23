# KURJAL BLITAR

Frontend mobile-first untuk operasional KURJAL Blitar berdasarkan PRD v2. Aplikasi berfungsi sebagai ledger order driver dan pencatatan setoran mingguan 10%—bukan sistem dispatch.

## Fitur

- Registrasi driver dengan status `PENDING` dan approval admin
- Pencatatan order selesai dengan dialog konfirmasi
- Dashboard driver: statistik order, total ongkir, dan setoran mingguan
- Dashboard admin: driver, seluruh order, laporan, dan settlement
- Kalkulator ongkir realtime dengan pembulatan Rp1.000, Kue Tart, dan tambahan malam
- Dua role: `ADMIN` dan `DRIVER`
- Satu portal Firebase Auth dengan routing otomatis berdasarkan role dan status akun
- PWA dan layout responsif hingga layar mobile

## Teknologi

- React 19
- Vite 7
- Lucide React
- Firebase Authentication, Cloud Firestore, dan Cloudflare R2
- CSS native dengan design tokens
- Node.js test runner

## Menjalankan project

```bash
npm install
cp .env.example .env.local
npm run dev
```

Isi `.env.local` dengan konfigurasi Firebase Web App dan `VITE_R2_WORKER_URL`, lalu aktifkan Email/Password di Firebase Authentication. Aplikasi menggunakan named Firestore database `default` di `asia-southeast2`.

Akun driver dibuat otomatis dengan status `PENDING`. Akun admin pertama harus dibuat lewat Firebase Console/Admin SDK, lalu dokumen `users/{uid}`-nya diisi dengan schema profil yang sama, `role: "ADMIN"`, dan `accountStatus: "APPROVED"`. Role admin tidak dapat dibuat dari browser.

### Cloudflare R2

Upload dan download melewati Cloudflare Worker agar bucket tetap privat dan kredensial R2 tidak masuk ke browser.

Bucket `kurjal` sudah terhubung melalui binding `SETTLEMENT_PROOFS` di `wrangler.jsonc`. Sesuaikan `ALLOWED_ORIGINS` bila domain frontend berbeda, lalu login dan deploy Worker:

```bash
npx wrangler login
npx wrangler deploy
```

Worker tersedia di `https://kurjal-r2.mhd-verel.workers.dev` dan URL tersebut digunakan sebagai `VITE_R2_WORKER_URL` di `.env.local`. R2 access key tidak diperlukan karena Worker memakai bucket binding.

Terapkan Firestore sebelum frontend agar listener tidak terkena permission/index error:

```bash
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes
npm run build
npx -y firebase-tools@latest deploy --only hosting
```

## Verifikasi

```bash
npm test
npm run test:rules
npm run build
```

## Data Firebase

- `users/{uid}` — profil, role, dan status akun
- `orders/{autoId}` — ledger order immutable
- `settlements/{weekKey_uid}` — status serta bukti setoran mingguan
- `settings/deliveryFee` — tarif kalkulator ongkir dan audit perubahan Admin
- R2 `settlement-proofs/{uid}/{weekKey}` — gambar bukti privat maksimal 5 MB

Project tidak menambahkan seed. Database kosong akan menampilkan empty state sampai driver dan order nyata dibuat. Dashboard memakai listener realtime; pagination dapat ditambahkan jika volume pembacaan sudah terukur besar.
