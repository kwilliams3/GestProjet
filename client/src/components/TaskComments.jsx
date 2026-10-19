import { useId, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { formatRelative, initials } from '../utils.js';
import MentionTextarea from './MentionTextarea.jsx';
import { ErrorMessage } from './ui.jsx';

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Met en valeur les « @Prénom Nom » qui correspondent à un membre du projet. */
function CommentBody({ text, members }) {
  if (members.length === 0) return text;
  const names = members
    .map((m) => m.full_name)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const parts = text.split(new RegExp(`(@(?:${names.join('|')}))`, 'giu'));
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="mention">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

/** Commentaires d'une tâche (F11). */
export default function TaskComments({ task, project, onChanged }) {
  const { user } = useAuth();
  const titleId = useId();
  const formRef = useRef(null);
  const { data: comments, error, reload } = useApi(`/tasks/${task.id}/comments`);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const active = project.status === 'actif';

  async function submit(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setActionError(null);
    try {
      await api(`/tasks/${task.id}/comments`, { method: 'POST', body: { body } });
      setBody('');
      reload();
      onChanged();
    } catch (err) {
      setActionError(err);
    } finally {
      setSending(false);
    }
  }

  async function remove(comment) {
    if (!window.confirm('Supprimer ce commentaire ?')) return;
    setActionError(null);
    try {
      await api(`/comments/${comment.id}`, { method: 'DELETE' });
      reload();
      onChanged();
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <section className="task-section" aria-labelledby={titleId}>
      <h3 id={titleId}>
        Commentaires {comments?.length > 0 && <span className="muted">({comments.length})</span>}
      </h3>
      <ErrorMessage error={error ?? actionError} />

      {comments?.length > 0 && (
        <ul className="comment-list">
          {comments.map((comment) => (
            <li key={comment.id} className="comment">
              <span className="avatar" aria-hidden="true">
                {initials(comment.author_name ?? '?')}
              </span>
              <div className="comment-main">
                <div className="comment-head">
                  <strong>{comment.author_name ?? 'Compte supprimé'}</strong>
                  <time className="muted small" dateTime={comment.created_at}>
                    {formatRelative(comment.created_at)}
                  </time>
                  {active && (comment.author_id === user.id || project.can_manage) && (
                    <button
                      type="button"
                      className="btn-link-danger small"
                      onClick={() => remove(comment)}
                      aria-label={`Supprimer le commentaire de ${comment.author_name ?? 'compte supprimé'}`}
                    >
                      Supprimer
                    </button>
                  )}
                </div>
                <p className="comment-body">
                  <CommentBody text={comment.body} members={project.members} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <form ref={formRef} className="comment-form" onSubmit={submit}>
          <MentionTextarea
            value={body}
            onChange={setBody}
            members={project.members.filter((m) => m.id !== user.id)}
            onSubmitShortcut={() => formRef.current.requestSubmit()}
            rows={2}
            maxLength={5000}
            placeholder="Écrire un commentaire… (@ pour mentionner, Ctrl+Entrée pour envoyer)"
            aria-label="Nouveau commentaire"
          />
          <button type="submit" className="btn btn-primary btn-small" disabled={sending || !body.trim()}>
            {sending ? 'Envoi…' : 'Commenter'}
          </button>
        </form>
      )}
    </section>
  );
}
