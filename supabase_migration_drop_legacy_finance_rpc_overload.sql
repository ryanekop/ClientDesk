BEGIN;

-- Keep only the canonical multi-filter finance RPC signature.
DROP FUNCTION IF EXISTS public.cd_get_finance_page(
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN
);

COMMIT;
