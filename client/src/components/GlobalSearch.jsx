import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api.js';
import { useDismiss } from '../hooks.js';
import { STATUS_LABELS } from '../labels.js';

/** Recherche globale (F17), toujours visible. Raccourcis : « / » ou Ctrl+K. */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);

  useDismiss(containerRef, open, () => setOpen(false));

  useEffect(() => {
    function onKeyDown(event) {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
      const ctrlK = event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey);
      if (ctrlK || (event.key === '/' && !typing)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Recherche lancée 250 ms après la dernière frappe.
  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) {
      setResults(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api(`/search?q=${encodeURIComponent(q)}`).then(
        (data) => !cancelled && setResults(data),
        () => !cancelled && setResults({ projects: [], tasks: [] }),
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text]);

  function go(url) {
    setOpen(false);
    setText('');
    navigate(url);
  }

  // Flèches haut/bas pour passer du champ aux résultats.
  function handleKeyDown(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = [...containerRef.current.querySelectorAll('.search-result')];
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? Math.min(index + 1, items.length - 1) : index - 1;
    if (next < 0) inputRef.current.focus();
    else items[next].focus();
  }

  const count = results ? results.projects.length + results.tasks.length : 0;

  return (
    <div className="search" ref={containerRef} role="search" onKeyDown={handleKeyDown}>
      <input
        ref={inputRef}
        type="search"
        value={text}
        placeholder="Rechercher un projet ou une tâche…"
        aria-label="Recherche globale (raccourci : /)"
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      <kbd className="search-hint" aria-hidden="true">
        /
      </kbd>
      {open && results && (
        <div className="card search-results">
          {count === 0 && <p className="muted small">Aucun résultat pour « {text.trim()} ».</p>}
          {results.projects.length > 0 && (
            <section>
              <h2 className="search-group">Projets</h2>
              {results.projects.map((project) => (
                <button key={project.id} type="button" className="search-result" onClick={() => go(`/projets/${project.id}`)}>
                  <span>{project.name}</span>
                  <span className="muted small">
                    {project.is_template ? 'Modèle' : project.status === 'archive' ? 'Archivé' : ''}
                  </span>
                </button>
              ))}
            </section>
          )}
          {results.tasks.length > 0 && (
            <section>
              <h2 className="search-group">Tâches</h2>
              {results.tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="search-result"
                  onClick={() => go(`/projets/${task.project_id}?tache=${task.id}`)}
                >
                  <span>{task.title}</span>
                  <span className="muted small">
                    {task.project_name} · {STATUS_LABELS[task.status]}
                  </span>
                </button>
              ))}
            </section>
          )}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {results ? `${count} résultat${count > 1 ? 's' : ''}` : ''}
      </p>
    </div>
  );
}
