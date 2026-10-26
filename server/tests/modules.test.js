import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { day, fileForm, startTestServer } from './helpers.js';

let api;
let admin, chef, member, invite;
let project, task;

before(async () => {
  api = await startTestServer('modules');
  [admin, chef, member, invite] = await Promise.all(
    ['admin', 'chef', 'membre', 'invite'].map((name) => api.login(`${name}@demo.test`)),
  );
  project = (await api.call(chef.token, 'GET', '/projects')).data.find((item) => item.name === 'Refonte du site web');
  task = (await api.call(chef.token, 'GET', `/projects/${project.id}/tasks`)).data[0];
});

after(() => api?.close());

test('calendar and reports respect project visibility', async () => {
  const dueDate = day(4);
  const created = await api.call(chef.token, 'POST', `/projects/${project.id}/tasks`, {
    title: 'Échéance calendrier',
    due_date: dueDate,
  });
  assert.equal(created.status, 201);

  const calendar = await api.call(member.token, 'GET', `/calendar?from=${day(0)}&to=${day(62)}`);
  assert.equal(calendar.status, 200);
  assert.ok(calendar.data.some((item) => item.id === created.data.id && item.event_date === dueDate));
  assert.ok(calendar.data.some((item) => item.event_type === 'project_end' && item.project_id === project.id));

  const invalidRange = await api.call(chef.token, 'GET', `/calendar?from=${day(7)}&to=${day(0)}`);
  assert.equal(invalidRange.status, 400);
  const excessiveRange = await api.call(chef.token, 'GET', `/calendar?from=${day(0)}&to=${day(63)}`);
  assert.equal(excessiveRange.status, 400);
  const invalidDate = await api.call(chef.token, 'GET', '/calendar?from=2026-02-30&to=2026-03-05');
  assert.equal(invalidDate.status, 400);

  const reports = await api.call(member.token, 'GET', '/reports');
  assert.equal(reports.status, 200);
  assert.ok(reports.data.projects.some((item) => item.id === project.id));
  assert.ok(reports.data.totals.tasks > 0);
});

test('budget expenses require project management and appear in reports', async () => {
  const path = `/projects/${project.id}/modules/expenses`;
  assert.equal((await api.call(member.token, 'POST', path, { title: 'Frais', amount: 12, spent_on: day(0) })).status, 403);
  assert.equal((await api.call(chef.token, 'POST', path, { title: '', amount: -1, spent_on: day(0) })).status, 400);
  assert.equal((await api.call(chef.token, 'POST', path, { title: 'Date invalide', amount: 5, spent_on: '2026-02-30' })).status, 400);

  const created = await api.call(chef.token, 'POST', path, { title: 'Hébergement', amount: 125.5, spent_on: day(0) });
  assert.equal(created.status, 201);
  assert.equal(created.data.amount, 125.5);
  const report = await api.call(chef.token, 'GET', '/reports');
  assert.equal(report.data.projects.find((item) => item.id === project.id).spent, 125.5);

  assert.equal((await api.call(chef.token, 'DELETE', `${path}/${created.data.id}`)).status, 204);
  assert.equal((await api.call(chef.token, 'DELETE', `${path}/${created.data.id}`)).status, 404);
});

test('time entries can be recorded and only removed by their owner or manager', async () => {
  const path = `/projects/${project.id}/modules/time-entries`;
  const created = await api.call(member.token, 'POST', path, {
    task_id: task.id,
    description: 'Atelier',
    minutes: 90,
    worked_on: day(0),
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.user_id, member.user.id);
  assert.equal(created.data.task_title, task.title);
  assert.equal((await api.call(invite.token, 'POST', path, { minutes: 30, worked_on: day(0) })).status, 403);
  assert.equal((await api.call(member.token, 'POST', path, { task_id: 999999, minutes: 30, worked_on: day(0) })).status, 400);

  const report = await api.call(chef.token, 'GET', '/reports');
  assert.equal(report.data.projects.find((item) => item.id === project.id).minutes_logged, 90);
  assert.equal((await api.call(chef.token, 'DELETE', `${path}/${created.data.id}`)).status, 204);
});

test('project documents are downloadable to viewers and removable by uploader or manager', async () => {
  const path = `/projects/${project.id}/modules/documents`;
  assert.equal((await api.call(invite.token, 'POST', path, fileForm('client.txt', 'fichier'))).status, 403);

  const created = await api.call(chef.token, 'POST', path, fileForm('référence.txt', 'document partagé'));
  assert.equal(created.status, 201);
  assert.equal(created.data.original_name, 'référence.txt');

  const downloaded = await api.call(member.token, 'GET', `/project-documents/${created.data.id}/download`);
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.data.toString(), 'document partagé');

  assert.equal((await api.call(member.token, 'DELETE', `/project-documents/${created.data.id}`)).status, 403);
  assert.equal((await api.call(chef.token, 'DELETE', `/project-documents/${created.data.id}`)).status, 204);
  assert.equal(await api.storedFiles(), 0);
});
