import styles from './DetailFields.module.css';

const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);

/**
 * DetailFields: a read-only section of label-over-value pairs, two to a
 * row, rows split by a hairline (a record's "view" drawer). An empty value
 * shows "-".
 *
 * @param {object}   props
 * @param {string}   [props.title]  – Section heading
 * @param {Array<{ key?: string, label: string, value: React.ReactNode, full?: boolean }>} props.items
 *        `full` gives a field the whole row (long text, a list).
 * @param {string}   [props.className]
 */
export function DetailFields({ title, items, className }) {
  return (
    <section className={[styles.section, className].filter(Boolean).join(' ')}>
      {title && <h3 className={styles.title}>{title}</h3>}
      <dl className={styles.grid}>
        {items.map(f => (
          <div key={f.key || f.label} className={f.full ? `${styles.field} ${styles.full}` : styles.field}>
            <dt className={styles.label}>{f.label}</dt>
            <dd className={styles.value}>{isEmpty(f.value) ? '-' : f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
