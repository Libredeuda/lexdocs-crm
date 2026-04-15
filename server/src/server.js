import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generalLimiter, authLimiter } from './middleware/rateLimit.js';

import authRoutes from './routes/auth.js';
import contactsRoutes from './routes/contacts.js';
import casesRoutes from './routes/cases.js';
import documentsRoutes from './routes/documents.js';
import paymentsRoutes from './routes/payments.js';
import eventsRoutes from './routes/events.js';
import activitiesRoutes from './routes/activities.js';
import pipelinesRoutes from './routes/pipelines.js';
import tagsRoutes from './routes/tags.js';
import organizationsRoutes from './routes/organizations.js';
import apiKeysRoutes from './routes/api-keys.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Body parser
app.use(express.json({ limit: '10mb' }));

// Rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth', authLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/pipelines', pipelinesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/api-keys', apiKeysRoutes);

// Error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`LexDocs server running on port ${PORT}`);
});

export default app;
