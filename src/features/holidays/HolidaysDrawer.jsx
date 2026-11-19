import { Drawer } from '../../components/Drawer/Drawer';
import { useHolidays } from './useHolidays';
import styles from './holidays.module.css';

/**
 * The calendar's Holidays touchpoint: the same holidays list as Settings →
 * Calendar → Holiday configuration, in a drawer, with search, filter and
 * New Configuration in the header and the filter bar under it.
 *
 * @param {object}   props
 * @param {function} props.onClose
 */
export function HolidaysDrawer({ onClose }) {
  const h = useHolidays({ embedded: true });
  return (
    <>
      <Drawer
        title="Holidays"
        width={980}
        onClose={onClose}
        noCloseDivider
        banner={h.filterRow || undefined}
        bodyClassName={styles.flushBody}
        headerRight={(
          <>
            {h.tools}
            <span className={styles.headerDivider} aria-hidden="true" />
          </>
        )}
      >
        {h.body}
      </Drawer>
      {h.elements}
    </>
  );
}
