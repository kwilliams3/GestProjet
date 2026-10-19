import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { ROLES, ROLE_LABELS } from '../labels.js';
import { formatDate } from '../utils.js';
import InviteModal from '../components/InviteModal.jsx';
import { PlusIcon } from '../components/icons.jsx';
import { Avatar, ErrorMessage, Loading, PageHeader } from '../components/ui.jsx';

export default function UsersPage() {
  const { user } = useAuth();
  const { data: users, error, setData } = useApi('/users');
  const invitations = useApi('/invitations');
  const [inviting, setInviting] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function run(action) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err);
    }
  }

  const changeRole = (target, role) =>
    run(async () => {
      const updated = await api(`/users/${target.id}/role`, { method: 'PATCH', body: { role } });
      setData((list) => list.map((u) => (u.id === updated.id ? updated : u)));
    });

  const revoke = (invitation) => {
    if (!window.confirm(`Révoquer l'invitation de ${invitation.email} ? Le lien ne fonctionnera plus.`)) return;
    run(async () => {
      await api(`/invitations/${invitation.id}`, { method: 'DELETE' });
      invitations.reload();
    });
  };

  if (error) return <ErrorMessage error={error} />;
  if (!users) return <Loading />;

  return (
    <>
      <PageHeader title="Utilisateurs" subtitle="Attribuez à chaque personne le rôle qui correspond à ses responsabilités.">
        <button type="button" className="btn btn-primary" onClick={() => setInviting(true)}>
          <PlusIcon className="btn-icon-svg" />
          Inviter une personne
        </button>
      </PageHeader>
      <ErrorMessage error={actionError} />

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">E-mail</th>
              <th scope="col">Rôle</th>
              <th scope="col">Inscrit le</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="person">
                    <Avatar name={u.full_name} />
                    {u.full_name}
                  </span>
                </td>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    disabled={u.id === user.id}
                    onChange={(event) => changeRole(u, event.target.value)}
                    aria-label={`Rôle de ${u.full_name}`}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{formatDate(u.created_at.slice(0, 10))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invitations.data?.length > 0 && (
        <section className="card panel section-gap">
          <h2>Invitations en attente</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">E-mail</th>
                  <th scope="col">Rôle</th>
                  <th scope="col">Projet</th>
                  <th scope="col">Invité par</th>
                  <th scope="col">Expire le</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.data.map((invitation) => (
                  <tr key={invitation.id}>
                    <td>{invitation.email}</td>
                    <td>{ROLE_LABELS[invitation.role]}</td>
                    <td>{invitation.project_name ?? <span className="muted">—</span>}</td>
                    <td>{invitation.invited_by_name ?? '—'}</td>
                    <td>
                      {invitation.expired ? (
                        <span className="badge">Expirée</span>
                      ) : (
                        formatDate(invitation.expires_at.slice(0, 10))
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn-link-danger small" onClick={() => revoke(invitation)}>
                        Révoquer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {inviting && <InviteModal onClose={() => setInviting(false)} onInvited={invitations.reload} />}
    </>
  );
}
