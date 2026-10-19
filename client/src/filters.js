import { isOverdue, normalize } from './utils.js';

// Critères de filtre des tâches d'un projet (F17). `assignee` vaut '', 'me', 'none' ou l'identifiant d'un membre.
export const EMPTY_FILTER = { q: '', assignee: '', priority: '', label: '', overdue: false };

export function isFilterActive(filter) {
  return Boolean(filter.q.trim() || filter.assignee || filter.priority || filter.label || filter.overdue);
}

export function matchesFilter(task, filter, userId) {
  const q = normalize(filter.q.trim());
  if (q && !normalize([task.title, task.description, ...task.labels].join(' ')).includes(q)) return false;

  const assigneeIds = task.assignees.map((a) => a.id);
  if (filter.assignee === 'me' && !assigneeIds.includes(userId)) return false;
  if (filter.assignee === 'none' && assigneeIds.length > 0) return false;
  if (/^\d+$/.test(filter.assignee) && !assigneeIds.includes(Number(filter.assignee))) return false;

  if (filter.priority && task.priority !== filter.priority) return false;
  if (filter.label && !task.labels.includes(filter.label)) return false;
  if (filter.overdue && !isOverdue(task)) return false;
  return true;
}
