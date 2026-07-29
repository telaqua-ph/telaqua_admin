import './StatCard.css';

export default function StatCard({ title, value, icon, accent = 'orange' }) {
  return (
    <article className={`stat-card stat-card--${accent}`}>
      <div className="stat-card__body">
        <p className="stat-card__title">{title}</p>
        <p className="stat-card__value">{value}</p>
      </div>
      {icon && <div className="stat-card__icon">{icon}</div>}
    </article>
  );
}
