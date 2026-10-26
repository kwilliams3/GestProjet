import { Link } from 'react-router';
import { useApi } from '../hooks.js';
import { formatBudget, formatDate, percent } from '../utils.js';
import { AlertIcon, CheckCircleIcon, ClockIcon, ListIcon } from '../components/icons.jsx';
import { EmptyState, ErrorMessage, Loading, PageHeader, ProgressBar } from '../components/ui.jsx';

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours} h${remaining ? ` ${remaining} min` : ''}`;
}

function StatTile({ icon: StatIcon, label, value, tone = 'accent' }) {
  return (
    <div className={`card stat stat-${tone}`}>
      <span className="stat-icon" aria-hidden="true"><StatIcon /></span>
      <div>
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { data, error } = useApi('/reports');
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <Loading />;

  const { totals, projects } = data;
  const progress = percent(totals.done, totals.tasks);
  const budgeted = projects.filter((project) => project.budget != null);

  return (
    <>
      <PageHeader
        eyebrow="Vue d’ensemble"
        title="Rapports"
        subtitle="Synthèse de l’avancement, des échéances, des budgets et du temps enregistré."
      />

      <div className="stats">
        <StatTile icon={ListIcon} label="Projets actifs" value={totals.projects} />
        <StatTile icon={CheckCircleIcon} tone="success" label="Tâches terminées" value={`${progress} %`} />
        <StatTile icon={AlertIcon} tone={totals.overdue ? 'danger' : 'neutral'} label="En retard" value={totals.overdue} />
        <StatTile icon={ClockIcon} tone="info" label="Temps enregistré" value={formatDuration(totals.minutes_logged)} />
      </div>

      <section className="card panel report-overview">
        <h2>Avancement global</h2>
        <div className="progress-caption">
          <span className="muted">{totals.done} terminées · {totals.in_progress} en cours · {totals.tasks} au total</span>
          <strong>{progress} %</strong>
        </div>
        <ProgressBar value={progress} label="Avancement global des projets" />
      </section>

      {projects.length === 0 ? (
        <EmptyState>Aucun projet visible pour établir un rapport.</EmptyState>
      ) : (
        <section className="card panel">
          <h2>Résultats par projet</h2>
          <div className="table-wrap">
            <table className="table report-table">
              <thead>
                <tr>
                  <th scope="col">Projet</th>
                  <th scope="col">Avancement</th>
                  <th scope="col">Retards</th>
                  <th scope="col">Dépenses / budget</th>
                  <th scope="col">Temps</th>
                  <th scope="col">Fin prévue</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => {
                  const done = percent(project.done_count, project.task_count);
                  return (
                    <tr key={project.id}>
                      <td>
                        <Link to={`/projets/${project.id}`} className="strong-link">{project.name}</Link>
                        {project.status === 'archive' && <span className="badge report-archive">Archivé</span>}
                      </td>
                      <td className="report-progress">
                        <ProgressBar value={done} label={`Avancement de ${project.name}`} />
                        <span className="small num">{project.done_count}/{project.task_count} · {done} %</span>
                      </td>
                      <td className={project.overdue_count ? 'overdue num' : 'num'}>
                        {project.overdue_count}
                      </td>
                      <td className="num">
                        {formatBudget(project.spent)} / {project.budget == null ? '—' : formatBudget(project.budget)}
                        {project.budget != null && project.budget > 0 && (
                          <span className={`report-budget-note${project.spent > project.budget ? ' overdue' : ' muted'}`}>
                            {percent(project.spent, project.budget)} % consommé
                          </span>
                        )}
                        {project.budget === 0 && project.spent > 0 && (
                          <span className="report-budget-note overdue">Budget nul dépassé</span>
                        )}
                      </td>
                      <td className="num">{formatDuration(project.minutes_logged)}</td>
                      <td>{formatDate(project.end_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {budgeted.length > 0 && (
        <section className="card panel">
          <h2>Budget consommé</h2>
          <ul className="report-budget-list">
            {budgeted.map((project) => {
              const ratio = project.budget > 0 ? percent(project.spent, project.budget) : project.spent > 0 ? 100 : 0;
              const usage = project.budget > 0
                ? `${ratio} % consommé`
                : project.spent > 0
                  ? `Budget dépassé de ${formatBudget(project.spent)}`
                  : 'Budget prévisionnel nul';
              return (
                <li key={project.id}>
                  <div className="progress-caption">
                    <Link to={`/projets/${project.id}`} className="strong-link">{project.name}</Link>
                    <span>{formatBudget(project.spent)} / {formatBudget(project.budget)} · {usage}</span>
                  </div>
                  <ProgressBar value={Math.min(ratio, 100)} label={`Budget consommé de ${project.name}`} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
