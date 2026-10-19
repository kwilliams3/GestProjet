import { query } from '../db.js';

/** Crée une notification pour chaque destinataire (sauf l'auteur de l'action). */
export async function notify(db, { userIds, type, taskId, actorId = null, message }) {
  const recipients = [...new Set(userIds)].filter((id) => id !== actorId);
  if (recipients.length === 0) return;
  await db.query(
    `INSERT INTO notifications (user_id, type, task_id, actor_id, message)
     SELECT unnest($1::int[]), $2::notification_type, $3, $4, $5`,
    [recipients, type, taskId, actorId, message],
  );
}

export function notifyAssigned(db, userIds, taskId, title, actor) {
  return notify(db, {
    userIds,
    type: 'assignation',
    taskId,
    actorId: actor.id,
    message: `${actor.full_name} vous a assigné « ${title} »`,
  });
}

/** Membres mentionnés dans un texte sous la forme « @Prénom Nom ». */
export function findMentions(text, members) {
  const lower = text.toLocaleLowerCase('fr');
  return members.filter((m) => lower.includes(`@${m.full_name.toLocaleLowerCase('fr')}`)).map((m) => m.id);
}

/**
 * Rappels d'échéance (F13) pour les personnes assignées à une tâche non terminée d'un projet actif :
 * échéance dans les 2 jours, ou échéance dépassée. L'index unique évite les doublons.
 */
export async function createDueReminders() {
  await query(
    `INSERT INTO notifications (user_id, type, task_id, message, reminder_for)
     SELECT ta.user_id, 'echeance_proche', t.id,
            format('« %s » arrive à échéance %s', t.title,
                   CASE t.due_date - current_date
                     WHEN 0 THEN 'aujourd''hui'
                     WHEN 1 THEN 'demain'
                     ELSE 'le ' || to_char(t.due_date, 'DD/MM/YYYY')
                   END),
            t.due_date
     FROM tasks t
     JOIN projects p ON p.id = t.project_id AND p.status = 'actif'
     JOIN task_assignees ta ON ta.task_id = t.id
     WHERE t.status <> 'termine' AND t.due_date BETWEEN current_date AND current_date + 2
     ON CONFLICT DO NOTHING`,
  );
  await query(
    `INSERT INTO notifications (user_id, type, task_id, message, reminder_for)
     SELECT ta.user_id, 'retard', t.id,
            format('« %s » est en retard (échéance du %s)', t.title, to_char(t.due_date, 'DD/MM/YYYY')),
            t.due_date
     FROM tasks t
     JOIN projects p ON p.id = t.project_id AND p.status = 'actif'
     JOIN task_assignees ta ON ta.task_id = t.id
     WHERE t.status <> 'termine' AND t.due_date < current_date
     ON CONFLICT DO NOTHING`,
  );
}
