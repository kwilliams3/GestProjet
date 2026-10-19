import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api.js';
import { useDismiss } from '../hooks.js';
import { formatRelative } from '../utils.js';
import { BellIcon } from './icons.jsx';

const ICONS = { assignation: '👤', mention: '@', commentaire: '💬', echeance_proche: '⏰', retard: '⚠' };
const REFRESH_MS = 30 * 1000;

/** Notifications dans l'application (F13), rafraîchies toutes les 30 secondes. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const ref = useRef(null);
  const [data, setData] = useState({ unread_count: 0, items: [] });
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api('/notifications').then(setData, () => {});
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useDismiss(ref, open, () => setOpen(false));

  function toggle() {
    if (!open) load();
    setOpen(!open);
  }

  async function openNotification(notification) {
    setOpen(false);
    if (!notification.read_at) {
      await api(`/notifications/${notification.id}/read`, { method: 'POST' }).catch(() => {});
      load();
    }
    if (notification.task_id) navigate(`/projets/${notification.project_id}?tache=${notification.task_id}`);
  }

  async function readAll() {
    await api('/notifications/read-all', { method: 'POST' }).catch(() => {});
    load();
  }

  const unread = data.unread_count;

  return (
    <div className="notif" ref={ref}>
      <button
        type="button"
        className="icon-button bell"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
        onClick={toggle}
      >
        <BellIcon />
        {unread > 0 && (
          <span className="bell-count" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="card notif-panel">
          <header className="notif-header">
            <h2>Notifications</h2>
            {unread > 0 && (
              <button type="button" className="btn btn-ghost btn-small" onClick={readAll}>
                Tout marquer comme lu
              </button>
            )}
          </header>
          {data.items.length === 0 ? (
            <p className="muted small notif-empty">Aucune notification pour le moment.</p>
          ) : (
            <ul className="notif-list">
              {data.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notif-item${n.read_at ? '' : ' unread'}`}
                    onClick={() => openNotification(n)}
                  >
                    <span className={`notif-icon notif-${n.type}`} aria-hidden="true">
                      {ICONS[n.type]}
                    </span>
                    <span className="notif-text">
                      <span>
                        {!n.read_at && <span className="sr-only">Non lue : </span>}
                        {n.message}
                      </span>
                      <span className="muted small">{formatRelative(n.created_at)}</span>
                    </span>
                    {!n.read_at && <span className="unread-dot" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
