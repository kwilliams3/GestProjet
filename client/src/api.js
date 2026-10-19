const TOKEN_KEY = 'gp_token';

// Jeton de connexion gardé en mémoire et recopié dans localStorage quand c'est possible.
let currentToken = null;
try {
  currentToken = localStorage.getItem(TOKEN_KEY);
} catch {
  // Stockage indisponible (navigation privée stricte) : la session ne survivra pas au rechargement.
}

export const tokenStore = {
  get: () => currentToken,
  set(token) {
    currentToken = token;
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // idem
    }
  },
  clear() {
    currentToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // idem
    }
  },
};

export class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const token = tokenStore.get();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  // Un FormData (envoi de fichier) part tel quel ; le reste est envoyé en JSON.
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined || isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Serveur injoignable : vérifiez votre connexion.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    // Jeton expiré ou invalide : l'application revient à l'écran de connexion.
    if (response.status === 401 && token) window.dispatchEvent(new Event('auth:expired'));
    const fallback =
      response.status >= 500 ? "Le serveur ne répond pas correctement (l'API est-elle démarrée ?)" : `Erreur ${response.status}`;
    throw new ApiError(response.status, data?.error ?? fallback, data?.details);
  }
  return response;
}

/** Appelle l'API (préfixe /api) et renvoie le JSON, ou lève une ApiError. */
export async function api(path, options) {
  const response = await request(path, options);
  return response.status === 204 ? null : response.json();
}

/** Télécharge un fichier protégé par l'authentification et propose de l'enregistrer. */
export async function downloadFile(path, filename) {
  const blob = await (await request(path)).blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
