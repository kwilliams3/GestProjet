// Invitations par e-mail (F02) et connexion SSO (F01), avec un faux Google à la place du vrai.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import { startTestServer } from './helpers.js';

const CLIENT_ID = 'client-test.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
process.env.GOOGLE_CLIENT_SECRET = 'secret-test';
process.env.MICROSOFT_CLIENT_ID = '';

// Faux point d'échange de Google : renvoie un id_token contenant `nextClaims`.
const realFetch = globalThis.fetch;
let nextClaims = null;
let lastTokenRequest = null;
globalThis.fetch = async (input, init) => {
  if (String(input) !== 'https://oauth2.googleapis.com/token') return realFetch(input, init);
  lastTokenRequest = new URLSearchParams(init.body);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return Response.json({ id_token: `${encode({ alg: 'none' })}.${encode(nextClaims)}.` });
};

let api;
let admin, chef, carine;
let site;

before(async () => {
  api = await startTestServer('comptes');
  [admin, chef, carine] = await Promise.all(['admin', 'chef', 'membre'].map((name) => api.login(`${name}@demo.test`)));
  site = (await api.call(chef.token, 'GET', '/projects')).data.find((p) => p.name === 'Refonte du site web');
});
after(() => api?.close());

const invitationToken = (link) => link.split('/invitation/')[1];

test('invitations : droits', async () => {
  const invite = (session, body) => api.call(session.token, 'POST', '/invitations', body);
  assert.equal((await invite(chef, { email: 'x@ext.test', role: 'chef_projet', project_id: site.id })).status, 403);
  assert.equal((await invite(chef, { email: 'x@ext.test', role: 'membre' })).status, 400, 'projet obligatoire pour un chef');
  assert.equal((await invite(carine, { email: 'x@ext.test', role: 'membre', project_id: site.id })).status, 403);
  assert.equal((await invite(admin, { email: 'membre@demo.test', role: 'membre' })).status, 409, 'compte existant');
  assert.equal((await invite(admin, { email: 'x@ext.test', role: 'patron' })).status, 400);
});

test("invitations : envoi et acceptation d'un lien", async () => {
  const sent = await api.call(chef.token, 'POST', '/invitations', { email: 'Lea@Ext.test', role: 'membre', project_id: site.id });
  assert.equal(sent.status, 201);
  assert.equal(sent.data.email, 'lea@ext.test');
  assert.equal(sent.data.project_name, 'Refonte du site web');
  assert.equal(sent.data.email_sent, false, 'SMTP non configuré : e-mail simulé');
  assert.match(sent.data.link, /^http:\/\/localhost:5173\/invitation\/[\w-]{43}$/);
  const token = invitationToken(sent.data.link);

  const info = await api.call(null, 'GET', `/invitations/accept/${token}`);
  assert.deepEqual(info.data, { email: 'lea@ext.test', role: 'membre', project_name: 'Refonte du site web', invited_by_name: 'Paul Nkoulou' });

  assert.equal((await api.call(null, 'POST', `/invitations/accept/${token}`, { full_name: 'Léa', password: '123' })).status, 400);
  const accepted = await api.call(null, 'POST', `/invitations/accept/${token}`, { full_name: 'Léa Mbida', password: 'motdepasse123' });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.data.user.role, 'membre');
  assert.equal(accepted.data.project_id, site.id);
  const projects = (await api.call(accepted.data.token, 'GET', '/projects')).data;
  assert.deepEqual(projects.map((p) => p.id), [site.id], 'ajoutée au projet');

  assert.equal((await api.call(null, 'GET', `/invitations/accept/${token}`)).status, 404, 'lien à usage unique');
  assert.equal((await api.call(null, 'GET', '/invitations/accept/inconnu')).status, 404);
});

test('invitations : remplacement, révocation, expiration, liste', async () => {
  const first = (await api.call(admin.token, 'POST', '/invitations', { email: 'marc@ext.test', role: 'chef_projet' })).data;
  const second = (await api.call(admin.token, 'POST', '/invitations', { email: 'marc@ext.test', role: 'membre' })).data;
  assert.equal((await api.call(null, 'GET', `/invitations/accept/${invitationToken(first.link)}`)).status, 404, 'ancien lien remplacé');
  assert.equal((await api.call(null, 'GET', `/invitations/accept/${invitationToken(second.link)}`)).data.role, 'membre');

  const fromChef = (await api.call(chef.token, 'POST', '/invitations', { email: 'ines@ext.test', role: 'invite', project_id: site.id })).data;
  const adminList = (await api.call(admin.token, 'GET', '/invitations')).data;
  const chefList = (await api.call(chef.token, 'GET', '/invitations')).data;
  assert.equal(adminList.length, 2, "l'admin voit toutes les invitations en attente");
  assert.deepEqual(chefList.map((i) => i.email), ['ines@ext.test'], 'le chef ne voit que les siennes');

  assert.equal((await api.call(chef.token, 'DELETE', `/invitations/${second.id}`)).status, 404);
  assert.equal((await api.call(admin.token, 'DELETE', `/invitations/${second.id}`)).status, 204);
  assert.equal((await api.call(null, 'GET', `/invitations/accept/${invitationToken(second.link)}`)).status, 404, 'lien révoqué');

  await api.pool.query("UPDATE invitations SET expires_at = now() - interval '1 minute' WHERE id = $1", [fromChef.id]);
  assert.equal((await api.call(null, 'GET', `/invitations/accept/${invitationToken(fromChef.link)}`)).status, 404, 'lien expiré');
});

/** Parcours SSO complet : redirection vers Google, puis retour avec un code. */
async function googleLogin(claims = {}, { state, cookie, query = '' } = {}) {
  const start = await api.call(null, 'GET', '/auth/sso/google', undefined, { redirect: 'manual' });
  const authorize = new URL(start.headers.get('location'));
  const params = authorize.searchParams;
  nextClaims = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'google-1',
    email: 'awa@gmail.com',
    email_verified: true,
    name: 'Awa Ndiaye',
    nonce: params.get('nonce'),
    exp: Math.floor(Date.now() / 1000) + 600,
    ...claims,
  };
  const sessionCookie = cookie ?? start.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const callback = await api.call(
    null,
    'GET',
    `/auth/sso/google/callback?code=code-test&state=${state ?? params.get('state')}${query}`,
    undefined,
    { redirect: 'manual', headers: { Cookie: sessionCookie } },
  );
  const target = new URL(callback.headers.get('location'));
  return {
    start,
    authorize,
    target,
    token: new URLSearchParams(target.hash.slice(1)).get('token'),
    error: target.searchParams.get('erreur_sso'),
  };
}

test('SSO : fournisseurs et redirection', async () => {
  assert.deepEqual((await api.call(null, 'GET', '/auth/providers')).data, [{ id: 'google', label: 'Google' }]);
  assert.equal((await api.call(null, 'GET', '/auth/sso/microsoft', undefined, { redirect: 'manual' })).status, 404);

  const start = await api.call(null, 'GET', '/auth/sso/google', undefined, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const url = new URL(start.headers.get('location'));
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('client_id'), CLIENT_ID);
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:5173/api/auth/sso/google/callback');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(start.headers.getSetCookie()[0], /HttpOnly/);
});

test('SSO : création de compte, PKCE, reconnexion', async () => {
  const first = await googleLogin();
  assert.equal(first.target.pathname, '/connexion/sso');
  const me = (await api.call(first.token, 'GET', '/auth/me')).data.user;
  assert.equal(me.email, 'awa@gmail.com');
  assert.equal(me.role, 'membre');

  const verifier = lastTokenRequest.get('code_verifier');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  assert.equal(challenge, first.authorize.searchParams.get('code_challenge'), 'PKCE cohérent');
  assert.equal(lastTokenRequest.get('client_secret'), 'secret-test');

  const again = await googleLogin({ email: 'awa.nouvelle@gmail.com' });
  assert.equal((await api.call(again.token, 'GET', '/auth/me')).data.user.id, me.id, 'même compte (même identifiant Google)');
});

test('SSO : invitation en attente appliquée', async () => {
  await api.call(admin.token, 'POST', '/invitations', { email: 'chef2@gmail.com', role: 'chef_projet', project_id: site.id });
  const login = await googleLogin({ sub: 'google-2', email: 'chef2@gmail.com' });
  const me = (await api.call(login.token, 'GET', '/auth/me')).data.user;
  assert.equal(me.role, 'chef_projet');
  assert.ok((await api.call(login.token, 'GET', '/projects')).data.some((p) => p.id === site.id));
  assert.equal((await api.call(admin.token, 'GET', '/invitations')).data.some((i) => i.email === 'chef2@gmail.com'), false);
});

test('SSO : liaison avec un compte existant', async () => {
  // Compte créé par simple inscription (adresse non vérifiée) : le mot de passe est effacé à la liaison.
  const registered = (await api.call(null, 'POST', '/auth/register', { full_name: 'Pierre', email: 'pierre@gmail.com', password: 'motdepasse123' })).data;
  const linked = await googleLogin({ sub: 'google-3', email: 'pierre@gmail.com' });
  assert.equal((await api.call(linked.token, 'GET', '/auth/me')).data.user.id, registered.user.id);
  assert.equal((await api.call(null, 'POST', '/auth/login', { email: 'pierre@gmail.com', password: 'motdepasse123' })).status, 401);

  // Compte créé par invitation (adresse vérifiée) : le mot de passe est conservé.
  const sent = (await api.call(admin.token, 'POST', '/invitations', { email: 'sara@gmail.com', role: 'membre' })).data;
  await api.call(null, 'POST', `/invitations/accept/${invitationToken(sent.link)}`, { full_name: 'Sara', password: 'motdepasse123' });
  await googleLogin({ sub: 'google-4', email: 'sara@gmail.com' });
  assert.equal((await api.call(null, 'POST', '/auth/login', { email: 'sara@gmail.com', password: 'motdepasse123' })).status, 200);
});

test('SSO : demandes refusées', async () => {
  const cases = [
    ['mauvais state', {}, { state: 'faux' }, /invalide/],
    ['sans cookie', {}, { cookie: '' }, /expirée/],
    ['nonce différent', { nonce: 'autre' }, {}, /rejoué/],
    ['adresse non vérifiée', { email_verified: false }, {}, /vérifiée/],
    ['autre application', { aud: 'autre-client' }, {}, /autre application/],
    ['jeton expiré', { exp: 1000 }, {}, /expiré/],
    ['connexion annulée', {}, { query: '&error=access_denied' }, /annulée/],
  ];
  for (const [label, claims, options, message] of cases) {
    const result = await googleLogin({ sub: 'google-x', email: 'x@gmail.com', ...claims }, options);
    assert.equal(result.target.pathname, '/connexion', label);
    assert.match(result.error ?? '', message, label);
    assert.equal(result.token, null, label);
  }
});
