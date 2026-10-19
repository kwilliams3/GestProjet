import { FIELD_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '../labels.js';
import { formatDate, initials, isOverdue } from '../utils.js';
import { AlertIcon, CalendarIcon, InboxIcon } from './icons.jsx';

export function Loading() {
  return (
    <p className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      Chargement…
    </p>
  );
}

export function ErrorMessage({ error }) {
  if (!error) return null;
  return (
    <div className="alert" role="alert">
      <AlertIcon className="alert-icon" />
      <div>
        <strong>{error.message}</strong>
        {error.details?.length > 0 && (
          <ul>
            {error.details.map((detail, i) => {
              const field = FIELD_LABELS[detail.field?.split('.')[0]];
              return <li key={i}>{field ? `${field} : ${detail.message}` : detail.message}</li>;
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <header className="page-header">
      <div className="page-heading">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function EmptyState({ icon: StateIcon = InboxIcon, children }) {
  return (
    <div className="empty">
      <StateIcon className="empty-icon" />
      <div>{children}</div>
    </div>
  );
}

export function ProgressBar({ value, label }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="badge-dot" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return <span className={`badge priority-${priority}`}>{PRIORITY_LABELS[priority]}</span>;
}

/** Échéance ; un retard est signalé par la couleur, une icône et un texte (jamais par la couleur seule). */
export function DueDate({ task }) {
  if (!task.due_date) return <span className="muted">—</span>;
  const overdue = isOverdue(task);
  const Icon = overdue ? AlertIcon : CalendarIcon;
  return (
    <span className={overdue ? 'due overdue' : 'due'} title={overdue ? 'En retard' : 'Échéance'}>
      <Icon className="inline-icon" />
      {formatDate(task.due_date)}
      {overdue && <span className="sr-only"> (en retard)</span>}
    </span>
  );
}

export function Labels({ labels }) {
  if (labels.length === 0) return null;
  return (
    <ul className="labels" aria-label="Étiquettes">
      {labels.map((label) => (
        <li key={label} className="label">
          {label}
        </li>
      ))}
    </ul>
  );
}

export function Avatar({ name }) {
  return (
    <span className="avatar" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Avatars({ people, max = 3, emptyText = 'Non assignée' }) {
  if (people.length === 0) return <span className="muted small">{emptyText}</span>;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="avatars">
      {shown.map((person) => (
        <span key={person.id} className="avatar" title={person.full_name} aria-hidden="true">
          {initials(person.full_name)}
        </span>
      ))}
      {extra > 0 && (
        <span className="avatar avatar-more" aria-hidden="true">
          +{extra}
        </span>
      )}
      <span className="sr-only">{people.map((person) => person.full_name).join(', ')}</span>
    </span>
  );
}
