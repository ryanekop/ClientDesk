BEGIN;

ALTER TABLE public.university_references
  ADD COLUMN IF NOT EXISTS abbreviation TEXT,
  ADD COLUMN IF NOT EXISTS normalized_abbreviation TEXT;

ALTER TABLE public.university_references
  DROP CONSTRAINT IF EXISTS university_references_source_check;

ALTER TABLE public.university_references
  ADD CONSTRAINT university_references_source_check
  CHECK (
    source IN (
      'kip_kuliah',
      'wikipedia_kedinasan',
      'wikipedia_poltekkes',
      'wikipedia_ptn',
      'wikipedia_ptkn',
      'manual'
    )
  );

CREATE INDEX IF NOT EXISTS university_references_normalized_abbreviation_idx
  ON public.university_references (normalized_abbreviation);

COMMIT;
