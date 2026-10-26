import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useApi } from '../hooks.js';
import { PRIORITY_LABELS, STATUS_LABELS } from '../labels.js';
import { formatDate } from '../utils.js';
import { CalendarIcon } from '../components/icons.jsx';
import { ErrorMessage, Loading, PageHeader } from '../components/ui.jsx';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthRange(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - mondayOffset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 41);
  return { from: isoDate(start), to: isoDate(end), start };
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const { from, to, start } = monthRange(month);
  const { data: tasks, error } = useApi(`/calendar?from=${from}&to=${to}`);

  const tasksByDate = useMemo(() => {
    const grouped = new Map();
    for (const event of tasks ?? []) {
      if (!grouped.has(event.event_date)) grouped.set(event.event_date, []);
      grouped.get(event.event_date).push(event);
    }
    return grouped;
  }, [tasks]);

  const days = Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const title = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(month);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const monthEvents = (tasks ?? []).filter((event) => event.event_date.startsWith(monthKey));

  function moveMonth(offset) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <>
      <PageHeader
        eyebrow="Échéances"
        title="Calendrier"
        subtitle="Retrouvez les échéances des tâches et les dates clés de vos projets actifs."
      >
        <div className="calendar-controls" aria-label="Changer de mois">
          <button type="button" className="btn" onClick={() => moveMonth(-1)} aria-label="Mois précédent">
            ‹
          </button>
          <strong className="calendar-month">{title}</strong>
          <button type="button" className="btn" onClick={() => moveMonth(1)} aria-label="Mois suivant">
            ›
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
          >
            Aujourd’hui
          </button>
        </div>
      </PageHeader>

      <ErrorMessage error={error} />
      {!tasks && !error && <Loading />}

      {tasks && (
        <section className="card calendar" aria-label={`Calendrier de ${title}`}>
          <div className="calendar-grid calendar-weekdays">
            {WEEKDAYS.map((day) => (
              <div key={day} className="calendar-weekday">
                {day}
              </div>
            ))}
          </div>
          <div className="calendar-grid calendar-days">
            {days.map((day) => {
              const date = isoDate(day);
              const events = tasksByDate.get(date) ?? [];
              const outsideMonth = day.getMonth() !== month.getMonth();
              return (
                <div key={date} className={`calendar-day${outsideMonth ? ' outside-month' : ''}`}>
                  <time className="calendar-date" dateTime={date}>
                    {day.getDate()}
                  </time>
                  <div className="calendar-events">
                    {events.map((event) => {
                      const isTask = event.event_type === 'task';
                      const label = event.event_type === 'project_start' ? 'Début du projet' : 'Fin prévue du projet';
                      return (
                      <Link
                        key={`${event.event_type}-${event.id}`}
                        className={`calendar-event${isTask ? ` status-${event.status}` : ` calendar-event-${event.event_type}`}`}
                        to={isTask ? `/projets/${event.project_id}?tache=${event.id}` : `/projets/${event.project_id}`}
                        title={isTask
                          ? `${event.project_name} · ${event.title} · ${STATUS_LABELS[event.status]} · Priorité ${PRIORITY_LABELS[event.priority]}`
                          : `${label} · ${event.project_name}`}
                      >
                        <span className="calendar-event-project">{event.project_name}</span>
                        <span className="calendar-event-task">{isTask ? event.title : label}</span>
                      </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {tasks.length === 0 && <p className="muted small calendar-no-events">Aucune échéance sur cette période.</p>}
          <p className="muted small calendar-help">
            <CalendarIcon className="inline-icon" /> Sélectionnez une tâche pour ouvrir son projet.
          </p>
        </section>
      )}

      {monthEvents.length > 0 && (
        <section className="card panel calendar-agenda">
          <h2>Échéances et dates clés du mois</h2>
          <ul className="calendar-agenda-list">
            {monthEvents.map((event) => (
              <li key={`${event.event_type}-${event.id}`}>
                <time dateTime={event.event_date}>{formatDate(event.event_date)}</time>
                <Link to={event.event_type === 'task' ? `/projets/${event.project_id}?tache=${event.id}` : `/projets/${event.project_id}`}>
                  {event.title}
                </Link>
                <span className="muted small">
                  {event.project_name}
                  {event.status && ` · ${STATUS_LABELS[event.status]}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
