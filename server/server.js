import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveSession, getSessionsByFormId } from './store.js';
import { analyzeSessions } from './analyzer.js';
import { generateInsights } from './insights.js';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../analytics')));

// receive events from form tracker
app.post('/events', (req, res) => {
  const session = req.body;
  if (!session || !session.sessionId) {
    return res.status(400).json({ error: 'Invalid session data' });
  }
  saveSession(session);
  res.json({ ok: true });
});

// get analysis for a form
app.get('/analysis/:formId', (req, res) => {
  const sessions = getSessionsByFormId(decodeURIComponent(req.params.formId));
  const analysis = analyzeSessions(sessions);
  res.json(analysis);
});

// get AI insights for a form
app.get('/insights/:formId', async (req, res) => {
  const sessions = getSessionsByFormId(decodeURIComponent(req.params.formId));
  const analysis = analyzeSessions(sessions);

  if (!analysis.ready) {
    return res.json({ ready: false, message: analysis.message });
  }

  const insights = await generateInsights(analysis);
  res.json({ ready: true, analysis, insights });
});

// apply a fix to the form config
app.post('/resolve', (req, res) => {
  const { formId, field, fix } = req.body;
  // store resolved fixes so dashboard can show before/after
  const fixes = JSON.parse(
    process.env.FIS_FIXES || '{}',
  );
  if (!fixes[formId]) fixes[formId] = [];
  fixes[formId].push({ field, fix, resolvedAt: Date.now() });
  process.env.FIS_FIXES = JSON.stringify(fixes);
  res.json({ ok: true });
});

// get resolved fixes
app.get('/fixes/:formId', (req, res) => {
  const fixes = JSON.parse(process.env.FIS_FIXES || '{}');
  res.json(fixes[decodeURIComponent(req.params.formId)] || []);
});

app.listen(config.port, () => {
  console.log(`Form Intelligence Server running at http://localhost:${config.port}`);
  console.log(`Analytics dashboard: http://localhost:${config.port}/analytics`);
});
