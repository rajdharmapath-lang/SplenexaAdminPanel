const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cors = require('cors');
const express = require('express');
const authRoutes = require('./src/routes/auth.routes');
const userRoutes = require('./src/routes/user.routes');
const questionBankRoutes = require('./src/routes/question-bank.routes');
const feePlanRoutes = require('./src/routes/fee-plan.routes');
const paymentRoutes = require('./src/routes/payment.routes');

const app = express();
const port = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(cors());
app.use('/api/question-bank', express.json({ limit: '4mb' }), questionBankRoutes);
app.use('/api/fee-plans', express.json({ limit: '1mb' }), feePlanRoutes);
app.use('/api/payments', express.json({ limit: '16kb' }), paymentRoutes);
app.use(express.json({ limit: '16kb' }));

app.get('/', (_req, res) => res.json({ ok: true, service: 'splenexa-backend' }));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

app.use((error, _req, res, _next) => {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large.' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ message: 'Request body must be valid JSON.' });
  }
  if (
    error.code === 'SUPABASE_NOT_CONFIGURED' ||
    error.code === 'JWT_NOT_CONFIGURED'
  ) {
    return res.status(503).json({ message: error.message });
  }
  console.error('Unhandled backend error:', error.message);
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
});

app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));

app.listen(port, '0.0.0.0', () => {
  console.info(`Splenexa backend listening on port ${port}`);
});
