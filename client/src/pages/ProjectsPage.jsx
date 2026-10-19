import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { canCreateProjects } from '../permissions.js';
import { formatDate, percent, projectColor } from '../utils.js';
import ProjectFormModal from '../components/ProjectFormModal.jsx';
import { AlertIcon, CalendarIcon, CheckSquareIcon, CopyIcon, FolderIcon, PlusIcon } from '../components/icons.jsx';
import { EmptyState, ErrorMessage, Loading, PageHeader, ProgressBar } from '../components/ui.jsx';

export default function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('actif');
  const { data: projects, error } = useApi(`/projects?status=${tab}`);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState(null);
  const canCreate = canCreateProjects(user);

  async function duplicate(project) {
    setActionError(null);
    try {
      const copy = await api(`/projects/${project.id}/duplicate`, { method: 'POST', body: {} });
      navigate(`/projets/${copy.id}`);
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <>
      <PageHeader title="Projets" subtitle="Tous les projets auxquels vous participez.">
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <PlusIcon className="btn-icon-svg" />
            Nouveau projet
          </button>
        )}
      </PageHeader>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Projets affichés">
          <button type="button" aria-pressed={tab === 'actif'} onClick={() => setTab('actif')}>
            Actifs
          </button>
          <button type="button" aria-pressed={tab === 'archive'} onClick={() => setTab('archive')}>
            Archivés
          </button>
        </div>
      </div>

      <ErrorMessage error={error ?? actionError} />
      {!projects && !error && <Loading />}
      {projects?.length === 0 && (
        <EmptyState>{tab === 'actif' ? 'Aucun projet actif pour le moment.' : 'Aucun projet archivé.'}</EmptyState>
      )}

      {projects?.length > 0 && (
        <div className="project-grid">
          {projects.map((project) => {
            const progress = percent(project.done_count, project.task_count);
            return (
              <article
                key={project.id}
                className={`card project-card${project.is_template ? ' is-template' : ''}`}
                style={{ '--project-color': projectColor(project.id) }}
              >
                <div className="project-card-head">
                  <span className="project-icon" aria-hidden="true">
                    <FolderIcon />
                  </span>
                  <div className="project-card-title">
                    <h2>
                      <Link to={`/projets/${project.id}`}>{project.name}</Link>
                    </h2>
                    <p className="small muted">Responsable : {project.owner_name}</p>
                  </div>
                  {project.is_template && <span className="badge badge-accent">Modèle</span>}
                </div>

                {project.description && <p className="muted clamp project-card-desc">{project.description}</p>}

                {project.is_template ? (
                  <p className="meta-item small muted">
                    <CheckSquareIcon className="inline-icon" />
                    {project.task_count} tâches prévues
                  </p>
                ) : (
                  <>
                    <div className="project-card-progress">
                      <div className="progress-caption small">
                        <span className="muted">Avancement</span>
                        <strong>{progress} %</strong>
                      </div>
                      <ProgressBar value={progress} label={`Avancement de ${project.name}`} />
                    </div>
                    <div className="project-card-meta small">
                      <span className="meta-item muted">
                        <CheckSquareIcon className="inline-icon" />
                        {project.done_count}/{project.task_count} tâches
                      </span>
                      {project.overdue_count > 0 && (
                        <span className="meta-item overdue">
                          <AlertIcon className="inline-icon" />
                          {project.overdue_count} en retard
                        </span>
                      )}
                      <span className="meta-item muted">
                        <CalendarIcon className="inline-icon" />
                        {formatDate(project.end_date)}
                      </span>
                    </div>
                  </>
                )}

                {canCreate && (
                  <div className="project-card-actions">
                    <button type="button" className="btn btn-small btn-ghost" onClick={() => duplicate(project)}>
                      <CopyIcon className="btn-icon-svg" />
                      {project.is_template ? 'Créer un projet depuis ce modèle' : 'Dupliquer'}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {creating && (
        <ProjectFormModal onClose={() => setCreating(false)} onSaved={(project) => navigate(`/projets/${project.id}`)} />
      )}
    </>
  );
}
