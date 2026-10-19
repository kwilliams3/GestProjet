import { useId, useRef, useState } from 'react';
import { api, downloadFile } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { formatRelative, formatSize } from '../utils.js';
import { PaperclipIcon } from './icons.jsx';
import { ErrorMessage } from './ui.jsx';

const MAX_SIZE = 50 * 1024 * 1024;

/** Pièces jointes d'une tâche (F11), 50 Mo maximum par fichier. */
export default function TaskAttachments({ task, project, canUpload, onChanged }) {
  const { user } = useAuth();
  const titleId = useId();
  const inputRef = useRef(null);
  const { data: files, error, reload } = useApi(`/tasks/${task.id}/attachments`);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const active = project.status === 'actif';

  async function run(action) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err);
    }
  }

  async function upload(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_SIZE) {
      setActionError(new Error(`« ${file.name} » dépasse la taille maximale de 50 Mo.`));
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setUploading(true);
    await run(async () => {
      await api(`/tasks/${task.id}/attachments`, { method: 'POST', body: form });
      reload();
      onChanged();
    });
    setUploading(false);
  }

  const remove = (file) => {
    if (!window.confirm(`Supprimer « ${file.original_name} » ?`)) return;
    run(async () => {
      await api(`/attachments/${file.id}`, { method: 'DELETE' });
      reload();
      onChanged();
    });
  };

  return (
    <section className="task-section" aria-labelledby={titleId}>
      <div className="task-section-head">
        <h3 id={titleId}>
          Pièces jointes {files?.length > 0 && <span className="muted">({files.length})</span>}
        </h3>
        {canUpload && active && (
          <>
            <input ref={inputRef} type="file" hidden onChange={upload} />
            <button type="button" className="btn btn-small" disabled={uploading} onClick={() => inputRef.current.click()}>
              <PaperclipIcon className="btn-icon-svg" />
              {uploading ? 'Envoi en cours…' : 'Joindre un fichier'}
            </button>
          </>
        )}
      </div>
      <ErrorMessage error={error ?? actionError} />

      {files?.length === 0 && <p className="muted small">Aucun fichier.</p>}
      {files?.length > 0 && (
        <ul className="attachment-list">
          {files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                className="link-button"
                onClick={() => run(() => downloadFile(`/attachments/${file.id}/download`, file.original_name))}
              >
                {file.original_name}
              </button>
              <span className="muted small">
                {formatSize(file.size_bytes)} · {file.uploaded_by_name ?? 'compte supprimé'} · {formatRelative(file.created_at)}
              </span>
              {active && (file.uploaded_by === user.id || project.can_manage) && (
                <button
                  type="button"
                  className="btn-link-danger small"
                  onClick={() => remove(file)}
                  aria-label={`Supprimer ${file.original_name}`}
                >
                  Supprimer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
