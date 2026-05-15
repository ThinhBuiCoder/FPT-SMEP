// src/app.js — Express app configuration (MongoDB version)

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Routes
const authRoutes       = require('./routes/auth.routes');
const userRoutes       = require('./routes/user.routes');
const classRoutes      = require('./routes/class.routes');
const teamRoutes       = require('./routes/team.routes');
const startupRoutes    = require('./routes/startupIdea.routes');
const evaluationRoutes = require('./routes/evaluation.routes');
const aiRoutes         = require('./routes/ai.routes');
const mentoringRoutes  = require('./routes/mentoring.routes');
const milestoneRoutes  = require('./routes/milestone.routes');
const dashboardRoutes  = require('./routes/dashboard.routes');

const { globalErrorHandler, notFound } = require('./middlewares/error.middleware');

const app = express();

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
  version: '1.0.0',
  db: 'MongoDB',
}));

// ─── API ROUTES ───────────────────────────────────────────
app.use('/api/auth',               authRoutes);
app.use('/api/users',              userRoutes);
app.use('/api/classes',            classRoutes);
app.use('/api/teams',              teamRoutes);
app.use('/api/startup-ideas',      startupRoutes);
app.use('/api/evaluations',        evaluationRoutes);
app.use('/api/ai',                 aiRoutes);
app.use('/api/mentoring-sessions', mentoringRoutes);
app.use('/api/milestones',         milestoneRoutes);
app.use('/api/dashboard',          dashboardRoutes);

// ─── ERROR HANDLERS ───────────────────────────────────────
app.use(notFound);
app.use(globalErrorHandler);

module.exports = app;
