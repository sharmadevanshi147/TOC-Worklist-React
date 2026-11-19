import { Fragment, useEffect, useRef, useState } from 'react';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../../../components/Avatar/Avatar';
import { EmptyState } from '../../../../../components/EmptyState/EmptyState';
import { Icon } from '../../../../../components/Icon/Icon';
import { Link } from '../../../../../components/Link/Link';
import { AddIconMinimalist } from '../../../../../components/Icon/AddIconMinimalist';
import { PanelSection, PanelSectionDivider } from '../../../../../components/PanelSection/PanelSection';
import { useAppStore } from '../../../../../store/useAppStore';
import { useP360Profile } from '../../../right-panel/tabs/overview/cards/useP360Profile';
import { AddFamilyDrawer } from '../../../family/AddFamilyDrawer';
import { ManageAppAccessDrawer } from '../../../family/ManageAppAccessDrawer';
import { FamilyMemberMenu } from '../../../family/FamilyMemberMenu';
import { AppAccessHistoryDrawer } from '../../../family/AppAccessHistoryDrawer';
import { profileEntryToMember, relationParts, resolveMember, rolesOfMember } from '../../../family/familyMembers';
import { accessStatusOf } from '../../../family/familyAccess';
import { AppAccessIcon } from '../../../family/AppAccessIcon';
import { Tooltip } from '../../../../../components/Tooltip/Tooltip';
import styles from './CaregiverFamilyWidget.module.css';

const list = v => (Array.isArray(v) ? v.filter(Boolean) : []);
// Wide enough for Call and Email beside ⋯; narrower, they move into the menu.
const WIDE_ROW = 480;

/**
 * Family & Caregiver on the Summary tab (Figma Mar-Present 2026 5207:5897;
 * rows 3137:45720, ⋯ menu 5207:6597): the profile's family plus those added
 * in Add Family, Caregivers & Decision Makers, each with Call and Email (in
 * the ⋯ menu when the row is narrow) and a ⋯ menu. People whose app access was removed or declined sit behind
 * "View N Inactive".
 */
export function CaregiverFamilyWidget({ patient }) {
  const patientId = patient?.id;
  const key = patientId == null ? null : String(patientId);
  const profile = useP360Profile(patientId);
  const added = useAppStore(s => (key ? s.familyMembers[key] : null));
  const patients = useAppStore(s => s.allPatients) || [];
  const fetchFamilyMembers = useAppStore(s => s.fetchFamilyMembers);
  const openNumberCallPopover = useAppStore(s => s.openNumberCallPopover);
  const openCommsDrawer = useAppStore(s => s.openCommsDrawer);
  // The family drawer: null closed, true to add, or the id of the person to edit.
  const [drawer, setDrawer] = useState(null);
  const [managing, setManaging] = useState(null);
  const [menu, setMenu] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const cardRef = useRef(null);
  // The card mounts only once there are rows; observe it from then on.
  const hasRows = (added?.length || 0) + list(profile?.family_members).length > 0;
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= WIDE_ROW));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasRows]);
  useEffect(() => { if (key) fetchFamilyMembers(key); }, [key, fetchFamilyMembers]);

  const people = (added || []).map((raw) => {
    const m = resolveMember(raw, patients);
    return { ...m, inactive: ['removed', 'declined'].includes(accessStatusOf(m)) };
  });
  const named = new Set(people.map(p => p.name.toLowerCase()));
  const fromProfile = list(profile?.family_members)
    .filter(f => f.name && !named.has(String(f.name).toLowerCase()))
    .map((f, i) => ({ ...profileEntryToMember(f, i, key), inactive: false }));
  const family = [...people, ...fromProfile];
  const inactive = family.filter(m => m.inactive);
  const shown = showInactive ? family : family.filter(m => !m.inactive);
  const loading = profile === undefined || added === undefined;

  const call = (m, el) => openNumberCallPopover({ label: m.name, kind: m.relationship, number: m.phone }, { current: el });
  // The email drawer starts with them in Send To when they're one of the patient's contacts.
  const email = (m) => {
    const role = !m.fromProfile ? rolesOfMember(m)[0] : null;
    openCommsDrawer('email', { initial: { patient, ...(role ? { sendTo: [`${m.id}:${role}`] } : {}) } });
  };
  const contactItems = (m) => [
    { key: 'call', icon: 'solar:phone-linear', label: 'Call', disabled: !m.phone, tooltip: m.phone ? undefined : 'No phone number on record' },
    { key: 'email', icon: 'solar:letter-linear', label: 'Email', disabled: !m.email, tooltip: m.email ? undefined : 'No email address on record' },
  ];
  const managed = managing ? (added || []).find(x => x.id === managing) : null;

  return (
    <>
      <PanelSection
        title="Family & Caregiver"
        actions={patient ? (
          <>
            <ActionButton icon="solar:history-linear" size="sm" tooltip="App Access History" onClick={() => setShowHistory(true)} />
            <PanelSectionDivider />
            <ActionButton size="sm" tooltip="Add family and caregivers" onClick={() => setDrawer(true)}>
              <AddIconMinimalist size={16} color="var(--neutral-300)" />
            </ActionButton>
          </>
        ) : null}
      >
        {shown.length === 0 && !loading ? (
          <EmptyState icon="solar:user-heart-linear" title="No family or caregivers on file" size="sm" />
        ) : shown.length > 0 && (
          <div ref={cardRef} className={styles.card}>
            {shown.map(m => (
              <div key={m.id} className={`${styles.row} ${m.inactive ? styles.rowInactive : ''}`}>
                {m.relatedPatientId
                  ? <Avatar variant="patient" size="M" initials={m.initials} />
                  : <Tooltip label="Not a Fold Member"><Avatar variant="others" size="M" initials={m.initials} /></Tooltip>}
                <div className={styles.info}>
                  <span className={styles.nameRow}>
                    <span className={styles.name}>{m.name}</span>
                    <AppAccessIcon member={m} />
                  </span>
                  <span className={styles.meta}>
                    {relationParts(m, { legal: false }).map((part, i) => (
                      <Fragment key={part}>
                        {i > 0 && <span className={styles.dot} aria-hidden="true">•</span>}
                        <span className={part === 'Emergency Contact' ? styles.emergency : undefined}>{part}</span>
                      </Fragment>
                    ))}
                  </span>
                </div>
                <div className={styles.actions}>
                  {wide && (
                    <>
                      <ActionButton icon="solar:phone-linear" size="sm" tooltip={m.phone ? 'Call' : 'No phone number on record'} disabled={!m.phone} onClick={e => call(m, e.currentTarget)} />
                      <PanelSectionDivider />
                      <ActionButton icon="solar:letter-linear" size="sm" tooltip={m.email ? 'Email' : 'No email address on record'} disabled={!m.email} onClick={() => email(m)} />
                      <PanelSectionDivider />
                    </>
                  )}
                  <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More actions" tooltipLeft onClick={e => setMenu({ member: m, el: e.currentTarget, rect: e.currentTarget.getBoundingClientRect() })} />
                </div>
              </div>
            ))}
            {inactive.length > 0 && (
              <div className={styles.footer}>
                <Link className={styles.footerLink} onClick={() => setShowInactive(v => !v)}>
                  {showInactive ? 'Hide Inactive' : `View ${inactive.length} Inactive`}
                  <Icon name={showInactive ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-right-linear'} size={12} />
                </Link>
              </div>
            )}
          </div>
        )}
      </PanelSection>
      {menu && (
        <FamilyMemberMenu
          patient={patient}
          member={menu.member}
          anchorRect={menu.rect}
          onClose={() => setMenu(null)}
          onEdit={target => setDrawer(target.id)}
          onManageAccess={target => setManaging(target.id)}
          leadingItems={wide ? [] : contactItems(menu.member)}
          onExtra={(k, m) => { if (k === 'call') call(m, menu.el); else if (k === 'email') email(m); }}
        />
      )}
      {showHistory && <AppAccessHistoryDrawer patient={patient} onClose={() => setShowHistory(false)} />}
      {managed && (
        <ManageAppAccessDrawer patient={patient} member={resolveMember(managed, patients)} onClose={() => setManaging(null)} />
      )}
      {drawer && (
        <AddFamilyDrawer
          patient={patient}
          profileFamily={list(profile?.family_members)}
          editId={drawer === true ? null : drawer}
          startAdding={drawer === true}
          onClose={() => setDrawer(null)}
        />
      )}
    </>
  );
}
