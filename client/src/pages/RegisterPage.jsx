import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '../auth.jsx';
import { PasswordField, SubmitButton, TextField } from '../components/AuthFields.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import { MailIcon, UserIcon } from '../components/icons.jsx';
import SsoButtons from '../components/SsoButtons.jsx';
import { ErrorMessage } from '../components/ui.jsx';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register(form);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <header className="auth-header">
        <h1>Créer un compte</h1>
        <p className="muted">Rejoignez votre équipe et retrouvez tous vos projets au même endroit.</p>
      </header>

      <ErrorMessage error={error} />

      <form onSubmit={handleSubmit}>
        <TextField
          label="Nom complet"
          icon={UserIcon}
          autoComplete="name"
          placeholder="Prénom Nom"
          required
          minLength={2}
          value={form.full_name}
          onChange={update('full_name')}
          autoFocus
        />
        <TextField
          label="Adresse e-mail"
          icon={MailIcon}
          type="email"
          autoComplete="email"
          placeholder="vous@entreprise.com"
          required
          value={form.email}
          onChange={update('email')}
        />
        <PasswordField
          autoComplete="new-password"
          placeholder="8 caractères minimum"
          hint="Au moins 8 caractères."
          required
          minLength={8}
          value={form.password}
          onChange={update('password')}
        />
        <SubmitButton busy={submitting} busyLabel="Création…">
          Créer mon compte
        </SubmitButton>
      </form>

      <SsoButtons />

      <p className="auth-switch">
        Déjà inscrit ? <Link to="/connexion">Se connecter</Link>
      </p>
    </AuthLayout>
  );
}
