import { Link } from 'react-router';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { canCreateProjects } from '../permissions.js';
import { formatDate, percent, projectColor, todayISO, todayLong } from '../utils.js';
import { AlertIcon, CheckCircleIcon, ClockIcon, ListIcon } from '../components/icons.jsx';
import { Avatar, EmptyState, ErrorMessage, Loading, PageHeader, ProgressBar } from '../components/ui.jsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, error } = useApi('/dashboard');

  if (error) return <ErrorMessage error={error} />;
  if (!data) return <Loading />;

  const { totals, projects, workload } = data;
  const firstName = user.full_name.split(' ')[0];

  return (
    <>
      <PageHeader eyebrow={todayLong()} title={`Bonjour ${firstName}`} subtitle="Voici l'avancement de vos projets actifs." />

      <div className="stats">
        <StatTile icon={ListIcon} label="Tâches" value={totals.total} hint={`dans ${projects.length} projet${projects.length > 1 ? 's' : ''}`} />
        <StatTile icon={CheckCircleIcon} tone="success" label="Terminées" value={totals.done} hint={`${percent(totals.done, totals.total)} % du total`} />
        <StatTile icon={ClockIcon} tone="info" label="En cours" value={totals.in_progress} hint="en ce moment" />
        <StatTile
          icon={AlertIcon}
          tone={totals.overdue > 0 ? 'danger' : 'neutral'}
          label="En retard"
          value={totals.overdue}
          hint={totals.overdue > 0 ? 'échéance dépassée' : 'aucun retard'}
        />
      </div>

      <div className="dashboard-grid">
        <section className="card panel">
          <h2>Avancement par projet</h2>
          {projects.length === 0 ? (
            <EmptyState>
              Aucun projet actif.{' '}
              {canCreateProjects(user) ? <Link to="/projets">Créer un premier projet</Link> : 'Un chef de projet doit vous y ajouter.'}
            </EmptyState>
          ) : (
            <ul className="project-rows">
              {projects.map((project) => {
                const progress = percent(project.done, project.total);
                const late = project.end_date && project.end_date < todayISO() && progress < 100;
                return (
                  <li key={project.id} className="project-row">
                    <div className="project-row-main">
                      <Link to={`/projets/${project.id}`} className="project-row-name">
                        <span className="project-dot" style={{ background: projectColor(project.id) }} aria-hidden="true" />
                        <span className="truncate">{project.name}</span>
                      </Link>
                      <span className="project-row-meta small muted">
                        {project.done}/{project.total} terminées
                        {project.overdue > 0 && (
                          <span className="overdue">
                            <AlertIcon className="inline-icon" />
                            {project.overdue} en retard
                          </span>
                        )}
                        <span className={late ? 'overdue' : undefined}>
                          Fin : {formatDate(project.end_date)}
                          {late && ' (dépassée)'}
                        </span>
                      </span>
                    </div>
                    <div className="project-row-progress">
                      <ProgressBar value={progress} label={`Avancement de ${project.name}`} />
                      <span className="progress-value">{progress} %</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <StatusBreakdown totals={totals} />
      </div>

      <section className="card panel">
        <h2>Charge par membre</h2>
        {workload.length === 0 ? (
          <EmptyState>Aucune tâche assignée pour le moment.</EmptyState>
        ) : (
          <Workload workload={workload} />
        )}
      </section>
    </>
  );
}

function StatTile({ icon: TileIcon, label, value, hint, tone = 'accent' }) {
  return (
    <div className={`card stat stat-${tone}`}>
      <span className="stat-icon" aria-hidden="true">
        <TileIcon />
      </span>
      <div>
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    </div>
  );
}

/** Répartition des tâches par statut : barre empilée + légende chiffrée (qui sert aussi de tableau). */
function StatusBreakdown({ totals }) {
  const segments = [
    { key: 'termine', label: 'Terminées', value: totals.done },
    { key: 'en_cours', label: 'En cours', value: totals.in_progress },
    { key: 'a_faire', label: 'À faire', value: totals.total - totals.done - totals.in_progress },
  ];
  const description = segments.map((s) => `${s.label} : ${s.value}`).join(', ');

  return (
    <section className="card panel">
      <h2>Répartition des tâches</h2>
      {totals.total === 0 ? (
        <EmptyState>Aucune tâche pour le moment.</EmptyState>
      ) : (
        <>
          <p className="breakdown-figure">
            {percent(totals.done, totals.total)} %<span className="muted"> des tâches terminées</span>
          </p>
          <div className="stack-bar" role="img" aria-label={`Répartition des tâches. ${description}`}>
            {segments
              .filter((s) => s.value > 0)
              .map((s) => (
                <span
                  key={s.key}
                  className={`stack-seg seg-${s.key}`}
                  style={{ flexGrow: s.value }}
                  title={`${s.label} : ${s.value} (${percent(s.value, totals.total)} %)`}
                />
              ))}
          </div>
          <ul className="legend">
            {segments.map((s) => (
              <li key={s.key}>
                <span className={`legend-swatch seg-${s.key}`} aria-hidden="true" />
                <span className="legend-label">{s.label}</span>
                <strong className="num">{s.value}</strong>
                <span className="muted num legend-pct">{percent(s.value, totals.total)} %</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Tâches ouvertes par membre : une barre horizontale par personne, la valeur au bout de la barre. */
function Workload({ workload }) {
  const max = Math.max(1, ...workload.map((m) => m.open_tasks));
  return (
    <div className="table-wrap">
      <table className="table workload">
        <thead>
          <tr>
            <th scope="col">Membre</th>
            <th scope="col">Tâches ouvertes</th>
            <th scope="col" className="num-col">
              Dont en cours
            </th>
            <th scope="col" className="num-col">
              En retard
            </th>
          </tr>
        </thead>
        <tbody>
          {workload.map((member) => (
            <tr key={member.id}>
              <td>
                <span className="person">
                  <Avatar name={member.full_name} />
                  {member.full_name}
                </span>
              </td>
              <td className="bar-cell">
                <span className="hbar">
                  <span className="hbar-fill" style={{ width: `calc((100% - 2.5rem) * ${member.open_tasks / max})` }} />
                  <span className="hbar-value num">{member.open_tasks}</span>
                </span>
              </td>
              <td className="num num-col">{member.in_progress}</td>
              <td className="num num-col">
                {member.overdue > 0 ? (
                  <span className="overdue">
                    <AlertIcon className="inline-icon" />
                    {member.overdue}
                  </span>
                ) : (
                  <span className="muted">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
