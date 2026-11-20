import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionTitleBar } from '../../../components/SectionTitleBar/SectionTitleBar';
import { CardSkeleton } from '../../../components/CardSkeleton/CardSkeleton';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { withDefaults } from './patientAppDefaults';
import { FamilyAccessTab } from './FamilyAccessTab';
import { FeatureAccessTab } from './FeatureAccessTab';
import styles from './PatientAppSettings.module.css';

const TABS = [
  { key: 'family', label: 'Family Access' },
  { key: 'features', label: 'Feature Access' },
];

/** Settings > Patient App: changes on either tab save automatically, shortly after each edit. */
export function PatientAppSettings() {
  const [tab, setTab] = useState('family');
  const saved = useAppStore(s => s.patientAppSettings);
  const fetched = useAppStore(s => s.patientAppSettingsFetched);
  const fetchSettings = useAppStore(s => s.fetchPatientAppSettings);
  const saveSettings = useAppStore(s => s.savePatientAppSettings);
  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const base = useMemo(() => withDefaults(saved || {}), [saved]);
  // The screen edits a local copy; each change is saved after a short pause,
  // so typing (a payer name) saves once rather than per keystroke.
  const [draft, setDraft] = useState(null);
  const current = draft || base;
  const update = (key) => (fn) => setDraft(d => { const c = d || base; return { ...c, [key]: fn(c[key]) }; });
  const pending = useRef(null);

  useEffect(() => {
    if (!draft) return undefined;
    pending.current = draft;
    const t = setTimeout(async () => {
      pending.current = null;
      if (!(await saveSettings(draft))) toast.error('Your change could not be saved. Try again.');
    }, 600);
    return () => clearTimeout(t);
  }, [draft, saveSettings]);
  // Leaving the screen mid-pause still saves the last change.
  useEffect(() => () => { if (pending.current) saveSettings(pending.current); }, [saveSettings]);

  return (
    <div className={styles.wrapper}>
      <SectionTitleBar
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        actions={[]}
      />
      <div className={styles.scroll}>
        {!fetched ? (
          <div className={styles.page}><CardSkeleton count={3} /></div>
        ) : tab === 'family' ? (
          <FamilyAccessTab value={current.familyAccess} onChange={update('familyAccess')} />
        ) : (
          <FeatureAccessTab value={current.featureAccess} familyEnabled={current.familyAccess.enabled} />
        )}
      </div>
    </div>
  );
}
