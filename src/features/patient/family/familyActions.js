import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';

/** The patient-profile person saved into the family list, so it can be changed. */
export async function adoptProfileMember(patientId, m) {
  const saved = await useAppStore.getState().addFamilyMember(patientId, {
    relatedPatientId: null, name: m.name, relationship: m.relationship || 'Other', email: m.email || '', phone: m.phone || '',
    additionalPhones: [], isCaregiver: !!m.isCaregiver, isEmergencyContact: !!m.isEmergencyContact,
    decisionMaker: null, authorityType: null, documentIds: [],
    accessLevel: 'none', accessBasis: 'consent', accessStatus: 'not_invited', consentStatus: 'not_needed',
    _adopted: true,
  });
  if (!saved) toast.error(`${m.name} could not be added to the list. Try again.`);
  return saved;
}

/**
 * Withdraw a request still waiting for the patient's consent: the person goes
 * back to No access / Not invited, and App Access History records it.
 */
export async function withdrawAccessRequest(patientId, m, reason = '') {
  const store = useAppStore.getState();
  const ok = await store.updateFamilyMember(patientId, m.id, {
    accessLevel: 'none', accessBasis: 'consent', accessStatus: 'not_invited', consentStatus: 'not_needed',
    accessEndsOn: '', accessUpdatedBy: store.currentUserProfile?.name || null, accessUpdatedAt: new Date().toISOString(),
  });
  if (!ok) { toast.error('The request could not be withdrawn. Try again.'); return false; }
  await store.logFamilyAccessEvent({ patientId: String(patientId), memberId: m.id, memberName: m.name, action: 'withdrawn', fromLevel: m.accessLevel, toLevel: 'none', note: reason });
  toast.success('Request Withdrawn Successfully');
  return true;
}
