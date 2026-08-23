# PLAN — Fitur Cek Ongkir KURJAL

## 1. Tujuan

Tambahkan fitur **Cek Ongkir** pada:

- Dashboard Driver
- Dashboard Admin

Fitur hanya berfungsi sebagai **kalkulator ongkir** dan tidak otomatis membuat order.

---

## 2. Aturan Ongkir Dasar

Gunakan jarak dalam kilometer.

| Jarak | Ongkir Dasar |
|---|---:|
| ≤ 4 km | Rp8.000 |
| > 4 km – 5 km | Rp10.000 |
| > 5 km – 6 km | Rp12.000 |
| > 6 km | +Rp2.000 setiap tambahan 1 km |

Untuk jarak pecahan, gunakan **pembulatan ke atas** setelah 6 km.

Contoh:

```text
3.5 km  = Rp8.000
4.2 km  = Rp10.000
5.2 km  = Rp12.000
6.0 km  = Rp12.000
6.1 km  = Rp14.000
7.0 km  = Rp14.000
7.1 km  = Rp16.000
```

Formula:

```text
distance <= 4
→ 8.000

distance <= 5
→ 10.000

distance <= 6
→ 12.000

distance > 6
→ 12.000 + (ceil(distance - 6) × 2.000)
```

---

## 3. Tambahan Ongkir

### Barang berat / sulit dibawa tanpa obrok

```text
+ Rp2.000
```

### Menggunakan obrok

```text
+ Rp4.000
```

Pilihan:

```text
Normal
Barang Berat / Sulit Dibawa
Menggunakan Obrok
```

`Barang Berat` dan `Obrok` dibuat **mutually exclusive** agar tambahan tidak terhitung ganda.

---

## 4. Ojek

Jika tipe layanan:

```text
OJEK
```

tambahkan:

```text
+ Rp2.000
```

Contoh:

```text
Jarak 3 km

Base            Rp8.000
Tambahan Ojek   Rp2.000
──────────────────────
Total          Rp10.000
```

---

## 5. Ojek Antar-Jemput / Pulang-Pergi

Tambahkan pilihan:

```text
Sekali Jalan
Pulang Pergi
```

Jika:

```text
Pulang Pergi
```

maka:

```text
Total ongkir = ongkir sekali jalan × 2
```

Contoh:

```text
Jarak       4 km

Base        Rp8.000
Ojek        Rp2.000

Sekali jalan:
Rp10.000

Pulang Pergi:
Rp10.000 × 2

TOTAL:
Rp20.000
```

Multiplier dilakukan **setelah tambahan ojek dihitung**.

---

## 6. Form Cek Ongkir

Tambahkan menu:

```text
Cek Ongkir
```

Form:

```text
Jarak
[ 5.3 ] KM

Jenis Layanan
[ Pengiriman ▼ ]

Kondisi Barang
[ Normal ▼ ]

Jenis Perjalanan
[ Sekali Jalan ▼ ]

[ HITUNG ONGKIR ]
```

### Jenis Layanan

```text
Pengiriman
Ojek
```

### Kondisi Barang

Jika `Pengiriman`:

```text
Normal
Berat / Sulit Dibawa
Menggunakan Obrok
```

Jika `Ojek`, field kondisi barang disembunyikan.

### Jenis Perjalanan

Hanya tampil jika:

```text
Jenis Layanan = Ojek
```

Pilihan:

```text
Sekali Jalan
Pulang Pergi
```

---

## 7. Hasil Perhitungan

Tampilkan breakdown agar driver/admin mengetahui asal nominalnya.

Contoh pengiriman:

```text
CEK ONGKIR

Jarak
7.2 km

Ongkir Dasar
Rp16.000

Tambahan Obrok
Rp4.000

──────────────

TOTAL ONGKIR

Rp20.000
```

Contoh ojek:

```text
CEK ONGKIR

Jarak
5 km

Ongkir Dasar
Rp10.000

Tambahan Ojek
Rp2.000

Pulang Pergi
× 2

──────────────

TOTAL ONGKIR

Rp24.000
```

---

## 8. Calculation Service

Jangan letakkan formula terpisah di halaman Admin dan Driver.

Buat satu reusable function/service:

```text
calculateDeliveryFee()
```

Input:

```ts
{
  distanceKm: number,
  serviceType: "DELIVERY" | "RIDE",
  cargoType: "NORMAL" | "HEAVY" | "OBROK",
  tripType: "ONE_WAY" | "ROUND_TRIP"
}
```

Output:

```ts
{
  distanceKm: 7.2,
  baseFee: 16000,
  cargoSurcharge: 4000,
  rideSurcharge: 0,
  multiplier: 1,
  totalFee: 20000
}
```

Admin dan Driver menggunakan calculation engine yang sama.

---

## 9. Config Firebase

Tarif jangan semuanya hardcoded.

Simpan konfigurasi di Firestore:

```text
/settings/deliveryFee
```

Contoh:

```json
{
  "upTo4Km": 8000,
  "upTo5Km": 10000,
  "upTo6Km": 12000,

  "additionalPerKm": 2000,

  "heavySurcharge": 2000,
  "obrokSurcharge": 4000,
  "rideSurcharge": 2000,

  "roundTripMultiplier": 2
}
```

Dengan demikian jika tarif KURJAL berubah, admin tidak perlu mengubah source code.

---

## 10. Admin Settings

Opsional tetapi direkomendasikan.

Di:

```text
Admin
→ Settings
→ Tarif Ongkir
```

Admin dapat mengubah:

```text
≤4 km             Rp8.000
≤5 km             Rp10.000
≤6 km             Rp12.000
Tambahan / km     Rp2.000
Barang Berat      Rp2.000
Obrok              Rp4.000
Ojek               Rp2.000
Pulang Pergi       ×2
```

Hanya `ADMIN` yang dapat mengubah konfigurasi tarif.

---

## 11. Integration ke Catat Order

Pada form:

```text
Catat Order
```

tambahkan action kecil:

```text
[ CEK ONGKIR ]
```

Setelah kalkulasi:

```text
TOTAL
Rp16.000

[ GUNAKAN ONGKIR INI ]
```

Jika ditekan:

```text
deliveryFee = calculatedFee
```

Field ongkir pada form otomatis terisi.

Tetapi driver tetap dapat membuka kalkulator secara standalone tanpa membuat order.

---

## 12. Navigation

### Driver

```text
Home
Catat
Cek Ongkir
Riwayat
Setoran
```

Jika bottom nav terlalu penuh, `Cek Ongkir` dapat menjadi shortcut/card di Home dan di form Catat Order.

### Admin

Tambahkan:

```text
Cek Ongkir
```

sebagai menu/shortcut di dashboard admin.

---

## 13. Validation

Jarak harus:

```text
> 0
```

Tidak boleh:

```text
0
negative number
text
NaN
```

Contoh input valid:

```text
3
4.5
7.25
```

---

## 14. Acceptance Criteria

- [ ] Admin dapat membuka Cek Ongkir.
- [ ] Driver dapat membuka Cek Ongkir.
- [ ] ≤4 km menghasilkan Rp8.000.
- [ ] >4–5 km menghasilkan Rp10.000.
- [ ] >5–6 km menghasilkan Rp12.000.
- [ ] Di atas 6 km bertambah Rp2.000 per kilometer berikutnya.
- [ ] Pecahan kilometer berikutnya dibulatkan ke atas.
- [ ] Barang berat menambah Rp2.000.
- [ ] Obrok menambah Rp4.000.
- [ ] Heavy dan Obrok tidak dapat dipilih bersamaan.
- [ ] Ojek menambah Rp2.000.
- [ ] Ojek pulang-pergi mengalikan ongkir sekali jalan ×2.
- [ ] Hasil menampilkan breakdown perhitungan.
- [ ] Admin dan Driver menggunakan calculation function yang sama.
- [ ] Tarif dibaca dari Firebase Settings.
- [ ] Hasil kalkulator dapat digunakan untuk mengisi field ongkir pada Catat Order.

---

## 15. Final Calculation Flow

```text
INPUT JARAK
      ↓
HITUNG BASE FEE
      ↓
CEK JENIS LAYANAN
      │
      ├── DELIVERY
      │      ↓
      │   Normal / Heavy / Obrok
      │
      └── OJEK
             ↓
          + Rp2.000
             ↓
      Sekali Jalan / Pulang Pergi
             ↓
         Jika PP → ×2
             ↓
        TOTAL ONGKIR
```

**Satu calculation engine digunakan oleh Admin, Driver, dan form Catat Order agar seluruh perhitungan ongkir KURJAL selalu konsisten.**