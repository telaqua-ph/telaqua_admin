import { useEffect, useState } from 'react';
import { getActivityAccess, getOrderActivity } from '../../services/api';
import ActivityChanges from '../ActivityChanges/ActivityChanges';
import { activityWho, formatActivityTime } from '../../utils/activityFormat';
import '../../pages/ActivityLog/ActivityLog.css';

/**
 * "Order history" box on the order page: who changed this order and what changed.
 * Shown only to admins allowed to see the Activity Log.
 * `refreshKey` changes after every save on the order page so the list reloads.
 */
export default function OrderActivityHistory({ orderId, refreshKey }) {
  const [canView, setCanView] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getActivityAccess().then((ok) => { if (alive) setCanView(ok); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!canView || !orderId) return undefined;
    let alive = true;
    setError('');
    // Small delay: the log row is written just after the save finishes.
    const timer = setTimeout(() => {
      getOrderActivity(orderId)
        .then((data) => { if (alive) setRows(data); })
        .catch((err) => { if (alive && err.status !== 401) setError(err.message || 'Could not load order history.'); })
        .finally(() => { if (alive) setLoading(false); });
    }, 800);
    return () => { alive = false; clearTimeout(timer); };
  }, [canView, orderId, refreshKey]);

  if (!canView) return null;

  return (
    <section className="panel order-activity">
      <div className="panel__header">
        <h3>Order history (who changed what)</h3>
      </div>
      <div className="panel__body">
        {error ? <div className="alert alert--error">{error}</div> : null}
        {loading ? (
          <p className="form-hint">Loading history…</p>
        ) : rows.length === 0 ? (
          <p className="form-hint">No admin changes recorded for this order yet.</p>
        ) : (
          <ol className="order-activity__list">
            {rows.map((row) => (
              <li key={row.id} className="order-activity__item">
                <div className="order-activity__head">
                  <time>{formatActivityTime(row.created_at)}</time>
                  <strong>{activityWho(row)}</strong>
                  <span>{row.action_label || row.action}</span>
                </div>
                <ActivityChanges changes={row.changes} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
