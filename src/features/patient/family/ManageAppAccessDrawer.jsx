import { useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Banner } from '../../../components/Banner/Banner';
import { Avatar } from '../../../components/Avatar/Avatar';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Icon } from '../../../components/Icon/Icon';
import { Link } from '../../../components/Link/Link';
import { Select } from '../../../components/Select/Select';
import { Textarea } from '../../../components/Textarea/Textarea';
import { DatePicker } from '../../../components/DatePicker/DatePicker';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { relationParts } from './familyMembers';
import {
  ACCESS_LEVELS, accessLists, CONSENT_METHODS, accessStatusOf, defaultLevelOf,
  fixedBasisOf, needsConsent, statusAfterSave,
} from './familyAccess';
import { AppAccessConsentDrawer } from './AppAccessConsentDrawer';
import { AppAccessHistoryDrawer } from './AppAccessHistoryDrawer';
import styles from './ManageAppAccessDrawer.module.css';

const todayIso = () => new Date().toISOString().slice(0, 10);
const firstOf = (name) => String(name || '').trim().split(/\s+/)[0] || '';
const LEVEL_LABELS = { none: 'No Access', view: 'View Only', act: 'Act on Behalf' };
const REASON_MAX = 150;
const newDocumentId = () => `pdoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Manage App Access (FCS-4729 Story 2, AC7–AC11; Story 5, AC39; Figma
 * Mar-Present 2026 5232:40499). The access level, what it means (can /
 * cannot), how the patient's consent is collected, an optional end date and
 * a reason. Staff Recorded Consent opens App Access Consent; what it records
 * shows as a card here and is saved with Save.
 *
 * Act on behalf for a parent of a minor, or a decision maker with a Legal
 * Authority document, is set by staff alone: no consent needed (AC10).
 */
export function ManageAppAccessDrawer({ patient, member, onClose }) {
  const patientId = String(patient.id);
  const updateFamilyMember = useAppStore(s => s.updateFamilyMember);
  const recordFamilyConsent = useAppStore(s => s.recordFamilyConsent);
  const logFamilyAccessEvent = useAppStore(s => s.logFamilyAccessEvent);
  const addProgramDocument = useAppStore(s => s.addProgramDocument);
  const me = useAppStore(s => s.currentUserProfile?.name) || null;

  const fixedBasis = fixedBasisOf(member, patient);
  const neverSet = member.accessLevel === 'none' && (member.accessStatus || 'not_invited') === 'not_invited';
  // A legal authority (decision maker with a Legal Authority document) is
  // always Act on behalf and can't be changed here (Figma Jan-present 2026
  // 3067:16249).
  const locked = fixedBasis === 'legal_authority';
  // A request waiting for the patient's consent (no access yet, AC11). Staff
  // start on the requested level: keep it and record consent to complete it,
  // pick another level to replace it, or No Access to withdraw it.
  const pending = accessStatusOf(member) === 'pending_consent';
  const [level, setLevel] = useState(locked ? 'act' : neverSet ? defaultLevelOf(member, patient) : member.accessLevel);
  const withdrawing = pending && level === 'none';
  // Where they stand now, as one sentence above Access Level. Nothing for
  // someone never given access.
  const statusNow = accessStatusOf(member);
  const savedLevel = LEVEL_LABELS[member.accessLevel];
  const stateLine = member.accessLevel === 'none' || statusNow === 'not_invited' ? null : {
    pending_consent: { tone: 'warning', icon: 'solar:clock-circle-linear', text: `${savedLevel} request pending patient consent.` },
    invited: { tone: 'info', icon: 'solar:letter-linear', text: `${savedLevel} access is set. Waiting for the member to accept the invite.` },
    active: { tone: 'success', icon: 'solar:check-circle-linear', text: `${savedLevel} access is active.` },
    declined: { tone: 'danger', icon: 'solar:close-circle-linear', text: `The patient declined ${savedLevel} access.` },
    removed: { tone: 'info', icon: 'solar:info-circle-linear', text: `${savedLevel} access has ended.` },
    paused: { tone: 'warning', icon: 'solar:pause-circle-linear', text: `${savedLevel} access is paused: the decision maker role or Legal Authority document was removed.` },
  }[statusNow] || null;
  const [endsOn, setEndsOn] = useState(member.accessEndsOn || '');
  const [method, setMethod] = useState('');
  const [consent, setConsent] = useState(null); // what App Access Consent recorded
  const [recording, setRecording] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  // The full matrix is on demand; the summary sentence says what matters.
  const [showAll, setShowAll] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const basis = level !== 'none' && fixedBasis ? fixedBasis : 'consent';
  const consentNeeded = needsConsent(level, basis, patient);
  // Consent already given covers the same level or a lower one.
  const alreadyConsented = member.consentStatus === 'accepted'
    && (member.accessLevel === level || (member.accessLevel === 'act' && level === 'view'));
  const askingConsent = consentNeeded && !alreadyConsented;
  const proxyFirst = firstOf(member.name) || 'They';
  const patientFirst = firstOf(patient.name) || 'The patient';

  // Staff Recorded Consent is recorded here, in App Access Consent.
  const recordedAs = !!CONSENT_METHODS.find(m => m.value === method)?.recorded;
  const blocked = askingConsent && !method ? 'Pick a consent method'
    : askingConsent && recordedAs && !consent ? 'Record the patient’s consent'
      : null;
  const unchanged = !neverSet && level === member.accessLevel && endsOn === (member.accessEndsOn || '') && !method && !reason.trim();

  const pickMethod = (v) => {
    setMethod(v);
    if (CONSENT_METHODS.find(m => m.value === v)?.recorded && !consent) setRecording(true);
  };

  const save = async () => {
    if (blocked || saving) return;
    setSaving(true);
    const staffRecorded = askingConsent && recordedAs && consent;
    if (staffRecorded) {
      let documentId = null;
      if (consent.file) {
        const ext = (/\.([a-z0-9]+)$/i.exec(consent.file.name) || [])[1]?.toLowerCase() || null;
        documentId = newDocumentId();
        addProgramDocument({
          id: documentId, programCode: null, patientId,
          name: consent.file.name, type: 'Consent', category: 'form',
          sizeBytes: consent.file.size, updatedBy: me || 'You',
          updatedDate: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          createdAt: new Date().toISOString(), ext,
        }, consent.file);
      }
      const ok = await recordFamilyConsent({
        familyMemberId: member.id, patientId, proxyName: member.name, level,
        method: consent.method, outcome: consent.outcome, documentId, note: consent.note,
      });
      if (!ok) { setSaving(false); toast.error('The consent could not be recorded. Try again.'); return; }
    }
    const declined = staffRecorded && consent.outcome === 'declined';
    const consentRecorded = alreadyConsented || (staffRecorded && !declined);
    const ok = await updateFamilyMember(patientId, member.id, {
      accessLevel: level,
      accessBasis: basis,
      accessEndsOn: level === 'none' ? '' : endsOn,
      accessNote: reason.trim(),
      consentStatus: !consentNeeded ? 'not_needed' : declined ? 'declined' : consentRecorded ? 'accepted' : 'pending',
      // Withdrawing a pending request leaves them as if never invited.
      accessStatus: declined ? 'declined' : withdrawing ? 'not_invited' : statusAfterSave(member, { level, consentNeeded, consentRecorded }),
      accessUpdatedBy: me,
      accessUpdatedAt: new Date().toISOString(),
    });
    setSaving(false);
    if (!ok) { toast.error('App access could not be saved. Try again.'); return; }
    // App Access History: what this Save did, in order.
    const base = { patientId, memberId: member.id, memberName: member.name, note: reason.trim() };
    const from = member.accessLevel;
    if (level !== from) {
      const action = level === 'none' ? (pending ? 'withdrawn' : (from === 'none' ? null : 'removed'))
        : from === 'none' || neverSet ? 'requested' : 'changed';
      if (action) await logFamilyAccessEvent({ ...base, action, fromLevel: from, toLevel: level, method: consentNeeded ? method || null : null });
    } else if (endsOn !== (member.accessEndsOn || '') || reason.trim()) {
      await logFamilyAccessEvent({ ...base, action: 'changed', fromLevel: from, toLevel: level });
    }
    if (staffRecorded) {
      await logFamilyAccessEvent({
        ...base, action: declined ? 'declined' : 'consent_recorded', toLevel: level,
        method: consent.method, note: consent.note || '',
      });
    }
    onClose();
  };

  const represents = basis === 'legal_authority' || basis === 'minor_parent';
  const lists = accessLists(level, basis);
  const summaryText = level === 'none'
    ? 'The member stays on the family list but can\u2019t open the record in the Fold Care app.'
    : level === 'view'
      ? 'The member can see the record (appointments, care plan, labs, documents, messages) but can\u2019t take any actions.'
      : `The member can see everything and act for the patient: book visits, fill in forms, message the care team.${represents ? ' The member can also sign forms and accept third-party consent.' : ''}`;
  // Why the patient isn't asked (spec section 4).
  const noConsentLabel = level === 'none' ? 'Not Needed: No Access'
    : basis === 'legal_authority' ? 'Not Needed: Legal Authority'
      : basis === 'minor_parent' ? 'Not Needed: Parent of a Minor'
        : alreadyConsented ? 'Already Consented'
          : 'Not Needed';
  const consentNote = basis === 'legal_authority' ? 'Only staff can change this access: it comes from a Legal Authority document.'
    : basis === 'minor_parent' ? 'As the parent of a minor, consent isn\u2019t needed and only staff can change this access.'
      : 'The patient can also change this in the Fold Care app.';
  const methodOptions = CONSENT_METHODS.map(m => ({
    value: m.value,
    triggerLabel: m.label,
    label: (
      <span className={styles.option}>
        <span>{m.label}</span>
        <span className={styles.optionHint}>{m.hint}</span>
      </span>
    ),
  }));

  return (
    <>
      <Drawer
        title="Manage App Access"
        onClose={onClose}
        headerRight={(
          <>
            <ActionButton icon="solar:history-linear" tooltip="App Access History" onClick={() => setShowHistory(true)} />
            <span className={styles.headerDivider} aria-hidden="true" />
          </>
        )}
        primaryAction={(
          <Button onClick={save} disabled={!!blocked || saving || unchanged} disabledReason={blocked || (unchanged ? 'No changes to save' : undefined)}>
            Save
          </Button>
        )}
        banner={(
          <div className={styles.banner}>
            <Avatar variant={member.relatedPatientId ? 'patient' : 'others'} size="M" initials={member.initials} />
            <div className={styles.bannerText}>
              <span className={styles.bannerName}>{member.name}</span>
              <span className={styles.bannerMeta}>{relationParts(member).join(' • ')}</span>
            </div>
          </div>
        )}
      >
        <div className={styles.body}>
          {locked && (
            <Banner size="sm" tone="warning" icon="solar:info-circle-linear">
              This user cannot have their access level updated as they are a legal authority with “act on behalf” access.
            </Banner>
          )}
          {/* Where they stand now, before staff decide what to change. */}
          {stateLine && !locked && (
            <Banner
              size="sm"
              tone={stateLine.tone}
              icon={stateLine.icon}
            >
              {stateLine.text}
              {/* Fixed for a pending request, whichever option is picked. */}
              {pending && <strong className={styles.saveEffect}> Updating Access withdraws it.</strong>}
            </Banner>
          )}
          <section className={styles.section}>
            <h3 className={styles.heading}>Access Level</h3>
            <p className={styles.description}>
              {locked
                ? `${proxyFirst} is ${patientFirst}\u2019s ${member.authorityType || 'legal authority'} with a Legal Authority document, so ${proxyFirst} acts on ${patientFirst}\u2019s behalf in the Fold Care app.`
                : consentNote}
            </p>
            <div className={styles.radios} role="radiogroup" aria-label="Access level">
              {Object.keys(ACCESS_LEVELS).map(v => (
                <RadioButton key={v} name="app-access-level" label={LEVEL_LABELS[v]} checked={level === v} disabled={locked} onChange={() => setLevel(v)} />
              ))}
            </div>
          </section>

          <section className={styles.matrix}>
            <div className={styles.matrixSummary}>
              <h3 className={styles.panelHeading}>{locked ? 'This access level means:' : 'Selecting this access level means:'}</h3>
              <p className={styles.summaryText}>{summaryText}</p>
              {level !== 'none' && <Link className={styles.toggle} onClick={() => setShowAll(v => !v)} aria-expanded={showAll}>
                {showAll ? 'Hide permissions' : 'See all permissions'}
                <Icon name={showAll ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={12} color="currentColor" />
              </Link>}
            </div>
            {showAll && level !== 'none' && (
              <div className={styles.canCannot}>
                {[['Member Can', lists.can, true], ['Member Cannot', lists.cannot, false]].map(([title, items, allowed]) => (
                  <div key={title} className={`${styles.canColumn} ${allowed ? styles.canYes : styles.canNo}`}>
                    <span className={styles.canTitle}>
                      <Icon name={allowed ? 'solar:check-circle-linear' : 'solar:close-circle-linear'} size={16} color={allowed ? 'var(--status-success)' : 'var(--status-error)'} />
                      {title}
                    </span>
                    <ul className={styles.list}>
                      {items.map(t => <li key={t}>{t}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {!locked && (
            <>
              {level !== 'none' && (
                <div className={`${styles.grid} ${styles.gridSpaced}`}>
                  {askingConsent ? (
                    <Select
                      label="Consent Method For Access Update"
                      required
                      options={methodOptions}
                      value={method}
                      onValueChange={pickMethod}
                      placeholder="Select Consent Method"
                    />
                  ) : (
                    <Select
                      label="Consent Method For Access Update"
                      disabled
                      options={[{ value: 'n/a', label: noConsentLabel }]}
                      value="n/a"
                      onValueChange={() => {}}
                    />
                  )}
                  <DatePicker label="Access End Date" value={endsOn} onSelect={setEndsOn} min={todayIso()} placeholder="Select Date" disabled={level === 'none'} />
                </div>
              )}

              {askingConsent && recordedAs && consent && (
                <div className={styles.consentCard}>
                  <span className={consent.outcome === 'declined' ? styles.consentIconDeclined : styles.consentIcon}>
                    <Icon name={consent.outcome === 'declined' ? 'solar:dislike-linear' : 'solar:like-linear'} size={16} color="currentColor" />
                  </span>
                  <div className={styles.consentText}>
                    <span className={styles.consentTitle}>{consent.outcome === 'declined' ? 'Consent Declined' : 'Consent Provided'}</span>
                    <span className={styles.consentMeta}>
                      {[({ written: 'Written', verbal: 'Verbal', not_required: 'Not Required' })[consent.method], consent.file?.name, `Recorded by ${me || 'you'}`].filter(Boolean).join(' • ')}
                    </span>
                  </div>
                  <ActionButton icon="solar:pen-linear" size="sm" tooltip="Edit consent" tooltipLeft onClick={() => setRecording(true)} />
                </div>
              )}

              <Textarea
                title="Reason"
                rows={2}
                maxLength={REASON_MAX}
                value={reason}
                onValueChange={v => setReason(v.slice(0, REASON_MAX))}
                placeholder="Enter Reason"
              />
            </>
          )}
        </div>
      </Drawer>
      {showHistory && (
        <AppAccessHistoryDrawer patient={patient} memberName={member.name} onClose={() => setShowHistory(false)} />
      )}
      {recording && (
        <AppAccessConsentDrawer
          patient={patient}
          member={member}
          level={level}
          initial={consent}
          onSave={(c) => { setConsent(c); setRecording(false); }}
          onClose={() => { setRecording(false); if (!consent) setMethod(''); }}
        />
      )}
    </>
  );
}
