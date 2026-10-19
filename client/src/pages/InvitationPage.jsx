import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { ROLE_LABELS } from '../labels.js';
import { PasswordField, SubmitButton, TextField } from '../components/AuthFields.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import { MailIcon, UserIcon } from '../components/icons.jsx';
import { ErrorMessage, Loading } from '../components/ui.jsx';

/** Page publique ouverte depuis le lien d'invitation : la personne choisit son nom et son mot de passe. */
export default function InvitationPage() {
  const { token } = useParams();
  const { user, acceptInvitation, logout } = useAuth();
  const navigate = useNavigate();
  const { data: invitation, error: loadError } = useApi(`/invitations/accept/${token}`);
  const [form, setForm] = useState({ full_name: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await acceptInvitation(token, form);
      navigate(result.project_id ? `/projets/${result.project_id}` : '/', { replace: true });
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <AuthLayout>
        <header className="auth-header">
          <h1>Invitation</h1>
        </header>
        <ErrorMessage error={loadError} />
        <p className="muted">Demandez à la personne qui vous a invité(e) de vous envoyer une nouvelle invitation.</p>
        <p className="auth-switch">
          <Link to="/connexion">Aller à la connexion</Link>
        </p>
      </AuthLayout>
    );
  }

  if (!invitation) {
    return (
      <AuthLayout>
        <Loading />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <header className="auth-header">
        <h1>Rejoindre GestProjet</h1>
      </header>
      <p className="auth-callout">
        <strong>{invitation.invited_by_name ?? 'Un administrateur'}</strong> vous invite en tant que{' '}
        <strong>{ROLE_LABELS[invitation.role]}</strong>
        {invitation.project_name && (
          <>
            {' '}
            sur le projet <strong>« {invitation.project_name} »</strong>
          </>
        )}
        .
      </p>

      {user ? (
        <>
          <p>
            Vous êtes connecté(e) en tant que <strong>{user.full_name}</strong>. Déconnectez-vous pour accepter cette
            invitation destinée à <strong>{invitation.email}</strong>.
          </p>
          <button type="button" className="btn btn-lg btn-block" onClick={logout}>
            Se déconnecter
          </button>
        </>
      ) : (
        <>
          <ErrorMessage error={error} />
          <form onSubmit={handleSubmit}>
            <TextField label="Adresse e-mail" icon={MailIcon} value={invitation.email} readOnly />
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
            <PasswordField
              label="Choisissez un mot de passe"
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
        </>
      )}
    </AuthLayout>
  );
}
