/**
 * Fold Care app access for the people on a patient's family list
 * (FCS-4729, Story 2 and Story 5). Who gets which level by default, whether
 * the patient has to consent, the status a card shows, and the plain-language
 * summary of the feature access matrix (spec section 5).
 */
import { formatDobDisplay } from '../../../lib/patientDob';

export const ACCESS_LEVELS = {
  none: 'No access',
  view: 'View only',
  act: 'Act on behalf',
};

export const ACCESS_STATUS = {
  not_invited: { label: 'Not invited', tone: 'neutral' },
  invited: { label: 'Invited', tone: 'info' },
  pending_consent: { label: 'Pending patient consent', tone: 'warning' },
  active: { label: 'Active', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  removed: { label: 'Removed', tone: 'neutral' },
  // Derived, never stored: legal authority without its role or document (AC10).
  paused: { label: 'Paused', tone: 'warning' },
};

/**
 * How the patient's consent is collected (Consent Method For Access Update;
 * Story 5, AC38–AC39). `hint` is the option's subline. Send to Patient sends
 * the Fold consent form to sign in the Fold Care app; Staff Recorded Consent
 * opens App Access Consent, where staff pick verbal or in writing (upload).
 */
export const CONSENT_METHODS = [
  { value: 'fold_form', label: 'Send to Patient', hint: 'Consent form sent to the patient to sign.', recorded: false },
  { value: 'staff', label: 'Staff Recorded Consent', hint: 'Record consent given by phone, in person or on paper.', recorded: true },
];

const PARENTS = new Set(['Mother', 'Father', 'Guardian']);

/** Years old from any stored dob, or null when there's none. */
export function ageInYears(dob, today = new Date()) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(formatDobDisplay(dob) || '');
  if (!m) return null;
  const birth = new Date(+m[3], +m[1] - 1, +m[2]);
  let years = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) years -= 1;
  return years;
}

export const isMinor = (patient) => {
  const age = ageInYears(patient?.dob);
  return age != null && age < 18;
};

export const hasLegalAuthority = (m) => !!m.decisionMaker && !!m.authorityType && (m.documentIds || []).length > 0;

/**
 * The basis staff can't override: a parent of a minor, or a decision maker
 * with a Legal Authority document. Everyone else needs the patient's consent.
 */
export function fixedBasisOf(m, patient) {
  if (hasLegalAuthority(m)) return 'legal_authority';
  if (PARENTS.has(m.relationship) && isMinor(patient)) return 'minor_parent';
  return null;
}

/** Spec section 4: the level someone starts at before anyone changes it. */
export function defaultLevelOf(m, patient) {
  if (fixedBasisOf(m, patient)) return 'act';
  if (m.isCaregiver) return 'view';
  return 'none';
}

/** An adult patient confirms any level above No access unless staff set it on a fixed basis. */
export const needsConsent = (level, basis, patient) => level !== 'none' && basis === 'consent' && !isMinor(patient);

const todayIso = () => new Date().toISOString().slice(0, 10);

/** The status a card shows, including the derived Paused. */
export function accessStatusOf(m) {
  if (m.accessBasis === 'legal_authority' && m.accessLevel !== 'none' && !hasLegalAuthority(m)) return 'paused';
  if (m.accessEndsOn && m.accessEndsOn < todayIso() && m.accessLevel !== 'none') return 'removed';
  return m.accessStatus || 'not_invited';
}

/** Active / Inactive filter: inactive is no access, declined, removed or past its end date. */
export function isAccessActive(m) {
  const s = accessStatusOf(m);
  // Only a real level counts (a person added this session has none yet), and
  // only once the patient has agreed: a request awaiting consent isn't access.
  return (m.accessLevel === 'view' || m.accessLevel === 'act') && !['pending_consent', 'declined', 'removed', 'paused'].includes(s);
}

/**
 * The status after staff save a level. Consent first; then whether they've
 * been invited. Active only comes from the proxy accepting in the app.
 */
export function statusAfterSave(m, { level, consentNeeded, consentRecorded }) {
  if (level === 'none') return m.accessStatus === 'not_invited' || !m.accessStatus ? 'not_invited' : 'removed';
  if (consentNeeded && !consentRecorded) return 'pending_consent';
  if (m.accessStatus === 'active') return 'active';
  return m.invitedAt ? 'invited' : 'not_invited';
}

/**
 * The feature access matrix (FCS-4729 spec section 5) for the two proxy
 * levels. Fold keeps it in the backend (Story 1, AC5); staff see it read
 * only. Cells: true / false, 'rep' (only as legal representative: parent of
 * a minor or legal authority), 'own' (their own device's settings only).
 */
export const ACCESS_MATRIX = [
  { area: 'Home', action: 'See the home screen, waiting counts and care team', view: true, act: true },
  { area: 'Appointments', action: 'See upcoming and past appointments', view: true, act: true },
  { area: 'Appointments', action: 'Book, reschedule, cancel and confirm (RSVP)', view: false, act: true },
  { area: 'Appointments', action: 'Join a video visit', view: false, act: true },
  { area: 'Tasks', action: 'See tasks and the medication checklist', view: true, act: true },
  { area: 'Tasks', action: 'Mark a task or medication done', view: false, act: true },
  { area: 'Forms', action: 'See forms sent to the patient', view: true, act: true },
  { area: 'Forms', action: 'Fill in and submit a form', view: false, act: true },
  { area: 'Forms', action: 'Sign a form', view: false, act: 'rep' },
  { area: 'Care plans', action: 'See goals, interventions, progress and barriers', view: true, act: true },
  { area: 'Health records', action: 'See conditions, medications, allergies, immunizations and vitals', view: true, act: true },
  { area: 'Lab results', action: 'See and download', view: true, act: true },
  { area: 'Documents', action: 'See and download', view: true, act: true },
  { area: 'Documents', action: 'Upload', view: false, act: true },
  { area: 'Chat', action: 'Read messages with the care team', view: true, act: true },
  { area: 'Chat', action: 'Send messages and attachments', view: false, act: true },
  { area: 'Education', action: 'See articles sent to the patient', view: true, act: true },
  { area: 'Wearables', action: 'See synced activity', view: true, act: true },
  { area: 'Wearables', action: 'Connect or disconnect a device', view: false, act: false },
  { area: 'ID cards and benefits', action: 'See', view: true, act: true },
  { area: 'Third-party consent', action: 'Accept or decline (for example, Milu)', view: false, act: 'rep' },
  { area: 'Notifications', action: 'Receive notifications about the patient', view: true, act: true },
  { area: 'Notifications', action: 'Change notification settings', view: 'own', act: 'own' },
  { area: 'Profile', action: 'Edit name, address and insurance', view: false, act: false },
  { area: 'My Family', action: 'Change who can access the record', view: false, act: false },
  { area: 'Login', action: 'Change password, username or biometrics', view: false, act: false },
  { area: 'Always hidden', action: 'Patient-only forms and anything marked Hide from proxies', view: false, act: false },
  { area: 'Always hidden', action: 'Advance Directive / Living Will documents and Advance Care Planning forms', view: false, act: 'legal' },
];

/**
 * ACCESS_MATRIX in plain language for staff: grouped lines, no area labels.
 * `represents`: a parent of a minor or a legal authority (signs as legal
 * representative). Returns { can: string[], cannot: string[] }.
 */
export function accessLists(level, basis) {
  const sees = level === 'view' || level === 'act';
  const acts = level === 'act';
  const represents = acts && (basis === 'minor_parent' || basis === 'legal_authority');
  const legal = acts && basis === 'legal_authority';
  const lines = [
    ['See the home screen and care team', sees],
    ['See appointments, tasks, forms and care plans', sees],
    ['See health records, lab results and documents', sees],
    ['Read messages from the care team', sees],
    ['See education, wearable activity, ID cards and benefits', sees],
    ['Get notifications about the patient (and change them on their own device)', sees],
    ['Book, change or cancel appointments, or join video visits', acts],
    ['Complete tasks or fill in forms', acts],
    ['Send messages or upload documents', acts],
    ['Sign forms or accept third-party consent', represents],
    ['Connect or disconnect wearables', false],
    ['Edit the patient\u2019s profile, login or who has access', false],
    ...(legal
      ? [['See Advance Directives (can\u2019t change them)', true], ['See Patient-only forms or anything hidden from family', false]]
      : [['See Patient-only forms, Advance Directives or anything hidden from family', false]]),
  ];
  return {
    can: lines.filter(([, ok]) => ok).map(([t]) => t),
    cannot: lines.filter(([, ok]) => !ok).map(([t]) => t),
  };
}

/** The access fields of a family row, read and written. */
export const rowToAccess = (r) => ({
  accessLevel: r.access_level || 'none',
  accessBasis: r.access_basis || 'consent',
  accessStatus: r.access_status || 'not_invited',
  accessEndsOn: r.access_ends_on || '',
  accessNote: r.access_note || '',
  consentStatus: r.consent_status || 'not_needed',
  invitedAt: r.invited_at || null,
  invitedVia: r.invited_via || null,
  accessUpdatedBy: r.access_updated_by || null,
  accessUpdatedAt: r.access_updated_at || null,
});

export const accessToRow = (p) => ({
  ...('accessLevel' in p ? { access_level: p.accessLevel } : {}),
  ...('accessBasis' in p ? { access_basis: p.accessBasis } : {}),
  ...('accessStatus' in p ? { access_status: p.accessStatus } : {}),
  ...('accessEndsOn' in p ? { access_ends_on: p.accessEndsOn || null } : {}),
  ...('accessNote' in p ? { access_note: p.accessNote || null } : {}),
  ...('consentStatus' in p ? { consent_status: p.consentStatus } : {}),
  ...('invitedAt' in p ? { invited_at: p.invitedAt } : {}),
  ...('invitedVia' in p ? { invited_via: p.invitedVia } : {}),
  ...('accessUpdatedBy' in p ? { access_updated_by: p.accessUpdatedBy } : {}),
  ...('accessUpdatedAt' in p ? { access_updated_at: p.accessUpdatedAt } : {}),
});

/**
 * Sample App Access History for a patient's family, used only until the
 * family_access_events table exists. Each person's story matches their saved
 * access, so the sample never contradicts the list.
 */
export function sampleAccessEvents(patientId, members = []) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const out = [];
  let n = 0;
  const add = (m, action, agoDays, extra = {}) => out.push({
    id: `sample-${m.id}-${n++}`, patientId, memberId: m.id, memberName: m.name, action,
    at: new Date(now - agoDays * day).toISOString(), actor: 'Dr. Michael Chen', note: '', sample: true, ...extra,
  });
  members.forEach((m) => {
    const level = m.accessLevel === 'view' || m.accessLevel === 'act' ? m.accessLevel : null;
    const status = m.accessStatus || 'not_invited';
    if (hasLegalAuthority(m)) {
      // A legal authority acts on behalf from the day the document is attached.
      add(m, 'requested', 12, { toLevel: 'act', note: `Legal Authority document attached: ${m.authorityType || 'legal authority'}.` });
      add(m, 'active', 11, { toLevel: 'act', actor: m.name });
    } else if (level && status === 'active') {
      add(m, 'requested', 9, { toLevel: level, method: 'staff', note: 'Patient asked for help with appointments.' });
      add(m, 'consent_recorded', 9, { toLevel: level, method: 'verbal', note: 'Patient agreed by phone.' });
      add(m, 'invited', 7, { toLevel: level, method: 'sms' });
      add(m, 'active', 6, { toLevel: level, actor: m.name });
    } else if (level && status === 'invited') {
      add(m, 'requested', 4, { toLevel: level, method: 'staff' });
      add(m, 'consent_recorded', 4, { toLevel: level, method: 'written' });
      add(m, 'invited', 3, { toLevel: level, method: 'email' });
    } else if (level && status === 'pending_consent') {
      add(m, 'requested', 2, { toLevel: level, method: 'fold_form', note: 'Requested at the care plan review.' });
    } else {
      // Someone without access now: an earlier request that was withdrawn.
      add(m, 'requested', 20, { toLevel: 'view', method: 'fold_form' });
      add(m, 'withdrawn', 18, { fromLevel: 'view', toLevel: 'none', note: 'Requested by mistake.' });
    }
  });
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}
