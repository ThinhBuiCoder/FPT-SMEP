// src/app.js — Express app configuration (MongoDB version)

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const classRoutes = require('./routes/class.routes');
const classTeamRoutes = require('./routes/classTeam.routes');  // Module 2: class-scoped team routes
const teamRoutes = require('./routes/team.routes');
const startupRoutes = require('./routes/startupIdea.routes');
const evaluationRoutes = require('./routes/evaluation.routes');
const aiRoutes = require('./routes/ai.routes');
const mentoringRoutes = require('./routes/mentoring.routes');
const milestoneRoutes = require('./routes/milestone.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const chatRoutes = require('./routes/chat.routes');
const workspaceRoutes = require('./routes/workspace.routes');
const commentRoutes = require('./routes/comment.routes');
const sprintTaskRoutes = require('./routes/sprintTask.routes');
const rankingRoutes = require('./routes/ranking.routes');
const notificationRoutes = require('./routes/notification.routes');
const workshopRoutes = require('./routes/workshop.routes');
const weeklyTaskRoutes = require('./routes/weeklyTask.routes');
const checkpointRoutes = require('./routes/checkpoint.routes');
const uploadRoutes = require('./routes/upload.routes');
const { globalErrorHandler, notFound } = require('./middlewares/error.middleware');

const path = require('path');

const app = express();

// Serve static uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/uploads/pitch-decks', express.static(path.join(__dirname, '../uploads/pitch-decks')));

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ─── HEALTH CHECK ─────────────────────────────────────────
app.get('/', (_req, res) => res.json({
  success: true,
  message: '🚀 FPT Startup Mentoring Platform API',
  version: '2.0.0',
  db: 'MongoDB',
  modules: ['Auth', 'User', 'Class Management', 'Team', 'AI', 'Evaluation', 'Milestone', 'Mentoring', 'Dashboard', 'Workspace', 'Checkpoints', 'Notifications', 'Workshops', 'Weekly Tasks', 'Rankings'],
}));

// ─── API ROUTES ───────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/classes', classRoutes);
// Module 2: team generation under /api/classes/:classId/teams
app.use('/api/classes/:classId/teams', classTeamRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/startup-ideas', startupRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/mentoring-sessions', mentoringRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/workspace/checkpoints', checkpointRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/sprint-tasks', sprintTaskRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/workshops', workshopRoutes);
app.use('/api/weekly-tasks', weeklyTaskRoutes);
app.use('/api/upload', uploadRoutes);
// ─── ERROR HANDLERS ───────────────────────────────────────
app.use(notFound);
app.use(globalErrorHandler);

module.exports = app;
