BEGIN;

CREATE TABLE IF NOT EXISTS public.university_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT university_references_source_check
    CHECK (source IN ('kip_kuliah', 'manual')),
  CONSTRAINT university_references_name_not_blank
    CHECK (char_length(btrim(name)) >= 2),
  CONSTRAINT university_references_normalized_name_not_blank
    CHECK (char_length(btrim(normalized_name)) >= 2)
);

CREATE UNIQUE INDEX IF NOT EXISTS university_references_normalized_name_key
  ON public.university_references (normalized_name);

CREATE INDEX IF NOT EXISTS university_references_name_idx
  ON public.university_references (name);

CREATE OR REPLACE FUNCTION public.update_university_references_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS university_references_set_updated_at
  ON public.university_references;

CREATE TRIGGER university_references_set_updated_at
BEFORE UPDATE ON public.university_references
FOR EACH ROW
EXECUTE PROCEDURE public.update_university_references_updated_at();

ALTER TABLE public.university_references ENABLE ROW LEVEL SECURITY;

COMMIT;
