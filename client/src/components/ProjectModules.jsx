import { useRef, useState } from 'react';
import { api, downloadFile } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { formatBudget, formatDate, formatRelative, formatSize, percent, todayISO } from '../utils.js';
import { ClockIcon, PaperclipIcon, PlusIcon, WalletIcon } from './icons.jsx';
import { EmptyState, ErrorMessage, Loading, ProgressBar } from './ui.jsx';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours} h${remaining ? ` ${remaining} min` : ''}`;
}

export default function ProjectModules({ project, tasks, section }) {
  const { user } = useAuth();
  const expenseQuery = useApi(`/projects/${project.id}/modules/expenses`);
  const documentQuery = useApi(`/projects/${project.id}/modules/documents`);
  const timeQuery = useApi(`/projects/${project.id}/modules/time-entries`);
  const fileInput = useRef(null);
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', spent_on: todayISO() });
  const [timeForm, setTimeForm] = useState({ task_id: '', description: '', minutes: '60', worked_on: todayISO() });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const active = project.status === 'actif';
  const canManage = project.can_manage && active;
  const canLogTime = user.role !== 'invite' && active;
  const expenses = expenseQuery.data ?? [];
  const documents = documentQuery.data ?? [];
  const timeEntries = timeQuery.data ?? [];
  const spent = expenses.reduce((total, expense) => total + expense.amount, 0);
  const loggedMinutes = timeEntries.reduce((total, entry) => total + entry.minutes, 0);
  const errors = [expenseQuery.error, documentQuery.error, timeQuery.error, actionError].filter(Boolean);

  async function run(action) {
    setActionError(null);
    setSaving(true);
    try {
      await action();
    } catch (error) {
      setActionError(error);
    } finally {
      setSaving(false);
    }
  }

  function addExpense(event) {
    event.preventDefault();
    run(async () => {
      await api(`/projects/${project.id}/modules/expenses`, {
        method: 'POST',
        body: { ...expenseForm, amount: Number(expenseForm.amount) },
      });
      setExpenseForm({ title: '', amount: '', spent_on: todayISO() });
      expenseQuery.reload();
    });
  }

  function removeExpense(expense) {
    if (!window.confirm(`Supprimer la dépense « ${expense.title} » ?`)) return;
    run(async () => {
      await api(`/projects/${project.id}/modules/expenses/${expense.id}`, { method: 'DELETE' });
      expenseQuery.reload();
    });
  }

  async function addDocument(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setActionError(new Error(`« ${file.name} » dépasse la taille maximale de 50 Mo.`));
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setActionError(null);
    setUploading(true);
    try {
      await api(`/projects/${project.id}/modules/documents`, { method: 'POST', body: form });
      documentQuery.reload();
    } catch (error) {
      setActionError(error);
    } finally {
      setUploading(false);
    }
  }

  function removeDocument(document) {
    if (!window.confirm(`Supprimer le document « ${document.original_name} » ?`)) return;
    run(async () => {
      await api(`/project-documents/${document.id}`, { method: 'DELETE' });
      documentQuery.reload();
    });
  }

  function addTimeEntry(event) {
    event.preventDefault();
    run(async () => {
      await api(`/projects/${project.id}/modules/time-entries`, {
        method: 'POST',
        body: {
          ...timeForm,
          task_id: timeForm.task_id ? Number(timeForm.task_id) : null,
          minutes: Number(timeForm.minutes),
        },
      });
      setTimeForm((form) => ({ ...form, description: '', minutes: '60' }));
      timeQuery.reload();
    });
  }

  function removeTimeEntry(entry) {
    if (!window.confirm('Supprimer cette saisie de temps ?')) return;
    run(async () => {
      await api(`/projects/${project.id}/modules/time-entries/${entry.id}`, { method: 'DELETE' });
      timeQuery.reload();
    });
  }

  return (
    <div className="project-modules">
      {!active && <p className="notice">Projet archivé : les rubriques sont en lecture seule.</p>}
      {errors.map((error, index) => <ErrorMessage key={`${error.message}-${index}`} error={error} />)}

      {section === 'budget' && (
      <section className="card panel module-panel">
        <div className="module-heading">
          <div>
            <h2><WalletIcon className="inline-icon" /> Budget et dépenses</h2>
            <p className="muted small">
              Saisissez les dépenses du projet et comparez-les au budget prévisionnel. Les montants suivent l’unité utilisée pour le budget du projet.
            </p>
          </div>
        </div>
        <div className="module-budget-summary">
          <div>
            <span className="muted small">Dépenses enregistrées</span>
            <strong>{formatBudget(spent)}</strong>
          </div>
          <div>
            <span className="muted small">Budget prévisionnel</span>
            <strong>{project.budget == null ? 'Non défini' : formatBudget(project.budget)}</strong>
          </div>
          {project.budget != null && (
            <div className={spent > project.budget ? 'overdue' : ''}>
              <span className="muted small">Disponible</span>
              <strong>{formatBudget(project.budget - spent)}</strong>
            </div>
          )}
        </div>
        {project.budget > 0 && (
          <div className="module-progress">
            <div className="progress-caption">
              <span className="muted">Budget consommé</span>
              <strong>{percent(spent, project.budget)} %</strong>
            </div>
            <ProgressBar value={Math.min(percent(spent, project.budget), 100)} label="Budget consommé" />
          </div>
        )}
        {project.budget === 0 && spent > 0 && (
          <p className="overdue small">Budget dépassé de {formatBudget(spent)} (budget prévisionnel nul).</p>
        )}
        {canManage && (
          <form className="module-entry-form" onSubmit={addExpense}>
            <label className="field">
              <span className="field-label">Libellé</span>
              <input required maxLength={200} value={expenseForm.title} onChange={(event) => setExpenseForm({ ...expenseForm, title: event.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Montant</span>
              <input required type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Date</span>
              <input required type="date" value={expenseForm.spent_on} onChange={(event) => setExpenseForm({ ...expenseForm, spent_on: event.target.value })} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <PlusIcon className="btn-icon-svg" /> Ajouter
            </button>
          </form>
        )}
        {expenseQuery.loading && expenses.length === 0 ? (
          <Loading />
        ) : expenses.length === 0 ? (
          <EmptyState>Aucune dépense enregistrée.</EmptyState>
        ) : (
          <ul className="module-list">
            {expenses.map((expense) => (
              <li key={expense.id}>
                <div>
                  <strong>{expense.title}</strong>
                  <span className="muted small">{formatDate(expense.spent_on)} · {expense.created_by_name ?? 'Compte supprimé'}</span>
                </div>
                <strong className="num">{formatBudget(expense.amount)}</strong>
                {canManage && (
                  <button type="button" className="btn-link-danger small" onClick={() => removeExpense(expense)} disabled={saving}>
                    Supprimer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {section === 'documents' && (
      <section className="card panel module-panel">
        <div className="module-heading">
          <div>
            <h2><PaperclipIcon className="inline-icon" /> Documents du projet</h2>
            <p className="muted small">Partagez les fichiers de référence avec les membres du projet (50 Mo maximum par fichier).</p>
          </div>
          {active && (project.can_manage || user.role === 'membre') && (
            <>
              <input ref={fileInput} type="file" hidden onChange={addDocument} />
              <button type="button" className="btn" disabled={uploading} onClick={() => fileInput.current.click()}>
                <PaperclipIcon className="btn-icon-svg" /> {uploading ? 'Envoi en cours…' : 'Ajouter un document'}
              </button>
            </>
          )}
        </div>
        {documentQuery.loading && documents.length === 0 ? (
          <Loading />
        ) : documents.length === 0 ? (
          <EmptyState>Aucun document partagé.</EmptyState>
        ) : (
          <ul className="module-list">
            {documents.map((document) => (
              <li key={document.id}>
                <div>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => run(() => downloadFile(`/project-documents/${document.id}/download`, document.original_name))}
                  >
                    {document.original_name}
                  </button>
                  <span className="muted small">
                    {formatSize(document.size_bytes)} · {document.uploaded_by_name ?? 'Compte supprimé'} · {formatRelative(document.created_at)}
                  </span>
                </div>
                {active && (project.can_manage || document.uploaded_by === user.id) && (
                  <button type="button" className="btn-link-danger small" onClick={() => removeDocument(document)} disabled={saving}>
                    Supprimer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {section === 'temps' && (
      <section className="card panel module-panel">
        <div className="module-heading">
          <div>
            <h2><ClockIcon className="inline-icon" /> Temps passé</h2>
            <p className="muted small">Enregistrez manuellement le temps consacré au projet ou à une tâche.</p>
          </div>
          <strong className="module-total">{durationLabel(loggedMinutes)} au total</strong>
        </div>
        {canLogTime && (
          <form className="module-entry-form time-entry-form" onSubmit={addTimeEntry}>
            <label className="field">
              <span className="field-label">Tâche (facultatif)</span>
              <select value={timeForm.task_id} onChange={(event) => setTimeForm({ ...timeForm, task_id: event.target.value })}>
                <option value="">Projet en général</option>
                {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Durée (minutes)</span>
              <input required type="number" min="1" max="1440" step="1" value={timeForm.minutes} onChange={(event) => setTimeForm({ ...timeForm, minutes: event.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Date</span>
              <input required type="date" value={timeForm.worked_on} onChange={(event) => setTimeForm({ ...timeForm, worked_on: event.target.value })} />
            </label>
            <label className="field time-entry-description">
              <span className="field-label">Description (facultative)</span>
              <input maxLength={500} value={timeForm.description} onChange={(event) => setTimeForm({ ...timeForm, description: event.target.value })} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <PlusIcon className="btn-icon-svg" /> Ajouter
            </button>
          </form>
        )}
        {timeQuery.loading && timeEntries.length === 0 ? (
          <Loading />
        ) : timeEntries.length === 0 ? (
          <EmptyState>Aucun temps enregistré.</EmptyState>
        ) : (
          <ul className="module-list">
            {timeEntries.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.task_title ?? 'Projet'}{entry.description ? ` · ${entry.description}` : ''}</strong>
                  <span className="muted small">{formatDate(entry.worked_on)} · {entry.user_name ?? 'Compte supprimé'}</span>
                </div>
                <strong className="num">{durationLabel(entry.minutes)}</strong>
                {active && (project.can_manage || entry.user_id === user.id) && (
                  <button type="button" className="btn-link-danger small" onClick={() => removeTimeEntry(entry)} disabled={saving}>
                    Supprimer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
    </div>
  );
}
