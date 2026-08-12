import { Link } from 'react-router-dom';
import './StatCard.css';

const downloadIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export default function StatCard({
  title,
  value,
  icon,
  accent = 'orange',
  to,
  onDownload,
  downloadLabel = 'Download CSV',
}) {
  const handleDownload = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDownload?.();
  };

  const content = (
    <article
      className={`stat-card stat-card--${accent}${to ? ' stat-card--clickable' : ''}`}
    >
      <div className="stat-card__body">
        <p className="stat-card__title">{title}</p>
        <p className="stat-card__value">{value}</p>
        {(to || onDownload) && (
          <div className="stat-card__footer">
            {to ? <span className="stat-card__cta">View list</span> : <span />}
            {onDownload ? (
              <button
                type="button"
                className="stat-card__download"
                onClick={handleDownload}
                title={downloadLabel}
                aria-label={downloadLabel}
              >
                {downloadIcon}
                <span>CSV</span>
              </button>
            ) : null}
          </div>
        )}
      </div>
      {icon && <div className="stat-card__icon">{icon}</div>}
    </article>
  );

  if (to) {
    return (
      <Link to={to} className="stat-card__link">
        {content}
      </Link>
    );
  }

  return content;
}
