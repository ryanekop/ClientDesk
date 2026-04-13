# Client Desk QA Checklist (Regression)

Tanggal: 2026-03-20

## Konfirmasi Variabel Split Wedding

Variabel split sesi untuk Wedding tersedia dan bisa dipakai di template WhatsApp:

- `{{akad_date}}`
- `{{akad_time}}`
- `{{akad_location}}`
- `{{resepsi_date}}`
- `{{resepsi_time}}`
- `{{resepsi_location}}`
- `{{resepsi_maps_url}}`

Field raw dari `extra_fields` juga tetap bisa terbaca bila datanya ada:

- `{{tanggal_akad}}`
- `{{tanggal_resepsi}}`

## Checklist UAT

Isi kolom `Status` dengan `PASS` / `FAIL` / `BLOCKED` dan tambahkan bukti singkat.

| No | Skenario | Steps Ringkas | Expected Result | Status | Evidence/Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | WA template per tipe acara | Set template berbeda untuk `Wedding` dan `Umum` pada semua tipe WA, lalu kirim dari bookings/finance/form/settlement | Template yang dipakai mengikuti `event_type`; fallback ke `Umum` jika event-specific belum ada |  |  |
| 2 | Token split session WA | Tambah `{{akad_date}}` + `{{resepsi_date}}` di template, kirim untuk booking Wedding split day | Dua tanggal terganti benar, bukan token mentah |  |  |
| 3 | Blank white first open | Buka `/dashboard` atau `/bookings` langsung dari incognito/new profile | Halaman tidak blank putih, route resolve normal |  |  |
| 4 | Storage restricted mode | Aktifkan mode browser ketat (storage dibatasi), buka app | App tetap render, tidak crash di auth/sidebar/changelog |  |  |
| 5 | Pagination mobile | Uji mobile viewport pada Bookings, Status Booking, Keuangan, Tim/Freelance | Kontrol page + items per page terlihat dan berfungsi |  |  |
| 6 | Persist items per page (Services/Paket) | Ubah items per page di halaman Services, reload browser | Nilai tersimpan per-user dan terbaca ulang |  |  |
| 7 | Tracking Wedding split day | Buat booking Wedding dengan `tanggal_akad` dan `tanggal_resepsi` berbeda, buka tracking publik | Menampilkan dua jadwal: Akad & Resepsi |  |  |
| 8 | Tracking non-Wedding | Buka tracking event non-Wedding | Tetap menampilkan jadwal tunggal |  |  |
| 9 | Dashboard 30 hari by booking date | Gunakan data booking dengan `booking_date` berbeda dari `created_at` | Bucket chart harian ikut `booking_date` |  |  |
| 10 | Dashboard 1 tahun fallback | Gunakan booking tanpa `booking_date` | Data tetap teragregasi via `created_at` |  |  |
| 11 | Filter tanggal Wedding split day | Buat booking Wedding dengan `tanggal_akad` dan `tanggal_resepsi` berbeda, lalu filter Bookings/Status Booking/Keuangan dengan basis `Session Date` pada masing-masing tanggal | Booking muncul saat filter kena tanggal akad maupun tanggal resepsi |  |  |
| 12 | Filter tanggal Wisuda split sessions | Buat booking Wisuda dengan `tanggal_wisuda_1` dan `tanggal_wisuda_2` berbeda, lalu filter Bookings/Status Booking/Keuangan dengan basis `Session Date` pada masing-masing tanggal | Booking muncul saat filter kena sesi 1 maupun sesi 2 |  |  |

## Verifikasi Teknis Otomatis (sudah dijalankan)

- `npm run build`: PASS
- `npx tsc --noEmit`: PASS

Catatan:

- Formula nominal pemasukan tidak berubah (tetap net verified revenue).
- Perubahan grafik hanya pada basis tanggal bucket (`booking_date`, fallback `created_at`).
