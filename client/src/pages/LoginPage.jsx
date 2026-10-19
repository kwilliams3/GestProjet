import { useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';
import { useAuth } from '../auth.jsx';
import { PasswordField, SubmitButton, TextField } from '../components/AuthFields.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import { MailIcon } from '../components/icons.jsx';
import SsoButtons from '../components/SsoButtons.jsx';
import { ErrorMessage } from '../components/ui.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const ssoError = searchParams.get('erreur_sso');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Une fois connecté, retour à la page demandée au départ.
  if (user) return <Navigate to={location.state?.from?.pathname ?? '/'} replace />;

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <header className="auth-header">
        <h1>Connexion</h1>
        <p className="muted">Heureux de vous revoir ! Connectez-vous pour retrouver vos projets.</p>
      </header>

      {ssoError && !error && <ErrorMessage error={{ message: `Connexion impossible : ${ssoError}.` }} />}
      <ErrorMessage error={error} />

      <form onSubmit={handleSubmit}>
        <TextField
          label="Adresse e-mail"
          icon={MailIcon}
          type="email"
          autoComplete="email"
          placeholder="vous@entreprise.com"
          required
          value={form.email}
          onChange={update('email')}
          autoFocus
        />
        <PasswordField
          autoComplete="current-password"
          placeholder="Votre mot de passe"
          required
          value={form.password}
          onChange={update('password')}
        />
        <SubmitButton busy={submitting} busyLabel="Connexion…">
          Se connecter
        </SubmitButton>
      </form>

      <SsoButtons />

      <p className="auth-switch">
        Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
      </p>
    </AuthLayout>
  );
}
