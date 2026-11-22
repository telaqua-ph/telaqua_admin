import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getActivityFilters, getActivityLog } from '../../services/api';
import { Button } from '../../components/Buttons';
import ActivityChanges from '../../components/ActivityChanges/ActivityChanges';
import { activityWho, downloadActivityCsv, formatActivityTime } from '../../utils/activityFormat';
import '../../styles/shared.css';
import './ActivityLog.css';

const PAGE_SIZE = 50;
const EMPTY_FILTERS = { admin_id: '', action: '', order: '', from: '', to: '', q: '' };

/**
 * Activity Log: every change made in the admin, with who made it and old -> new values.
 * Read-only — entries cannot be edited or deleted from the admin.
 */
export default function ActivityLog() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [admins, setAdmins] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getActivityFilters()
      .then(({ admins: a, actions: b }) => { setAdmins(a); setActions(b); })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getActivityLog({ ...applied, page, limit: PAGE_SIZE });
      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      if (err.status === 403) setError('You do not have access to the Activity Log.');
      else if (err.status !== 401) setError(err.message || 'Failed to load the activity log.');
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => { load(); }, [load]);

  const setField = (key) => (event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }));
  const apply = (event) => { event?.preventDefault(); setPage(1); setApplied(filters); };
  const reset = () => { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1); };

  const download = async () => {
    setDownloading(true);
    setError('');
    setMessage('');
    try {
      const result = await getActivityLog({ ...applied, page: 1, limit: 5000 });
      if (!result.rows.length) { setMessage('Nothing to download for these filters.'); return; }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadActivityCsv(result.rows, `telaqua-activity-log-${stamp}.csv`);
      setMessage(`Downloaded ${result.rows.length} entr${result.rows.length === 1 ? 'y' : 'ies'}${result.total > result.rows.length ? ` (first 5000 of ${result.total} — narrow the dates for the rest)` : ''}.`);
    } catch (err) {
      setError(err.message || 'Failed to download CSV.');
    } finally {
      setDownloading(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page activity-log">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Activity Log</h2>
          <p>Every change made in the admin — who did it, when, and what changed. Entries cannot be edited or deleted.</p>
        </div>
        <Button onClick={download} disabled={downloading}>{downloading ? 'Preparing CSV…' : 'Download CSV'}</Button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {message && <div className="alert alert--info">{message}</div>}

      <section className="panel">
        <form className="panel__body activity-log__filters" onSubmit={apply}>
          <div className="form-group">
            <label htmlFor="al-admin">Employee</label>
            <select id="al-admin" value={filters.admin_id} onChange={setField('admin_id')}>
              <option value="">All employees</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>{a.full_name || a.username || a.email}{Number(a.is_active) === 0 ? ' (disabled)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="al-action">Type of change</label>
            <select id="al-action" value={filters.action} onChange={setField('action')}>
              <option value="">All changes</option>
              {actions.map((a) => <option key={a.action} value={a.action}>{a.label || a.action}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="al-order">Order</label>
            <input id="al-order" placeholder="TAQ-001550 or 1550" value={filters.order} onChange={setField('order')} />
          </div>
          <div className="form-group">
            <label htmlFor="al-from">From</label>
            <input id="al-from" type="date" value={filters.from} onChange={setField('from')} />
          </div>
          <div className="form-group">
            <label htmlFor="al-to">To</label>
            <input id="al-to" type="date" value={filters.to} onChange={setField('to')} />
          </div>
          <div className="form-group">
            <label htmlFor="al-q">Search</label>
            <input id="al-q" placeholder="e.g. delivered, Paid" value={filters.q} onChange={setField('q')} />
          </div>
          <div className="activity-log__filter-actions">
            <Button type="submit">Apply</Button>
            <Button type="button" variant="secondary" onClick={reset}>Reset</Button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Changes</h3>
          <span className="activity-log__count">{total} entr{total === 1 ? 'y' : 'ies'}</span>
        </div>
        <div className="panel__body activity-log__table-wrap">
          {loading ? (
            <div className="loading-state">Loading activity…</div>
          ) : rows.length === 0 ? (
            <p className="form-hint">No changes recorded for these filters yet.</p>
          ) : (
            <table className="activity-log__table">
              <thead>
                <tr>
                  <th>When (IST)</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Order</th>
                  <th>What changed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="activity-log__time">{formatActivityTime(row.created_at)}</td>
                    <td className="activity-log__who">
                      <strong>{activityWho(row)}</strong>
                      {row.admin_email ? <span>{row.admin_email}</span> : null}
                    </td>
                    <td className="activity-log__action">{row.action_label || row.action}</td>
                    <td className="activity-log__order">
                      {row.order_id ? <Link to={`/orders/${row.order_id}`}>{row.order_number || `#${row.order_id}`}</Link> : '—'}
                    </td>
                    <td>
                      {Array.isArray(row.changes) && row.changes.length
                        ? <ActivityChanges changes={row.changes} />
                        : <span className="form-hint">{row.summary || '—'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {total > PAGE_SIZE && (
            <div className="activity-log__pagination">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="orders__page-indicator">Page {page} of {pages}</span>
              <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
