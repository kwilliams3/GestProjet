import { useId, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { ROLES, ROLE_LABELS } from '../labels.js';
import Modal from './Modal.jsx';
import { ErrorMessage } from './ui.jsx';

/**
 * Invitation par e-mail (F02). Depuis un projet, `project` est imposé ; l'administrateur peut aussi
 * inviter sans projet, avec n'importe quel rôle. Le chef de projet invite des membres ou des invités.
 */
export default function InviteModal({ project = null, onClose, onInvited }) {
  const { user } = useAuth();
  const formId = useId();
  const isAdmin = user.role === 'admin';
  const roles = isAdmin ? ROLES : ['membre', 'invite'];
  const [form, setForm] = useState({ email: '', role: 'membre', project_id: project ? String(project.id) : '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const body = { email: form.email, role: form.role, project_id: form.project_id ? Number(form.project_id) : null };
      setResult(await api('/invitations', { method: 'POST', body }));
      onInvited?.();
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  function inviteAnother() {
    setResult(null);
    setForm((f) => ({ ...f, email: '' }));
  }

  return (
    <Modal
      title={project ? `Inviter sur « ${project.name} »` : 'Inviter une personne'}
      onClose={onClose}
      footer={
        result ? (
          <>
            <button type="button" className="btn" onClick={inviteAnother}>
              Inviter une autre personne
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Terminer
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" form={formId} className="btn btn-primary" disabled={sending}>
              {sending ? 'Envoi…' : "Envoyer l'invitation"}
            </button>
          </>
        )
      }
    >
      {result ? (
        <InvitationResult result={result} />
      ) : (
        <form id={formId} onSubmit={handleSubmit}>
          <ErrorMessage error={error} />
          <label className="field">
            <span className="field-label">E-mail de la personne</span>
            <input type="email" required value={form.email} onChange={update('email')} autoFocus />
          </label>
          <label className="field">
            <span className="field-label">Rôle</span>
            <select value={form.role} onChange={update('role')}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          {!project && isAdmin && <ProjectSelect value={form.project_id} onChange={update('project_id')} />}
        </form>
      )}
    </Modal>
  );
}

function ProjectSelect({ value, onChange }) {
  const { data: projects } = useApi('/projects');
  return (
    <label className="field">
      <span className="field-label">Projet (facultatif)</span>
      <select value={value} onChange={onChange}>
        <option value="">Aucun projet</option>
        {projects
          ?.filter((p) => !p.is_template)
          .map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
      </select>
    </label>
  );
}

function InvitationResult({ result }) {
  const inputRef = useRef(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
    } catch {
      inputRef.current.select(); // presse-papiers indisponible : le lien est sélectionné pour Ctrl+C
    }
  }

  return (
    <div className="invite-result" role="status">
      <p>
        Invitation créée pour <strong>{result.email}</strong>, valable 7 jours.{' '}
        {result.email_sent
          ? 'Elle a été envoyée par e-mail.'
          : "L'envoi d'e-mails n'est pas configuré : transmettez-lui ce lien vous-même."}
      </p>
      <div className="copy-row">
        <input ref={inputRef} readOnly value={result.link} aria-label="Lien d'invitation" onFocus={(e) => e.target.select()} />
        <button type="button" className="btn" onClick={copy}>
          {copied ? 'Copié ✓' : 'Copier'}
        </button>
      </div>
    </div>
  );
}
