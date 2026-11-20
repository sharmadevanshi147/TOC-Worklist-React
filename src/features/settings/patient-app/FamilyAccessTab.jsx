import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { US_STATES } from '../account/users/editUserForm';
import { SettingGroup, SettingRow, SettingsCard } from './SettingsCard';
import styles from './PatientAppSettings.module.css';

// A whole number kept between min and max; an empty or partial entry stays as typed until it's a number.
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
function NumberField({ value, min, max, unit, label, onChange }) {
  const n = Number(value) || min;
  return (
    <span className={styles.numberField}>
      <Input
        inputMode="numeric"
        aria-label={label}
        value={String(value)}
        trailingText={unit}
        onValueChange={(v) => { const d = v.replace(/\D/g, ''); onChange(d === '' ? '' : clamp(Number(d), min, max)); }}
        onStepUp={() => onChange(clamp(n + 1, min, max))}
        onStepDown={() => onChange(clamp(n - 1, min, max))}
      />
    </span>
  );
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
// Access levels are shown, not edited, here.
const LEVEL_BADGE = {
  none: { label: 'No access', tone: 'neutral' },
  view: { label: 'View only', tone: 'info' },
  act: { label: 'Act on behalf', tone: 'primary' },
};

/**
 * Family Access: who staff can give app access to, and the rules for consent
 * and minors. `value` is the familyAccess object; `onChange(fn)`
 * gets an updater for it.
 */
export function FamilyAccessTab({ value: fa, onChange }) {
  const set = (patch) => onChange(cur => ({ ...cur, ...patch }));
  const setAge = (patch) => onChange(cur => ({ ...cur, ageRules: { ...cur.ageRules, ...patch } }));
  const setStateRule = (id, patch) => setAge({ states: fa.ageRules.states.map(s => (s.id === id ? { ...s, ...patch } : s)) });

  const usedStates = new Set(fa.ageRules.states.map(s => s.state));
  const stateOptions = (current) => US_STATES.filter(s => s === current || !usedStates.has(s)).map(s => ({ value: s, label: s }));
  const d = fa.ageRules.default;

  const relationRow = (r) => (
    <SettingRow
      key={r.key}
      label={r.label}
      help={r.note}
    >
      <span className={styles.levelText}><Badge size="sm" {...LEVEL_BADGE[r.allowed ? r.level : 'none']} /></span>
    </SettingRow>
  );

  return (
    <div className={styles.page}>
      <SettingsCard
        title="Who can get access"
        description="View the default access level for users added to a patient's family and caregivers."
      >
        <SettingGroup title={<>These roles don&rsquo;t need the patient&rsquo;s consent to update access</>} aside="Default level">
          {fa.relations.filter(r => r.basis !== 'consent').map(relationRow)}
        </SettingGroup>
        <SettingGroup title={<>These roles need the patient&rsquo;s consent to update access</>} aside="Default level">
          {fa.relations.filter(r => r.basis === 'consent').map(relationRow)}
        </SettingGroup>
      </SettingsCard>

      {/* Read only: the org's consent rule, stated as a sentence. */}
      <SettingsCard
        title="Consent"
        description={fa.consent.requireAdults
          ? 'Adult patients must agree before a family member gets access.'
          : 'Adult patients don\u2019t need to agree before a family member gets access.'}
      />

      <SettingsCard
        title="Minors"
        description="Set the age rules for each state your patients live in. Check each state's ages with your legal team."
        action={(
          <Button variant="outline" size="sm" leadingIcon="solar:add-linear"
            onClick={() => setAge({ states: [...fa.ageRules.states, { id: newId(), state: '', ...d }] })}>
            Add State
          </Button>
        )}
      >
        <SettingGroup>
          <div className={styles.subRows}>
            <div className={`${styles.stateGrid} ${styles.subRowsHead}`}>
              <span>State</span><span>Adult at</span><span>Teen privacy from</span><span />
            </div>
            {fa.ageRules.states.map(st => (
              <div key={st.id} className={styles.stateGrid}>
                <Select searchable searchPlaceholder="Search state" placeholder="Pick a state"
                  options={stateOptions(st.state)} value={st.state} onValueChange={(v) => setStateRule(st.id, { state: v })} />
                <NumberField value={st.majority} min={16} max={21} unit="years" label={`${st.state || 'State'}: adult at`}
                  onChange={(v) => setStateRule(st.id, { majority: v })} />
                <NumberField value={st.privacyFrom === '' ? '' : (Number(st.privacyFrom) || 12)} min={10} max={17} unit="years" label={`${st.state || 'State'}: teen privacy from`}
                  onChange={(v) => setStateRule(st.id, { privacyFrom: v })} />
                <ActionButton icon="solar:trash-bin-minimalistic-linear" size="sm" tone="danger" tooltipLeft
                  disabled={fa.ageRules.states.length === 1}
                  tooltip={fa.ageRules.states.length === 1 ? 'Keep at least one state' : 'Remove state'}
                  onClick={() => setAge({ states: fa.ageRules.states.filter(s => s.id !== st.id) })} />
              </div>
            ))}
          </div>
        </SettingGroup>
        <SettingGroup>
          <SettingRow label="Remind them before" help="The patient and parent get a reminder this many days before the patient becomes an adult.">
            <NumberField value={fa.notifyDaysBeforeMajority} min={0} max={180} unit="days" label="Days before" onChange={(v) => set({ notifyDaysBeforeMajority: v })} />
          </SettingRow>
        </SettingGroup>
      </SettingsCard>
    </div>
  );
}
