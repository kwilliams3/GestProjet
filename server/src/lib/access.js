import { query } from '../db.js';
import { HttpError } from './http.js';

// Règles d'accès (cahier des charges, section 3) :
// - administrateur : accès total ;
// - chef de projet : crée des projets, gère ceux dont il est membre, voit les modèles ;
// - membre d'équipe : voit ses projets, modifie les tâches qui lui sont assignées ;
// - invité / client : lecture seule sur les projets partagés avec lui.

/**
 * Condition SQL « le projet p est visible par l'utilisateur ».
 * Elle utilise les paramètres $1, $2 et $3 : placer visibilityParams(user) en tête des paramètres.
 */
export const VISIBLE_PROJECT = `($1::boolean
  OR (p.is_template AND $2::boolean)
  OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = $3))`;

export const visibilityParams = (user) => [user.role === 'admin', user.role === 'chef_projet', user.id];

/** Charge un projet visible par l'utilisateur et indique s'il peut le gérer. */
export async function loadProject(projectId, user) {
  const { rows } = await query(
    `SELECT p.*, u.full_name AS owner_name,
            EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = $2) AS is_member
     FROM projects p
     JOIN users u ON u.id = p.owner_id
     WHERE p.id = $1`,
    [projectId, user.id],
  );
  const project = rows[0];
  const visible =
    project &&
    (user.role === 'admin' || project.is_member || (project.is_template && user.role === 'chef_projet'));
  // 404 plutôt que 403 : on ne révèle pas l'existence d'un projet à un non-membre.
  if (!visible) throw new HttpError(404, 'Projet introuvable');

  const canManage = user.role === 'admin' || (user.role === 'chef_projet' && project.is_member);
  return { project, canManage };
}

export function assertActive(project) {
  if (project.status === 'archive') {
    throw new HttpError(409, 'Ce projet est archivé : désarchivez-le pour le modifier');
  }
}

export function canEditTask(user, task, canManage) {
  return canManage || (user.role === 'membre' && task.assignees.some((a) => a.id === user.id));
}
