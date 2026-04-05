-- ========================================================
-- Migration: Team Badge Colors + Simplify Team Pricelist
-- ========================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS team_badge_colors jsonb
DEFAULT '{"roles":{},"tags":{}}'::jsonb;

UPDATE public.profiles
SET team_badge_colors = '{"roles":{},"tags":{}}'::jsonb
WHERE team_badge_colors IS NULL
  OR jsonb_typeof(team_badge_colors) <> 'object';

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['public.freelance', 'public.freelancers'] LOOP
    IF to_regclass(target_table) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE %s ALTER COLUMN IF EXISTS pricelist SET DEFAULT ''{"items":[]}''::jsonb',
      target_table
    );

    EXECUTE format(
      $sql$
        UPDATE %s AS f
        SET pricelist = jsonb_build_object(
          'items',
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', COALESCE(NULLIF(BTRIM(item.value->>'id'), ''), 'item_' || item.ordinality::text),
                  'name', COALESCE(NULLIF(BTRIM(item.value->>'name'), ''), 'Item ' || item.ordinality::text),
                  'price',
                    COALESCE(
                      NULLIF(regexp_replace(COALESCE(item.value->>'price', ''), '[^0-9]', '', 'g'), '')::integer,
                      NULLIF(
                        regexp_replace(
                          COALESCE(
                            CASE
                              WHEN COALESCE(f.pricelist->'columns'->0->>'id', '') <> ''
                                THEN item.value->'prices'->>(f.pricelist->'columns'->0->>'id')
                              ELSE NULL
                            END,
                            ''
                          ),
                          '[^0-9]',
                          '',
                          'g'
                        ),
                        ''
                      )::integer,
                      0
                    )
                )
                ORDER BY item.ordinality
              )
              FROM jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(f.pricelist->'items') = 'array'
                    THEN f.pricelist->'items'
                  ELSE '[]'::jsonb
                END
              ) WITH ORDINALITY AS item(value, ordinality)
            ),
            '[]'::jsonb
          )
        )
        WHERE f.pricelist IS NOT NULL
      $sql$,
      target_table
    );

    EXECUTE format(
      'UPDATE %s SET pricelist = ''{"items":[]}''::jsonb WHERE pricelist IS NULL',
      target_table
    );
  END LOOP;
END $$;
