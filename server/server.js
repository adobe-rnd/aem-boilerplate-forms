import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';
import {
  saveSession, appendEvents, getAllSessions, getSessionsByFormIdAndRange, clearSessionsByFormId,
  saveInsightsCache, getInsightsCache, clearInsightsCache,
  saveResolvedFix, getResolvedFixes, clearResolvedFixes,
  saveCycleSnapshot, getCycleSnapshots,
  getFormCycles, saveFormCycle, updateFormCycleSnapshot, deleteFormCycle,
  getJourneysByDomain, getJourneyStats, getJourneysByFormId,
} from './store.js';
import {
  analyzeSessions, buildFunnel, buildSessionSummaries, filterGhostSessions, buildTimeline,
  buildFlowComparison, mergeIntoJourneySessions,
} from './analyzer.js';
import { generateInsights, generateRuleBasedInsights, detectRegressions } from './insights.js';
import { config } from './config.js';
import { diagnoseEvent } from './error-patterns.js';
import { checkThresholds, sendWeeklyDigest } from './notifier.js';
import {
  recordResolution, lookupResolution, getKnowledgeBase, signatureForError,
} from './knowledge-base.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
// Screenshots are base64-encoded PNGs (300 KB–1 MB each). Raise the body limit
// so sessions that carry screenshot data aren't silently rejected with 413.
app.use(express.json({ limit: '50mb' }));
// sendBeacon from a cross-origin page (form on :3001) must use text/plain to
// avoid a CORS preflight — parse the raw text body as JSON for /events
app.use(express.text({ type: 'text/plain', limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../analytics')));
app.use(express.static(path.join(__dirname, '..')));
app.use('/screenshots', express.static(path.join(__dirname, 'data/screenshots')));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Serve the standalone tracker script. Customers add this to their form pages:
//   <script async src="https://this-host/fis-tracker.js" data-server="https://this-host"></script>
// It self-initializes, auto-detects the form, captures frontend errors, and
// posts events back here. Served with permissive CORS so any origin can load it.
app.get('/fis-tracker.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(__dirname, '../fis-tracker.js'));
});

// Serve the lightweight page tracker for non-form pages (landing, thank-you, etc.)
app.get('/fis-page-tracker.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(__dirname, '../fis-page-tracker.js'));
});

// ── Error test endpoints — must be defined BEFORE the wildcard submit handler ─
// These URLs match FORM_CALL_PATTERNS in form-tracker.js so the tracker intercepts them.

// Returns the requested HTTP error code (form_error with status)
app.all('/adobe/forms/af/submit/test-error/:code', (req, res) => {
  const code = parseInt(req.params.code, 10);
  const valid = [400, 401, 403, 404, 422, 429, 500, 502, 503, 504];
  if (!valid.includes(code)) return res.status(400).json({ error: 'Use one of: ' + valid.join(', ') });
  res.status(code).json({ error: `Simulated ${code} error` });
});

// Drops the TCP connection immediately — causes a "Network error" / status 0 form_error
app.all('/adobe/forms/af/submit/test-network-failure', (req, _res) => {
  req.socket.destroy();
});

// Required fields per form — mock server validates these so incomplete submissions
// return 422 instead of 200, preventing false "submitted" sessions in analytics.
// test-form uses client-side required:true on all fields — no server re-check needed.
const REQUIRED_FIELDS = {};

// Mock form submission endpoint for local development
app.post('/adobe/forms/af/submit/*', (req, res) => {
  const formId = req.params[0];
  console.log('Mock form submission received for:', formId);

  const data = req.body?.data || {};
  const required = REQUIRED_FIELDS[formId];
  if (required) {
    const missing = required.filter((f) => !data[f] || String(data[f]).trim() === '');
    if (missing.length > 0) {
      return res.status(422).json({
        error: 'Validation failed',
        message: `Required fields are missing or empty: ${missing.join(', ')}`,
        fields: missing,
      });
    }
  }

  res.json({ thankYouMessage: 'Thank you for your submission.' });
});

// Prefill 404 — already covered by the real mock above, but explicit alias for clarity
app.all('/adobe/forms/af/prefill/test-error', (_req, res) => {
  res.status(404).json({ error: 'Simulated prefill not found' });
});

// Silent API error — returns 500 on a non-lifecycle URL to test the expanded fetch interceptor
app.all('/api/silent-test-500', (_req, res) => {
  res.status(500).json({ error: 'Simulated silent API error' });
});

// receive events from form tracker
app.post('/events', (req, res) => {
  let payload = req.body;
  // sendBeacon sends text/plain cross-origin — parse it here
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!payload || !payload.sessionId) {
    return res.status(400).json({ error: 'Invalid session data' });
  }

  let formId;
  if (payload.formId) {
    // full session object — legacy path (e.g. stripRefreshAbandon re-posts)
    saveSession(payload);
    formId = payload.formId;
  } else {
    // incremental payload: { sessionId, events, meta? }
    appendEvents(payload.sessionId, payload.events || [], payload.meta || null);
    formId = payload.meta?.formId;
  }

  res.json({ ok: true });

  // Check thresholds async — don't block the response
  if (formId) {
    const allSessions = getSessionsByFormIdAndRange(formId, null, null, null);
    const analysis = analyzeSessions(allSessions);
    checkThresholds(formId, analysis).catch(() => {});
  }
});

// Retract a form_abandon from a session that turned out to be a cross-domain redirect.
// The tracker on the next page posts here once it detects it continued the same journey.
app.post('/retract-abandon', (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const all = getAllSessions();
  const session = all.find((s) => s.sessionId === sessionId);
  if (!session) return res.status(404).json({ error: 'session not found' });

  const hadAbandon = session.events.some((e) => e.type === 'form_abandon');
  if (!hadAbandon) {
    // form_abandon beacon hasn't arrived yet (race: next page loaded before beacon delivered).
    // Set a flag so appendEvents can swap it out when it arrives.
    session.retractPending = true;
    saveSession(session);
    return res.json({ ok: true, changed: false, pending: true });
  }

  session.events = session.events.filter((e) => e.type !== 'form_abandon');
  session.events.push({ type: 'form_continued', timestamp: Date.now() });
  delete session.retractPending;
  saveSession(session);

  return res.json({ ok: true, changed: true });
});

function rangeMs(range) {
  const DAY = 86400000;
  if (range === 'today') return DAY;
  if (range === '7d') return 7 * DAY;
  if (range === '14d') return 14 * DAY;
  if (range === '30d') return 30 * DAY;
  if (range === '90d') return 90 * DAY;
  return null;
}

function resolveSinceTs(query) {
  if (query.since) return Number(query.since);
  const ms = rangeMs(query.range);
  return ms ? Date.now() - ms : null;
}

function resolveUntilTs(query) {
  return query.until ? Number(query.until) : null;
}

// get analysis for a form
app.get('/analysis/:formId', (req, res) => {
  const formId = decodeURIComponent(req.params.formId);
  const sinceTs = resolveSinceTs(req.query);
  const untilTs = resolveUntilTs(req.query);
  const sessions = mergeIntoJourneySessions(getSessionsByFormIdAndRange(formId, null, sinceTs, untilTs));
  const analysis = analyzeSessions(sessions);

  // comparison period: same duration shifted back
  if (req.query.compare === 'true' && sinceTs) {
    const effectiveUntil = untilTs || Date.now();
    const duration = effectiveUntil - sinceTs;
    const prevSince = sinceTs - duration;
    const prevUntil = sinceTs;
    const prevSessions = mergeIntoJourneySessions(getSessionsByFormIdAndRange(formId, null, prevSince, prevUntil));
    const prevAnalysis = analyzeSessions(prevSessions);
    analysis.prev = prevAnalysis.ready ? prevAnalysis.summary : null;
  }

  res.json(analysis);
});

// day/week/hour bucketed trend data for timeline chart
app.get('/timeline/:formId', (req, res) => {
  const sinceTs = resolveSinceTs(req.query);
  const untilTs = resolveUntilTs(req.query);
  const sessions = getSessionsByFormIdAndRange(
    decodeURIComponent(req.params.formId),
    null,
    sinceTs,
    untilTs,
  );
  res.json(buildTimeline(filterGhostSessions(mergeIntoJourneySessions(sessions)), sinceTs, untilTs));
});

// flow comparison: completers vs abandoners — where the flow breaks + why
app.get('/flow/:formId', (req, res) => {
  const sinceTs = resolveSinceTs(req.query);
  const untilTs = resolveUntilTs(req.query);
  const sessions = getSessionsByFormIdAndRange(
    decodeURIComponent(req.params.formId),
    null,
    sinceTs,
    untilTs,
  );
  res.json(buildFlowComparison(mergeIntoJourneySessions(sessions)));
});

// conversion funnel
app.get('/funnel/:formId', (req, res) => {
  const sinceTs = resolveSinceTs(req.query);
  const untilTs = resolveUntilTs(req.query);
  const sessions = filterGhostSessions(mergeIntoJourneySessions(getSessionsByFormIdAndRange(
    decodeURIComponent(req.params.formId),
    null,
    sinceTs,
    untilTs,
  )));
  res.json(buildFunnel(sessions));
});

function insightKey(insight) {
  return insight.fields?.length > 0
    ? insight.fields.slice().sort().join(',')
    : `__session__${(insight.fix || '').slice(0, 60)}`;
}

// get AI insights for a form — checks skill-written cache first
app.get('/insights/:formId', async (req, res) => {
  const formId = decodeURIComponent(req.params.formId);

  // respect cycle/date windowing so regression check uses post-deploy sessions only
  const sinceTs = resolveSinceTs(req.query);
  const untilTs = resolveUntilTs(req.query);
  const sessions = mergeIntoJourneySessions(getSessionsByFormIdAndRange(formId, null, sinceTs, untilTs));
  const analysis = analyzeSessions(sessions);

  if (!analysis.ready) {
    return res.json({ ready: false, message: analysis.message });
  }

  const resolvedFixes = getResolvedFixes(formId);
  const resolvedKeys = new Set(resolvedFixes.map((f) => f.field));
  // Error insights are matched by their STABLE errorSignature too — the AI rephrases
  // the fix text between generations, which would change the field-key and make a
  // resolved error reappear as active. The signature is deterministic, so it doesn't.
  const resolvedSignatures = new Set(resolvedFixes.map((f) => f.errorSignature).filter(Boolean));
  const sigToFix = new Map(resolvedFixes.filter((f) => f.errorSignature).map((f) => [f.errorSignature, f]));

  const isResolvedInsight = (i) => resolvedKeys.has(insightKey(i))
    || (i.errorSignature && resolvedSignatures.has(i.errorSignature));

  // detect regressions — resolved issues whose metrics have worsened above threshold again
  const regressions = detectRegressions(analysis, resolvedFixes);
  const regressionKeys = new Set(regressions.map((r) => r.fields.slice().sort().join(',')));

  // build a map of field key → full resolved-fix entry so we can attach cycleId
  const resolvedFixesMap = new Map(resolvedFixes.map((f) => [f.field, f]));

  function attachCycleMeta(insight) {
    const fix = resolvedFixesMap.get(insightKey(insight))
      || (insight.errorSignature && sigToFix.get(insight.errorSignature));
    return {
      ...insight,
      cycleId: fix?.cycleId ?? null,
      resolvedAt: fix?.resolvedAt ?? null,
      appliedFix: fix?.actualFix ?? null, // the custom fix the user typed, if any
      usedSuggested: fix?.usedSuggested ?? true,
    };
  }

  const { totalSessions: totalN = 0 } = analysis.summary || {};

  // How many sessions does this insight rest on? Prefer a literal "N of M sessions"
  // count in the text (most accurate); else the worst field's drop-off count; else
  // a "NN.N%" rate applied to the sample; else the whole sample.
  function affectedSessions(insight) {
    const text = insight.insight || '';
    const literal = /(\d+)\s+(?:out of|of)\s+\d+\s+sessions?/i.exec(text);
    if (literal) return Number(literal[1]);
    if (insight.fields?.length && analysis.fields?.length) {
      const matched = analysis.fields.filter((f) => insight.fields.includes(f.field));
      const worst = Math.max(0, ...matched.map((f) => f.dropOffRate || 0));
      if (worst > 0) return Math.round(worst * totalN);
    }
    const pct = /(\d+(?:\.\d+)?)\s*%/.exec(text);
    if (pct) return Math.round((Number(pct[1]) / 100) * totalN);
    return totalN;
  }

  // Confidence = how much we trust the pattern, driven by sample size.
  function sampleConfidence(n) {
    if (n >= 100) return { pct: 95, reason: `${n} sessions show this pattern` };
    if (n >= 50) return { pct: 90, reason: `${n} sessions show this pattern` };
    if (n >= 20) return { pct: 82, reason: `${n} sessions — a solid sample` };
    if (n >= 10) return { pct: 70, reason: `${n} sessions — indicative` };
    if (n >= 5) return { pct: 52, reason: `only ${n} sessions — provisional` };
    return { pct: 30, reason: `only ${n} session${n !== 1 ? 's' : ''} — too few to be sure` };
  }

  function enrichInsight(insight) {
    const affected = affectedSessions(insight);
    const conf = sampleConfidence(affected);
    return {
      ...insight,
      confidence: conf.pct,
      confidenceReason: conf.reason,
    };
  }

  // If this error was solved before on another form, recommend the proven fix.
  function attachPriorResolution(insight) {
    if (!insight.errorSignature) return insight;
    const prior = lookupResolution(insight.errorSignature, formId);
    if (!prior) return insight;
    return {
      ...insight,
      priorResolution: {
        fix: prior.fix,
        label: prior.label,
        formName: prior.formName,
        resolvedAt: prior.firstResolvedAt,
        timesApplied: prior.timesApplied,
      },
    };
  }

  // 1. skill-generated insights — split into active and resolved, return both
  const cached = getInsightsCache(formId);
  if (cached) {
    const active = cached.insights
      .filter((i) => !isResolvedInsight(i))
      .map(attachPriorResolution)
      .map(enrichInsight);
    const resolved = cached.insights
      .filter((i) => isResolvedInsight(i) && !regressionKeys.has(insightKey(i)))
      .map(attachCycleMeta);
    return res.json({
      ready: true, analysis, insights: [...regressions, ...active], resolvedInsights: resolved, source: 'skill',
    });
  }

  // 2. API-generated insights (Bedrock or Anthropic), falling back to rules if no credentials
  const { insights: allInsights, source } = await generateInsights(analysis, resolvedFixes, sessions);
  const active = allInsights
    .filter((i) => !isResolvedInsight(i))
    .map(attachPriorResolution)
    .map(enrichInsight);
  const resolved = allInsights
    .filter((i) => isResolvedInsight(i) && !regressionKeys.has(insightKey(i)))
    .map(attachCycleMeta);
  res.json({
    ready: true, analysis, insights: [...regressions, ...active], resolvedInsights: resolved, source,
  });
});

// accept insights written by the /generate-insights Claude Code skill
app.post('/insights/:formId', (req, res) => {
  const formId = decodeURIComponent(req.params.formId);
  const { insights } = req.body;
  if (!Array.isArray(insights)) {
    return res.status(400).json({ error: 'insights must be an array' });
  }
  saveInsightsCache(formId, insights);
  console.log(`Insights cached for ${formId}: ${insights.length} cards`);
  res.json({ ok: true, count: insights.length });
});

// clear cached insights so the skill can regenerate
app.delete('/insights/:formId', (req, res) => {
  clearInsightsCache(decodeURIComponent(req.params.formId));
  res.json({ ok: true });
});

// get session summaries (for sessions list view)
app.get('/sessions/:formId', (req, res) => {
  const sinceTs = resolveSinceTs(req.query);
  const untilTs = resolveUntilTs(req.query);
  const sessions = filterGhostSessions(getSessionsByFormIdAndRange(
    decodeURIComponent(req.params.formId),
    null,
    sinceTs,
    untilTs,
  ));
  res.json(buildSessionSummaries(sessions));
});

// journeys for a form — sessions sharing a journeyId grouped into one multi-page journey
app.get('/form-journeys/:formId', (req, res) => {
  const sinceTs = resolveSinceTs(req.query);
  const untilTs = resolveUntilTs(req.query);
  let journeys = getJourneysByFormId(decodeURIComponent(req.params.formId));
  if (sinceTs) journeys = journeys.filter((j) => (j.startTime || 0) >= sinceTs);
  if (untilTs) journeys = journeys.filter((j) => (j.startTime || 0) <= untilTs);
  res.json(journeys);
});

// get a single full session (for timeline view)
app.get('/session/:sessionId', (req, res) => {
  const all = getAllSessions();
  let session = all.find((s) => s.sessionId === req.params.sessionId);
  // A multi-page journey's sessions are merged (mergeIntoJourneySessions) into one
  // synthetic session whose sessionId is set to the journeyId — so error-panel chips
  // and other UI built from merged data pass a journeyId here, not a real sessionId.
  // Fall back to the earliest raw page for that journey so the timeline can still open.
  if (!session) {
    const pages = all.filter((s) => s.journeyId === req.params.sessionId);
    if (pages.length) {
      [session] = [...pages].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    }
  }
  if (!session) return res.status(404).json({ error: 'Session not found' });
  return res.json(session);
});

// mark a field fix as resolved — persisted to disk, survives server restarts.
// If the issue is an error with a precise signature, also record what actually
// worked into the cross-form knowledge base.
app.post('/resolve', (req, res) => {
  const {
    formId, field, fix, snapshot, cycleId,
    errorSignature, errorLabel, actualFix, usedSuggested, formName, insightText,
  } = req.body;
  const cleanActualFix = (actualFix && actualFix.trim()) || null;
  saveResolvedFix(
    formId, field, fix, snapshot, cycleId || null,
    cleanActualFix, usedSuggested !== false, errorSignature || null, insightText || null,
  );

  // Learn from this resolution: store the fix the user actually applied, keyed
  // by the precise error signature, so the same error elsewhere gets it back.
  if (errorSignature) {
    recordResolution({
      signature: errorSignature,
      label: errorLabel,
      fix: cleanActualFix || fix,
      usedSuggested: usedSuggested !== false,
      formId,
      formName,
    });
  }
  res.json({ ok: true });
});

// the cross-form knowledge base of proven fixes
app.get('/knowledge-base', (_req, res) => {
  res.json(getKnowledgeBase());
});

// bulk-resolve all active insights for a form — called when creating a new deploy cycle
app.post('/resolve-all/:formId', (req, res) => {
  const formId = decodeURIComponent(req.params.formId);
  const { cycleId, cycleTimestamp } = req.body;

  // use sessions up to the cycle timestamp so regression baselines are pre-deploy
  const sessions = getSessionsByFormIdAndRange(formId, null, null, cycleTimestamp || Date.now());
  const analysis = analyzeSessions(sessions);
  if (!analysis.ready) return res.json({ ok: true, count: 0 });

  const resolvedFixes = getResolvedFixes(formId);
  const resolvedKeys = new Set(resolvedFixes.map((f) => f.field));

  const cached = getInsightsCache(formId);
  const allInsights = cached ? cached.insights : generateRuleBasedInsights(analysis, [], sessions);

  const toResolve = allInsights.filter((i) => !resolvedKeys.has(insightKey(i)));

  toResolve.forEach((insight) => {
    const key = insightKey(insight);
    const snapshot = {};
    if (insight.fields && insight.fields.length > 0) {
      insight.fields.forEach((fieldName) => {
        const stats = analysis.fields.find((f) => f.field === fieldName);
        if (stats) {
          snapshot[fieldName] = {
            dropOffRate: stats.dropOffRate,
            avgErrorCount: stats.avgErrorCount,
            avgIdleTimeMs: stats.avgIdleTimeMs,
            labelCopyRate: stats.labelCopyRate,
            copyPasteRate: stats.copyPasteRate,
            visibilityRate: stats.visibilityRate,
            avgVisitCount: stats.avgVisitCount,
            skipRate: stats.skipRate,
          };
        }
      });
    } else {
      // Session-level insight — snapshot the current session summary metrics
      const s = analysis.summary;
      const n = s.totalSessions || 1;
      snapshot.__session__ = {
        completionRate: s.completionRate,
        dropOffRate: s.dropOffRate,
        jsErrorRate: (s.errors?.jsErrors || 0) / n,
        apiErrorRate: (s.errors?.apiErrors || 0) / n,
        crashRate: (s.errors?.suspectedCrashes || 0) / n,
      };
    }
    saveResolvedFix(formId, key, insight.fix, snapshot, cycleId || null);
  });

  res.json({ ok: true, count: toResolve.length });
});

// ── Deploy cycle CRUD (server-side persistence) ───────────────────────────────

app.get('/cycles/:formId', (req, res) => {
  const formId = decodeURIComponent(req.params.formId);
  res.json(getFormCycles(formId));
});

app.post('/cycles/:formId', (req, res) => {
  const formId = decodeURIComponent(req.params.formId);
  const cycle = req.body;
  if (!cycle?.id || !cycle?.timestamp) return res.status(400).json({ error: 'cycle must have id and timestamp' });
  saveFormCycle(formId, cycle);
  res.json({ ok: true });
});

app.patch('/cycles/:formId/:cycleId/snapshot', (req, res) => {
  const formId = decodeURIComponent(req.params.formId);
  const { cycleId } = req.params;
  updateFormCycleSnapshot(formId, cycleId, req.body);
  res.json({ ok: true });
});

app.delete('/cycles/:formId/:cycleId', (req, res) => {
  const formId = decodeURIComponent(req.params.formId);
  const { cycleId } = req.params;
  deleteFormCycle(formId, cycleId);
  res.json({ ok: true });
});

// save a cycle snapshot — call before clearing insights at the start of each new cycle
app.post('/cycle-snapshot/:formId', (req, res) => {
  const formId = decodeURIComponent(req.params.formId);
  const sessions = filterGhostSessions(getSessionsByFormIdAndRange(formId, null, null, null));
  if (!sessions.length) return res.json({ ok: false, reason: 'no sessions to snapshot' });
  const { summary } = analyzeSessions(sessions);
  const cached = getInsightsCache(formId);
  const activeCount = cached?.insights?.length || 0;
  const resolvedCount = getResolvedFixes(formId).length;
  saveCycleSnapshot(formId, summary, activeCount, resolvedCount);
  res.json({ ok: true, savedAt: Date.now(), totalSessions: summary.totalSessions });
});

// get cycle-over-cycle progress for a form
app.get('/progress/:formId', (req, res) => {
  const formId = decodeURIComponent(req.params.formId);
  const snapshots = getCycleSnapshots(formId);
  if (snapshots.length < 2) return res.json({ available: false, snapshots });
  const prev = snapshots[snapshots.length - 2];
  const curr = snapshots[snapshots.length - 1];
  res.json({
    available: true,
    cycleCount: snapshots.length,
    prev,
    curr,
    delta: {
      completionRate: curr.completionRate - prev.completionRate,
      dropOffRate: curr.dropOffRate - prev.dropOffRate,
      bounceRate: curr.bounceRate - prev.bounceRate,
      deepAbandonRate: curr.deepAbandonRate - prev.deepAbandonRate,
      totalSessions: curr.totalSessions - prev.totalSessions,
      activeInsightCount: curr.activeInsightCount - prev.activeInsightCount,
      resolvedInsightCount: curr.resolvedInsightCount - prev.resolvedInsightCount,
    },
  });
});

// get resolved fixes for a form
app.get('/fixes/:formId', (req, res) => {
  res.json(getResolvedFixes(decodeURIComponent(req.params.formId)));
});

app.get('/errors/:formId', (req, res) => {
  const formId = decodeURIComponent(req.params.formId);
  const sinceTs = resolveSinceTs(req.query);
  const untilTs = resolveUntilTs(req.query);
  const sessions = filterGhostSessions(mergeIntoJourneySessions(getSessionsByFormIdAndRange(formId, null, sinceTs, untilTs)));

  // All problem signals that surface in a session timeline belong in the Errors tab —
  // not just runtime/API errors, but also frustration (rage/dead/disabled clicks) and
  // environment failures (crash, storage quota). Field validation stays in the Fields tab.
  const ERROR_TYPES = new Set([
    'js_error', 'form_error', 'api_error', 'console_error',
    'rage_click', 'dead_click', 'disabled_click', 'suspected_crash', 'storage_quota',
  ]);
  const MAIN_SCREENSHOT_ERROR_TYPES = new Set(['js_error', 'form_error', 'api_error']);
  const CLICK_TYPES = new Set(['rage_click', 'dead_click', 'disabled_click']);
  const groups = {};

  sessions.forEach((s) => {
    s.events.filter((e) => ERROR_TYPES.has(e.type)).forEach((ev) => {
      // Group SIMILAR errors together: signatureForError normalizes endpoints
      // (/api/org/123 → /api/org/:id) and messages (strips ids/line numbers/hex),
      // so the same logical error collapses into one group instead of many.
      let key;
      const sig = signatureForError(ev);
      if (sig) {
        key = sig.signature;
      } else if (CLICK_TYPES.has(ev.type)) {
        key = `${ev.type}:${(ev.element || (ev.invalidFields || []).join(',') || '').toLowerCase().replace(/\d+/g, '')}`;
      } else {
        key = `${ev.type}:${(ev.message || ev.reason || ev.statusText || '').toLowerCase().replace(/\d+/g, '').slice(0, 80)}`;
      }
      if (!groups[key]) {
        groups[key] = {
          type: ev.type,
          message: ev.message || ev.reason || ev.statusText || ev.element
            || (ev.invalidFields ? `Blocked: ${ev.invalidFields.join(', ')}` : '') || '',
          status: ev.status || null,
          callType: ev.callType || null,
          url: ev.url || ev.source || null,
          source: ev.source || null,
          errorType: ev.errorType || ev.errorClass || null,
          count: 0,
          sessionIds: new Set(),
          blockedSessionIds: new Set(),
          sessionFireCounts: {},
          devices: {},
          sampleScreenshots: [],
          firstSeen: ev.timestamp,
          lastSeen: ev.timestamp,
          diagnosis: (() => { try { return diagnoseEvent(ev); } catch { return null; } })(),
          nearestFieldMap: {},
          stepNameMap: {},
          elementMap: {},
          triggeredByMap: {},
        };
      }
      const g = groups[key];
      g.count += 1;
      g.sessionIds.add(s.sessionId);

      // Blocking detection: error is blocking if form_abandon follows within 60s
      // with no field interaction in between (user couldn't continue)
      const evIdx = s.events.indexOf(ev);
      const eventsAfter = s.events.slice(evIdx + 1);
      const abandonAfter = eventsAfter.find((e) => e.type === 'form_abandon');
      const fieldAfter = eventsAfter.find((e) => e.type === 'field_focus' || e.type === 'field_change' || e.type === 'field_blur');
      const isBlockingDropoff = abandonAfter && !fieldAfter && (abandonAfter.timestamp - ev.timestamp) < 60000;
      if (isBlockingDropoff) {
        g.blockedSessionIds.add(s.sessionId);
      }
      g.sessionFireCounts[s.sessionId] = (g.sessionFireCounts[s.sessionId] || 0) + 1;
      g.devices[s.device || 'desktop'] = (g.devices[s.device || 'desktop'] || 0) + 1;
      const shouldSampleScreenshot = ev.screenshot
        && (CLICK_TYPES.has(ev.type)
          || (MAIN_SCREENSHOT_ERROR_TYPES.has(ev.type) && (ev.screenshotBefore || isBlockingDropoff)));
      if (shouldSampleScreenshot && g.sampleScreenshots.length < 3) {
        g.sampleScreenshots.push({
          before: ev.screenshotBefore || null,
          after: ev.screenshot,
          // triggeredByLabel/Kind come only from sessions recorded with the newer
          // tracker. nearestField has been recorded on error events for a long
          // time, so it's the fallback that makes this caption work retroactively
          // on older sessions too — just less precise (nearby field, not confirmed click).
          triggeredByLabel: ev.triggeredByLabel || null,
          triggeredByKind: ev.triggeredByKind || null,
          nearestField: ev.triggeredByLabel ? null : (ev.nearestField || null),
          stepName: ev.stepName || null,
        });
      }
      if (ev.timestamp < g.firstSeen) g.firstSeen = ev.timestamp;
      if (ev.timestamp > g.lastSeen) g.lastSeen = ev.timestamp;

      // For api_error: use triggeredBy if present (new sessions).
      // For old sessions without triggeredBy, infer from the event that
      // immediately preceded this error in the same session (within 3s).
      // — field_blur just before → that field triggered the API call (correct)
      // — anything else → don't guess; the button isn't recoverable from old data
      let resolvedField = ev.nearestField || null;
      let resolvedButton = ev.triggeredBy || null;
      if (ev.type === 'api_error' && !resolvedButton) {
        const evIdx = s.events.indexOf(ev);
        const preceding = s.events.slice(Math.max(0, evIdx - 8), evIdx).reverse();
        const recent = preceding.find((pe) => ev.timestamp - pe.timestamp < 3000);
        if (recent?.type === 'field_blur' && recent.field) {
          resolvedField = recent.field;
        } else if (recent && recent.type !== 'field_blur') {
          // non-blur preceded error (focus, visible, etc.) — likely a button click, don't show wrong field
          resolvedField = null;
        }
      }

      if (resolvedField) g.nearestFieldMap[resolvedField] = (g.nearestFieldMap[resolvedField] || 0) + 1;
      if (ev.stepName) g.stepNameMap[ev.stepName] = (g.stepNameMap[ev.stepName] || 0) + 1;
      if (ev.element) g.elementMap[ev.element] = (g.elementMap[ev.element] || 0) + 1;
      if (resolvedButton) g.triggeredByMap[resolvedButton] = (g.triggeredByMap[resolvedButton] || 0) + 1;
    });
  });

  const result = Object.values(groups).map((g) => {
    const ids = [...g.sessionIds];
    const topNearestField = Object.entries(g.nearestFieldMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const topStepName = Object.entries(g.stepNameMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const topElement = Object.entries(g.elementMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const topTriggeredBy = Object.entries(g.triggeredByMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const sessionFireArr = Object.values(g.sessionFireCounts);
    const maxPerSession = sessionFireArr.length ? Math.max(...sessionFireArr) : 0;
    const avgPerSession = ids.length ? Math.round(g.count / ids.length) : 0;

    let pattern = null;
    if (avgPerSession >= 5) {
      if (g.type === 'api_error' || g.type === 'form_error') {
        // State only what we observed (the repeat count) and list possible causes
        // as possibilities — we cannot tell from the data alone whether the user
        // was typing, so we must not assert "every keystroke".
        pattern = `Fired ~${avgPerSession}× per session on average (max ${maxPerSession}× in one session) — more than the single call you'd expect. `
          + 'Possible causes: the call is repeated on every input/change without a debounce, or the form re-evaluates it on each rule/re-render pass. '
          + 'Worth checking whether it can run once (debounced ~500ms, or on field blur) instead of repeatedly.';
      } else {
        pattern = `This event fires ~${avgPerSession}× per session (max ${maxPerSession}×) — higher than expected. Possible causes: a listener registered more than once, or a repeated re-evaluation loop. Worth confirming the trigger.`;
      }
    }

    // Upgrade severity when error blocked users (abandon with no further field interaction)
    const blockedCount = g.blockedSessionIds.size;
    const blockedRate = ids.length ? blockedCount / ids.length : 0;
    let effectiveSeverity = g.diagnosis?.severity || 'medium';
    if (blockedRate >= 0.8) {
      effectiveSeverity = 'critical';
    } else if (blockedRate >= 0.5 && effectiveSeverity !== 'critical') {
      effectiveSeverity = 'high';
    }
    const diagnosis = g.diagnosis
      ? { ...g.diagnosis, severity: effectiveSeverity }
      : (blockedRate >= 0.5 ? { cause: 'This error caused users to abandon without interacting further — it blocked them from continuing.', fix: 'Investigate what happens when this error appears. Add a clear recovery path or retry option.', severity: effectiveSeverity } : null);

    const { sessionIds, blockedSessionIds, nearestFieldMap, stepNameMap, elementMap, triggeredByMap, sessionFireCounts, ...rest } = g;
    return {
      ...rest,
      diagnosis,
      sessionCount: ids.length,
      sessionRate: sessions.length ? ids.length / sessions.length : 0,
      sessionIds: ids,
      avgPerSession,
      maxPerSession,
      pattern,
      topNearestField,
      topStepName,
      topElement,
      topTriggeredBy,
      blockedCount,
      blockedRate: Math.round(blockedRate * 100),
    };
  }).sort((a, b) => b.sessionCount - a.sessionCount);

  res.json({ errors: result, totalSessions: sessions.length });
});

// clear resolved fixes (called when sessions are cleared)
app.delete('/fixes/:formId', (req, res) => {
  clearResolvedFixes(decodeURIComponent(req.params.formId));
  res.json({ ok: true });
});

// clear all sessions for a form — useful after tracker fixes to flush stale data
app.delete('/sessions/:formId', (req, res) => {
  clearSessionsByFormId(decodeURIComponent(req.params.formId));
  res.json({ ok: true });
});

// ── Journey endpoints ─────────────────────────────────────────────────────────

// returns all journeys whose pages start with a given path prefix
app.get('/journeys/:domain', (req, res) => {
  const domain = decodeURIComponent(req.params.domain);
  const sinceTs = req.query.since ? Number(req.query.since) : null;
  const untilTs = req.query.until ? Number(req.query.until) : null;
  let journeys = getJourneysByDomain(domain);
  if (sinceTs) journeys = journeys.filter((j) => j.startTime >= sinceTs);
  if (untilTs) journeys = journeys.filter((j) => j.startTime <= untilTs);
  res.json(journeys);
});

// returns aggregate stats (funnel, completion rate, drop-off by page)
app.get('/journey-stats/:domain', (req, res) => {
  const domain = decodeURIComponent(req.params.domain);
  res.json(getJourneyStats(domain));
});

// HTTPS if cert files exist (server/cert/{cert,key}.pem). Delete that folder to fall back to HTTP.
const certDir = path.join(__dirname, 'cert');
const certPath = path.join(certDir, 'cert.pem');
const keyPath = path.join(certDir, 'key.pem');
const useHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);

if (useHttps) {
  https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
    .listen(config.port, () => {
      console.log(`Form Intelligence Server (HTTPS) running at https://localhost:${config.port}`);
      console.log(`Analytics dashboard: https://localhost:${config.port}/analytics`);
    });
} else {
  app.listen(config.port, () => {
    console.log(`Form Intelligence Server running at http://localhost:${config.port}`);
    console.log(`Analytics dashboard: http://localhost:${config.port}/analytics`);
  });
}

// ── Weekly digest scheduler ───────────────────────────────────────────────────
// Fires every Monday at the configured hour (DIGEST_HOUR env var, default 9 AM).
// Summarises the past 7 days of sessions for every form that had activity.
function scheduleWeeklyDigest() {
  if (!config.slack.webhookUrl) return;

  function msUntilNextMonday() {
    const now = new Date();
    const next = new Date();
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7; // days until next Monday
    next.setDate(now.getDate() + daysUntilMonday);
    next.setHours(config.slack.digestHour, 0, 0, 0);
    return next - now;
  }

  function runDigest() {
    const sinceTs = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const allSessions = getAllSessions();
    const byForm = new Map();
    allSessions.forEach((s) => {
      if (!s.startTime || s.startTime < sinceTs) return;
      if (!byForm.has(s.formId)) byForm.set(s.formId, []);
      byForm.get(s.formId).push(s);
    });

    if (byForm.size) {
      const formSummaries = [...byForm.entries()]
        .map(([formId, sessions]) => ({ formId, summary: analyzeSessions(sessions).summary }))
        .filter(({ summary }) => summary.totalSessions > 0)
        .sort((a, b) => b.summary.totalSessions - a.summary.totalSessions);

      sendWeeklyDigest(formSummaries).catch(() => {});
    }

    setTimeout(runDigest, 7 * 24 * 60 * 60 * 1000);
  }

  setTimeout(() => runDigest(), msUntilNextMonday());
  console.log(`[digest] Weekly digest scheduled for Mondays at ${config.slack.digestHour}:00`);
}

scheduleWeeklyDigest();
