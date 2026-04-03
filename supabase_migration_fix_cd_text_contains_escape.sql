-- ============================================================
-- HOTFIX: Fix invalid escape string in text filter helpers
-- Run this SQL in Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.cd_escape_like_query(
  p_value TEXT
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT replace(
           replace(
             replace(COALESCE(p_value, ''), E'\\', E'\\\\'),
             '%',
             E'\\%'
           ),
           '_',
           E'\\_'
         );
$$;

CREATE OR REPLACE FUNCTION public.cd_text_contains(
  p_source TEXT,
  p_query TEXT
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_source, '') ILIKE ('%' || public.cd_escape_like_query(COALESCE(p_query, '')) || '%')
  ESCAPE E'\\';
$$;
