import { Badge } from '../../../components/Badge/Badge';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { ACCESS_LEVELS, ACCESS_STATUS, accessStatusOf } from './familyAccess';
import styles from './AppAccessIcon.module.css';

// Every app access state except "never given access" gets an icon-only badge;
// the tooltip names the level and the status (AC6).
const todayIso = () => new Date().toISOString().slice(0, 10);
// 2026-10-01 → 10/01/2026, without a timezone shift.
const mdy = (iso) => { const [y, mo, d] = iso.split('-'); return `${mo}/${d}/${y}`; };

const STATUS_BADGE = {
  pending_consent: { icon: 'solar:clock-circle-linear', tone: 'warning' },
  invited: { icon: 'solar:letter-linear', tone: 'info' },
  declined: { icon: 'solar:close-circle-linear', tone: 'danger' },
  removed: { icon: 'solar:forbidden-circle-linear', tone: 'neutral' },
};

/**
 * Beside a family person's name, an xs badge for where their app access
 * stands: the phone-with-check once it's active (amber View only, green Act
 * on behalf), otherwise pending, invited, declined or ended. Nothing
 * for someone never given access.
 */
export function AppAccessIcon({ member: m }) {
  const status = accessStatusOf(m);
  const hasLevel = m.accessLevel === 'view' || m.accessLevel === 'act';
  if (!hasLevel || status === 'not_invited') return null;
  const level = ACCESS_LEVELS[m.accessLevel];
  const label = status === 'pending_consent' ? `${level} App Access requested, pending patient consent`
    : status === 'active' ? `${level} App Access active`
      : status === 'invited' ? `Member has been invited for ${level.toLowerCase()} access`
      : status === 'declined' ? `Patient Declined consent for ${level.toLowerCase()} access`
      // An end date that has passed ends access on its own; anything else was removed by staff.
      : status === 'removed' ? (m.accessEndsOn && m.accessEndsOn < todayIso()
        ? `${level} access ended on ${mdy(m.accessEndsOn)}`
        : `${level} access removed`)
      : `${level} · ${ACCESS_STATUS[status].label}`;
  const badge = STATUS_BADGE[status]
    || { icon: 'custom:phone-verified', tone: m.accessLevel === 'act' ? 'success' : 'warning' };
  return (
    <Tooltip label={label}>
      <span className={styles.badge}>
        <Badge size="xs" tone={badge.tone} icon={badge.icon} />
      </span>
    </Tooltip>
  );
}
