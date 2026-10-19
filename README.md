# GestProjet

Application web de gestion de projet réalisée à partir du cahier des charges « Application de gestion de projet ».

- **Front-end** : React (Vite), dans `client/`
- **Back-end** : API REST Node.js (Express), authentification JWT, dans `server/`
- **Base de données** : PostgreSQL

## Prérequis

- Node.js 20.19 ou plus récent
- PostgreSQL 17, service démarré

## Installation

```bash
npm install            # installe le serveur et le client
```

Ouvrez ensuite `server/.env` et renseignez `DB_PASSWORD`, le mot de passe de l'utilisateur `postgres` choisi à l'installation de PostgreSQL. Le fichier `server/.env.example` décrit toutes les variables.

```bash
npm run db:setup       # crée la base gestion_projet, les tables et un jeu de démonstration
npm run dev            # lance l'API (port 4000) et l'interface (port 5173)
```

L'application est alors disponible sur http://localhost:5173.

## Comptes de démonstration

Le mot de passe de tous les comptes est `Demo1234!`.

| E-mail              | Rôle            |
| ------------------- | --------------- |
| `admin@demo.test`   | Administrateur  |
| `chef@demo.test`    | Chef de projet  |
| `membre@demo.test`  | Membre d'équipe |
| `membre2@demo.test` | Membre d'équipe |
| `invite@demo.test`  | Invité / client |

Sans jeu de démonstration, le premier compte créé via « Créer un compte » devient administrateur.

## Structure

```
client/src/
  pages/            un fichier par écran (tableau de bord, projets, mes tâches…)
  components/       Kanban, liste, formulaires, éléments d'interface
  api.js            appels à l'API
server/
  src/routes/       routes de l'API (auth, users, projects, tasks, dashboard)
  src/lib/          règles d'accès, validation, fonctions partagées
  db/migrations/    schéma SQL, appliqué par « npm run db:migrate »
  scripts/          création de la base, migrations, jeu de démonstration
```

Pour faire évoluer le schéma, ajoutez un fichier `server/db/migrations/002_….sql` puis lancez `npm run db:migrate -w server`.

## Avancement par rapport au cahier des charges

**Lot 1 (livré)**

- F01 Inscription et connexion par e-mail
- F02 Rôles (administrateur, chef de projet, membre, invité) et leur gestion par l'administrateur
- F03 Création, archivage et duplication de projets, modèles de projet
- F04 Objectifs, dates, budget indicatif et membres
- F05 Tâches et sous-tâches avec description, échéance, priorité et étiquettes
- F06 Assignation à une ou plusieurs personnes, statuts À faire / En cours / Terminé
- F08 Vue liste et tableau Kanban en glisser-déposer (souris, tactile et clavier)
- F15 Tableau de bord : tâches terminées, retards, charge par membre
- Mode clair et mode sombre, interface responsive

**Lot 2 (livré)**

- F11 Commentaires avec mentions `@Prénom Nom` (suggestions à la frappe), pièces jointes jusqu'à 50 Mo
- F13 Notifications dans l'application (cloche, rafraîchie toutes les 30 s) et par e-mail : assignation, mention, nouveau commentaire, échéance dans les 2 jours, retard
- F17 Recherche globale dans les projets et les tâches, sans tenir compte des accents (raccourci `/` ou `Ctrl+K`) ; filtres de tâches (texte, personne, priorité, étiquette, retard) enregistrables
- Une tâche s'ouvre par un lien direct (`/projets/3?tache=12`), utilisé par la recherche, les notifications et les e-mails

**Fin des exigences « M » (livré)**

- F01 Connexion avec Google et Microsoft (OpenID Connect avec PKCE), active dès que les identifiants sont renseignés : voir plus bas
- F02 Invitations par e-mail : l'administrateur invite avec n'importe quel rôle, le chef de projet invite des membres ou des invités sur ses projets ; lien valable 7 jours, à usage unique, révocable
- Tests automatisés de l'API (`npm test`)

**Lot 3** : exigences « S » (dépendances, Gantt, calendrier, historique, temps passé, exports CSV/PDF, API publique, journal d'audit), interface en anglais, notifications en temps réel par WebSocket, tests de l'interface.

## Tests

```bash
npm test               # tests de l'API
npm run test:coverage  # idem, avec le taux de couverture du code serveur
```

Chaque fichier de `server/tests/` crée sa propre base temporaire (`gestion_projet_test_…`) remplie avec le jeu de démonstration, puis la supprime : vos données ne sont jamais touchées. La connexion Google est testée avec un faux serveur Google.

## Connexion avec Google ou Microsoft

Les boutons « Continuer avec … » n'apparaissent que si le fournisseur est configuré dans `server/.env`.

**Google** : sur https://console.cloud.google.com, créez un projet, configurez l'écran de consentement OAuth, puis dans *API et services > Identifiants*, créez un « ID client OAuth » de type *Application Web*. Ajoutez l'URI de redirection `http://localhost:5173/api/auth/sso/google/callback`, puis copiez l'ID et le secret dans `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.

**Microsoft** : sur https://portal.azure.com, dans *Microsoft Entra ID > Inscriptions d'applications*, créez une inscription avec l'URI de redirection Web `http://localhost:5173/api/auth/sso/microsoft/callback`. Créez un secret client (*Certificats et secrets*), puis renseignez `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` et `MICROSOFT_TENANT`.

Un compte qui se connecte par SSO est relié au compte existant ayant la même adresse e-mail, ou bien créé. Une invitation en attente pour cette adresse s'applique alors (rôle, projet).

## E-mails (notifications et invitations)

Sans configuration, les e-mails sont affichés dans la console du serveur (`[e-mail simulé] …`). Pour les envoyer réellement, renseignez `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` et `SMTP_FROM` dans `server/.env` : voir `server/.env.example`. Avec Gmail, il faut un « mot de passe d'application ».

Les pièces jointes sont stockées dans `server/uploads/`, un dossier exclu de Git.
