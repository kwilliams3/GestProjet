import express from 'express';
import helmet from 'helmet';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { attachments, taskAttachments } from './routes/attachments.js';
import authRoutes from './routes/auth.js';
import { comments, taskComments } from './routes/comments.js';
import dashboardRoutes from './routes/dashboard.js';
import filterRoutes from './routes/filters.js';
import { invitations, publicInvitations } from './routes/invitations.js';
import notificationRoutes from './routes/notifications.js';
import projectRoutes from './routes/projects.js';
import { calendar, projectDocuments, projectModules, reports } from './routes/modules.js';
import searchRoutes from './routes/search.js';
import ssoRoutes from './routes/sso.js';
import taskRoutes from './routes/tasks.js';
import userRoutes from './routes/users.js';

export const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth/sso', ssoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/invitations/accept', publicInvitations);
app.use('/api/invitations', requireAuth, invitations);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/projects/:projectId/modules', requireAuth, projectModules);
app.use('/api/project-documents', requireAuth, projectDocuments);
app.use('/api/calendar', requireAuth, calendar);
app.use('/api/reports', requireAuth, reports);
app.use('/api/tasks/:taskId/comments', requireAuth, taskComments);
app.use('/api/tasks/:taskId/attachments', requireAuth, taskAttachments);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/comments', requireAuth, comments);
app.use('/api/attachments', requireAuth, attachments);
app.use('/api/notifications', requireAuth, notificationRoutes);
app.use('/api/search', requireAuth, searchRoutes);
app.use('/api/filters', requireAuth, filterRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);

app.use('/api', notFound);
app.use(errorHandler);
