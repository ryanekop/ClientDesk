# ClientDesk Staleness Audit Runbook

Tanggal: 2026-03-27

## Tujuan

Audit berbasis bukti untuk kasus perubahan setting/data yang tidak langsung muncul di:

- Public form booking
- Public invoice
- Public tracking/status booking

Fokus audit:

1. Trigger `updated_at` di DB.
2. Jalur invalidasi cache di app.
3. Cache browser/HTTP (normal URL vs cache-bust URL).

## Step 1 — Verifikasi Trigger DB

Jalankan query SQL di environment terdampak (staging/production) menggunakan snippet pada:

- `docs/qa/staleness-audit-sql.md`

Hasil yang diharapkan:

- Trigger `set_profiles_updated_at` dan `set_bookings_updated_at` ada dan aktif.
- Function `public.set_row_updated_at()` benar-benar mengubah `NEW.updated_at = NOW()`.

## Step 2 — Reproduksi Per Kasus + Bukti Timestamp

Siapkan:

- `user_id` vendor yang dites
- `booking_id` / `booking_code` / `tracking_uuid` dari booking sampel

Kasus audit:

1. Ubah setting di halaman form booking (mis. greeting/warna/opsi field), lalu simpan.
2. Ubah status booking di halaman status booking.
3. Ubah data yang berdampak invoice (mis. total/final settlement/status pembayaran).

Untuk tiap kasus, ambil bukti:

- `updated_at` sebelum save
- `updated_at` sesudah save
- timestamp request halaman/API publik yang dicek

Template catatan:

| Kasus | Entity | ID | updated_at sebelum | updated_at sesudah | URL normal | URL cache-bust | Hasil |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | profile | `<user_id>` |  |  |  |  |  |
| B | booking | `<booking_id>` |  |  |  |  |  |
| C | booking | `<booking_id>` |  |  |  |  |  |

## Step 3 — Isolasi Layer Cache (URL Normal vs Cache-Bust)

Gunakan pasangan URL berikut untuk pembanding:

- Invoice:
  - Normal: `/api/public/invoice?code=<code>&stage=<stage>&lang=<lang>`
  - Cache-bust: `/api/public/invoice?code=<code>&stage=<stage>&lang=<lang>&__cb=<unix_ms>`
- Track API:
  - Normal: `/api/public/track?uuid=<uuid>&locale=id`
  - Cache-bust: `/api/public/track?uuid=<uuid>&locale=id&__cb=<unix_ms>`
- Form booking:
  - Normal: `/<locale>/formbooking/<slug>`
  - Cache-bust: `/<locale>/formbooking/<slug>?__cb=<unix_ms>`

Catatan:

- `__cb` dipakai untuk memaksa URL unik di sisi browser/proxy.
- Untuk browser test, gunakan mode incognito agar state lama tidak ikut terbawa.

## Step 4 — Audit Kode Jalur Invalidasi

Jalankan script audit:

```bash
npm run audit:cache-staleness
```

Script ini memindai update langsung ke tabel `profiles`/`bookings` dan menandai file yang tidak memiliki indikasi invalidasi cache publik.

## Aturan Diagnosis

- `updated_at` tidak berubah setelah save:
  - akar masalah kemungkinan di trigger/migrasi DB.
- `updated_at` berubah, URL `__cb` fresh, URL normal stale:
  - kemungkinan browser/proxy HTTP cache.
- `updated_at` berubah, URL normal + `__cb` sama-sama stale:
  - kemungkinan invalidasi cache app/route-level belum terpanggil.
- API fresh, tetapi page masih stale:
  - kemungkinan cache/render layer page (client hydration atau snapshot data).

## Output Audit Yang Wajib Disimpan

Simpan artefak berikut per environment:

1. Screenshot hasil query trigger/function dari SQL Editor.
2. Tabel bukti before/after `updated_at`.
3. Perbandingan respon URL normal vs cache-bust.
4. Output command `npm run audit:cache-staleness`.
