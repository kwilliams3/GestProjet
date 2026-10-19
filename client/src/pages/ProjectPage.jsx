import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { EMPTY_FILTER, isFilterActive, matchesFilter } from '../filters.js';
import { useApi } from '../hooks.js';
import { canCreateProjects, canEditTask } from '../permissions.js';
import { formatBudget, formatDate, groupTasks, percent, projectColor } from '../utils.js';
import {
  ArchiveIcon,
  CalendarIcon,
  CopyIcon,
  DashboardIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
  TargetIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
} from '../components/icons.jsx';
import InviteModal from '../components/InviteModal.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import ProjectFormModal from '../components/ProjectFormModal.jsx';
import TaskFilters from '../components/TaskFilters.jsx';
import TaskList from '../components/TaskList.jsx';
import TaskModal from '../components/TaskModal.jsx';
import { Avatars, ErrorMessage, Loading, PageHeader, ProgressBar } from '../components/ui.jsx';

function Fact({ icon: FactIcon, label, children }) {
  return (
    <div className="fact">
      <span className="fact-icon" aria-hidden="true">
        <FactIcon />
      </span>
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  // La tâche ouverte est dans l'adresse (?tache=12) : lien partageable, ouvert depuis la recherche ou une notification.
  const [searchParams, setSearchParams] = useSearchParams();
  const projectQuery = useApi(`/projects/${id}`);
  const tasksQuery = useApi(`/projects/${id}/tasks`);
  const [view, setView] = useState('kanban');
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [editingProject, setEditingProject] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [actionError, setActionError] = useState(null);

  const tasks = tasksQuery.data;
  const { topLevel, subtasksByParent } = useMemo(() => groupTasks(tasks ?? []), [tasks]);
  // Une tâche reste affichée si elle ou l'une de ses sous-tâches correspond au filtre.
  const visibleTasks = useMemo(() => {
    if (!isFilterActive(filter)) return topLevel;
    const matches = (task) => matchesFilter(task, filter, user.id);
    return topLevel.filter((task) => matches(task) || (subtasksByParent.get(task.id) ?? []).some(matches));
  }, [topLevel, subtasksByParent, filter, user.id]);
  const labels = useMemo(
    () => [...new Set((tasks ?? []).flatMap((t) => t.labels))].sort((a, b) => a.localeCompare(b, 'fr')),
    [tasks],
  );

  const project = projectQuery.data;
  if (projectQuery.error || tasksQuery.error) return <ErrorMessage error={projectQuery.error ?? tasksQuery.error} />;
  if (!project || !tasks) return <Loading />;

  const active = project.status === 'actif';
  const done = tasks.filter((task) => task.status === 'termine').length;
  const progress = percent(done, tasks.length);
  const openTaskId = Number(searchParams.get('tache'));
  const openTask = tasks.find((task) => task.id === openTaskId);
  const openTaskById = (taskId) => setSearchParams({ tache: String(taskId) }, { replace: true });
  const closeTask = () => setSearchParams({}, { replace: true });

  async function runAction(action) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err);
    }
  }

  // Déplacement Kanban : affichage immédiat, puis enregistrement (annulé si l'API refuse).
  function moveTask(task, status) {
    tasksQuery.setData((list) => list.map((t) => (t.id === task.id ? { ...t, status } : t)));
    runAction(async () => {
      try {
        const updated = await api(`/tasks/${task.id}`, { method: 'PATCH', body: { status } });
        tasksQuery.setData((list) => list.map((t) => (t.id === updated.id ? updated : t)));
      } catch (err) {
        tasksQuery.reload();
        throw err;
      }
    });
  }

  const toggleArchive = () =>
    runAction(async () => {
      const updated = await api(`/projects/${project.id}`, {
        method: 'PATCH',
        body: { status: active ? 'archive' : 'actif' },
      });
      projectQuery.setData(updated);
    });

  const duplicate = () =>
    runAction(async () => {
      const copy = await api(`/projects/${project.id}/duplicate`, { method: 'POST', body: {} });
      navigate(`/projets/${copy.id}`);
    });

  return (
    <>
      <PageHeader
        title={
          <span className="project-title">
            <span className="project-dot project-dot-lg" style={{ background: projectColor(project.id) }} aria-hidden="true" />
            {project.name}
          </span>
        }
        subtitle={
          <>
            {!active && <span className="badge">Archivé</span>}
            {project.is_template && <span className="badge badge-accent">Modèle</span>}
            {project.description && <span>{project.description}</span>}
          </>
        }
      >
        {project.can_manage && (
          <>
            <button type="button" className="btn" onClick={() => setEditingProject(true)}>
              <PencilIcon className="btn-icon-svg" />
              Modifier
            </button>
            {active && !project.is_template && (
              <button type="button" className="btn" onClick={() => setInviting(true)}>
                <UserPlusIcon className="btn-icon-svg" />
                Inviter
              </button>
            )}
            <button type="button" className="btn" onClick={toggleArchive}>
              <ArchiveIcon className="btn-icon-svg" />
              {active ? 'Archiver' : 'Désarchiver'}
            </button>
          </>
        )}
        {canCreateProjects(user) && (
          <button type="button" className="btn" onClick={duplicate}>
            <CopyIcon className="btn-icon-svg" />
            Dupliquer
          </button>
        )}
      </PageHeader>

      <ErrorMessage error={actionError} />
      {!active && <p className="notice">Ce projet est archivé : il est en lecture seule.</p>}

      <section className="card panel project-overview">
        <dl className="facts">
          <Fact icon={CalendarIcon} label="Période">
            {formatDate(project.start_date)} → {formatDate(project.end_date)}
          </Fact>
          <Fact icon={WalletIcon} label="Budget indicatif">
            {formatBudget(project.budget)}
          </Fact>
          <Fact icon={UserIcon} label="Responsable">
            {project.owner_name}
          </Fact>
          <Fact icon={UsersIcon} label={`Membres (${project.members.length})`}>
            <Avatars people={project.members} max={6} />
          </Fact>
        </dl>
        <div className="overview-progress">
          <div className="progress-caption">
            <span className="muted">Avancement</span>
            <strong>
              {progress} % <span className="muted small">· {done}/{tasks.length} tâches</span>
            </strong>
          </div>
          <ProgressBar value={progress} label="Avancement du projet" />
        </div>
        {project.objectives && (
          <div className="objectives">
            <h2>
              <TargetIcon className="inline-icon" />
              Objectifs
            </h2>
            <p className="pre-line">{project.objectives}</p>
          </div>
        )}
      </section>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Affichage des tâches">
          <button type="button" aria-pressed={view === 'kanban'} onClick={() => setView('kanban')}>
            <DashboardIcon className="btn-icon-svg" />
            Kanban
          </button>
          <button type="button" aria-pressed={view === 'liste'} onClick={() => setView('liste')}>
            <ListIcon className="btn-icon-svg" />
            Liste
          </button>
        </div>
        {project.can_manage && active && (
          <button type="button" className="btn btn-primary" onClick={() => setCreatingTask(true)}>
            <PlusIcon className="btn-icon-svg" />
            Nouvelle tâche
          </button>
        )}
      </div>

      {topLevel.length > 0 && (
        <TaskFilters
          filter={filter}
          onChange={setFilter}
          members={project.members.filter((m) => m.role !== 'invite')}
          labels={labels}
          shown={visibleTasks.length}
          total={topLevel.length}
        />
      )}

      {view === 'kanban' ? (
        <KanbanBoard
          tasks={visibleTasks}
          subtasksByParent={subtasksByParent}
          canEdit={(task) => canEditTask(user, project, task)}
          onOpen={(task) => openTaskById(task.id)}
          onMove={moveTask}
        />
      ) : (
        <TaskList tasks={visibleTasks} subtasksByParent={subtasksByParent} onOpen={(task) => openTaskById(task.id)} />
      )}

      {editingProject && (
        <ProjectFormModal
          project={project}
          onClose={() => setEditingProject(false)}
          onSaved={(updated) => {
            projectQuery.setData(updated);
            tasksQuery.reload();
            setEditingProject(false);
          }}
        />
      )}

      {inviting && <InviteModal project={project} onClose={() => setInviting(false)} />}

      {creatingTask && (
        <TaskModal
          key="nouvelle"
          project={project}
          task={null}
          onClose={() => setCreatingTask(false)}
          onChanged={tasksQuery.reload}
        />
      )}

      {openTask && (
        <TaskModal
          key={openTask.id}
          project={project}
          task={openTask}
          subtasks={subtasksByParent.get(openTask.id) ?? []}
          onOpenTask={(task) => openTaskById(task.id)}
          onClose={closeTask}
          onChanged={tasksQuery.reload}
        />
      )}
    </>
  );
}
