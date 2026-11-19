import { rowToAccess } from './familyAccess';

/**
 * A patient's family, caregivers and decision makers (patient_family_members).
 * One entry per person; Send To reads them as role contacts (familyToContacts).
 */

export const RELATIONSHIPS = [
  'Spouse', 'Partner', 'Mother', 'Father', 'Son', 'Daughter', 'Sister', 'Brother',
  'Grandparent', 'Grandchild', 'Guardian', 'Friend', 'Other',
];
export const DECISION_MAKER_ROLES = ['Decision Maker', 'Alternate Decision Maker'];
export const AUTHORITY_TYPES = ['Legal Guardian', 'Healthcare Agent'];
// The patient Documents tab folder that holds what backs a decision maker.
export const LEGAL_AUTHORITY_CATEGORY = 'legal_authority';
export const LEGAL_AUTHORITY_TYPE = 'Legal Authority';

export const rowToFamilyMember = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  relatedPatientId: r.related_patient_id || null,
  name: r.name,
  relationship: r.relationship,
  email: r.email || '',
  phone: r.phone || '',
  additionalPhones: r.additional_phones || [],
  isCaregiver: !!r.is_caregiver,
  isEmergencyContact: !!r.is_emergency_contact,
  decisionMaker: r.decision_maker || null,
  authorityType: r.authority_type || null,
  documentIds: r.document_ids || [],
  createdAt: r.created_at,
  ...rowToAccess(r),
});

export const familyMemberToRow = (m) => ({
  id: m.id,
  patient_id: String(m.patientId),
  related_patient_id: m.relatedPatientId ? String(m.relatedPatientId) : null,
  name: m.name,
  relationship: m.relationship,
  email: m.email || null,
  phone: m.phone || null,
  additional_phones: m.additionalPhones || [],
  is_caregiver: !!m.isCaregiver,
  is_emergency_contact: !!m.isEmergencyContact,
  decision_maker: m.decisionMaker || null,
  authority_type: m.decisionMaker ? m.authorityType : null,
  document_ids: m.decisionMaker ? (m.documentIds || []) : [],
  created_by: m.createdBy || null,
});

/** A person's roles, in display order. */
export const rolesOfMember = (m) => [
  m.isCaregiver && 'Care Giver',
  m.isEmergencyContact && 'Emergency Contact',
  m.decisionMaker,
].filter(Boolean);

const initialsOf = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

/**
 * The person as the banner and the drawer list show them. A Fold member's
 * details come from their own record, so they never go stale.
 */
export function resolveMember(m, patients = []) {
  const p = m.relatedPatientId ? patients.find(x => String(x.id) === String(m.relatedPatientId)) : null;
  return {
    ...m,
    name: p?.name || m.name,
    email: p?.email || m.email,
    phone: p?.phone || m.phone,
    dob: p?.dob || '',
    gender: p?.gender || '',
    initials: p?.initials || initialsOf(p?.name || m.name),
  };
}

/** One contact per role, the shape Send To and Protect links read. */
export function familyToContacts(members = [], patients = []) {
  return members.flatMap((raw) => {
    const m = resolveMember(raw, patients);
    return rolesOfMember(m).map(type => ({
      id: `${m.id}:${type}`, patientId: m.patientId, type,
      // The family record, and the Fold member behind it if any (to edit them).
      familyId: m.id, memberId: m.relatedPatientId || null,
      name: m.name, email: m.email, phone: m.phone, dob: m.dob, gender: m.gender,
    }));
  });
}

/**
 * A family entry from the patient's profile record (p360 `family_members`,
 * relation like "Sister (Caregiver)") in the family-list shape, not saved.
 */
export function profileEntryToMember(f, i, patientId) {
  const [, rel = '', roles = ''] = /^([^(]*)(?:\(([^)]*)\))?/.exec(String(f.relation || '')) || [];
  return {
    id: `profile-${i}`, fromProfile: true, patientId: String(patientId), name: f.name, initials: f.initials,
    relationship: rel.trim() || 'Other', phone: f.phone || '', email: f.email || '', phoneHours: f.phone_hours || '',
    isCaregiver: /caregiver/i.test(roles), isEmergencyContact: /emergency/i.test(roles),
    decisionMaker: null, documentIds: [], accessLevel: 'none', accessBasis: 'consent',
    accessStatus: 'not_invited', consentStatus: 'not_needed',
  };
}

/**
 * The relationship then each role, for the "Sister • Caregiver • Emergency
 * Contact" line. `legal: false` leaves out "(Legal Authority)" (the Summary
 * tab's compact rows).
 */
export const relationParts = (m, { legal = true } = {}) => [
  m.relationship,
  m.isCaregiver && 'Caregiver',
  // A decision maker backed by a Legal Authority document holds legal authority.
  m.decisionMaker && (legal && m.authorityType && (m.documentIds || []).length ? `${m.decisionMaker} (Legal Authority)` : m.decisionMaker),
  m.isEmergencyContact && 'Emergency Contact',
].filter(Boolean);
