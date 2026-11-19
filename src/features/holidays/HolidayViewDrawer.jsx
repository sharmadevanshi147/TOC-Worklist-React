import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { DetailFields } from '../../components/DetailFields/DetailFields';
import { Icon } from '../../components/Icon/Icon';
import { HolidayBadgeIcon } from '../../components/Icon/HolidayBadgeIcon';
import { Badge } from '../../components/Badge/Badge';
import { STATUS_TONE } from '../ooo/oooUtils';
import { holidayStatus, isPastHoliday } from './holidayUtils';
import styles from './holidays.module.css';

const bannerDate = (v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// When it runs: start date - end date.
const whenText = (h) => `${bannerDate(h.startAt)} - ${bannerDate(h.endAt)}`;

// A festive header that suits any holiday: the badge, its name, status and date on
// a soft green card, with sparkles drifting off to the right.
function HolidayBanner({ holiday: h }) {
  const status = holidayStatus(h, new Date());
  return (
    <div className={styles.banner}>
      <HolidayBadgeIcon size={32} />
      <span className={styles.bannerText}>
        <span className={styles.bannerHead}>
          <span className={styles.bannerName}>{h.name}</span>
          <Badge tone={STATUS_TONE[status]} size="sm" label={status} />
        </span>
        <span className={styles.bannerWhen}>{whenText(h)}</span>
      </span>
      <span className={styles.bannerSparkles} aria-hidden="true">
        <Icon name="solar:stars-minimalistic-linear" size={28} color="currentColor" className={styles.sparkleA} />
        <Icon name="solar:star-linear" size={14} color="currentColor" className={styles.sparkleB} />
        <Icon name="solar:stars-minimalistic-linear" size={18} color="currentColor" className={styles.sparkleC} />
        <Icon name="solar:star-linear" size={10} color="currentColor" className={styles.sparkleD} />
      </span>
    </div>
  );
}

/**
 * A holiday, read only: a festive banner (name, status, dates), then its
 * locations and auto reply. Edit (not for a past holiday)
 * opens the form.
 *
 * @param {object}   props
 * @param {object}   props.holiday
 * @param {function} [props.onEdit]  – (holiday) => void
 * @param {function} props.onClose
 */
export function HolidayViewDrawer({ holiday: h, onEdit, onClose }) {
  const canEdit = onEdit && !isPastHoliday(h, new Date());
  return (
    <Drawer
      title="View Holiday"
      width={640}
      onClose={onClose}
      noCloseDivider
      headerRight={canEdit ? (
        <>
          <Button variant="outline" leadingIcon="solar:pen-linear" onClick={() => onEdit(h)}>Edit</Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      ) : null}
    >
      <div className={styles.viewBody}>
        <HolidayBanner holiday={h} />
        <DetailFields
          title="Holiday Details"
          items={[
            {
              label: `Locations (${(h.locations || []).length})`,
              value: (h.locations || []).join(', '),
              full: true,
            },
          ]}
        />
        <DetailFields
          title="Auto Reply"
          items={[{ label: 'Auto Reply Message', value: h.autoReplyMessage, full: true }]}
        />
      </div>
    </Drawer>
  );
}
