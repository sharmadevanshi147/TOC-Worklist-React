import { useRef, useState } from 'react';
import { WorklistShell } from '../../components/WorklistShell/WorklistShell';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { BadgeRow } from '../../components/BadgeRow/BadgeRow';
import { Icon } from '../../components/Icon/Icon';
import { TruncatedText } from '../../components/TruncatedText/TruncatedText';
import { formatDateTime } from '../ooo/oooUtils';
import { isPastHoliday } from './holidayUtils';
import styles from './holidays.module.css';

// Duplicate and Delete live in the row's ⋯ menu; a past holiday can't be
// changed, so they're off (the hint says why).
function RowMenu({ holiday, past, onDuplicate, onDelete }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const hint = past ? "Past holidays can't be changed" : undefined;
  return (
    <span ref={ref} className={styles.menuCell}>
      <ActionButton icon="solar:menu-dots-linear" tooltip="More options" tooltipLeft aria-label={`More options for ${holiday.name}`} onClick={() => setOpen(v => !v)} />
      {open && (
        <MenuPopover
          anchorRef={ref}
          ariaLabel="Holiday actions"
          width={180}
          items={[
            { key: 'duplicate', icon: 'solar:copy-linear', label: 'Duplicate', disabled: past, tooltip: hint },
            { divider: true },
            { key: 'delete', icon: 'solar:trash-bin-minimalistic-linear', label: 'Delete', danger: true, disabled: past, tooltip: hint },
          ]}
          onSelect={(key) => { setOpen(false); (key === 'duplicate' ? onDuplicate : onDelete)(holiday); }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

const COLUMNS = [
  { key: 'name', label: 'Holiday Name', sticky: 'left', left: 0, width: 260 },
  { key: 'start', label: 'Start Date & Time', width: 184 },
  { key: 'end', label: 'End Date & Time', width: 184 },
  { key: 'locations', label: 'Location' },
  { key: 'actions', label: 'Action', sticky: 'right', width: 156 },
];

/**
 * Holidays in the shared WorklistShell table (Figma December-2025
 * 842:14951): name, start, end, locations and Edit / Duplicate / Delete.
 * Past holidays are read-only, so their actions are off (the tooltip says
 * why).
 *
 * @param {object}   props
 * @param {object[]} props.holidays
 * @param {boolean}  [props.loading]
 * @param {boolean}  [props.embedded]   – Grow with the content inside a scrolling parent
 * @param {React.ReactNode} props.emptyState
 * @param {object}   [props.pagination]
 * @param {function} props.onView       – (holiday) => void
 * @param {function} props.onEdit       – (holiday) => void
 * @param {function} props.onDuplicate  – (holiday) => void
 * @param {function} props.onDelete     – (holiday) => void
 */
export function HolidaysTable({ holidays, loading, embedded = false, emptyState, pagination, onView, onEdit, onDuplicate, onDelete }) {
  const now = new Date();
  const action = (h, { icon, label, verb, onClick, left }) => {
    const off = isPastHoliday(h, now);
    return (
      <ActionButton
        tooltip={off ? `Past holidays can't be ${verb}` : label}
        tooltipLeft={left}
        disabled={off}
        aria-label={`${label} ${h.name}`}
        onClick={() => !off && onClick(h)}
      >
        <Icon name={icon} size={16} color={off ? 'var(--neutral-150)' : 'var(--neutral-300)'} />
      </ActionButton>
    );
  };
  const renderRow = (h) => (
    <tr key={h.id} className={styles.row}>
      <td className={`${styles.membersTd} ${styles.stickyLeft}`} style={{ left: 0 }}>
        <TruncatedText text={h.name} className={styles.name} />
      </td>
      <td className={styles.td}>{formatDateTime(h.startAt)}</td>
      <td className={styles.td}>{formatDateTime(h.endAt)}</td>
      <td className={styles.td}><BadgeRow items={h.locations || []} maxLines={1} icon="solar:map-point-linear" /></td>
      <td className={`${styles.td} ${styles.stickyRight}`}>
        <span className={styles.actionsCell}>
          <ActionButton tooltip="View" tooltipLeft aria-label={`View ${h.name}`} onClick={() => onView(h)}>
            <Icon name="solar:eye-linear" size={16} color="var(--neutral-300)" />
          </ActionButton>
          <span className={styles.actionDivider} aria-hidden="true" />
          {action(h, { icon: 'solar:pen-linear', label: 'Edit', verb: 'edited', onClick: onEdit, left: true })}
          <span className={styles.actionDivider} aria-hidden="true" />
          <RowMenu holiday={h} past={isPastHoliday(h, now)} onDuplicate={onDuplicate} onDelete={onDelete} />
        </span>
      </td>
    </tr>
  );
  return (
    <div className={[embedded ? styles.wrapEmbedded : styles.wrap, !loading && !holidays.length ? styles.empty : ''].filter(Boolean).join(' ')}>
      <WorklistShell
        header={null}
        columns={COLUMNS}
        rows={holidays}
        renderRow={renderRow}
        loading={loading}
        emptyState={emptyState}
        embedded={embedded}
        minTableWidth={980}
        page={pagination?.page}
        perPage={pagination?.perPage}
        totalItems={pagination?.totalItems}
        onPageChange={pagination?.onPageChange}
        onPageSizeChange={pagination?.onPageSizeChange}
      />
    </div>
  );
}
