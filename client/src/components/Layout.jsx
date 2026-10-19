import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { projectColor } from '../utils.js';
import { CheckSquareIcon, DashboardIcon, FolderIcon, LogoMark, UsersIcon } from './icons.jsx';
import NotificationBell from './NotificationBell.jsx';
import ThemeSwitch from './ThemeSwitch.jsx';
import UserMenu from './UserMenu.jsx';

const NAV = [
  { to: '/', end: true, label: 'Tableau de bord', short: 'Accueil', icon: DashboardIcon },
  { to: '/mes-taches', label: 'Mes tâches', short: 'Mes tâches', icon: CheckSquareIcon },
  { to: '/projets', label: 'Projets', short: 'Projets', icon: FolderIcon },
];
const ADMIN_NAV = { to: '/admin/utilisateurs', label: 'Utilisateurs', short: 'Équipe', icon: UsersIcon };

const SECTION_TITLES = {
  '/': 'Tableau de bord',
  '/mes-taches': 'Mes tâches',
  '/projets': 'Projets',
  '/admin/utilisateurs': 'Utilisateurs',
};

/**
 * Cadre des pages connectées : barre latérale (navigation, projets actifs) et en-tête
 * (fil d'Ariane, thème clair/sombre, notifications, compte). Sur mobile, la navigation
 * passe en onglets en bas de l'écran.
 */
export default function Layout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const projects = useApi('/projects');

  // La liste des projets est rechargée à chaque changement de page (création, archivage…).
  const firstRender = useRef(true);
  const { reload } = projects;
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    reload();
  }, [pathname, reload]);

  const nav = user.role === 'admin' ? [...NAV, ADMIN_NAV] : NAV;
  const activeProjects = (projects.data ?? []).filter((p) => !p.is_template).slice(0, 8);

  return (
    <div className="app">
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>

      <aside className="sidebar">
        <Link to="/" className="brand sidebar-brand">
          <LogoMark size={30} />
          GestProjet
        </Link>

        <nav className="nav" aria-label="Navigation principale">
          {nav.map(({ to, end, label, short, icon: NavIcon }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              <NavIcon className="nav-icon" />
              <span className="nav-label">{label}</span>
              <span className="nav-short" aria-hidden="true">
                {short}
              </span>
            </NavLink>
          ))}
        </nav>

        {activeProjects.length > 0 && (
          <nav className="sidebar-projects" aria-label="Projets actifs">
            <p className="sidebar-title">Projets actifs</p>
            {activeProjects.map((project) => (
              <NavLink key={project.id} to={`/projets/${project.id}`} className="project-link">
                <span className="project-dot" style={{ background: projectColor(project.id) }} aria-hidden="true" />
                <span className="truncate">{project.name}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </aside>

      <div className="shell">
        <header className="header">
          <Link to="/" className="brand header-brand">
            <LogoMark size={28} />
            GestProjet
          </Link>
          <Breadcrumbs pathname={pathname} projects={projects.data} />
          <div className="header-actions">
            <ThemeSwitch />
            <NotificationBell />
            <span className="header-separator" aria-hidden="true" />
            <UserMenu />
          </div>
        </header>

        <main id="contenu" className="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Fil d'Ariane : rubrique courante, et nom du projet sur la page d'un projet. */
function Breadcrumbs({ pathname, projects }) {
  const projectId = Number(pathname.match(/^\/projets\/(\d+)/)?.[1]);
  const items = projectId
    ? [
        { label: 'Projets', to: '/projets' },
        { label: projects?.find((p) => p.id === projectId)?.name ?? 'Projet' },
      ]
    : [{ label: SECTION_TITLES[pathname] ?? 'GestProjet' }];

  return (
    <nav className="crumbs" aria-label="Fil d'Ariane">
      <ol>
        {items.map((item) => (
          <li key={item.label} className="truncate">
            {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
