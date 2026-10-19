import { useId, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../labels.js';
import { canEditTask } from '../permissions.js';
import { parseLabels } from '../utils.js';
import Modal from './Modal.jsx';
import TaskAttachments from './TaskAttachments.jsx';
import TaskComments from './TaskComments.jsx';
import { DueDate, ErrorMessage } from './ui.jsx';

/**
 * Création (task absente) ou consultation/modification d'une tâche.
 * Les champs sont en lecture seule si l'utilisateur n'a pas le droit de modifier la tâche.
 */
export default function TaskModal({ project, task, parentId = null, subtasks = [], onOpenTask, onClose, onChanged }) {
  const { user } = useAuth();
  const formId = useId();
  const isNew = !task;
  const canManage = project.can_manage && project.status === 'actif';
  const canEdit = isNew ? canManage : canEditTask(user, project, task);
  const assignable = project.members.filter((member) => member.role !== 'invite');

  const [form, setForm] = useState(() => ({
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? 'a_faire',
    priority: task?.priority ?? 'moyenne',
    due_date: task?.due_date ?? '',
    labels: task?.labels.join(', ') ?? '',
    assignee_ids: task?.assignees.map((a) => a.id) ?? [],
  }));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  const toggleAssignee = (id) =>
    setForm((f) => ({
      ...f,
      assignee_ids: f.assignee_ids.includes(id) ? f.assignee_ids.filter((a) => a !== id) : [...f.assignee_ids, id],
    }));

  async function run(action) {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    run(async () => {
      const body = {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        labels: parseLabels(form.labels),
      };
      if (canManage) body.assignee_ids = form.assignee_ids;
      if (isNew) {
        await api(`/projects/${project.id}/tasks`, { method: 'POST', body: { ...body, parent_id: parentId } });
      } else {
        await api(`/tasks/${task.id}`, { method: 'PATCH', body });
      }
      onChanged();
      onClose();
    });
  }

  function handleDelete() {
    const message = subtasks.length > 0 ? 'Supprimer cette tâche et ses sous-tâches ?' : 'Supprimer cette tâche ?';
    if (!window.confirm(message)) return;
    run(async () => {
      await api(`/tasks/${task.id}`, { method: 'DELETE' });
      onChanged();
      onClose();
    });
  }

  let title = canEdit ? 'Modifier la tâche' : 'Détail de la tâche';
  if (isNew) title = parentId ? 'Nouvelle sous-tâche' : 'Nouvelle tâche';

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide={!isNew}
      footer={
        <>
          {!isNew && canManage && (
            <button type="button" className="btn btn-danger footer-start" onClick={handleDelete} disabled={saving}>
              Supprimer
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {canEdit ? 'Annuler' : 'Fermer'}
          </button>
          {canEdit && (
            <button type="submit" form={formId} className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          )}
        </>
      }
    >
      <ErrorMessage error={error} />
      {project.status !== 'actif' && <p className="notice">Projet archivé : lecture seule.</p>}
      <form id={formId} onSubmit={handleSubmit}>
        <fieldset disabled={!canEdit}>
          <label className="field">
            <span className="field-label">Titre</span>
            <input required maxLength={200} value={form.title} onChange={update('title')} autoFocus={canEdit} />
          </label>
          <label className="field">
            <span className="field-label">Description</span>
            <textarea rows={3} value={form.description} onChange={update('description')} />
          </label>
          <div className="grid-3">
            <label className="field">
              <span className="field-label">Statut</span>
              <select value={form.status} onChange={update('status')}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Priorité</span>
              <select value={form.priority} onChange={update('priority')}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Échéance</span>
              <input type="date" value={form.due_date} onChange={update('due_date')} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Étiquettes</span>
            <input value={form.labels} onChange={update('labels')} placeholder="design, urgent…" />
            <span className="field-hint">Séparées par des virgules.</span>
          </label>
        </fieldset>
        <fieldset className="field" disabled={!canManage}>
          <legend className="field-label">Assignée à</legend>
          {assignable.length === 0 ? (
            <p className="muted small">Aucun membre à assigner : ajoutez des membres au projet.</p>
          ) : (
            <div className="checkbox-list">
              {assignable.map((member) => (
                <label key={member.id} className="checkbox-pill">
                  <input
                    type="checkbox"
                    checked={form.assignee_ids.includes(member.id)}
                    onChange={() => toggleAssignee(member.id)}
                  />
                  {member.full_name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      </form>

      {!isNew && !task.parent_id && (
        <Subtasks project={project} parent={task} subtasks={subtasks} onOpenTask={onOpenTask} onChanged={onChanged} />
      )}
      {!isNew && (
        <>
          <TaskAttachments task={task} project={project} canUpload={canEdit} onChanged={onChanged} />
          <TaskComments task={task} project={project} onChanged={onChanged} />
        </>
      )}
    </Modal>
  );
}

function Subtasks({ project, parent, subtasks, onOpenTask, onChanged }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);
  const canAdd = project.can_manage && project.status === 'actif';
  const done = subtasks.filter((s) => s.status === 'termine').length;

  async function call(action) {
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err);
    }
  }

  const toggle = (subtask) =>
    call(() =>
      api(`/tasks/${subtask.id}`, {
        method: 'PATCH',
        body: { status: subtask.status === 'termine' ? 'a_faire' : 'termine' },
      }),
    );

  function add(event) {
    event.preventDefault();
    call(async () => {
      await api(`/projects/${project.id}/tasks`, { method: 'POST', body: { title, parent_id: parent.id } });
      setTitle('');
    });
  }

  return (
    <section className="task-section" aria-labelledby="subtasks-title">
      <h3 id="subtasks-title">
        Sous-tâches {subtasks.length > 0 && <span className="muted">({done}/{subtasks.length})</span>}
      </h3>
      <ErrorMessage error={error} />
      {subtasks.length > 0 && (
        <ul className="subtask-list">
          {subtasks.map((subtask) => (
            <li key={subtask.id}>
              <input
                type="checkbox"
                checked={subtask.status === 'termine'}
                disabled={!canEditTask(user, project, subtask)}
                onChange={() => toggle(subtask)}
                aria-label={`Terminée : ${subtask.title}`}
              />
              <button
                type="button"
                className={`link-button${subtask.status === 'termine' ? ' is-done' : ''}`}
                onClick={() => onOpenTask(subtask)}
              >
                {subtask.title}
              </button>
              <DueDate task={subtask} />
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <form className="inline-form" onSubmit={add}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nouvelle sous-tâche"
            aria-label="Titre de la nouvelle sous-tâche"
            maxLength={200}
            required
          />
          <button type="submit" className="btn">
            Ajouter
          </button>
        </form>
      )}
    </section>
  );
}
