import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';

// Connexion SSO (F01) en OpenID Connect, « authorization code » avec PKCE, sans bibliothèque externe.

const { google, microsoft } = config.sso;
const isTrue = (value) => value === true || value === 'true';

const PROVIDERS = {
  google: {
    label: 'Google',
    ...google,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    validIssuer: (iss) => iss === 'https://accounts.google.com' || iss === 'accounts.google.com',
    // Google précise si l'adresse a été vérifiée : sans cette garantie, on refuse.
    emailOf: (claims) => (isTrue(claims.email_verified) ? claims.email : null),
  },
  microsoft: {
    label: 'Microsoft',
    ...microsoft,
    authorizeUrl: `https://login.microsoftonline.com/${microsoft.tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${microsoft.tenant}/oauth2/v2.0/token`,
    validIssuer: (iss, claims) => iss === `https://login.microsoftonline.com/${claims.tid}/v2.0`,
    emailOf: (claims) => claims.email ?? claims.preferred_username ?? null,
  },
};

/** Fournisseur configuré (identifiant et secret renseignés dans server/.env), sinon null. */
export function getProvider(id) {
  const provider = Object.hasOwn(PROVIDERS, id) ? PROVIDERS[id] : null;
  return provider?.clientId && provider?.clientSecret ? provider : null;
}

export function enabledProviders() {
  return Object.keys(PROVIDERS)
    .filter((id) => getProvider(id))
    .map((id) => ({ id, label: PROVIDERS[id].label }));
}

// L'adresse de retour passe par l'interface (le proxy Vite en développement) : c'est celle à déclarer
// chez Google et Microsoft.
export const redirectUri = (id) => `${config.appUrl}/api/auth/sso/${id}/callback`;

export function randomToken() {
  return randomBytes(32).toString('base64url');
}

export function authorizeUrl(id, { state, nonce, verifier }) {
  const provider = getProvider(id);
  const url = new URL(provider.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: redirectUri(id),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

/**
 * Échange le code contre un id_token et renvoie l'identité qu'il contient.
 * La signature du jeton n'est pas vérifiée : il est reçu directement du fournisseur, par une connexion TLS
 * authentifiée par le secret client (OpenID Connect Core, § 3.1.3.7). Ses autres champs le sont.
 */
export async function fetchIdentity(id, { code, verifier, nonce }) {
  const provider = getProvider(id);
  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(id),
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: verifier,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id_token) {
    throw new Error(`réponse refusée par ${provider.label} (${data.error_description ?? data.error ?? response.status})`);
  }

  const claims = JSON.parse(Buffer.from(data.id_token.split('.')[1] ?? '', 'base64url').toString('utf8'));
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(provider.clientId)) throw new Error('jeton destiné à une autre application');
  if (!provider.validIssuer(claims.iss, claims)) throw new Error('émetteur du jeton inattendu');
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error('jeton expiré');
  if (claims.nonce !== nonce) throw new Error('jeton rejoué ou falsifié');
  const email = provider.emailOf(claims);
  if (!claims.sub || !email) throw new Error("ce compte n'a pas d'adresse e-mail vérifiée");

  return { subject: claims.sub, email: email.toLowerCase(), fullName: claims.name || email };
}
