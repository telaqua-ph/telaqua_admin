import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/inventory';
import './NotificationBell.css';

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await getNotifications(false);
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (err) {
      setError(err?.message || 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;

    const onDocClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
    if (!open) load();
  };

  const handleRead = async (id) => {
    try {
      await markNotificationRead(id);
      await load();
    } catch (err) {
      setError(err?.message || 'Could not mark notification read');
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      await load();
    } catch (err) {
      setError(err?.message || 'Could not mark all read');
    }
  };

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        type="button"
        className="notification-bell__trigger"
        onClick={handleToggle}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-bell__badge">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-bell__panel">
          <div className="notification-bell__head">
            <h2>Notifications</h2>
            {unreadCount > 0 && (
              <button type="button" onClick={handleReadAll}>
                Mark all read
              </button>
            )}
          </div>

          {error && <p className="notification-bell__error">{error}</p>}
          {loading && <p className="notification-bell__empty">Loading…</p>}

          {!loading && notifications.length === 0 && (
            <p className="notification-bell__empty">No notifications yet.</p>
          )}

          <ul className="notification-bell__list">
            {notifications.map((item) => {
              const isLow = item.notification_type === 'LOW_STOCK';
              return (
                <li
                  key={item.id}
                  className={`notification-bell__item${
                    item.is_read ? '' : ' notification-bell__item--unread'
                  }`}
                >
                  <div>
                    <p className="notification-bell__type">
                      {isLow ? '⚠️ Low Stock' : '🔴 Out of Stock'}
                    </p>
                    <p className="notification-bell__message">
                      {item.product_name} — {item.stock_at_notification} remaining
                    </p>
                    <p className="notification-bell__time">{formatWhen(item.created_at)}</p>
                  </div>
                  {!item.is_read && (
                    <button type="button" onClick={() => handleRead(item.id)}>
                      Read
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
