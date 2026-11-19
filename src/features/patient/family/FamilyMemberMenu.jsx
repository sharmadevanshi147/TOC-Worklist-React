import { useState } from 'react';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { rolesOfMember } from './familyMembers';
import { adoptProfileMember } from './familyActions';

/**
 * A family row's ⋯ menu (Figma Mar-Present 2026 5207:6597): SMS, Edit,
 * Manage App Access, Mark / Unmark as caregiver, then Remove Member.
 * `member` may be a profile entry (`fromProfile`): it's saved to the family
 * list before anything changes it, and can't be removed from here.
 * `leadingItems` (first) and `extraItems` (after Manage App Access) add the
 * caller's own actions; `onExtra(key, member)` runs them.
 */
export function FamilyMemberMenu({ patient, member: m, anchorRect, onClose, onEdit, onManageAccess, leadingItems = [], extraItems = [], onExtra }) {
  const patientId = String(patient.id);
  const updateFamilyMember = useAppStore(s => s.updateFamilyMember);
  const removeFamilyMember = useAppStore(s => s.removeFamilyMember);
  const openCommsDrawer = useAppStore(s => s.openCommsDrawer);
  const [removing, setRemoving] = useState(false);

  const saved = async () => (m.fromProfile ? adoptProfileMember(patientId, m) : m);
  const items = [
    ...leadingItems,
    { key: 'sms', icon: 'solar:chat-square-linear', label: 'SMS', disabled: !m.phone, tooltip: m.phone ? undefined : 'No phone number on record' },
    { key: 'edit', icon: 'solar:pen-linear', label: 'Edit' },
    { key: 'access', icon: 'solar:shield-user-linear', label: 'Manage App Access' },
    ...extraItems,
    { key: 'caregiver', icon: 'solar:user-heart-linear', label: m.isCaregiver ? 'Unmark as caregiver' : 'Mark as caregiver' },
    { divider: true },
    {
      key: 'remove', icon: 'solar:trash-bin-2-linear', label: 'Remove Member', danger: true,
      disabled: !!m.fromProfile, tooltip: m.fromProfile ? 'From the patient’s profile record' : undefined,
    },
  ];

  const run = async (key) => {
    if (key === 'sms') {
      const role = !m.fromProfile ? rolesOfMember(m)[0] : null;
      openCommsDrawer('sms', { initialPatient: patient, ...(role ? { initialSendTo: [`${m.id}:${role}`] } : {}) });
    } else if (key === 'edit') {
      const target = await saved();
      if (target) onEdit?.(target);
    } else if (key === 'access') {
      const target = await saved();
      if (target) onManageAccess?.(target);
    } else if (key === 'caregiver') {
      const target = await saved();
      if (!target) return;
      const ok = await updateFamilyMember(patientId, target.id, { isCaregiver: !m.isCaregiver });
      if (ok) toast.success(m.isCaregiver ? 'Caregiver Unmarked Successfully' : 'Caregiver Marked Successfully');
      else toast.error('This change could not be saved. Try again.');
    } else if (key === 'remove') {
      setRemoving(true);
      return;

    } else {
      onExtra?.(key, m);
    }
    onClose();
  };

  return (
    <>
      {!removing && (
        <MenuPopover
          anchorRect={anchorRect}
          ariaLabel={`Actions for ${m.name}`}
          width="auto"
          items={items}
          onClose={onClose}
          onSelect={(key) => run(key)}
        />
      )}
      {removing && (
        <ConfirmDialog
          variant="destructive"
          title={`Remove ${m.name}?`}
          description="They're removed from this patient's family, caregivers and decision makers."
          confirmLabel="Remove"
          onCancel={() => { setRemoving(false); onClose(); }}
          onConfirm={async () => {
            const ok = await removeFamilyMember(patientId, m.id);
            if (ok) toast.success('Family Member Removed Successfully');
            else toast.error('This person could not be removed. Try again.');
            setRemoving(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
