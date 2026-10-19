import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import { ErrorMessage } from '../components/ui.jsx';

/** Retour d'une connexion Google/Microsoft : le jeton arrive dans le fragment de l'adresse (#token=…). */
export default function SsoCallbackPage() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (started.current) return; // React (mode strict) exécute l'effet deux fois en développement
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    window.history.replaceState(null, '', window.location.pathname); // retire le jeton de l'adresse
    if (!token) {
      navigate('/connexion', { replace: true });
      return;
    }
    loginWithToken(token).then(() => navigate('/', { replace: true }), setError);
  }, [loginWithToken, navigate]);

  return (
    <AuthLayout>
      {error ? (
        <>
          <header className="auth-header">
            <h1>Connexion impossible</h1>
          </header>
          <ErrorMessage error={error} />
          <p className="auth-switch">
            <Link to="/connexion">Revenir à la connexion</Link>
          </p>
        </>
      ) : (
        <p className="auth-pending" role="status">
          <span className="spinner" aria-hidden="true" />
          Connexion en cours…
        </p>
      )}
    </AuthLayout>
  );
}
