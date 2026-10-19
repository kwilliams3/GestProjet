import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  // Au démarrage, on récupère l'utilisateur correspondant au jeton enregistré.
  useEffect(() => {
    if (!tokenStore.get()) return;
    api('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => {
      tokenStore.clear();
      setUser(null);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  async function authenticate(path, body) {
    const result = await api(path, { method: 'POST', body });
    tokenStore.set(result.token);
    setUser(result.user);
    return result;
  }

  const value = {
    user,
    loading,
    login: (email, password) => authenticate('/auth/login', { email, password }),
    register: (data) => authenticate('/auth/register', data),
    acceptInvitation: (token, data) => authenticate(`/invitations/accept/${token}`, data),
    // Retour d'une connexion Google/Microsoft : le serveur a fourni le jeton, on charge l'utilisateur.
    async loginWithToken(token) {
      tokenStore.set(token);
      try {
        setUser((await api('/auth/me')).user);
      } catch (err) {
        tokenStore.clear();
        throw err;
      }
    },
    logout() {
      tokenStore.clear();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
