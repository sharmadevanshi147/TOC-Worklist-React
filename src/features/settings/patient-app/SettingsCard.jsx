import { Icon } from '../../../components/Icon/Icon';
import styles from './PatientAppSettings.module.css';

/** One group of Patient App settings: a heading, then its rows. */
export function SettingsCard({ title, description, action, children }) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardHeading}>
          <h3 className={styles.cardTitle}>{title}</h3>
          {description && <p className={styles.cardDesc}>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * One setting: what it is and a short explanation on the left, its control on
 * the right, in a fixed-width column so every control lines up. `stacked`
 * puts the control under the text for wide controls. `icon` (Solar name)
 * sits before the label.
 */
export function SettingRow({ label, help, icon, children, stacked = false }) {
  return (
    <div className={stacked ? `${styles.settingRow} ${styles.stacked}` : styles.settingRow}>
      {icon && <span className={styles.settingIcon}><Icon name={icon} size={16} /></span>}
      <div className={styles.settingText}>
        <span className={styles.settingLabel}>{label}</span>
        {help && <span className={styles.settingHelp}>{help}</span>}
      </div>
      {children != null && <div className={styles.settingControl}>{children}</div>}
    </div>
  );
}

/**
 * A bordered box of rows inside a section, with an optional heading strip.
 * `aside` labels the control column (e.g. "Default level").
 */
export function SettingGroup({ title, aside, children }) {
  return (
    <div className={styles.group}>
      {title && (
        <div className={styles.groupHead}>
          <span className={styles.groupTitle}>{title}</span>
          {aside && <span className={styles.groupAside}>{aside}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
