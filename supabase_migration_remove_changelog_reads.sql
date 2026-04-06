-- changelog popup preference is now stored in browser localStorage
-- so the changelog_reads table is no longer used by the application

DROP POLICY IF EXISTS "changelog_reads_own" ON public.changelog_reads;
DROP TABLE IF EXISTS public.changelog_reads;
