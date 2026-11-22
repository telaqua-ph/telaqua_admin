import { formatChangeValue } from '../../utils/activityFormat';

/** Small "Field: old → new" list used by the Activity Log page and the order history box. */
export default function ActivityChanges({ changes, limit = 8 }) {
  if (!Array.isArray(changes) || changes.length === 0) return null;
  const shown = changes.slice(0, limit);
  return (
    <ul className="activity-changes">
      {shown.map((change, index) => (
        <li key={`${change.field}-${index}`}>
          <span className="activity-changes__field">{change.label || change.field}</span>
          <span className="activity-changes__from">{formatChangeValue(change.from)}</span>
          <span className="activity-changes__arrow" aria-hidden="true">→</span>
          <span className="activity-changes__to">{formatChangeValue(change.to)}</span>
        </li>
      ))}
      {changes.length > limit ? <li className="activity-changes__more">+{changes.length - limit} more change(s)</li> : null}
    </ul>
  );
}
