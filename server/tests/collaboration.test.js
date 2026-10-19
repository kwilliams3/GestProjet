// Lot 2 : commentaires, mentions, pièces jointes, notifications, recherche, filtres.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { day, fileForm, startTestServer } from './helpers.js';

let api;
let chef, carine, david, invite;
let site, maquettes, hebergement, formulaire;
let createDueReminders, sendPendingEmails;

const notifs = async (session) => (await api.call(session.token, 'GET', '/notifications')).data;

before(async () => {
  api = await startTestServer('collaboration');
  ({ createDueReminders } = await import('../src/lib/notifications.js'));
  ({ sendPendingEmails } = await import('../src/lib/mailer.js'));
  [chef, carine, david, invite] = await Promise.all(
    ['chef', 'membre', 'membre2', 'invite'].map((name) => api.login(`${name}@demo.test`)),
  );
  site = (await api.call(chef.token, 'GET', '/projects')).data.find((p) => p.name === 'Refonte du site web');
  const tasks = (await api.call(chef.token, 'GET', `/projects/${site.id}/tasks`)).data;
  const byTitle = (title) => tasks.find((t) => t.title === title);
  maquettes = byTitle('Maquettes des pages');
  hebergement = byTitle("Mettre en place l'hébergement");
  formulaire = byTitle('Développer le formulaire de contact');
});
after(() => api?.close());

test("notifications d'assignation", async () => {
  const created = await api.call(chef.token, 'POST', `/projects/${site.id}/tasks`, {
    title: 'Préparer la démo',
    assignee_ids: [carine.user.id],
  });
  const [last] = (await notifs(carine)).items;
  assert.equal(last.type, 'assignation');
  assert.equal(last.message, 'Paul Nkoulou vous a assigné « Préparer la démo »');
  assert.equal(last.task_id, created.data.id);
  assert.equal(last.project_id, site.id);
  assert.equal((await notifs(chef)).items.length, 0, "l'auteur de l'action n'est pas notifié");

  const davidBefore = (await notifs(david)).items.length;
  await api.call(chef.token, 'PATCH', `/tasks/${hebergement.id}`, { assignee_ids: [david.user.id, carine.user.id] });
  assert.match((await notifs(carine)).items[0].message, /hébergement/);
  assert.equal((await notifs(david)).items.length, davidBefore, 'déjà assigné : pas de nouvelle notification');
});

test('commentaires et mentions', async () => {
  const comment = await api.call(david.token, 'POST', `/tasks/${maquettes.id}/comments`, {
    body: 'Bonjour @Paul Nkoulou, voir avec @carine ewane',
  });
  assert.equal(comment.status, 201);
  assert.equal(comment.data.author_name, 'David Tchami');
  assert.equal((await notifs(chef)).items[0].type, 'mention');
  const carineItems = (await notifs(carine)).items;
  assert.equal(carineItems[0].type, 'mention', 'mention reconnue sans tenir compte de la casse');
  assert.notEqual(carineItems[1].type, 'commentaire', 'une seule notification pour une assignée mentionnée');

  await api.call(chef.token, 'POST', `/tasks/${maquettes.id}/comments`, { body: 'Les maquettes sont validées.' });
  assert.equal((await notifs(carine)).items[0].type, 'commentaire');

  const fromInvite = await api.call(invite.token, 'POST', `/tasks/${maquettes.id}/comments`, { body: 'Merci.' });
  assert.equal(fromInvite.status, 201, "l'invité peut commenter");
  const list = (await api.call(chef.token, 'GET', `/tasks/${maquettes.id}/comments`)).data;
  assert.equal(list.length, 3);
  assert.equal((await api.call(invite.token, 'DELETE', `/comments/${list[1].id}`)).status, 403);
  assert.equal((await api.call(chef.token, 'DELETE', `/comments/${fromInvite.data.id}`)).status, 204);
  assert.equal((await api.call(chef.token, 'POST', `/tasks/${maquettes.id}/comments`, { body: '  ' })).status, 400);
});

test('pièces jointes', async () => {
  const name = 'Cahier des charges – été.txt';
  const content = 'Contenu de test : é à ç';
  const before = await api.storedFiles();

  const uploaded = await api.call(carine.token, 'POST', `/tasks/${maquettes.id}/attachments`, fileForm(name, content));
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.data.original_name, name, 'nom accentué conservé');

  const download = await api.call(david.token, 'GET', `/attachments/${uploaded.data.id}/download`);
  assert.equal(download.data.toString('utf8'), content);
  assert.match(download.headers.get('content-disposition'), /filename\*=UTF-8/);

  assert.equal((await api.call(invite.token, 'POST', `/tasks/${maquettes.id}/attachments`, fileForm('x', 'x'))).status, 403);
  assert.equal((await api.call(david.token, 'POST', `/tasks/${maquettes.id}/attachments`, fileForm('x', 'x'))).status, 403);
  const tooBig = fileForm('gros.bin', Buffer.alloc(50 * 1024 * 1024 + 1));
  assert.equal((await api.call(chef.token, 'POST', `/tasks/${maquettes.id}/attachments`, tooBig)).status, 413);

  const chefFile = (await api.call(chef.token, 'POST', `/tasks/${maquettes.id}/attachments`, fileForm('plan.pdf', 'pdf'))).data;
  assert.equal(await api.storedFiles(), before + 2, 'le fichier refusé ne reste pas sur le disque');
  const task = (await api.call(chef.token, 'GET', `/projects/${site.id}/tasks`)).data.find((t) => t.id === maquettes.id);
  assert.deepEqual([task.comment_count, task.attachment_count], [2, 2]);

  assert.equal((await api.call(carine.token, 'DELETE', `/attachments/${chefFile.id}`)).status, 403);
  assert.equal((await api.call(chef.token, 'DELETE', `/attachments/${uploaded.data.id}`)).status, 204);
  assert.equal(await api.storedFiles(), before + 1, 'fichier supprimé du disque');

  const temp = (await api.call(chef.token, 'POST', `/projects/${site.id}/tasks`, { title: 'Jetable' })).data;
  await api.call(chef.token, 'POST', `/tasks/${temp.id}/attachments`, fileForm('a.txt', 'a'));
  await api.call(chef.token, 'DELETE', `/tasks/${temp.id}`);
  assert.equal(await api.storedFiles(), before + 1, 'les fichiers partent avec leur tâche');
});

test("rappels d'échéance et retards", async () => {
  await api.call(chef.token, 'PATCH', `/tasks/${formulaire.id}`, { due_date: day(1) });
  await createDueReminders();
  const items = (await notifs(david)).items;
  assert.ok(items.some((n) => n.type === 'echeance_proche' && n.message.endsWith('arrive à échéance demain')));
  assert.equal(items.filter((n) => n.type === 'retard').length, 2);

  await createDueReminders();
  assert.equal((await notifs(david)).items.length, items.length, 'pas de doublon');
  await api.call(chef.token, 'PATCH', `/tasks/${formulaire.id}`, { due_date: day(2) });
  await createDueReminders();
  assert.equal((await notifs(david)).items.length, items.length + 1, "nouveau rappel quand l'échéance change");
});

test('lecture des notifications et e-mails', async () => {
  const before = await notifs(carine);
  await api.call(carine.token, 'POST', `/notifications/${before.items[0].id}/read`);
  assert.equal((await notifs(carine)).unread_count, before.unread_count - 1);
  await api.call(carine.token, 'POST', '/notifications/read-all');
  assert.equal((await notifs(carine)).unread_count, 0);

  await sendPendingEmails();
  const { rows } = await api.pool.query('SELECT COUNT(*) AS count FROM notifications WHERE emailed_at IS NULL');
  assert.equal(rows[0].count, 0, 'toutes les notifications ont été envoyées (mode simulé)');
});

test('recherche globale', async () => {
  const search = async (session, q) => (await api.call(session.token, 'GET', `/search?q=${encodeURIComponent(q)}`)).data;
  assert.ok((await search(chef, 'HEBERGEMENT')).tasks.some((t) => t.id === hebergement.id), 'sans accents ni casse');
  assert.equal((await search(chef, 'campagne')).projects.length, 1);
  assert.deepEqual(await search(carine, 'campagne'), { projects: [], tasks: [] }, "pas de résultats chez autrui");
  assert.ok((await search(chef, 'design')).tasks.length >= 2, 'recherche dans les étiquettes');
  assert.equal((await search(chef, '%_')).tasks.length, 0, 'caractères spéciaux');
  assert.deepEqual(await search(chef, 'a'), { projects: [], tasks: [] }, 'au moins 2 caractères');
});

test('filtres enregistrés', async () => {
  const saved = await api.call(carine.token, 'POST', '/filters', { name: 'Mes urgences', criteria: { assignee: 'me', priority: 'haute' } });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.criteria.priority, 'haute');
  assert.equal((await api.call(carine.token, 'POST', '/filters', { name: 'X', criteria: { priority: 'xyz' } })).status, 400);
  assert.equal((await api.call(chef.token, 'GET', '/filters')).data.length, 0, "propres à l'utilisateur");
  assert.equal((await api.call(chef.token, 'DELETE', `/filters/${saved.data.id}`)).status, 404);
  assert.equal((await api.call(carine.token, 'DELETE', `/filters/${saved.data.id}`)).status, 204);
});
