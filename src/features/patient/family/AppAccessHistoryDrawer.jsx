import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { ActivityLog } from '../../../components/ActivityLog/ActivityLog';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { useAppStore } from '../../../store/useAppStore';
import { ACCESS_LEVELS, accessStatusOf } from './familyAccess';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { ReasonDialog } from '../../../components/ReasonDialog/ReasonDialog';
import { withdrawAccessRequest } from './familyActions';
import { ConsentDocumentLink } from './ConsentDocumentLink';
import { Icon } from '../../../components/Icon/Icon';
import styles from './AppAccessHistoryDrawer.module.css';

const LEVEL = (l) => ACCESS_LEVELS[l] || ACCESS_LEVELS.none;
const METHOD = {
  fold_form: 'Sent to patient', staff: 'Staff recorded consent',
  verbal: 'Verbal', written: 'Written', not_required: 'Not required',
  sms: 'SMS', email: 'Email',
};

// Each action: its filter name, its line, and its rail icon. `full`: the line
// already names the member, so it isn't followed by "for [name]".
const ACTIONS = {
  member_added: { filter: 'Family list', icon: 'solar:user-plus-linear', tone: 'info', full: true, text: e => `${e.memberName} added to the family list` },
  member_removed: { filter: 'Family list', icon: 'solar:trash-bin-2-linear', tone: 'neutral', full: true, text: e => `${e.memberName} removed from the family list` },
  roles_changed: { filter: 'Family list', icon: 'solar:user-id-linear', tone: 'info', text: () => 'Roles updated' },
  details_updated: { filter: 'Family list', icon: 'solar:pen-linear', tone: 'info', text: () => 'Family details updated' },
  requested: { filter: 'Requested', icon: 'solar:clock-circle-linear', tone: 'warning', text: e => `${LEVEL(e.toLevel)} access requested` },
  changed: { filter: 'Changed', icon: 'solar:pen-linear', tone: 'info', text: e => (e.fromLevel && e.fromLevel !== e.toLevel ? `Access changed from ${LEVEL(e.fromLevel)} to ${LEVEL(e.toLevel)}` : `${LEVEL(e.toLevel)} access updated`) },
  consent_recorded: { filter: 'Consent', icon: 'solar:like-linear', tone: 'success', text: () => 'Consent recorded' },
  declined: { filter: 'Consent', icon: 'solar:close-circle-linear', tone: 'error', text: e => `Patient declined ${LEVEL(e.toLevel)} access` },
  invited: { filter: 'Invited', icon: 'solar:letter-linear', tone: 'info', text: () => 'Invite sent' },
  active: { filter: 'Active', icon: 'solar:check-circle-linear', tone: 'success', text: e => `${LEVEL(e.toLevel)} access active` },
  withdrawn: { filter: 'Ended or removed', icon: 'solar:undo-left-linear', tone: 'neutral', text: e => `Pending ${LEVEL(e.fromLevel)} request withdrawn` },
  removed: { filter: 'Ended or removed', icon: 'solar:forbidden-circle-linear', tone: 'neutral', text: e => `${LEVEL(e.fromLevel)} access removed` },
  ended: { filter: 'Ended or removed', icon: 'solar:calendar-mark-linear', tone: 'neutral', text: e => `${LEVEL(e.toLevel || e.fromLevel)} access ended` },
};
// Rail tile colour, as the shared icon avatar variants.
const TONE = { success: 'success', warning: 'warning', error: 'error', info: 'primary', neutral: 'others' };
const ACTION_FILTERS = [...new Set(Object.values(ACTIONS).map(a => a.filter))];

const dayLabel = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const dateText = (iso) => new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
const timeText = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * App Access History (FCS-4729): one patient's app access history across
 * every family member, newest first, grouped by day. `memberName` opens it
 * filtered to that person (from Manage App Access); clearing the chip shows
 * everyone, including people no longer on the family list.
 */
export function AppAccessHistoryDrawer({ patient, memberName = null, onClose }) {
  const patientId = String(patient.id);
  const events = useAppStore(s => s.familyAccessEvents[patientId]);
  const fetchFamilyAccessEvents = useAppStore(s => s.fetchFamilyAccessEvents);
  useEffect(() => { fetchFamilyAccessEvents(patientId); }, [patientId, fetchFamilyAccessEvents]);

  const [members, setMembers] = useState(memberName ? [memberName] : []);
  const [actions, setActions] = useState([]);
  const storedMembers = useAppStore(s => s.familyMembers[patientId]);
  const [menu, setMenu] = useState(null); // { member, rect }
  const [withdrawing, setWithdrawing] = useState(null); // member
  // Everyone on the family list, plus anyone in the history who has since left it.
  const memberOptions = useMemo(() => [...new Set([
    ...(storedMembers || []).map(m => m.name),
    ...(memberName ? [memberName] : []),
    ...(events || []).map(e => e.memberName),
  ])].filter(Boolean).sort(), [storedMembers, events, memberName]);


  const entries = useMemo(() => {
    const shown = (events || []).filter(e => (!members.length || members.includes(e.memberName))
      && (!actions.length || actions.includes(ACTIONS[e.action]?.filter)));
    // The latest request per member: only it can be withdrawn, and only while
    // the member is still pending at that level.
    const latestRequest = {};
    for (const e of events || []) if (e.action === 'requested' && !latestRequest[e.memberId]) latestRequest[e.memberId] = e.id;
    const openRequest = (e) => {
      if (e.action !== 'requested' || latestRequest[e.memberId] !== e.id) return null;
      const m = (storedMembers || []).find(x => x.id === e.memberId);
      return m && accessStatusOf(m) === 'pending_consent' && m.accessLevel === e.toLevel ? m : null;
    };
    const out = [];
    let day = null;
    for (const e of shown) {
      const a = ACTIONS[e.action] || { icon: 'solar:history-linear', tone: 'neutral', text: () => e.action };
      const label = dayLabel(e.at);
      if (label !== day) { out.push({ t: 'group', label }); day = label; }
      out.push({
        t: 'access',
        title: <span className={styles.title}>{a.full ? a.text(e) : `${a.text(e)} for ${e.memberName}`}</span>,
        date: dateText(e.at),
        time: timeText(e.at),
        by: e.actor || null,
        // The method (or, for family-list entries, the relationship).
        context: METHOD[e.method] || e.method || null,
        // A Written consent links its signed form, kept in the patient's Documents.
        outcome: e.documentId ? (
          <span className={styles.outcomeRow}>
            {e.note && <span>{e.note}</span>}
            <span className={styles.attachment}>
              <Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" />
              <ConsentDocumentLink documentId={e.documentId} name={e.documentName} />
            </span>
          </span>
        ) : (e.note || null),
        outcomeColor: 'var(--neutral-300)',
        trailing: openRequest(e) ? (
          <ActionButton
            icon="solar:menu-dots-linear"
            size="sm"
            tooltip="More actions"
            tooltipLeft
            onClick={ev => setMenu({ member: openRequest(e), rect: ev.currentTarget.getBoundingClientRect() })}
          />
        ) : null,
        icon: a.icon, avatarVariant: TONE[a.tone],
      });
    }
    return out;
  }, [events, members, actions, storedMembers]);

  return (
    <Drawer
      title="App Access History"
      onClose={onClose}
      // Filters in a band under the header, as in the other history drawers.
      banner={(
        <div className={styles.filters}>
          <FilterChip label="Member" size="S" options={memberOptions} selected={members} onChange={setMembers} searchable={memberOptions.length > 6} />
          <FilterChip label="Action" size="S" options={ACTION_FILTERS} selected={actions} onChange={setActions} />
        </div>
      )}
    >
      <div className={styles.body}>
        {events === undefined
          ? <p className={styles.loading}>Loading history…</p>
          : <ActivityLog flushTop entries={entries} emptyLabel={members.length || actions.length ? 'No access history matches these filters.' : 'No app access history yet.'} />}
      </div>
      {menu && (
        <MenuPopover
          anchorRect={menu.rect}
          ariaLabel="Request actions"
          width="auto"
          items={[{ key: 'withdraw', icon: 'solar:undo-left-linear', label: 'Withdraw Request' }]}
          onClose={() => setMenu(null)}
          onSelect={() => { setWithdrawing(menu.member); setMenu(null); }}
        />
      )}
      {withdrawing && (
        <ReasonDialog
          title="Withdraw this request?"
          description={`The pending ${ACCESS_LEVELS[withdrawing.accessLevel]} request for ${withdrawing.name} is cancelled, and they go back to No access.`}
          decision="fail"
          confirmLabel="Withdraw"
          standardReasons={['Requested by mistake', 'Wrong family member', 'Wrong access level', 'Patient or family asked to cancel']}
          notesPlaceholder="Add Note"
          onCancel={() => setWithdrawing(null)}
          onSubmit={async ({ code, freeText }) => {
            const reason = [code, freeText?.trim()].filter(Boolean).join(': ');
            await withdrawAccessRequest(patientId, withdrawing, reason);
            setWithdrawing(null);
          }}
        />
      )}
    </Drawer>
  );
}
