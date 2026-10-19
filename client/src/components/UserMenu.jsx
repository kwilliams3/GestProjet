import { useId, useRef, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { useDismiss } from '../hooks.js';
import { ROLE_LABELS } from '../labels.js';
import { initials } from '../utils.js';
import { ChevronDownIcon, LogOutIcon } from './icons.jsx';

/** Menu du compte dans l'en-tête : identité de la personne connectée et déconnexion. */
export default function UserMenu() {
  const { user, logout } = useAuth();
  const ref = useRef(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);

  useDismiss(ref, open, () => setOpen(false));

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Compte de ${user.full_name}`}
        onClick={() => setOpen(!open)}
      >
        <span className="avatar" aria-hidden="true">
          {initials(user.full_name)}
        </span>
        <span className="user-menu-name" aria-hidden="true">
          <strong className="truncate">{user.full_name}</strong>
          <span>{ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronDownIcon className="user-menu-chevron" />
      </button>

      {open && (
        <div id={panelId} className="card user-dropdown">
          <div className="user-dropdown-head">
            <span className="avatar avatar-lg" aria-hidden="true">
              {initials(user.full_name)}
            </span>
            <div className="user-dropdown-identity">
              <strong className="truncate">{user.full_name}</strong>
              <span className="muted small truncate">{user.email}</span>
              <span className="badge badge-accent">{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
          <button type="button" className="user-dropdown-item" onClick={logout}>
            <LogOutIcon className="btn-icon-svg" />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
