import { Fragment, useEffect, useMemo, useState, useRef } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { Link } from '../../../components/Link/Link';
import { Badge } from '../../../components/Badge/Badge';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { Banner } from '../../../components/Banner/Banner';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { UploadDropField } from '../../../components/UploadDropField/UploadDropField';
import { AddIconMinimalist } from '../../../components/Icon/AddIconMinimalist';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { PersonOption } from '../../messages/comms/PersonOption';
import { personMeta } from '../../messages/comms/sendTo';
import { categoryOf } from '../right-panel/tabs/documents/documentsData';
import {
  RELATIONSHIPS, DECISION_MAKER_ROLES, AUTHORITY_TYPES, LEGAL_AUTHORITY_CATEGORY, LEGAL_AUTHORITY_TYPE,
  resolveMember,
  profileEntryToMember, relationParts,
} from './familyMembers';
import { FamilyMemberMenu } from './FamilyMemberMenu';
import { AppAccessIcon } from './AppAccessIcon';
import { needsConsent } from './familyAccess';
import { ManageAppAccessDrawer } from './ManageAppAccessDrawer';
import { AppAccessHistoryDrawer } from './AppAccessHistoryDrawer';
import styles from './AddFamilyDrawer.module.css';

const MAX_BYTES = 5 * 1024 * 1024;
const EMPTY_FORM = {
  mode: 'search', // 'search' | 'member' (a Fold member) | 'new' (someone outside Fold)
  relatedPatientId: '', name: '', relationship: '', email: '', phone: '', additionalPhones: [],
  isCaregiver: false, isEmergencyContact: false, decisionMaker: null, authorityType: null, documentIds: [],
};
const extOf = (name) => (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1]?.toLowerCase() || null;
const today = () => new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

/** The Add Relatives form filled from a saved family person, to edit them. */
const formFromMember = (m) => ({
  ...EMPTY_FORM,
  mode: m.relatedPatientId ? 'member' : 'new',
  relatedPatientId: m.relatedPatientId ? String(m.relatedPatientId) : '',
  name: m.name || '', relationship: m.relationship || '', email: m.email || '', phone: m.phone || '',
  additionalPhones: m.additionalPhones || [], isCaregiver: !!m.isCaregiver, isEmergencyContact: !!m.isEmergencyContact,
  decisionMaker: m.decisionMaker || null, authorityType: m.authorityType || null, documentIds: m.documentIds || [],
});

function Card({ title, children }) {
  return (
    <div className={styles.card}>
      <span className={styles.cardTitle}>{title}</span>
      {children}
    </div>
  );
}

function RequiredLabel({ children }) {
  return <span className={styles.subLabel}>{children}<span className={styles.req} aria-hidden="true" /></span>;
}

/** Add a Legal Authority document to the patient's Documents (inline card). */
function NewDocumentCard({ patientId, onSaved, onCancel }) {
  const addProgramDocument = useAppStore(s => s.addProgramDocument);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [fieldKey, setFieldKey] = useState(0);
  const pick = (f) => {
    if (f && f.size > MAX_BYTES) {
      toast.error('That file is over 5 MB. Choose a smaller one.');
      setFieldKey(k => k + 1);
      return;
    }
    setFile(f);
    if (f && !caption) setCaption(f.name.replace(/\.[^.]+$/, ''));
  };
  const save = () => {
    if (!file || !caption.trim()) return;
    const ext = extOf(file.name);
    const id = `pdoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addProgramDocument({
      id, programCode: null, patientId: String(patientId),
      name: ext ? `${caption.trim()}.${ext}` : caption.trim(),
      type: LEGAL_AUTHORITY_TYPE, category: LEGAL_AUTHORITY_CATEGORY,
      sizeBytes: file.size, updatedBy: useAppStore.getState().currentUserProfile?.name || 'You',
      updatedDate: today(), createdAt: new Date().toISOString(), ext,
    }, file);
    onSaved(id);
  };
  return (
    <div className={styles.docCard}>
      <span className={styles.cardTitle}>Add New Document</span>
      <UploadDropField
        key={fieldKey}
        onChange={pick}
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        helperText="Supported formats: PDF, DOC, DOCX, PNG, JPG"
        secondaryText="Max size: 5 MB"
      />
      {file && (
        <div className={styles.docFields}>
          <Select label="Document Type" disabled options={[{ value: LEGAL_AUTHORITY_TYPE, label: LEGAL_AUTHORITY_TYPE }]} value={LEGAL_AUTHORITY_TYPE} onValueChange={() => {}} />
          <Input label="Caption" required value={caption} onChange={e => setCaption(e.target.value)} maxLength={80} />
        </div>
      )}
      <div className={styles.actions}>
        <Button size="sm" onClick={save} disabled={!file || !caption.trim()}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/**
 * Add Family, Caregivers & Decision Makers (Figma Mar-Present 2026
 * 4801:13694). Search Fold members first; "Not a Fold Member? Add Here"
 * (Jun-July 2025 1162:54280) opens the form for someone outside Fold. Add
 * saves the person straight away; they're listed under Family & Caregivers.
 *
 * `prefill` (from Send To's "+ Add email address"): opens on that person with
 * the Email field focused: `{ name, phone, type, familyId? }`. With a
 * `familyId` (already added), saving updates their email instead of adding
 * them again.
 */
export function AddFamilyDrawer({ patient, prefill = null, profileFamily: profileFamilyProp, editId = null, startAdding = false, onClose }) {
  const patientId = String(patient.id);
  const patients = useAppStore(s => s.allPatients) || [];
  const members = useAppStore(s => s.familyMembers[patientId]) || [];
  // Family from the patient's profile record (what the banner also lists).
  const storedProfile = useAppStore(s => s.p360ProfilesById[patientId] ?? s.p360ProfilesById[patient.id]);
  const profileFamily = profileFamilyProp ?? storedProfile?.family_members ?? [];
  const fetchFamilyMembers = useAppStore(s => s.fetchFamilyMembers);
  const addFamilyMember = useAppStore(s => s.addFamilyMember);
  const updateFamilyMember = useAppStore(s => s.updateFamilyMember);
  const logFamilyAccessEvent = useAppStore(s => s.logFamilyAccessEvent);
  const documents = useAppStore(s => s.programDocuments);
  const fetchProgramDocuments = useAppStore(s => s.fetchProgramDocuments);
  // Contact search lists every patient; opened from a patient page they may not be loaded yet.
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const patientsLoading = useAppStore(s => s.allPatientsLoading);
  useEffect(() => { fetchFamilyMembers(patientId); fetchProgramDocuments(); fetchAllPatients(); }, [patientId, fetchFamilyMembers, fetchProgramDocuments, fetchAllPatients]);

  // Opened from a row's ⋯ › Edit outside this drawer: start on that person.
  const editTarget = editId ? members.find(m => m.id === editId) : null;
  const [form, setForm] = useState(() => (editTarget ? formFromMember(editTarget) : prefill ? {
    ...EMPTY_FORM,
    mode: 'new',
    name: prefill.name || '',
    phone: prefill.phone || '',
    relationship: prefill.relationship || '',
    isCaregiver: prefill.type === 'Care Giver',
    isEmergencyContact: prefill.type === 'Emergency Contact',
  } : EMPTY_FORM));
  const updating = prefill?.familyId || null;
  // Opened to add an email: the cursor starts there.
  const emailRef = useRef(null);
  useEffect(() => {
    if (!prefill) return undefined;
    const t = setTimeout(() => emailRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [prefill]);
  const [addingDoc, setAddingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  // The Add Relatives card is open (Figma Mar-Present 2026 5215:37345).
  // `startAdding`: opened from an Add (+) button, so the Add Relatives card starts open.
  const [adding, setAdding] = useState(!!prefill || !!editTarget || startAdding);
  // The person being edited in that card (⋯ › Edit), or null when adding.
  const [editingId, setEditingId] = useState(editTarget?.id || null);
  const [rowMenu, setRowMenu] = useState(null);
  const [managing, setManaging] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const set = (patch) => setForm(f => ({ ...f, ...patch }));
  const closeCard = () => { setForm(EMPTY_FORM); setAddingDoc(false); setAdding(false); setEditingId(null); };
  const startEdit = (m) => {
    setForm(formFromMember(m));
    setAddingDoc(false);
    setEditingId(m.id);
    setAdding(true);
  };

  // A Fold member is listed once, and never the patient themself.
  const taken = new Set(members.map(m => String(m.relatedPatientId)).filter(Boolean));
  const memberOptions = useMemo(() => patients
    .filter(p => String(p.id) !== patientId && !taken.has(String(p.id)))
    .map(p => ({
      value: String(p.id),
      triggerLabel: p.name,
      searchText: `${p.name} ${p.memberId || ''}`,
      label: <PersonOption name={p.name} initials={p.initials} meta={personMeta(p)} />,
    })), [patients, patientId, members]); // eslint-disable-line react-hooks/exhaustive-deps

  const legalDocs = documents.filter(d => String(d.patientId) === patientId && categoryOf(d) === LEGAL_AUTHORITY_CATEGORY);
  const holder = form.decisionMaker ? members.find(m => m.decisionMaker === form.decisionMaker && m.id !== editingId) : null;
  const isNew = form.mode === 'new';
  const name = form.mode === 'member' ? (patients.find(p => String(p.id) === form.relatedPatientId)?.name || '') : form.name.trim();
  const canAdd = form.mode !== 'search' && !!name && !!form.relationship && !addingDoc && !saving
    && (!form.decisionMaker || (!!form.authorityType && form.documentIds.length > 0));
  const addBlocked = form.mode === 'search' ? 'Pick a contact or add someone'
    : !name ? 'Add a name' : !form.relationship ? 'Pick a relationship'
      : addingDoc ? 'Save or cancel the new document first'
        : form.decisionMaker && !form.authorityType ? 'Pick an authority type'
          : form.decisionMaker && !form.documentIds.length ? 'Pick a supporting document' : null;

  const add = async () => {
    if (updating) {
      setSaving(true);
      const ok = await updateFamilyMember(patientId, updating, { email: form.email.trim() });
      setSaving(false);
      if (!ok) { toast.error('The email could not be saved. Try again.'); return; }
      toast.success('Email Added Successfully');
      onClose();
      return;
    }
    if (!canAdd) return;
    if (editingId) {
      setSaving(true);
      // One holder per decision-maker role: the current one steps down first.
      if (holder) await updateFamilyMember(patientId, holder.id, { decisionMaker: null });
      const ok = await updateFamilyMember(patientId, editingId, {
        ...(form.mode === 'new' ? { name } : {}),
        relationship: form.relationship,
        ...(form.mode === 'new' ? {
          email: form.email.trim(), phone: form.phone.trim(),
          additionalPhones: form.additionalPhones.map(x => x.trim()).filter(Boolean),
        } : {}),
        isCaregiver: form.isCaregiver, isEmergencyContact: form.isEmergencyContact,
        decisionMaker: form.decisionMaker, authorityType: form.authorityType, documentIds: form.documentIds,
      });
      setSaving(false);
      if (!ok) { toast.error('These changes could not be saved. Try again.'); return; }
      toast.success('Family Member Updated Successfully');
      closeCard();
      return;
    }
    setSaving(true);
    const saved = await addFamilyMember(patientId, {
      ...form,
      name,
      relatedPatientId: form.mode === 'member' ? form.relatedPatientId : null,
      additionalPhones: form.additionalPhones.map(x => x.trim()).filter(Boolean),
    });
    setSaving(false);
    if (!saved) { toast.error('This person could not be added. Try again.'); return; }
    toast.success('Family Member Added Successfully');
    closeCard();
  };

  const toggleDoc = (id) => set({ documentIds: form.documentIds.includes(id) ? form.documentIds.filter(x => x !== id) : [...form.documentIds, id] });
  const setPhone = (i, v) => set({ additionalPhones: form.additionalPhones.map((x, j) => (j === i ? v : x)) });
  const preview = (d) => {
    const url = d.fileUrl || (d.file ? URL.createObjectURL(d.file) : null);
    if (url) window.open(url, '_blank', 'noopener');
    else toast.error('This document has no file to preview.');
  };

  // Profile people not yet saved here show too; changing them saves them to
  // the list first (FamilyMemberMenu).
  const addedNames = new Set(members.map(m => resolveMember(m, patients).name.toLowerCase()));
  const fromProfile = (profileFamily || [])
    .filter(f => f?.name && !addedNames.has(String(f.name).toLowerCase()))
    .map((f, i) => profileEntryToMember(f, i, patientId));
  const resolved = [...members.map(raw => resolveMember(raw, patients)), ...fromProfile];
  const shown = resolved;

  // Invite only once they have a level, by SMS when there's a phone, else email.
  const inviteChannel = (m) => (m.phone ? 'sms' : m.email ? 'email' : null);
  const inviteBlock = (m) => (m.accessLevel === 'none' ? 'Set an app access level first'
    : !inviteChannel(m) ? 'Add a phone number or email first' : null);
  const inviteItem = (m) => ({
    key: 'invite', icon: 'solar:letter-linear', label: m.invitedAt ? 'Resend Invite' : 'Invite to Access',
    hint: inviteBlock(m) ? undefined : (inviteChannel(m) === 'sms' ? 'By SMS' : 'By email'),
    disabled: !!inviteBlock(m), tooltip: inviteBlock(m) || undefined,
  });
  const invite = async (m) => {
    const consentPending = needsConsent(m.accessLevel, m.accessBasis, patient) && m.consentStatus !== 'accepted';
    const ok = await updateFamilyMember(patientId, m.id, {
      invitedAt: new Date().toISOString(),
      invitedVia: inviteChannel(m),
      accessStatus: consentPending ? 'pending_consent' : m.accessStatus === 'active' ? 'active' : 'invited',
    });
    if (ok) {
      logFamilyAccessEvent({ patientId, memberId: m.id, memberName: m.name, action: 'invited', toLevel: m.accessLevel, method: inviteChannel(m) });
      toast.success('Invite Recorded Successfully');
    }
    else toast.error('The invite could not be recorded. Try again.');
  };
  // The Add Relatives card: above the list when adding, in place of the
  // person's own card when editing them.
  const formCard = (
            <div className={styles.addCard}>
              <h4 className={styles.addTitle}>{editingId ? 'Edit Relative' : 'Add Relatives'}</h4>
              <div className={styles.grid}>
                {editingId && form.mode === 'member'
                  ? <Input label="Contact" value={name} disabled />
                  : isNew
                  ? <Input label="Name" required value={form.name} onChange={e => set({ name: e.target.value })} placeholder="Enter name" maxLength={80} />
                  : (
                    <Select
                      label="Contact"
                      searchable
                      leadingIcon="solar:magnifer-linear"
                      options={memberOptions}
                      value={form.relatedPatientId}
                      onValueChange={(id) => set({ mode: 'member', relatedPatientId: id })}
                      placeholder="Search Contacts"
                      searchPlaceholder="Search by name or member ID"
                      emptyText={() => (patientsLoading ? 'Loading contacts\u2026' : (
                        <span className={styles.notMember}>
                          <EmptyState size="sm" icon="solar:user-cross-linear">
                            <span className={styles.notMemberText}>
                              Not a Fold Member? <Link onClick={() => set({ mode: 'new' })}>Add Here</Link>
                            </span>
                          </EmptyState>
                        </span>
                      ))}
                    />
                  )}
                <Select label="Relationship" required options={RELATIONSHIPS.map(r => ({ value: r, label: r }))} value={form.relationship} onValueChange={v => set({ relationship: v })} placeholder="Select Relationship" />
                {isNew && <Input ref={emailRef} label="Email" type="email" value={form.email} onChange={e => set({ email: e.target.value })} placeholder="Enter email" />}
                {isNew && <Input label="Phone Number" type="tel" value={form.phone} onChange={e => set({ phone: e.target.value })} placeholder="Enter phone number" />}
              </div>
              {isNew && (
                <div className={styles.phones}>
                  {form.additionalPhones.length > 0 && <span className={styles.subLabel}>Additional Phone Numbers</span>}
                  {form.additionalPhones.map((v, i) => (
                    <div key={i} className={styles.phoneRow}>
                      <Input type="tel" value={v} onChange={e => setPhone(i, e.target.value)} placeholder="Enter phone number" aria-label={`Additional phone ${i + 1}`} />
                      <ActionButton icon="solar:trash-bin-trash-linear" tone="danger" size="sm" tooltip="Remove" tooltipLeft onClick={() => set({ additionalPhones: form.additionalPhones.filter((_, j) => j !== i) })} />
                    </div>
                  ))}
                  <Link className={styles.addLink} role="button" tabIndex={0} onClick={() => set({ additionalPhones: [...form.additionalPhones, ''] })}>
                    <AddIconMinimalist size={12} color="currentColor" />
                    Add Phone Numbers
                  </Link>
                </div>
              )}
              {isNew && !updating && !editingId && (
                <Link variant="secondary" className={styles.addLink} role="button" tabIndex={0} onClick={() => set({ mode: 'search', name: '', email: '', phone: '', additionalPhones: [] })}>
                  Search Fold members instead
                </Link>
              )}

              <Card title="Assign this relative as additional role:">
                <div className={styles.inline}>
                  <label className={styles.check}><Checkbox checked={form.isCaregiver} onCheckedChange={c => set({ isCaregiver: c === true })} />Caregiver</label>
                  <label className={styles.check}><Checkbox checked={form.isEmergencyContact} onCheckedChange={c => set({ isEmergencyContact: c === true })} />Emergency Contact</label>
                </div>
              </Card>

              <Card title="Mark this relative as a decision maker:">
                <div className={styles.inline}>
                  {DECISION_MAKER_ROLES.map(r => (
                    <RadioButton
                      key={r}
                      label={r === 'Decision Maker' ? 'Decision maker' : 'Alternate Decision maker'}
                      checked={form.decisionMaker === r}
                      // Clicking the picked one again clears it: being a decision maker is optional.
                      onChange={() => set(form.decisionMaker === r ? { decisionMaker: null } : { decisionMaker: r })}
                    />
                  ))}
                </div>
                {holder && (
                  <Banner icon="solar:info-circle-linear" size="sm" tone="warning">
                    {resolveMember(holder, patients).name} is the current {form.decisionMaker}. Adding {name || 'this person'} replaces them.
                  </Banner>
                )}
                {form.decisionMaker && (
                  <>
                    <RequiredLabel>Select Authority Type</RequiredLabel>
                    <div className={styles.inline}>
                      {AUTHORITY_TYPES.map(t => <RadioButton key={t} label={t} checked={form.authorityType === t} onChange={() => set({ authorityType: t })} />)}
                    </div>
                    <RequiredLabel>Select Supporting Documents</RequiredLabel>
                    {legalDocs.length > 0 && (
                      <div className={styles.docList}>
                        <span className={styles.docListTitle}>Select from Patient’s Legal Authority Documents:</span>
                        {legalDocs.map(d => (
                          <div key={d.id} className={styles.docRow}>
                            <label className={styles.check}><Checkbox checked={form.documentIds.includes(d.id)} onCheckedChange={() => toggleDoc(d.id)} />{d.name}</label>
                            <ActionButton icon="solar:eye-linear" size="sm" tooltip="Preview" tooltipLeft onClick={() => preview(d)} />
                          </div>
                        ))}
                      </div>
                    )}
                    {addingDoc
                      ? <NewDocumentCard patientId={patientId} onCancel={() => setAddingDoc(false)} onSaved={(id) => { setAddingDoc(false); set({ documentIds: [...form.documentIds, id] }); }} />
                      : (
                        <Link className={styles.addLink} role="button" tabIndex={0} onClick={() => setAddingDoc(true)}>
                          <AddIconMinimalist size={12} color="currentColor" />
                          Upload New Document
                        </Link>
                      )}
                  </>
                )}
              </Card>

              <div className={styles.actions}>
                {updating
                  ? <Button onClick={add} disabled={!form.email.trim() || saving} disabledReason={!form.email.trim() ? 'Add an email' : null}>Save</Button>
                  : <Button onClick={add} disabled={!canAdd} disabledReason={addBlocked}>{editingId ? 'Save' : 'Add'}</Button>}
                <Button variant="outline" onClick={closeCard}>Discard</Button>
              </div>
            </div>
  );

  return (
    <Drawer
      title="Add Family, Caregivers & Decision Makers"
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <ActionButton icon="solar:history-linear" tooltip="App Access History" onClick={() => setShowHistory(true)} />
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
    >
      <div className={styles.body}>
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>Family & Caregivers</h3>
            <div className={styles.headActions}>
              <Button variant="soft" size="sm" leadingIconElement={<AddIconMinimalist size={16} color="currentColor" />} disabled={adding} onClick={() => setAdding(true)}>Add Relatives</Button>
            </div>
          </div>

          {adding && !editingId && formCard}

          <div>
            {resolved.length === 0 ? (
              !adding && (
                <div className={styles.emptyCard}>
                  <EmptyState size="sm" icon="solar:user-heart-linear" title="No family or caregivers added" />
                </div>
              )
            ) : (
              <div className={styles.list}>
                {shown.map((m) => {
                  if (m.id === editingId) return <Fragment key={m.id}>{formCard}</Fragment>;
                  return (
                    <div key={m.id} className={`${styles.person} ${adding ? styles.listDimmed : ''}`}>
                      {m.relatedPatientId
                        ? <Avatar variant="patient" size="M" initials={m.initials} />
                        : <Tooltip label="Not a Fold Member"><Avatar variant="others" size="M" initials={m.initials} /></Tooltip>}
                      <div className={styles.personText}>
                        <span className={styles.personName}>{m.name}<AppAccessIcon member={m} /></span>
                        <span className={styles.personMeta}>
                          {[...relationParts(m), m.fromProfile && 'From profile'].filter(Boolean).map((part, i) => (
                            <Fragment key={part}>
                              {i > 0 && <span aria-hidden="true">•</span>}
                              <span className={part === 'Emergency Contact' ? styles.emergency : undefined}>{part}</span>
                            </Fragment>
                          ))}
                        </span>
                      </div>
                      <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More actions" tooltipLeft disabled={adding} onClick={(e) => setRowMenu({ member: m, rect: e.currentTarget.getBoundingClientRect() })} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
      {rowMenu && (
        <FamilyMemberMenu
          patient={patient}
          member={rowMenu.member}
          anchorRect={rowMenu.rect}
          onClose={() => setRowMenu(null)}
          onEdit={startEdit}
          onManageAccess={target => setManaging(target.id)}
          extraItems={[inviteItem(rowMenu.member)]}
          onExtra={(key, m) => { if (key === 'invite') invite(m); }}
        />
      )}
      {showHistory && <AppAccessHistoryDrawer patient={patient} onClose={() => setShowHistory(false)} />}
      {managing && (
        <ManageAppAccessDrawer
          patient={patient}
          member={resolveMember(members.find(x => x.id === managing) || {}, patients)}
          onClose={() => setManaging(null)}
        />
      )}
    </Drawer>
  );
}
