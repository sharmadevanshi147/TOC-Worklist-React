-- FCS-4729 Family & Caregiver Proxy Access, provider web (Story 2, Story 5).
--
-- Adds app access to the people on a patient's family list
-- (patient_family_members) and a consent record table.
--
--   access_level   none | view | act        (No access, View only, Act on behalf)
--   access_basis   consent | minor_parent | legal_authority
--                  consent: the adult patient decides (needs their consent).
--                  minor_parent / legal_authority: set by staff, the patient
--                  can't change it.
--   access_status  not_invited | invited | pending_consent | active | declined | removed
--   consent_status not_needed | pending | accepted | declined | revoked
--
-- family_access_consents keeps one row per consent recorded by staff (AC40):
-- the patient, the proxy, the level, the method, the outcome, the time and who
-- recorded it, plus the signed form (written) and staff notes.
--
-- Additive and idempotent: safe to run more than once.

ALTER TABLE public.patient_family_members
  ADD COLUMN IF NOT EXISTS access_level   text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS access_basis   text NOT NULL DEFAULT 'consent',
  ADD COLUMN IF NOT EXISTS access_status  text NOT NULL DEFAULT 'not_invited',
  ADD COLUMN IF NOT EXISTS access_ends_on date,
  ADD COLUMN IF NOT EXISTS consent_status text NOT NULL DEFAULT 'not_needed',
  ADD COLUMN IF NOT EXISTS invited_at     timestamptz,
  ADD COLUMN IF NOT EXISTS invited_via    text,
  ADD COLUMN IF NOT EXISTS access_note    text,
  ADD COLUMN IF NOT EXISTS access_updated_by text,
  ADD COLUMN IF NOT EXISTS access_updated_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.patient_family_members ADD CONSTRAINT patient_family_members_access_level_chk
    CHECK (access_level IN ('none', 'view', 'act'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_family_members ADD CONSTRAINT patient_family_members_access_basis_chk
    CHECK (access_basis IN ('consent', 'minor_parent', 'legal_authority'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_family_members ADD CONSTRAINT patient_family_members_access_status_chk
    CHECK (access_status IN ('not_invited', 'invited', 'pending_consent', 'active', 'declined', 'removed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_family_members ADD CONSTRAINT patient_family_members_consent_status_chk
    CHECK (consent_status IN ('not_needed', 'pending', 'accepted', 'declined', 'revoked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_family_members ADD CONSTRAINT patient_family_members_invited_via_chk
    CHECK (invited_via IS NULL OR invited_via IN ('sms', 'email'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.family_access_consents (
  id                text PRIMARY KEY,
  family_member_id  text NOT NULL,
  patient_id        text NOT NULL,
  proxy_name        text NOT NULL,
  access_level      text NOT NULL CHECK (access_level IN ('view', 'act')),
  -- Staff Recorded Consent (App Access Consent drawer): how the patient gave
  -- their answer, and whether they agreed or declined.
  method            text NOT NULL CHECK (method IN ('verbal', 'written', 'not_required')),
  outcome           text NOT NULL DEFAULT 'accepted' CHECK (outcome IN ('accepted', 'declined')),
  -- The signed form, uploaded to the patient's documents (written only).
  document_id       text,
  note              text,
  recorded_by       text,
  recorded_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS family_access_consents_member_idx ON public.family_access_consents (family_member_id);
CREATE INDEX IF NOT EXISTS family_access_consents_patient_idx ON public.family_access_consents (patient_id);

ALTER TABLE public.family_access_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on family_access_consents" ON public.family_access_consents;
CREATE POLICY "Allow all on family_access_consents" ON public.family_access_consents
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);

-- App Access History (one patient's history across every family member):
-- one row per access action, newest read first. `action`:
-- requested | changed | consent_recorded | invited | active | declined |
-- withdrawn | removed | ended | paused
CREATE TABLE IF NOT EXISTS public.family_access_events (
  id                text PRIMARY KEY,
  patient_id        text NOT NULL,
  family_member_id  text NOT NULL,
  member_name       text NOT NULL,
  action            text NOT NULL,
  from_level        text,
  to_level          text,
  method            text,
  note              text,
  actor             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS family_access_events_patient_idx ON public.family_access_events (patient_id, created_at DESC);

ALTER TABLE public.family_access_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on family_access_events" ON public.family_access_events;
CREATE POLICY "Allow all on family_access_events" ON public.family_access_events
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);

NOTIFY pgrst, 'reload schema';
