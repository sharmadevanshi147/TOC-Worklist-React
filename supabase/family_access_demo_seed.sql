-- FCS-4729 demo (dev only): give Wei Brave Fold Care app access, so the
-- Family & Caregiver section shows the green app icon and the Add Family
-- drawer shows View only / Active.
--
-- Run AFTER patient_family_access_migration.sql. Idempotent: updates Wei's
-- family-list row if there is one, otherwise adds them from the patient's
-- profile record (p360_profiles.family_members) first.

INSERT INTO public.patient_family_members
  (id, patient_id, name, relationship, phone, is_caregiver, is_emergency_contact, created_by)
SELECT 'fam-demo-wei-brave', p.patient_id, 'Wei Brave', 'Partner', fm->>'phone', true, true, 'FCS-4729 demo seed'
FROM public.p360_profiles p
CROSS JOIN LATERAL jsonb_array_elements(p.family_members) fm
WHERE fm->>'name' = 'Wei Brave'
  AND NOT EXISTS (
    SELECT 1 FROM public.patient_family_members m
    WHERE m.patient_id = p.patient_id AND lower(m.name) = 'wei brave'
  )
ON CONFLICT (id) DO NOTHING;

UPDATE public.patient_family_members
SET access_level      = 'view',
    access_basis      = 'consent',
    access_status     = 'active',
    consent_status    = 'accepted',
    invited_at        = COALESCE(invited_at, now() - interval '3 days'),
    invited_via       = COALESCE(invited_via, 'sms'),
    access_updated_by = 'FCS-4729 demo seed',
    access_updated_at = now()
WHERE lower(name) = 'wei brave';

-- The consent behind it, as staff would record it.
INSERT INTO public.family_access_consents
  (id, family_member_id, patient_id, proxy_name, access_level, method, outcome, note, recorded_by)
SELECT 'fac-demo-wei-brave', m.id, m.patient_id, m.name, 'view', 'verbal', 'accepted', 'Annette agreed by phone.', 'FCS-4729 demo seed'
FROM public.patient_family_members m
WHERE lower(m.name) = 'wei brave'
ON CONFLICT (id) DO NOTHING;

-- App Access History for Wei: requested, consent recorded, invited, active.
INSERT INTO public.family_access_events
  (id, patient_id, family_member_id, member_name, action, from_level, to_level, method, note, actor, created_at)
SELECT v.id, m.patient_id, m.id, m.name, v.action, v.from_level, v.to_level, v.method, v.note, v.actor, now() - v.ago
FROM public.patient_family_members m
CROSS JOIN (VALUES
  ('fae-demo-wei-1', 'requested',        'none', 'view', 'staff',  'Annette asked for Wei to help with appointments.', 'Dr. Michael Chen', interval '5 days'),
  ('fae-demo-wei-2', 'consent_recorded', NULL,   'view', 'verbal', 'Annette agreed by phone.',                         'Dr. Michael Chen', interval '5 days' - interval '2 minutes'),
  ('fae-demo-wei-3', 'invited',          NULL,   'view', 'sms',    NULL,                                               'Dr. Michael Chen', interval '3 days'),
  ('fae-demo-wei-4', 'active',           NULL,   'view', NULL,     NULL,                                               'Wei Brave',        interval '2 days')
) AS v(id, action, from_level, to_level, method, note, actor, ago)
WHERE lower(m.name) = 'wei brave'
ON CONFLICT (id) DO NOTHING;
