import { useState } from 'react';
import { api } from '../api.js';
import { EMPTY_FILTER, isFilterActive } from '../filters.js';
import { useApi } from '../hooks.js';
import { PRIORITIES, PRIORITY_LABELS } from '../labels.js';
import { ErrorMessage } from './ui.jsx';

/** Barre de filtres des tâches d'un projet, avec filtres enregistrés (F17). */
export default function TaskFilters({ filter, onChange, members, labels, shown, total }) {
  const { data: saved, setData: setSaved } = useApi('/filters');
  const [savedId, setSavedId] = useState('');
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const active = isFilterActive(filter);

  const update = (field) => (event) => {
    setSavedId('');
    onChange({ ...filter, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value });
  };

  function applySaved(event) {
    const id = event.target.value;
    setSavedId(id);
    const found = saved.find((f) => String(f.id) === id);
    onChange(found ? { ...EMPTY_FILTER, ...found.criteria } : EMPTY_FILTER);
  }

  function clear() {
    setSavedId('');
    onChange(EMPTY_FILTER);
  }

  async function save(event) {
    event.preventDefault();
    setError(null);
    try {
      const created = await api('/filters', { method: 'POST', body: { name, criteria: filter } });
      setSaved((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
      setSavedId(String(created.id));
      setNaming(false);
      setName('');
    } catch (err) {
      setError(err);
    }
  }

  async function removeSaved() {
    setError(null);
    try {
      await api(`/filters/${savedId}`, { method: 'DELETE' });
      setSaved((list) => list.filter((f) => String(f.id) !== savedId));
      setSavedId('');
    } catch (err) {
      setError(err);
    }
  }

  return (
    <div className="filters" role="search" aria-label="Filtrer les tâches">
      <div className="filters-row">
        <input
          type="search"
          value={filter.q}
          onChange={update('q')}
          placeholder="Filtrer les tâches…"
          aria-label="Texte recherché dans les tâches"
          className="filter-text"
        />
        <select value={filter.assignee} onChange={update('assignee')} aria-label="Personne assignée">
          <option value="">Toutes les personnes</option>
          <option value="me">Mes tâches</option>
          <option value="none">Non assignées</option>
          {members.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.full_name}
            </option>
          ))}
        </select>
        <select value={filter.priority} onChange={update('priority')} aria-label="Priorité">
          <option value="">Toutes priorités</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        {labels.length > 0 && (
          <select value={filter.label} onChange={update('label')} aria-label="Étiquette">
            <option value="">Toutes étiquettes</option>
            {labels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        )}
        <label className="checkbox-line">
          <input type="checkbox" checked={filter.overdue} onChange={update('overdue')} />
          En retard
        </label>
      </div>

      <div className="filters-row">
        {saved?.length > 0 && (
          <select value={savedId} onChange={applySaved} aria-label="Filtres enregistrés">
            <option value="">Filtres enregistrés…</option>
            {saved.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        {savedId && (
          <button type="button" className="btn btn-small btn-ghost" onClick={removeSaved}>
            Supprimer ce filtre
          </button>
        )}
        {active && !savedId && !naming && (
          <button type="button" className="btn btn-small" onClick={() => setNaming(true)}>
            Enregistrer ce filtre
          </button>
        )}
        {naming && (
          <form className="inline-form" onSubmit={save}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nom du filtre"
              aria-label="Nom du filtre"
              maxLength={60}
              required
              autoFocus
            />
            <button type="submit" className="btn btn-small btn-primary">
              Enregistrer
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setNaming(false)}>
              Annuler
            </button>
          </form>
        )}
        {active && (
          <>
            <span className="small muted filter-count" aria-live="polite">
              {shown} tâche{shown > 1 ? 's' : ''} sur {total}
            </span>
            <button type="button" className="btn btn-small btn-ghost" onClick={clear}>
              Effacer les filtres
            </button>
          </>
        )}
      </div>
      <ErrorMessage error={error} />
    </div>
  );
}
