import { useId, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { ROLE_LABELS } from '../labels.js';
import Modal from './Modal.jsx';
import { ErrorMessage } from './ui.jsx';

/** Création (project absent) ou modification d'un projet. */
export default function ProjectFormModal({ project, onClose, onSaved }) {
  const { user } = useAuth();
  const formId = useId();
  const { data: users } = useApi('/users');
  const ownerId = project ? project.owner_id : user.id;
  const [form, setForm] = useState(() => ({
    name: project?.name ?? '',
    description: project?.description ?? '',
    objectives: project?.objectives ?? '',
    start_date: project?.start_date ?? '',
    end_date: project?.end_date ?? '',
    budget: project?.budget ?? '',
    is_template: project?.is_template ?? false,
    member_ids: project?.members.map((member) => member.id) ?? [],
  }));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const toggleMember = (id) =>
    setForm((f) => ({
      ...f,
      member_ids: f.member_ids.includes(id) ? f.member_ids.filter((m) => m !== id) : [...f.member_ids, id],
    }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      ...form,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: form.budget === '' ? null : Number(form.budget),
    };
    try {
      const saved = project
        ? await api(`/projects/${project.id}`, { method: 'PATCH', body })
        : await api('/projects', { method: 'POST', body });
      onSaved(saved);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={project ? 'Modifier le projet' : 'Nouveau projet'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <ErrorMessage error={error} />
        <label className="field">
          <span className="field-label">Nom du projet</span>
          <input required maxLength={150} value={form.name} onChange={update('name')} autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Description</span>
          <textarea rows={2} value={form.description} onChange={update('description')} />
        </label>
        <label className="field">
          <span className="field-label">Objectifs</span>
          <textarea rows={3} value={form.objectives} onChange={update('objectives')} />
        </label>
        <div className="grid-3">
          <label className="field">
            <span className="field-label">Date de début</span>
            <input type="date" value={form.start_date} onChange={update('start_date')} />
          </label>
          <label className="field">
            <span className="field-label">Date de fin</span>
            <input type="date" value={form.end_date} min={form.start_date || undefined} onChange={update('end_date')} />
          </label>
          <label className="field">
            <span className="field-label">Budget indicatif</span>
            <input type="number" min="0" step="any" inputMode="decimal" value={form.budget} onChange={update('budget')} />
          </label>
        </div>
        <fieldset className="field">
          <legend className="field-label">Membres</legend>
          {users ? (
            <div className="checkbox-list">
              {users.map((u) => (
                <label key={u.id} className="checkbox-pill" title={ROLE_LABELS[u.role]}>
                  <input
                    type="checkbox"
                    checked={u.id === ownerId || form.member_ids.includes(u.id)}
                    disabled={u.id === ownerId}
                    onChange={() => toggleMember(u.id)}
                  />
                  {u.full_name}
                  {u.role === 'invite' && <span className="muted small">(invité)</span>}
                </label>
              ))}
            </div>
          ) : (
            <p className="muted small">Chargement des utilisateurs…</p>
          )}
        </fieldset>
        <label className="checkbox-line">
          <input type="checkbox" checked={form.is_template} onChange={update('is_template')} />
          Utiliser ce projet comme modèle
        </label>
      </form>
    </Modal>
  );
}
