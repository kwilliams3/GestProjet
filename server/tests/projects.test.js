// Lot 1 : comptes, rôles, projets, tâches, tableau de bord.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startTestServer } from './helpers.js';

let api;
let admin, chef, carine, david, invite;
let site, marketing, template;

before(async () => {
  api = await startTestServer('projets');
  [admin, chef, carine, david, invite] = await Promise.all(
    ['admin', 'chef', 'membre', 'membre2', 'invite'].map((name) => api.login(`${name}@demo.test`)),
  );
});
after(() => api?.close());

test('connexion', async () => {
  assert.ok([admin, chef, carine, david, invite].every((s) => s?.token), 'les 5 comptes de démonstration se connectent');
  const wrong = await api.call(null, 'POST', '/auth/login', { email: 'admin@demo.test', password: 'faux' });
  assert.equal(wrong.status, 401);
  const me = await api.call(carine.token, 'GET', '/auth/me');
  assert.equal(me.data.user.email, 'membre@demo.test');
  assert.equal((await api.call(null, 'GET', '/projects')).status, 401, 'sans jeton');
  assert.equal((await api.call('faux', 'GET', '/projects')).status, 401, 'jeton invalide');
});

test('visibilité des projets selon le rôle', async () => {
  const count = async (session) => (await api.call(session.token, 'GET', '/projects')).data.length;
  assert.equal(await count(admin), 3, 'admin : tous les projets');
  assert.equal(await count(chef), 3, 'chef : ses 2 projets + le modèle');
  assert.equal(await count(carine), 1);
  assert.equal(await count(david), 2);
  assert.equal(await count(invite), 1);

  const projects = (await api.call(chef.token, 'GET', '/projects')).data;
  site = projects.find((p) => p.name === 'Refonte du site web');
  marketing = projects.find((p) => p.name.startsWith('Lancement'));
  template = projects.find((p) => p.is_template);
  assert.equal((await api.call(carine.token, 'GET', `/projects/${marketing.id}`)).status, 404, 'projet non partagé');
});

test('compteurs et tableau de bord', async () => {
  assert.deepEqual([site.task_count, site.done_count, site.overdue_count], [8, 2, 1]);
  const { totals, workload } = (await api.call(chef.token, 'GET', '/dashboard')).data;
  assert.deepEqual(totals, { total: 11, done: 3, in_progress: 3, overdue: 2 });
  const davidLoad = workload.find((w) => w.full_name === 'David Tchami');
  assert.equal(davidLoad.open_tasks, 5);
  assert.equal(davidLoad.overdue, 2);
});

test('droits sur les tâches', async () => {
  const tasks = (await api.call(carine.token, 'GET', `/projects/${site.id}/tasks`)).data;
  const maquettes = tasks.find((t) => t.title === 'Maquettes des pages');
  const hebergement = tasks.find((t) => t.title === "Mettre en place l'hébergement");

  const own = await api.call(carine.token, 'PATCH', `/tasks/${maquettes.id}`, { status: 'termine' });
  assert.equal(own.status, 200, 'un membre modifie sa tâche');
  assert.ok(own.data.completed_at, 'date de fin renseignée');
  assert.equal((await api.call(carine.token, 'PATCH', `/tasks/${hebergement.id}`, { status: 'termine' })).status, 403);
  assert.equal((await api.call(carine.token, 'PATCH', `/tasks/${maquettes.id}`, { assignee_ids: [] })).status, 403);
  assert.equal((await api.call(invite.token, 'GET', `/projects/${site.id}/tasks`)).status, 200, "l'invité consulte");
  assert.equal((await api.call(invite.token, 'PATCH', `/tasks/${maquettes.id}`, { status: 'a_faire' })).status, 403);
  assert.equal((await api.call(carine.token, 'POST', '/projects', { name: 'X' })).status, 403);
});

test('création de projet et de tâches', async () => {
  const badDates = await api.call(chef.token, 'POST', '/projects', { name: 'T', start_date: '2026-11-01', end_date: '2026-10-01' });
  assert.equal(badDates.status, 400);

  const created = await api.call(chef.token, 'POST', '/projects', {
    name: 'Projet test',
    budget: 1000,
    member_ids: [carine.user.id, invite.user.id],
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.members.length, 3, 'responsable + 2 membres');
  const p = created.data;

  const task = await api.call(chef.token, 'POST', `/projects/${p.id}/tasks`, {
    title: 'Tâche A',
    assignee_ids: [carine.user.id],
    labels: ['x', 'y'],
    due_date: '2026-11-15',
  });
  assert.equal(task.status, 201);
  assert.equal(task.data.assignees.length, 1);
  const sub = await api.call(chef.token, 'POST', `/projects/${p.id}/tasks`, { title: 'Sous-tâche', parent_id: task.data.id });
  assert.equal(sub.data.parent_id, task.data.id);

  const refused = [
    { title: 'Niveau 3', parent_id: sub.data.id },
    { title: 'Invité', assignee_ids: [invite.user.id] },
    { title: 'Hors projet', assignee_ids: [david.user.id] },
    { title: 'Date', due_date: '2026-02-30' },
  ];
  for (const body of refused) {
    assert.equal((await api.call(chef.token, 'POST', `/projects/${p.id}/tasks`, body)).status, 400, body.title);
  }

  const removed = await api.call(chef.token, 'PATCH', `/projects/${p.id}`, { member_ids: [] });
  assert.equal(removed.data.members.length, 1, 'le responsable reste membre');
  const after = (await api.call(chef.token, 'GET', `/projects/${p.id}/tasks`)).data;
  assert.equal(after.find((t) => t.id === task.data.id).assignees.length, 0, 'assignations des membres retirés supprimées');

  const archived = await api.call(chef.token, 'PATCH', `/projects/${p.id}`, { status: 'archive' });
  assert.equal(archived.data.status, 'archive');
  assert.equal((await api.call(chef.token, 'PATCH', `/tasks/${task.data.id}`, { title: 'x' })).status, 409);
  const list = (await api.call(chef.token, 'GET', '/projects?status=archive')).data;
  assert.ok(list.some((x) => x.id === p.id));
});

test('duplication depuis un modèle et suppression', async () => {
  const copy = await api.call(chef.token, 'POST', `/projects/${template.id}/duplicate`, { name: 'Nouveau site' });
  assert.equal(copy.status, 201);
  assert.equal(copy.data.is_template, false);
  let tasks = (await api.call(chef.token, 'GET', `/projects/${copy.data.id}/tasks`)).data;
  assert.equal(tasks.length, 7);
  assert.equal(tasks.filter((t) => t.parent_id).length, 2);

  const dev = tasks.find((t) => t.title === 'Développement');
  assert.equal((await api.call(chef.token, 'DELETE', `/tasks/${dev.id}`)).status, 204);
  tasks = (await api.call(chef.token, 'GET', `/projects/${copy.data.id}/tasks`)).data;
  assert.equal(tasks.length, 4, 'les sous-tâches sont supprimées avec leur tâche');
});

test('« Mes tâches »', async () => {
  const mine = (await api.call(carine.token, 'GET', '/tasks/mine')).data;
  assert.ok(mine.length > 0);
  assert.ok(mine.every((t) => t.assignees.some((a) => a.id === carine.user.id) && t.project_name));
});

test('administration des rôles', async () => {
  assert.equal((await api.call(admin.token, 'PATCH', `/users/${admin.user.id}/role`, { role: 'membre' })).status, 400);
  const changed = await api.call(admin.token, 'PATCH', `/users/${david.user.id}/role`, { role: 'chef_projet' });
  assert.equal(changed.data.role, 'chef_projet');
  assert.equal((await api.call(david.token, 'GET', '/users')).status, 200, 'nouveau rôle appliqué immédiatement');
  assert.equal((await api.call(carine.token, 'GET', '/users')).status, 403);
});

test('inscription', async () => {
  const body = { full_name: 'Nouvel Utilisateur', email: 'Nouveau@Demo.test', password: 'motdepasse123' };
  const created = await api.call(null, 'POST', '/auth/register', body);
  assert.equal(created.status, 201);
  assert.equal(created.data.user.role, 'membre');
  assert.equal(created.data.user.email, 'nouveau@demo.test');
  assert.equal((await api.call(null, 'POST', '/auth/register', body)).status, 409);
  const short = await api.call(null, 'POST', '/auth/register', { ...body, email: 'a@b.test', password: '123' });
  assert.equal(short.status, 400);
  assert.match(short.data.details[0].message, /8 caractères/);
});
