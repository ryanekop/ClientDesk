-- ============================================================
-- MIGRATION: Changelog feature
-- Run this SQL in Supabase SQL Editor
-- ============================================================

-- Changelog table — stores release notes visible to all users
CREATE TABLE IF NOT EXISTS changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,                    -- e.g. "1.5.0"
  title text NOT NULL,                      -- short title
  description text,                         -- markdown or plain text body
  badge text DEFAULT 'update',              -- 'new' | 'improvement' | 'fix' | 'update'
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index for ordered listing
CREATE INDEX IF NOT EXISTS idx_changelog_published ON changelog(published_at DESC);

-- RLS: anyone authenticated can read
ALTER TABLE changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "changelog_select_authenticated"
  ON changelog FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role (admin) can insert/update/delete — no user policy needed

-- Track which user has seen changelog up to which entry
CREATE TABLE IF NOT EXISTS changelog_reads (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id)
);

ALTER TABLE changelog_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "changelog_reads_own"
  ON changelog_reads FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Seed initial changelog entries
-- ============================================================

INSERT INTO changelog (version, title, description, badge, published_at) VALUES
('1.5.0', 'Custom Form Builder', 'Buat form booking custom dengan section dan field sendiri. Mirip Google Form — bisa tambah teks, textarea, angka, dropdown, dan checkbox.', 'new', '2026-03-12T10:00:00Z'),
('1.5.0', 'Custom Tipe Acara', 'Tambahkan tipe acara khusus selain template bawaan (Wedding, Wisuda, dll). Kelola di pengaturan Form Booking.', 'new', '2026-03-12T09:55:00Z'),
('1.5.0', 'Paket Add-on / Tambahan', 'Tandai paket sebagai add-on. Di form publik akan tampil terpisah dengan checkbox dan total otomatis dihitung.', 'new', '2026-03-12T09:50:00Z'),
('1.5.0', 'Urutan Paket', 'Atur urutan tampilan paket di form publik dengan tombol ↑↓ di halaman Layanan.', 'improvement', '2026-03-12T09:45:00Z'),
('1.5.0', 'Min DP Fleksibel', 'Pilih antara persentase (%) atau nominal tetap (Rp) untuk minimum DP per tipe acara.', 'improvement', '2026-03-12T09:40:00Z'),
('1.5.0', 'Total Pemasukan Akurat', 'Pemasukan sekarang dihitung dari semua DP yang masuk, bukan hanya booking lunas.', 'fix', '2026-03-12T09:35:00Z');
