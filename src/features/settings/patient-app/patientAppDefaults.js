/**
 * Settings > Patient App: the organization's Fold Care app rules (FCS-4729).
 * Stored as one row in patient_app_settings; anything the row doesn't have
 * falls back to these defaults, so a new rule never needs a data fix.
 */

export const DEFAULT_FAMILY_ACCESS = {
  enabled: true,
  relations: [
    { key: 'parent', label: 'Parent', note: 'Of a patient who is a minor', basis: 'minor_parent', level: 'act', allowed: true },
    { key: 'legal_guardian', label: 'Legal Authority', note: 'Supported by a Legal Authority document', basis: 'legal_authority', level: 'act', allowed: true },
    { key: 'health_care_agent', label: 'Health Care Agent', note: 'Supported by a Legal Authority document', basis: 'legal_authority', level: 'act', allowed: true },
    { key: 'spouse', label: 'Spouse or partner', basis: 'consent', level: 'view', allowed: true },
    { key: 'adult_child', label: 'Adult child', basis: 'consent', level: 'view', allowed: true },
    { key: 'caregiver', label: 'Caregiver', note: 'Anyone marked as a caregiver', basis: 'consent', level: 'act', allowed: false },
    { key: 'dependent', label: 'Dependent', basis: 'consent', level: 'view', allowed: false },
    { key: 'other', label: 'Other family', note: 'For example, a grandchild', basis: 'consent', level: 'view', allowed: false },
  ],
  ageRules: {
    default: { majority: 18, privacyFrom: 12 },
    // At least one state is always listed; California is the starting one.
    states: [{ id: 'state-1', state: 'California', majority: 18, privacyFrom: 12 }],
  },
  notifyDaysBeforeMajority: 30,
  consent: {
    requireAdults: true,
  },
};

// What each family access level can use in the Fold Care app, one row per
// feature, on or off per level. `kind: 'do'` rows are actions, which View
// only never gets. `required` rows are always on for both levels; `locked`
// rows are never on.
export const APP_FEATURES = [
  { area: 'Home', items: [
    { key: 'home', label: 'Home screen and care team', required: true },
    { key: 'notifications', label: 'Notifications about the patient', required: true },
  ] },
  { area: 'Appointments', items: [
    { key: 'appointments', label: 'See upcoming and past visits', view: true, act: true },
    { key: 'book', kind: 'do', label: 'Book, reschedule or cancel visits', act: true },
    { key: 'video', kind: 'do', label: 'Join video visits', act: true },
  ] },
  { area: 'Tasks and forms', items: [
    { key: 'tasks', label: 'See tasks, forms and the medication checklist', view: true, act: true },
    { key: 'complete_tasks', kind: 'do', label: 'Complete tasks and fill in forms', act: true },
    { key: 'sign', kind: 'do', label: 'Sign forms and third-party consents for the patient', act: true },
    { key: 'sensitive_forms', label: 'Patient-only forms', locked: 'Never shown to family' },
  ] },
  { area: 'Health records', items: [
    { key: 'care_plans', label: 'Care plans', view: true, act: true },
    { key: 'clinical', label: 'Conditions, medications, allergies and immunizations', view: true, act: true },
    { key: 'labs', label: 'Lab results', view: true, act: true },
    { key: 'documents', label: 'See and download documents', view: true, act: true },
    { key: 'upload', kind: 'do', label: 'Upload documents', act: true },
  ] },
  { area: 'Messages', items: [
    { key: 'chat_history', label: 'Read messages with the care team', view: true, act: true },
    { key: 'chat_send', kind: 'do', label: 'Message the care team', act: true },
  ] },
  { area: 'Profile', items: [
    { key: 'wearables', label: 'See wearable activity', view: true, act: true },
    { key: 'profile', kind: 'do', label: 'Edit contact details and insurance', act: false },
    { key: 'account', label: 'Password and login', locked: 'Patient only' },
    { key: 'family', label: 'Add or remove family members', locked: 'Patient only' },
  ] },
];

export const ALL_FEATURES = APP_FEATURES.flatMap(g => g.items);

export const RESTRICTED_SECTIONS = [
  { icon: 'solar:document-text-linear', label: 'Advance Directives and living will', rule: 'Only Legal Guardians and Health Care Agents can see them.' },
  { icon: 'solar:shield-user-linear', label: 'Teens\u2019 private care', rule: 'Behavioral health, sexual and reproductive health, substance use and STI testing.' },
  { icon: 'solar:eye-closed-linear', label: 'Anything staff hide from family', rule: 'Hidden from every family member.' },
];

// What each level gets in the Fold Care app.
export const DEFAULT_FEATURE_ACCESS = {
  default: Object.fromEntries(ALL_FEATURES.filter(f => !f.locked && !f.required).map(f => [f.key, { view: !!f.view, act: !!f.act }])),
};

/** A saved row merged over the defaults, so missing keys get today's defaults. */
export function withDefaults(saved = {}) {
  const fa = saved.familyAccess || {};
  return {
    familyAccess: {
      ...DEFAULT_FAMILY_ACCESS,
      ...fa,
      ageRules: {
        ...DEFAULT_FAMILY_ACCESS.ageRules,
        ...(fa.ageRules || {}),
        states: fa.ageRules?.states?.length ? fa.ageRules.states : DEFAULT_FAMILY_ACCESS.ageRules.states,
      },
      consent: { ...DEFAULT_FAMILY_ACCESS.consent, ...(fa.consent || {}) },
      // Saved rows only carry what admins change; labels and notes come from here.
      relations: DEFAULT_FAMILY_ACCESS.relations.map((r) => {
        const saved = (fa.relations || []).find(x => x.key === r.key);
        return saved ? { ...r, allowed: saved.allowed ?? r.allowed, level: saved.level ?? r.level } : r;
      }),
    },
    featureAccess: {
      default: Object.fromEntries(Object.entries(DEFAULT_FEATURE_ACCESS.default)
        .map(([k, v]) => [k, { ...v, ...(((saved.featureAccess || {}).default || {})[k] || {}) }])),
    },
  };
}
