import { Icon } from '../../../components/Icon/Icon';
import { PhoneVerifiedIcon } from '../../../components/Icon/PhoneVerifiedIcon';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { ACCESS_LEVELS, ACCESS_STATUS, accessStatusOf } from './familyAccess';

// Every app access state except "never given access" gets an icon; the
// tooltip names the level and the status (AC6).
const STATUS_ICON = {
  pending_consent: { name: 'solar:clock-circle-linear', color: 'var(--status-warning)' },
  invited: { name: 'solar:letter-linear', color: 'var(--status-info)' },
  declined: { name: 'solar:close-circle-linear', color: 'var(--status-error)' },
  removed: { name: 'solar:forbidden-circle-linear', color: 'var(--neutral-300)' },
  paused: { name: 'solar:pause-circle-linear', color: 'var(--status-warning)' },
};

/**
 * Beside a family person's name: the phone-with-check once access is active
 * (amber View only, green Act on behalf), otherwise an icon for where the
 * access stands (pending, invited, declined, removed, paused). Nothing for
 * someone never given access.
 */
export function AppAccessIcon({ member: m, size = 14 }) {
  const status = accessStatusOf(m);
  const hasLevel = m.accessLevel === 'view' || m.accessLevel === 'act';
  if (!hasLevel || status === 'not_invited') return null;
  const label = `${ACCESS_LEVELS[m.accessLevel]} · ${ACCESS_STATUS[status].label}`;
  const icon = STATUS_ICON[status];
  return (
    <Tooltip label={label}>
      <span style={{ display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}>
        {icon
          ? <Icon name={icon.name} size={size} color={icon.color} />
          : <PhoneVerifiedIcon size={size} color={m.accessLevel === 'act' ? 'var(--status-success-bright)' : 'var(--status-warning)'} />}
      </span>
    </Tooltip>
  );
}
