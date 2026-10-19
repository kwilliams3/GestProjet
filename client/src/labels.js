export const STATUSES = ['a_faire', 'en_cours', 'termine'];
export const STATUS_LABELS = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' };

export const PRIORITIES = ['basse', 'moyenne', 'haute', 'urgente'];
export const PRIORITY_LABELS = { basse: 'Basse', moyenne: 'Moyenne', haute: 'Haute', urgente: 'Urgente' };

export const ROLES = ['admin', 'chef_projet', 'membre', 'invite'];
export const ROLE_LABELS = {
  admin: 'Administrateur',
  chef_projet: 'Chef de projet',
  membre: "Membre d'équipe",
  invite: 'Invité / client',
};

// Libellés des champs dans les messages d'erreur de validation.
export const FIELD_LABELS = {
  full_name: 'Nom complet',
  email: 'E-mail',
  password: 'Mot de passe',
  name: 'Nom',
  title: 'Titre',
  description: 'Description',
  objectives: 'Objectifs',
  start_date: 'Date de début',
  end_date: 'Date de fin',
  budget: 'Budget',
  due_date: 'Échéance',
  labels: 'Étiquettes',
  role: 'Rôle',
};
