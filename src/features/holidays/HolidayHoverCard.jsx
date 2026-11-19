import { useState } from 'react';
import { HoverCard } from '../../components/HoverCard/HoverCard';
import { Link } from '../../components/Link/Link';
import { Icon } from '../../components/Icon/Icon';
import { formatDate } from '../../lib/dateFormat';
import { HolidayDrawer } from './HolidayDrawer';
import { HolidayViewDrawer } from './HolidayViewDrawer';
import styles from './holidays.module.css';

const SHOWN = 5;

// The date(s) a holiday covers. It ends at midnight, so the end date
// itself isn't part of it: 12/25 00:00 to 12/26 00:00 is just 12/25.
const holidayDates = (h) => {
  const from = formatDate(h.startAt);
  const to = formatDate(new Date(new Date(h.endAt).getTime() - 1));
  return from === to ? from : `${from} to ${to}`;
};

/**
 * A holiday strip's location count is a way into the holiday: hovering
 * opens a card (each holiday with its date, the first five locations, and
 * "View N more", which opens the holiday's read-only view; Edit there opens
 * the form). The strip itself isn't a link. One location needs no card.
 *
 * @param {object}    props
 * @param {object[]}  props.holidays  – The day's holidays ({ id, name, startAt, endAt, locations })
 * @param {ReactNode} props.children  – The strip
 * @param {string}    [props.className] – On the hover wrapper (to place it like the strip)
 */
export function HolidayHoverCard({ holidays, children, className }) {
  const [opened, setOpened] = useState(null);
  const [editing, setEditing] = useState(null);
  const depts = [...new Set(holidays.flatMap(h => h.locations || []))].sort((a, b) => a.localeCompare(b));
  const more = depts.length - SHOWN;
  const drawer = (
    <>
      {opened && <HolidayViewDrawer holiday={opened} onEdit={(h) => { setOpened(null); setEditing(h); }} onClose={() => setOpened(null)} />}
      {editing && <HolidayDrawer holiday={editing} onClose={() => setEditing(null)} />}
    </>
  );
  if (depts.length < 2) return children;
  return (
    <>
      <HoverCard trigger={children} width={280} align="center" className={className} ariaLabel={`${holidays.map(h => h.name).join(', ')} locations`}>
        {(close) => (
          <span className={styles.tipCard}>
            {holidays.map(h => (
              <span key={h.id || h.name} className={styles.tipHead}>
                <span className={styles.tipTitle}>{h.name}</span> <span className={styles.tipTime}>({holidayDates(h)})</span>
              </span>
            ))}
            <span className={styles.tipLabel}>Holiday at {depts.length} locations</span>
            <span className={styles.tipList}>
              <ul className={styles.tipDepts}>
                {depts.slice(0, SHOWN).map(d => <li key={d} className={styles.tipDept}>{d}</li>)}
              </ul>
              {more > 0 && (
                <Link size="xs" className={styles.tipMore} onClick={() => { close(); setOpened(holidays[0]); }}>
                  View {more} more
                  <Icon name="solar:alt-arrow-right-linear" size={12} color="currentColor" />
                </Link>
              )}
            </span>
          </span>
        )}
      </HoverCard>
      {drawer}
    </>
  );
}
