import { useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { Textarea } from '../../../components/Textarea/Textarea';
import { UploadDropField } from '../../../components/UploadDropField/UploadDropField';
import { toast } from '../../../components/Toast/sonnerToast';
import { ageFromDobMdy } from '../../../lib/patientDisplay';
import { formatDobDisplay } from '../../../lib/patientDob';
import { ACCESS_LEVELS } from './familyAccess';
import styles from './AppAccessConsentDrawer.module.css';

const MAX_BYTES = 5 * 1024 * 1024;
const firstOf = (name) => String(name || '').trim().split(/\s+/)[0] || '';

/**
 * App Access Consent (Figma Mar-Present 2026 5232:39914): staff record the
 * patient's answer to giving a family member app access, opened from Manage
 * App Access › Consent Method › Staff Recorded Consent. Nothing is saved here;
 * `onSave({ outcome, method, file, note })` hands it back to Manage App Access,
 * whose Save records it.
 */
export function AppAccessConsentDrawer({ patient, member, level, initial = null, onSave, onClose }) {
  const proxy = firstOf(member.name) || member.name;
  const relation = (member.relationship || '').toLowerCase();
  const statements = [
    `I agree to ${member.name}${relation ? ` (my ${relation})` : ''} having ${ACCESS_LEVELS[level]} access to my record in the Fold Care app.`,
    `I understand what ${proxy} can see and do at this level, as it was explained to me.`,
    'I understand Patient-only forms, Advance Directive documents and anything my care team hides from family stay private.',
    `I understand anything ${proxy} does for me in the app is recorded under ${proxy}’s name.`,
    'I understand I can change or remove this access at any time in the Fold Care app or by calling my care team.',
  ];
  const [agreed, setAgreed] = useState(() => statements.map(() => initial?.outcome === 'accepted'));
  const [method, setMethod] = useState(initial?.method || '');
  const [file, setFile] = useState(initial?.file || null);
  const [fileKey, setFileKey] = useState(0);
  const [note, setNote] = useState(initial?.note || '');

  const all = agreed.every(Boolean);
  const some = agreed.some(Boolean);
  const setAll = (v) => setAgreed(statements.map(() => v));
  const toggle = (i, v) => setAgreed(a => a.map((x, j) => (j === i ? v : x)));

  // Not Required skips the statements: there's nothing for the patient to agree to.
  const blocked = !method ? 'Pick how consent was received'
    : method !== 'not_required' && !all ? 'Tick every statement'
      : method === 'written' && !file ? 'Upload the signed form'
        : null;

  const pickFile = (f) => {
    if (f && f.size > MAX_BYTES) {
      toast.error('That file is over 5 MB. Choose a smaller one.');
      setFileKey(k => k + 1);
      return;
    }
    setFile(f);
  };

  const dob = formatDobDisplay(patient.dob);
  const meta = ['Patient', patient.gender, dob && ageFromDobMdy(dob), patient.memberId && `#${patient.memberId}`].filter(Boolean);

  return (
    <Drawer
      title="App Access Consent"
      onClose={onClose}
      primaryAction={(
        <Button onClick={() => onSave({ outcome: 'accepted', method, file: method === 'written' ? file : null, note: note.trim() })} disabled={!!blocked} disabledReason={blocked}>
          Save
        </Button>
      )}
      banner={(
        <div className={styles.banner}>
          <Avatar variant="patient" size="M" initials={patient.initials} />
          <div className={styles.bannerText}>
            <span className={styles.bannerName}>{patient.name}</span>
            <span className={styles.bannerMeta}>
              {meta.map((x, i) => <span key={x}>{i > 0 && <span aria-hidden="true">• </span>}{x}</span>)}
            </span>
          </div>
        </div>
      )}
    >
      <div className={styles.body}>
        <section className={styles.section}>
          <h3 className={styles.heading}>Patient must consent and agree to the following:</h3>
          <label className={styles.checkStrong}>
            <Checkbox checked={all ? true : some ? 'indeterminate' : false} onCheckedChange={c => setAll(c === true)} />
            I consent and understand that giving {proxy} app access means:
          </label>
          <div className={styles.children}>
            {statements.map((t, i) => (
              <label key={t} className={styles.check}>
                <Checkbox checked={agreed[i]} onCheckedChange={c => toggle(i, c === true)} />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.heading}>Consent Received<span className={styles.req} aria-label="required" /></h3>
          <div className={styles.radios}>
            <RadioButton name="consent-received" label="Verbal" checked={method === 'verbal'} onChange={() => setMethod('verbal')} />
            <RadioButton
              name="consent-received"
              ariaLabel="Written (Add Supporting Document)"
              label={<>Written <span className={styles.labelHint}>(Add Supporting Document)</span></>}
              checked={method === 'written'}
              onChange={() => setMethod('written')}
            />
            <RadioButton name="consent-received" label="Not Required" checked={method === 'not_required'} onChange={() => setMethod('not_required')} />
          </div>
          {method === 'written' && (
            <UploadDropField key={fileKey} onChange={pickFile} initialFile={file} accept=".pdf,.png,.jpg,.jpeg" helperText="Upload the signed form: PDF, PNG or JPG" secondaryText="Max size: 5 MB" />
          )}
        </section>

        <section className={styles.sectionTight}>
          <h3 className={styles.heading}>Notes</h3>
          <Textarea rows={3} value={note} onValueChange={setNote} placeholder="Add Note" aria-label="Notes" />
        </section>
      </div>
    </Drawer>
  );
}
