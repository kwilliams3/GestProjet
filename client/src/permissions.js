// Mêmes règles que server/src/lib/access.js : l'interface masque ce que l'API refuserait.

export const canCreateProjects = (user) => user.role === 'admin' || user.role === 'chef_projet';

export function canEditTask(user, project, task) {
  if (project.status !== 'actif') return false;
  return project.can_manage || (user.role === 'membre' && task.assignees.some((a) => a.id === user.id));
}
