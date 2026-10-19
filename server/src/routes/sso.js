import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { findOrCreateSsoUser, signToken } from '../lib/accounts.js';
import { HttpError } from '../lib/http.js';
import { authorizeUrl, fetchIdentity, getProvider, randomToken } from '../lib/sso.js';

// F01 : connexion avec Google ou Microsoft (/api/auth/sso/:provider puis …/callback).
const router = Router();

const COOKIE = 'gp_sso';
const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax', secure: config.appUrl.startsWith('https'), path: '/api/auth/sso' };

function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

router.get('/:provider', (req, res) => {
  const id = req.params.provider;
  if (!getProvider(id)) throw new HttpError(404, 'Connexion par ce fournisseur non configurée');

  // state (anti-CSRF), nonce (anti-rejeu) et vérificateur PKCE sont gardés dans un cookie signé, httpOnly,
  // valable 10 minutes : on les retrouve au retour du fournisseur.
  const ticket = { provider: id, state: randomToken(), nonce: randomToken(), verifier: randomToken() };
  res.cookie(COOKIE, jwt.sign(ticket, config.jwtSecret, { expiresIn: '10m' }), { ...COOKIE_OPTIONS, maxAge: 10 * 60 * 1000 });
  res.redirect(authorizeUrl(id, ticket));
});

router.get('/:provider/callback', async (req, res) => {
  const id = req.params.provider;
  res.clearCookie(COOKIE, COOKIE_OPTIONS);
  try {
    if (!getProvider(id)) throw new Error('fournisseur non configuré');
    if (req.query.error) throw new Error(req.query.error === 'access_denied' ? 'connexion annulée' : String(req.query.error));

    let ticket;
    try {
      ticket = jwt.verify(readCookie(req, COOKIE) ?? '', config.jwtSecret);
    } catch {
      throw new Error('demande de connexion expirée, veuillez recommencer');
    }
    if (ticket.provider !== id || ticket.state !== req.query.state) {
      throw new Error('demande de connexion invalide, veuillez recommencer');
    }

    const identity = await fetchIdentity(id, { code: String(req.query.code ?? ''), verifier: ticket.verifier, nonce: ticket.nonce });
    const user = await findOrCreateSsoUser(id, identity);
    // Le jeton passe dans le fragment (#) : il n'est ni envoyé aux serveurs ni enregistré dans leurs journaux.
    res.redirect(`${config.appUrl}/connexion/sso#token=${encodeURIComponent(signToken(user))}`);
  } catch (err) {
    res.redirect(`${config.appUrl}/connexion?erreur_sso=${encodeURIComponent(err.message)}`);
  }
});

export default router;
