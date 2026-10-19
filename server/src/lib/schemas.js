import * as z from 'zod';

// Messages de validation en français.
z.config(z.locales.fr());

export { z };

export const ROLES = ['admin', 'chef_projet', 'membre', 'invite'];
export const TASK_STATUSES = ['a_faire', 'en_cours', 'termine'];
export const TASK_PRIORITIES = ['basse', 'moyenne', 'haute', 'urgente'];

export const emailSchema = z.string().trim().toLowerCase().email();
export const fullNameSchema = z.string().trim().min(2).max(100);
export const passwordSchema = z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').max(100);

export const dateString =z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format AAAA-MM-JJ attendue');
export const idList = z.array(z.number().int().positive()).max(200);

const projectFields = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(5000),
  objectives: z.string().max(5000),
  start_date: dateString.nullable(),
  end_date: dateString.nullable(),
  budget: z.number().nonnegative().max(1e12).nullable(),
  is_template: z.boolean(),
  member_ids: idList,
});

export const projectCreateSchema = projectFields.partial().extend({ name: projectFields.shape.name });
export const projectUpdateSchema = projectFields.partial().extend({
  status: z.enum(['actif', 'archive']).optional(),
});

const taskFields = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10000),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  due_date: dateString.nullable(),
  labels: z.array(z.string().trim().min(1).max(30)).max(10),
  assignee_ids: idList,
});

export const taskCreateSchema = taskFields.partial().extend({
  title: taskFields.shape.title,
  parent_id: z.number().int().positive().nullable().optional(),
});
export const taskUpdateSchema = taskFields.partial().extend({
  position: z.number().optional(),
});
