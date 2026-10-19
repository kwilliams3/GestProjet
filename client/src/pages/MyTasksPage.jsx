import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { STATUSES, STATUS_LABELS } from '../labels.js';
import { CheckCircleIcon } from '../components/icons.jsx';
import { DueDate, EmptyState, ErrorMessage, Labels, Loading, PageHeader, PriorityBadge } from '../components/ui.jsx';

export default function MyTasksPage() {
  const { data: tasks, error, setData } = useApi('/tasks/mine');
  const [showDone, setShowDone] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function changeStatus(task, status) {
    setActionError(null);
    try {
      const updated = await api(`/tasks/${task.id}`, { method: 'PATCH', body: { status } });
      setData((list) => list.map((t) => (t.id === updated.id ? { ...updated, project_name: t.project_name } : t)));
    } catch (err) {
      setActionError(err);
    }
  }

  if (error) return <ErrorMessage error={error} />;
  if (!tasks) return <Loading />;

  const visible = showDone ? tasks : tasks.filter((task) => task.status !== 'termine');

  return (
    <>
      <PageHeader title="Mes tâches" subtitle="Les tâches qui vous sont assignées dans les projets actifs." />
      <div className="toolbar">
        <label className="checkbox-line">
          <input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)} />
          Afficher les tâches terminées
        </label>
      </div>
      <ErrorMessage error={actionError} />

      {visible.length === 0 ? (
        tasks.length === 0 ? (
          <EmptyState>Aucune tâche ne vous est assignée.</EmptyState>
        ) : (
          <EmptyState icon={CheckCircleIcon}>Toutes vos tâches sont terminées. Bravo !</EmptyState>
        )
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Tâche</th>
                <th scope="col">Projet</th>
                <th scope="col">Priorité</th>
                <th scope="col">Échéance</th>
                <th scope="col">Statut</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => (
                <tr key={task.id}>
                  <td>
                    <Link to={`/projets/${task.project_id}?tache=${task.id}`} className="strong-link">
                      {task.title}
                    </Link>
                    <Labels labels={task.labels} />
                  </td>
                  <td>
                    <Link to={`/projets/${task.project_id}`}>{task.project_name}</Link>
                  </td>
                  <td>
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td>
                    <DueDate task={task} />
                  </td>
                  <td>
                    <select
                      value={task.status}
                      onChange={(event) => changeStatus(task, event.target.value)}
                      aria-label={`Statut de « ${task.title} »`}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
