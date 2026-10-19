// Jeu de démonstration : 5 comptes (un par rôle), 2 projets actifs et 1 modèle.
// N'agit que sur une base sans utilisateurs.
import bcrypt from 'bcryptjs';
import { dbHint, pool, withTransaction } from '../src/db.js';

const PASSWORD = 'Demo1234!';

/** Date 'AAAA-MM-JJ' décalée de `offset` jours par rapport à aujourd'hui. */
function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const USERS = [
  ['admin', 'admin@demo.test', 'Aline Mbarga', 'admin'],
  ['chef', 'chef@demo.test', 'Paul Nkoulou', 'chef_projet'],
  ['carine', 'membre@demo.test', 'Carine Ewane', 'membre'],
  ['david', 'membre2@demo.test', 'David Tchami', 'membre'],
  ['invite', 'invite@demo.test', 'Client Invité', 'invite'],
];

const PROJECTS = [
  {
    name: 'Refonte du site web',
    description: "Nouveau site vitrine responsive pour présenter l'offre de l'entreprise.",
    objectives: 'Mettre le nouveau site en ligne avant la fin du trimestre.\nAugmenter de 20 % les demandes de contact.',
    start_date: day(-20),
    end_date: day(40),
    budget: 2500000,
    owner: 'chef',
    members: ['chef', 'carine', 'david', 'invite'],
    tasks: [
      { title: 'Recueillir les besoins', status: 'termine', due: day(-15), labels: ['analyse'], assignees: ['carine'] },
      {
        title: 'Maquettes des pages',
        status: 'en_cours',
        priority: 'haute',
        due: day(3),
        labels: ['design'],
        assignees: ['carine'],
        subtasks: [
          { title: "Page d'accueil", status: 'termine', assignees: ['carine'] },
          { title: 'Page contact', due: day(3), assignees: ['carine'] },
        ],
      },
      { title: "Mettre en place l'hébergement", priority: 'haute', due: day(-2), labels: ['infra'], assignees: ['david'] },
      { title: 'Développer le formulaire de contact', due: day(10), labels: ['dev'], assignees: ['david'] },
      { title: 'Rédiger les contenus', status: 'en_cours', due: day(6), labels: ['contenu'], assignees: ['carine', 'david'] },
      { title: 'Tests et recette', priority: 'haute', due: day(35) },
    ],
  },
  {
    name: 'Lancement de la campagne marketing',
    description: 'Campagne de communication pour le lancement du nouveau service.',
    start_date: day(-5),
    end_date: day(25),
    budget: 800000,
    owner: 'chef',
    members: ['chef', 'david'],
    tasks: [
      { title: 'Définir le budget média', status: 'termine', due: day(-3), assignees: ['chef'] },
      { title: 'Créer les visuels', status: 'en_cours', due: day(5), labels: ['design'], assignees: ['david'] },
      { title: 'Planifier les publications', priority: 'urgente', due: day(-1), assignees: ['david'] },
    ],
  },
  {
    name: 'Modèle — Projet web standard',
    description: "Modèle réutilisable reprenant les étapes classiques d'un projet web.",
    is_template: true,
    owner: 'admin',
    members: ['admin'],
    tasks: [
      { title: 'Cadrage et spécifications' },
      { title: 'Maquettes' },
      { title: 'Développement', subtasks: [{ title: 'Front-end' }, { title: 'Back-end' }] },
      { title: 'Recette' },
      { title: 'Mise en production', priority: 'haute' },
    ],
  },
];

async function seed(db) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const userIds = {};
  for (const [key, email, fullName, role] of USERS) {
    const { rows } = await db.query(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [email, hash, fullName, role],
    );
    userIds[key] = rows[0].id;
  }

  for (const project of PROJECTS) {
    const { rows } = await db.query(
      `INSERT INTO projects (name, description, objectives, start_date, end_date, budget, is_template, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        project.name,
        project.description,
        project.objectives ?? '',
        project.start_date ?? null,
        project.end_date ?? null,
        project.budget ?? null,
        project.is_template ?? false,
        userIds[project.owner],
      ],
    );
    const projectId = rows[0].id;
    for (const key of project.members) {
      await db.query('INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)', [projectId, userIds[key]]);
    }

    let position = 0;
    const addTask = async (task, parentId = null) => {
      position += 1;
      const status = task.status ?? 'a_faire';
      const { rows: inserted } = await db.query(
        `INSERT INTO tasks (project_id, parent_id, title, status, priority, due_date, labels, position,
                            created_by, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          projectId,
          parentId,
          task.title,
          status,
          task.priority ?? 'moyenne',
          task.due ?? null,
          task.labels ?? [],
          position,
          userIds[project.owner],
          status === 'termine' ? new Date() : null,
        ],
      );
      const taskId = inserted[0].id;
      for (const key of task.assignees ?? []) {
        await db.query('INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2)', [taskId, userIds[key]]);
      }
      for (const subtask of task.subtasks ?? []) await addTask(subtask, taskId);
    };
    for (const task of project.tasks) await addTask(task);
  }
}

try {
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM users');
  if (rows[0].count > 0) {
    console.log('Des utilisateurs existent déjà : jeu de démonstration ignoré.');
  } else {
    await withTransaction(seed);
    console.log(`Jeu de démonstration créé (mot de passe de tous les comptes : ${PASSWORD}).`);
  }
} catch (err) {
  console.error(`Échec du jeu de démonstration → ${dbHint(err)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
