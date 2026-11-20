-- FCS-4729 demo data (dev and prod): give Wei Brave Fold Care app access, so the
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

-- Andrew Evans (11048, born 06/27/2016) is 10: his profile record's family
-- (a wife and a son) doesn't fit a child. Replace it with his parents.
-- Kept on prod as well as dev (agreed with UX, 2026-11-19).
UPDATE public.p360_profiles
SET family_members = '[
  {"name": "Rachel Evans", "relation": "Mother (Caregiver)", "initials": "RE", "phone": "(562) 555-0182", "phone_hours": "Mon-Fri, 8am-6pm"},
  {"name": "Daniel Evans", "relation": "Father", "initials": "DE", "phone": "(562) 555-0147", "phone_hours": "Mon-Sun, 6pm-9pm"}
]'::jsonb
WHERE patient_id = '11048';

-- Rachel on his family list, acting on his behalf as the parent of a minor
-- (no consent needed, spec section 4): Act on behalf, minor_parent, Active.
INSERT INTO public.patient_family_members
  (id, patient_id, name, relationship, phone, email, is_caregiver, is_emergency_contact,
   access_level, access_basis, access_status, consent_status, invited_at, invited_via, created_by)
SELECT 'fam-demo-andrew-mother', p.id, 'Rachel Evans', 'Mother', '(562) 555-0182', 'rachel.evans@example.com', true, true,
       'act', 'minor_parent', 'active', 'not_needed', now() - interval '6 days', 'sms', 'FCS-4729 demo seed'
FROM public.all_patients p
WHERE p.id = '11048'
ON CONFLICT (id) DO UPDATE SET
  access_level = 'act', access_basis = 'minor_parent', access_status = 'active', consent_status = 'not_needed',
  invited_at = COALESCE(public.patient_family_members.invited_at, EXCLUDED.invited_at),
  invited_via = COALESCE(public.patient_family_members.invited_via, EXCLUDED.invited_via);

INSERT INTO public.family_access_events
  (id, patient_id, family_member_id, member_name, action, from_level, to_level, method, note, actor, created_at)
SELECT v.id, '11048', 'fam-demo-andrew-mother', 'Rachel Evans', v.action, v.from_level, v.to_level, v.method, v.note, v.actor, now() - v.ago
FROM (VALUES
  ('fae-demo-andrew-1', 'member_added', NULL,   NULL,  'Mother', 'Caregiver, Emergency Contact',                  'Dr. Michael Chen', interval '8 days'),
  ('fae-demo-andrew-2', 'requested',    'none', 'act', NULL,     'Parent of a minor: no patient consent needed.', 'Dr. Michael Chen', interval '8 days' - interval '3 minutes'),
  ('fae-demo-andrew-3', 'invited',      NULL,   'act', 'sms',    NULL,                                            'Dr. Michael Chen', interval '6 days'),
  ('fae-demo-andrew-4', 'active',       NULL,   'act', NULL,     NULL,                                            'Rachel Evans',     interval '5 days')
) AS v(id, action, from_level, to_level, method, note, actor, ago)
WHERE EXISTS (SELECT 1 FROM public.all_patients WHERE id = '11048')
ON CONFLICT (id) DO NOTHING;

-- Annette Brave (11089): one family member per app access state, so the
-- Family & Caregiver section shows every badge (Active Act on behalf,
-- Invited, Declined, Ended). Wei (View only, Active), Aaliyah
-- (pending consent) and Aisha (no access) already cover the rest.
-- Daniel and Grace are "ended": Daniel's basis is legal_authority but he no
-- longer has a Decision Maker role or Legal Authority document; Grace's end
-- date passed.
INSERT INTO public.patient_family_members
  (id, patient_id, name, relationship, is_caregiver, is_emergency_contact,
   access_level, access_basis, access_status, consent_status, access_ends_on,
   invited_at, invited_via, access_updated_by, access_updated_at, created_by)
SELECT v.id, '11089', v.name, v.relationship, false, false,
       v.access_level, v.access_basis, v.access_status, v.consent_status, v.access_ends_on,
       now() - interval '10 days', 'sms', 'FCS-4729 demo seed', now(), 'FCS-4729 demo seed'
FROM (VALUES
  ('fam-demo-annette-marcus', 'Marcus Brave', 'Son',        'act',  'consent',         'active',   'accepted',   NULL::date),
  ('fam-demo-annette-lena',   'Lena Brave',   'Sister',     'view', 'consent',         'invited',  'accepted',   NULL::date),
  ('fam-demo-annette-omar',   'Omar Reed',    'Son-in-law', 'view', 'consent',         'declined', 'declined',   NULL::date),
  ('fam-demo-annette-grace',  'Grace Bello',  'Friend',     'view', 'consent',         'active',   'accepted',   DATE '2026-10-01'),
  ('fam-demo-annette-daniel', 'Daniel Brave', 'Brother',    'act',  'legal_authority', 'active',   'not_needed', NULL::date)
) AS v(id, name, relationship, access_level, access_basis, access_status, consent_status, access_ends_on)
WHERE EXISTS (SELECT 1 FROM public.all_patients WHERE id = '11089')
ON CONFLICT (id) DO NOTHING;
