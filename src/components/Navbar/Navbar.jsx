import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../NotificationBell';
import './Navbar.css';

export default function Navbar({ title, onMenuClick }) {
  const { user } = useAuth();
  const displayName = user?.full_name || user?.username || 'Admin';
  const displayEmail = user?.email || '';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="navbar">
      <div className="navbar__left">
        <button
          type="button"
          className="navbar__menu"
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="navbar__title">{title}</h1>
      </div>

      <div className="navbar__right">
        <NotificationBell />
        <div className="navbar__profile">
          <div className="navbar__avatar">{initials || 'AD'}</div>
          <div className="navbar__profile-text">
            <p className="navbar__name">{displayName}</p>
            <p className="navbar__role">{displayEmail}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
