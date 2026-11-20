-- Settings > Patient App (FCS-4729): the organization's Fold Care app rules.
-- One row (id 'org'):
--   family_access   who can get family access, age rules, consent rules,
--                   payer and employer overrides, notification routing
--   feature_access  which app features the patient, View only and Act on
--                   behalf family members can use
-- The app merges each JSON object over its built-in defaults, so keys added
-- later need no data fix. Idempotent: safe to run more than once, dev first.

CREATE TABLE IF NOT EXISTS public.patient_app_settings (
  id              text PRIMARY KEY,
  family_access   jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_access  jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by      text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on patient_app_settings" ON public.patient_app_settings;
CREATE POLICY "Allow all on patient_app_settings" ON public.patient_app_settings
  FOR ALL USING (true) WITH CHECK (true);

-- The organization's row, on the defaults ({} means "use the app's defaults").
INSERT INTO public.patient_app_settings (id, family_access, feature_access, updated_by)
VALUES ('org', '{}'::jsonb, '{}'::jsonb, 'FCS-4729 seed')
ON CONFLICT (id) DO NOTHING;
