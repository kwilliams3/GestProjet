import { ChartIcon, ChatIcon, KanbanIcon, LogoMark } from './icons.jsx';

const FEATURES = [
  { icon: KanbanIcon, text: 'Kanban et listes de tâches en glisser-déposer' },
  { icon: ChartIcon, text: "Tableau de bord d'avancement et charge de chacun" },
  { icon: ChatIcon, text: 'Commentaires, mentions et pièces jointes' },
];

/** Mise en page des écrans d'accès : présentation à gauche, formulaire à droite (seul sur mobile). */
export default function AuthLayout({ children }) {
  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="auth-brand">
          <LogoMark size={36} />
          GestProjet
        </div>

        <div>
          <h2>Tous vos projets, enfin au même endroit.</h2>
          <p className="auth-hero-text">
            Planifiez, suivez l'avancement et collaborez avec votre équipe, sans tableurs ni e-mails dispersés.
          </p>
          <ul className="auth-features">
            {FEATURES.map(({ icon: FeatureIcon, text }) => (
              <li key={text}>
                <span className="feature-icon">
                  <FeatureIcon />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <BoardPreview />

        <p className="auth-hero-footer">© 2026 GestProjet · Gestion de projet en équipe</p>
      </aside>

      <main className="auth-main">
        <div className="auth-panel">
          <div className="auth-mobile-brand">
            <LogoMark size={36} />
            GestProjet
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/** Aperçu décoratif d'un tableau Kanban (ignoré par les lecteurs d'écran). */
function BoardPreview() {
  const columns = [
    { title: 'À faire', cards: [{ chip: 'c1' }, { chip: 'c2', short: true }] },
    { title: 'En cours', cards: [{ chip: 'c2', avatars: 2 }, { chip: 'c1', short: true }] },
    { title: 'Terminé', cards: [{ chip: 'c3', done: true }] },
  ];
  return (
    <div className="board-preview" aria-hidden="true">
      {columns.map((column) => (
        <div key={column.title} className="board-col">
          <span className="board-col-title">{column.title}</span>
          {column.cards.map((card, i) => (
            <div key={i} className={`board-card${card.done ? ' done' : ''}`}>
              <span className={`board-chip ${card.chip}`} />
              <span className="board-line" />
              <span className={`board-line${card.short ? ' short' : ''}`} />
              {card.avatars && (
                <span className="board-avatars">
                  {Array.from({ length: card.avatars }, (_, j) => (
                    <span key={j} className="board-avatar" />
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
