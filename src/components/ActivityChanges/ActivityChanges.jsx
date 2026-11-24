import { useState } from 'react';
import { explainChanges } from '../../utils/activityFormat';

/**
 * Plain-language list of what changed.
 * Shows only the changes that matter (delivery status, payment, stock, courier…);
 * technical fields (status codes, error text, internal timestamps) sit behind a toggle.
 */
export default function ActivityChanges({ changes, summary }) {
  const [open, setOpen] = useState(false);
  const { key, technical, created, deleted } = explainChanges(changes);

  if (!key.length && !technical.length && !created && !deleted) {
    return summary ? <p className="al-change__plain">{summary}</p> : <p className="al-change__plain">—</p>;
  }

  return (
    <div className="al-changes">
      {created ? <span className="al-pill al-pill--new">New order created</span> : null}
      {deleted ? <span className="al-pill al-pill--del">Order deleted</span> : null}
      {key.length ? (
        <ul className="al-change-list">
          {key.map((change) => (
            <li key={`${change.label}-${change.from}-${change.to}`} className="al-change">
              <span className="al-change__label">{change.label}</span>
              <span className="al-change__values">
                <span className="al-change__from">{change.from}</span>
                <svg className="al-change__arrow" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="al-change__to">{change.to}</span>
                {change.note ? <span className={`al-change__note ${change.note.startsWith('-') ? 'is-down' : 'is-up'}`}>{change.note}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {technical.length ? (
        <div className="al-tech">
          <button type="button" className="al-tech__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Hide technical details' : `Show technical details (${technical.length})`}
          </button>
          {open ? (
            <ul className="al-tech__list">
              {technical.map((change, index) => (
                <li key={`${change.label}-${index}`}>
                  <span className="al-tech__label">{change.label}</span>
                  <span className="al-tech__vals">{change.from} → {change.to}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
