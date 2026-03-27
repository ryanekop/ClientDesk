# ClientDesk Staleness Audit — Initial Findings (Code-Level)

Tanggal: 2026-03-27

## Ringkasan

Audit lokal awal dilakukan dengan:

```bash
npm run audit:cache-staleness
```

Hasil:

- `Scanned files: 198`
- `Files with updates: 24`
- `Potential gap files: 19` (indikasi awal, masih perlu verifikasi runtime)

## Bukti Utama Sesuai Keluhan

### 1) Form Booking Settings

Update ke `profiles` dilakukan langsung di client page:

- [form-booking/page.tsx:714](/Volumes/Data%20Ryan/Software%20Mac/Develop%20Software/Website/Client%20Desk/ClientDesk/src/app/[locale]/(app)/form-booking/page.tsx:714)
- [form-booking/page.tsx:808](/Volumes/Data%20Ryan/Software%20Mac/Develop%20Software/Website/Client%20Desk/ClientDesk/src/app/[locale]/(app)/form-booking/page.tsx:808)

Pada file ini tidak ada panggilan invalidasi cache publik setelah save.

### 2) Status Booking

Update status/queue booking dilakukan langsung di client page:

- [client-status/page.tsx:353](/Volumes/Data%20Ryan/Software%20Mac/Develop%20Software/Website/Client%20Desk/ClientDesk/src/app/[locale]/(app)/client-status/page.tsx:353)
- [client-status/page.tsx:430](/Volumes/Data%20Ryan/Software%20Mac/Develop%20Software/Website/Client%20Desk/ClientDesk/src/app/[locale]/(app)/client-status/page.tsx:430)

Pada file ini tidak ada panggilan invalidasi cache publik per booking setelah update.

### 3) Pembanding (Flow Yang Sudah Punya Invalidasi)

Settings/Profile punya best-effort invalidasi ke endpoint internal:

- [settings/page.tsx:1000](/Volumes/Data%20Ryan/Software%20Mac/Develop%20Software/Website/Client%20Desk/ClientDesk/src/app/[locale]/(app)/settings/page.tsx:1000)
- [profile/page.tsx:83](/Volumes/Data%20Ryan/Software%20Mac/Develop%20Software/Website/Client%20Desk/ClientDesk/src/app/[locale]/(app)/profile/page.tsx:83)

## Catatan

- Temuan ini bersifat **code-level static evidence**.
- Keputusan final akar masalah tetap ditentukan dari audit runtime:
  - verifikasi trigger `updated_at` di DB
  - bukti timestamp sebelum/sesudah save
  - perbandingan URL normal vs URL `__cb`.

