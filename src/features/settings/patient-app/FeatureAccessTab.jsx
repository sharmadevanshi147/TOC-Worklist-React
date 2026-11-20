import { Icon } from '../../../components/Icon/Icon';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { APP_FEATURES, RESTRICTED_SECTIONS } from './patientAppDefaults';
import { SettingGroup, SettingRow, SettingsCard } from './SettingsCard';
import styles from './PatientAppSettings.module.css';

/**
 * Feature Access (read only): what View only and Act on behalf family members
 * can use in the Fold Care app, a tick or a cross per level. `value` is the
 * featureAccess object ({ default }).
 */
export function FeatureAccessTab({ value, familyEnabled }) {
  const mark = (f, level) => {
    // Required rows are always on; View only can't take actions; Act on
    // behalf gets everything View only has.
    const viewOnlyAction = level === 'view' && f.kind === 'do';
    const inherited = level === 'act' && f.kind !== 'do' && !!value.default[f.key]?.view;
    const yes = !!f.required || (!viewOnlyAction && (inherited || !!value.default[f.key]?.[level]));
    const why = f.required ? 'Always on: family members need this to use the app'
      : viewOnlyAction ? 'View only family members can’t take actions' : null;
    const icon = (
      <span className={yes ? styles.yes : styles.no} aria-label={yes ? 'Yes' : 'No'}>
        <Icon name={yes ? 'solar:check-circle-linear' : 'solar:close-circle-linear'} size={16} />
      </span>
    );
    return <span className={styles.cellCenter}>{why ? <Tooltip label={why}>{icon}</Tooltip> : icon}</span>;
  };

  return (
    <div className={styles.page}>
      <SettingsCard
        title="What family members can use"
        description={familyEnabled
          ? 'What View only and Act on behalf family members can use in the Fold Care app. The patient always has everything with their own login. As the plan’s subscriber, an employee can always see ID cards for dependents on their plan, whatever their access level.'
          : 'Family access is turned off for your organization, so this doesn’t apply right now.'}
      >
        {APP_FEATURES.map(g => (
          <SettingGroup key={g.area}>
            {/* Each box's header row names its columns: the area, then the two levels. */}
            <div className={styles.featureGroupHead}>
              <span>{g.area}</span><span className={styles.cellCenter}>View only</span><span className={styles.cellCenter}>Act on behalf</span>
            </div>
            {g.items.map(f => (
              <div key={f.key} className={styles.featureRow}>
                <span className={styles.featureName}>{f.label}</span>
                {f.locked ? (
                  <span className={styles.locked}><Icon name="solar:lock-keyhole-minimalistic-linear" size={14} />{f.locked}</span>
                ) : (
                  <>{mark(f, 'view')}{mark(f, 'act')}</>
                )}
              </div>
            ))}
          </SettingGroup>
        ))}
      </SettingsCard>

      <SettingsCard title="Always hidden from family" description="These stay hidden from family members, whatever is shown above.">
        <SettingGroup>
          {RESTRICTED_SECTIONS.map(r => <SettingRow key={r.label} icon={r.icon} label={r.label} help={r.rule} />)}
        </SettingGroup>
      </SettingsCard>
    </div>
  );
}
