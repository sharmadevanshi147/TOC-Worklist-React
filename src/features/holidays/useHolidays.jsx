import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { DateRangePopover } from '../../components/DateRangePopover/DateRangePopover';
import { Icon } from '../../components/Icon/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { SearchIconButton } from '../../components/SearchIconButton/SearchIconButton';
import { toast } from '../../components/Toast/sonnerToast';
import { useAppStore } from '../../store/useAppStore';
import { formatDate } from '../../lib/dateFormat';
import { HolidayDrawer } from './HolidayDrawer';
import { HolidayViewDrawer } from './HolidayViewDrawer';
import { HolidaysTable } from './HolidaysTable';
import { HolidayIcon } from '../../components/Icon/HolidayIcon';
import { holidaysInYear, holidayYears, sortHolidays } from './holidayUtils';
import styles from './holidays.module.css';

const PER_PAGE = 20;

/**
 * Holidays list with its controls and drawers, shared by Settings → Calendar
 * → Holiday configuration and the calendar's Holidays drawer. Returns the
 * pieces for the caller to place: `tools` (search, filter, New Configuration),
 * `filterRow` (Year, Date Range and Location; null while closed), `body`
 * (the table) and `elements`
 * (drawers and the delete confirmation).
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.embedded]
 */
export function useHolidays({ embedded = false } = {}) {
  const holidays = useAppStore(s => s.holidayConfigs);
  const fetched = useAppStore(s => s.holidayConfigsFetched);
  const fetchHolidays = useAppStore(s => s.fetchHolidayConfigs);
  const deleteHoliday = useAppStore(s => s.deleteHolidayConfig);
  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const thisYear = String(new Date().getFullYear());
  const [year, setYear] = useState(() => [thisYear]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateRange, setDateRange] = useState([]); // [startISO, endISO] or []
  const [locationFilter, setLocationFilter] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);
  const [form, setForm] = useState(null);       // { holiday? , copyFrom? }
  const [viewing, setViewing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const [from, to] = dateRange.length === 2
      ? [new Date(`${dateRange[0]}T00:00`).getTime(), new Date(`${dateRange[1]}T00:00`).getTime() + 86400000]
      : [null, null];
    const picked = new Set(locationFilter);
    return sortHolidays(holidaysInYear(holidays, Number(year[0])))
      .filter(h => (!q || h.name.toLowerCase().includes(q) || (h.locations || []).some(l => l.toLowerCase().includes(q)))
        && (!picked.size || (h.locations || []).some(l => picked.has(l)))
        && (from == null || (new Date(h.startAt).getTime() < to && new Date(h.endAt).getTime() > from)));
  }, [holidays, year, query, dateRange, locationFilter]);
  const locationOptions = useMemo(() => [...new Set((holidays || []).flatMap(h => h.locations || []))].sort(), [holidays]);
  const filterCount = (year[0] === thisYear ? 0 : 1) + (dateRange.length === 2 ? 1 : 0) + (locationFilter.length ? 1 : 0);
  const resetPage = (fn) => (v) => { fn(v); setPage(1); };
  const clearFilters = () => { setYear([thisYear]); setDateRange([]); setLocationFilter([]); setPage(1); };
  const lastPage = Math.max(1, Math.ceil(shown.length / perPage));
  const pageNow = Math.min(page, lastPage);
  const rows = shown.slice((pageNow - 1) * perPage, pageNow * perPage);

  const filterButton = (
    <ActionButton
      icon="custom:filter"
      tooltip="Filter"
      tooltipBelow
      notification={filterCount > 0}
      count={filterCount > 0 ? String(filterCount) : undefined}
      className={filtersOpen ? styles.iconActive : undefined}
      aria-expanded={filtersOpen}
      onClick={() => setFiltersOpen(v => !v)}
    />
  );

  const filterRow = filtersOpen && (
    <div className={styles.filterRow}>
      <FilterChip
        label="Year"
        options={holidayYears(holidays).map(String)}
        selected={year}
        onChange={(next) => { if (next.length) resetPage(setYear)(next); }}
        singleSelect
        noClear
      />
      <FilterChip
        label="Date Range"
        active={dateRange.length === 2}
        onClear={() => resetPage(setDateRange)([])}
        activeSummary={dateRange.length === 2 ? `${formatDate(`${dateRange[0]}T00:00`)} - ${formatDate(`${dateRange[1]}T00:00`)}` : undefined}
        renderPopover={({ anchorRect, onClose }) => (
          <DateRangePopover anchorRect={anchorRect} label="Date Range" selected={dateRange} onChange={resetPage(setDateRange)} onClose={onClose} />
        )}
      />
      <FilterChip label="Location" options={locationOptions} selected={locationFilter} onChange={resetPage(setLocationFilter)} searchable />
      {filterCount > 0 && (
        <button type="button" className={styles.clearAll} onClick={clearFilters}>
          <Icon name="solar:close-circle-linear" size={14} color="var(--primary-300)" />
          Clear All
        </button>
      )}
    </div>
  );

  const tools = (
    <>
      {searchOpen ? (
        <SearchBar
          placeholder="Search By Holiday or Location"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          onClose={() => { setSearchOpen(false); setQuery(''); setPage(1); }}
        />
      ) : (
        <SearchIconButton tooltipBelow onClick={() => setSearchOpen(true)} />
      )}
      <span className={styles.headerDivider} aria-hidden="true" />
      {filterButton}
      <span className={styles.headerDivider} aria-hidden="true" />
      <Button variant="outline" leadingIcon="solar:add-circle-linear" onClick={() => setForm({})}>New Configuration</Button>
    </>
  );

  const body = (
    <HolidaysTable
      holidays={rows}
      loading={!fetched}
      embedded={embedded}
      emptyState={(
        <div className={styles.emptyBox}>
          <EmptyState icon={HolidayIcon} title={query || filterCount ? 'No holidays match these filters' : `No holidays in ${year[0]} yet`} />
        </div>
      )}
      pagination={shown.length > PER_PAGE ? {
        page: pageNow, perPage, totalItems: shown.length, onPageChange: setPage, onPageSizeChange: (n) => { setPerPage(n); setPage(1); },
      } : undefined}
      onView={setViewing}
      onEdit={(h) => setForm({ holiday: h })}
      onDuplicate={(h) => setForm({ copyFrom: h })}
      onDelete={setToDelete}
    />
  );

  const elements = (
    <>
      {viewing && <HolidayViewDrawer holiday={viewing} onEdit={(h) => { setViewing(null); setForm({ holiday: h }); }} onClose={() => setViewing(null)} />}
      {form && <HolidayDrawer holiday={form.holiday} copyFrom={form.copyFrom} onClose={() => setForm(null)} />}
      {toDelete && (
        <ConfirmDialog
          variant="destructive"
          title="Delete Holiday?"
          description={`${toDelete.name} will be removed from the calendar and its auto reply turned off for ${toDelete.locations.length} location${toDelete.locations.length === 1 ? '' : 's'}.`}
          confirmLabel="Delete Holiday"
          cancelLabel="Cancel"
          loading={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={async () => {
            setDeleting(true);
            try {
              const ok = await deleteHoliday(toDelete.id);
              if (ok) toast.success('Holiday Deleted Successfully');
              setToDelete(null);
            } finally {
              setDeleting(false);
            }
          }}
        />
      )}
    </>
  );

  return { tools, filterRow: filterRow || null, body, elements };
}
