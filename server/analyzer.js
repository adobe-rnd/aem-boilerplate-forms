import { config } from './config.js';

// Error/friction signals that mean a session was NOT a passive view — the user hit a
// real problem (broken API, script error, rage/dead/disabled clicks, validation).
const FRICTION_EVENT_TYPES = new Set([
  'form_error', 'api_error', 'js_error', 'console_error',
  'rage_click', 'dead_click', 'disabled_click', 'field_error', 'validation_thrash',
]);

export function isFinalSubmissionFailureEvent(event = {}) {
  const text = [
    event.statusText,
    event.message,
    event.reason,
    event.responseBody,
  ].filter(Boolean).join(' ').toLowerCase();

  return /personal loan request could not be submitted|request could not be submitted|could not be submitted|application number\s*not generated|not generated|there seems to be an error in the application|contact nearest branch|try later/.test(text);
}

export function sessionHasFinalSubmissionFailure(session = {}) {
  return (session.events || []).some((event) => event.type === 'form_error' && isFinalSubmissionFailureEvent(event));
}

export function didSessionComplete(session = {}) {
  return (session.events || []).some((event) => event.type === 'form_submit' && !event.failed)
    && !sessionHasFinalSubmissionFailure(session);
}

export function buildSessionSummaries(sessions) {
  return sessions.map((s) => {
    const submitEvent = s.events.find((e) => e.type === 'form_submit');
    const hasSubmit = !!submitEvent;
    const submitFailed = s.events.some((e) => e.type === 'form_submit' && e.failed === true)
      || sessionHasFinalSubmissionFailure(s);
    const completed = didSessionComplete(s);
    const hasFieldFocus = s.events.some((e) => e.type === 'field_focus');
    const hasFriction = s.events.some((e) => FRICTION_EVENT_TYPES.has(e.type));
    const abandonEvent = s.events.find((e) => e.type === 'form_abandon');
    const errorCount = s.events.filter((e) => e.type === 'field_error').length;
    const thrashFields = [...new Set(s.events.filter((e) => e.type === 'validation_thrash').map((e) => e.field))];
    const lastEvent = s.events[s.events.length - 1];

    let category;
    if (hasSubmit && submitFailed) {
      category = 'submit_error';
    } else if (completed) {
      category = 'successful';
    } else if (abandonEvent) {
      // Only "viewed only" / "bounced" if the user never interacted AND hit no error.
      // An error (even with no field focus) means they were blocked, not just browsing.
      if (!hasFieldFocus && !hasFriction) {
        const pageTimeMs = abandonEvent.pageTimeMs ?? 0;
        const scrollDepth = abandonEvent.maxScrollDepth ?? 100;
        category = pageTimeMs < 15000 && scrollDepth < 25 ? 'bounced' : 'scan-only';
      } else {
        category = 'abandoned';
      }
    } else {
      // pagehide fires the abandon beacon, but if the tab stays open or the beacon fails,
      // no abandon event arrives. Treat any session idle for 30+ min as abandoned.
      const STALE_MS = 30 * 60 * 1000;
      const lastActiveTs = lastEvent?.timestamp ?? s.startTime ?? 0;
      category = (Date.now() - lastActiveTs) > STALE_MS ? 'abandoned' : 'in-progress';
    }
    const durationMs = abandonEvent?.pageTimeMs
      ?? (lastEvent ? lastEvent.timestamp - s.startTime : 0);

    return {
      sessionId: s.sessionId,
      journeyId: s.journeyId ?? null,
      category,
      durationMs,
      lastField: abandonEvent?.lastField ?? null,
      stepName: abandonEvent?.stepName ?? null,
      timestamp: s.startTime,
      errorCount,
      thrashFields,
      device: s.device ?? 'desktop',
    };
  });
}


export function buildFunnel(sessions) {
  if (!sessions.length) return [];

  const formStartEvents = sessions
    .map((s) => s.events.find((e) => e.type === 'form_start'))
    .filter(Boolean);
  // use the most recent session's stepsInfo — avoids stale data from old sessions
  // that were recorded before tracker fixes (e.g. outer wizard panel included)
  const stepsInfo = [...formStartEvents].reverse().find((e) => e.stepsInfo?.length)?.stepsInfo || [];

  const submitted = sessions.filter(didSessionComplete).length;

  if (stepsInfo.length > 1) {
    const MAX_FUNNEL = 6;
    // Use array position i (not step.index) — HDFC sub-panels all have index:0
    // which causes every abandon to satisfy step.index>=0 for every such panel.
    const rawSteps = stepsInfo.map((step, i) => {
      const count = sessions.filter((s) => {
        if (didSessionComplete(s)) return true;
        const abandon = s.events.find((e) => e.type === 'form_abandon');
        if (abandon) return (abandon.step ?? -1) >= i;
        // Sessions that closed without firing form_abandon: use the highest step reached
        // via step_change events as a proxy for how far the user got.
        const maxStep = Math.max(-1, ...(s.events || [])
          .filter((e) => e.type === 'step_change')
          .map((e) => e.step ?? e.toStep ?? e.stepIndex ?? -1));
        if (maxStep >= 0) return maxStep >= i;
        return i === 0 && s.events.some((e) => e.type === 'form_start');
      }).length;
      return { label: step.name || `Step ${i + 1}`, count };
    });

    // Cap each step at the previous step's count — a later step can never have
    // more users than an earlier step in a linear funnel.
    let prevCount = Infinity;
    const allSteps = rawSteps.map((step) => {
      const count = Math.min(step.count, prevCount);
      prevCount = count;
      return { ...step, count };
    });

    // Trim to MAX_FUNNEL-1 meaningful steps (leave 1 slot for Submitted).
    // Always keep first and last; fill middle with biggest drop-offs.
    let picked;
    if (allSteps.length <= MAX_FUNNEL - 1) {
      picked = allSteps;
    } else {
      const first = allSteps[0];
      const last = allSteps[allSteps.length - 1];
      const middle = allSteps.slice(1, -1).map((s, idx) => ({
        ...s,
        origIdx: idx + 1,
        dropOff: Math.max(0, (allSteps[idx].count || 0) - s.count),
      }));
      const topMiddle = middle
        .sort((a, b) => b.dropOff - a.dropOff)
        .slice(0, MAX_FUNNEL - 3)
        .sort((a, b) => a.origIdx - b.origIdx);
      picked = [first, ...topMiddle, last];
    }

    picked.push({ label: 'Submitted', count: submitted });
    return picked;
  }

  // flat form — funnel by field interaction order
  const fieldOrder = [];
  const seen = new Set();
  sessions.forEach((s) => {
    (s.events.find((e) => e.type === 'form_fields')?.fields || []).forEach((f) => {
      if (!seen.has(f)) { seen.add(f); fieldOrder.push(f); }
    });
  });

  if (!fieldOrder.length) return [{ label: 'Started', count: sessions.length }, { label: 'Submitted', count: submitted }];

  const fieldIndexMap = new Map(fieldOrder.map((f, i) => [f, i]));

  // Two separate counts per field:
  // interactionCount — sessions where the user touched this field (used to decide
  //                    which fields to include in the funnel)
  // completionCount  — sessions where the user went PAST this field (bar height)
  //
  // Why separate? If you drop off at field X, you did touch X (interaction=1) but
  // you didn't go past it (completion=0). The bar for X is lower than X-1, so the
  // chart correctly shows the drop AT X, not at X+1.
  const interactionCounts = new Array(fieldOrder.length).fill(0);
  const completionCounts = new Array(fieldOrder.length).fill(0);

  sessions.forEach((s) => {
    const didSubmit = didSessionComplete(s);
    const abandon = s.events.find((e) => e.type === 'form_abandon');

    let maxIdx = -1;

    if (didSubmit) {
      maxIdx = fieldOrder.length - 1;
    } else if (abandon?.lastField) {
      // Use lastField as the definitive drop-off point.
      // Do NOT recompute from raw field events — users often fill forms out of
      // order (e.g. jump to address section then come back to NIN). Taking the
      // max interaction index would wrongly place the drop-off at the last field
      // they touched in DOM order, not where they actually gave up.
      const idx = fieldIndexMap.get(abandon.lastField);
      if (idx !== undefined) maxIdx = idx;
    } else {
      // No explicit lastField (very old session / no abandon event) — fall back
      s.events.forEach((e) => {
        if (e.type === 'field_focus' || e.type === 'field_blur') {
          const idx = fieldIndexMap.get(e.field);
          if (idx !== undefined && idx > maxIdx) maxIdx = idx;
        }
      });
    }

    if (maxIdx < 0) return; // bounce — never touched a field

    for (let i = 0; i <= maxIdx; i += 1) interactionCounts[i] += 1;

    const clearedUpTo = didSubmit ? fieldOrder.length : maxIdx;
    for (let i = 0; i < clearedUpTo; i += 1) completionCounts[i] += 1;
  });

  const MAX_FUNNEL = 6;
  const interacted = fieldOrder
    .map((f, i) => ({ f, i }))
    .filter(({ i }) => interactionCounts[i] > 0);

  let funnelFields;
  if (interacted.length <= MAX_FUNNEL) {
    funnelFields = interacted;
  } else {
    // For long forms: always keep first + last interacted field,
    // fill the middle slots with the fields that have the biggest drop-offs.
    const first = interacted[0];
    const last = interacted[interacted.length - 1];
    const middle = interacted.slice(1, -1).map(({ f, i }) => ({
      f,
      i,
      dropOff: (completionCounts[i - 1] ?? sessions.length) - completionCounts[i],
    }));
    const topMiddle = middle
      .sort((a, b) => b.dropOff - a.dropOff)
      .slice(0, MAX_FUNNEL - 2)
      .sort((a, b) => a.i - b.i); // restore DOM order
    funnelFields = [first, ...topMiddle, last];
  }

  return [
    { label: 'Started', count: sessions.length },
    ...funnelFields.map(({ f, i }) => ({ label: f, count: interactionCounts[i] })),
    { label: 'Submitted', count: submitted },
  ];
}

function getDiagnosis(stats) {
  const isFileField = stats.meta?.fieldType === 'file' || stats.meta?.fieldType === 'file-input';
  const signals = [
    { label: 'Validation loop', score: stats.thrashRate > 0.1 ? 40 : 0, text: `Validation loop in ${(stats.thrashRate * 100).toFixed(0)}% of sessions` },
    { label: 'Confusing label', score: stats.labelCopyRate > 0.2 ? 35 : 0, text: `Label copied in ${(stats.labelCopyRate * 100).toFixed(0)}% of sessions` },
    { label: 'Unclear validation', score: stats.avgErrorCount > 1.5 ? 30 : stats.avgErrorCount > 0.5 ? 15 : 0, text: `${stats.avgErrorCount.toFixed(1)} avg errors per visit` },
    { label: 'Hesitation before typing', score: stats.avgHesitationMs > 5000 ? 28 : stats.avgHesitationMs > 2000 ? 15 : 0, text: `${(stats.avgHesitationMs / 1000).toFixed(1)}s avg hesitation before first keystroke` },
    { label: 'High rework rate', score: stats.avgCorrectionCount > 5 ? 25 : stats.avgCorrectionCount > 2 ? 12 : 0, text: `${stats.avgCorrectionCount.toFixed(1)} avg backspaces per visit — users are correcting mistakes` },
    { label: 'Field frequently ignored', score: stats.blurWithoutChangeRate > 0.4 ? 20 : stats.blurWithoutChangeRate > 0.2 ? 10 : 0, text: `${(stats.blurWithoutChangeRate * 100).toFixed(0)}% of visits left field unchanged — may be confusing or irrelevant` },
    { label: 'Hesitation detected', score: stats.avgIdleTimeMs > 8000 ? 25 : 0, text: `${(stats.avgIdleTimeMs / 1000).toFixed(0)}s avg idle before typing` },
    { label: 'Too complex', score: stats.avgTimeSpentMs > 20000 ? 20 : 0, text: `${(stats.avgTimeSpentMs / 1000).toFixed(0)}s avg — unusually long` },
    // file uploads use a click-to-open-picker interaction — returning to the upload
    // area is normal behaviour (re-pick, wrong file, etc), not confusion anxiety
    { label: 'Revisit anxiety', score: !isFileField && stats.avgVisitCount > 1.5 ? 20 : 0, text: `Revisited ${stats.avgVisitCount.toFixed(1)}× on average` },
    { label: 'Copy-paste dependency', score: stats.copyPasteRate > 0.3 ? 15 : 0, text: `Copy-pasted in ${(stats.copyPasteRate * 100).toFixed(0)}% of visits` },
    { label: 'Scroll barrier', score: stats.visibilityRate < 0.5 ? 15 : 0, text: `Seen by only ${(stats.visibilityRate * 100).toFixed(0)}% of users` },
    { label: 'Trust issue', score: stats.dropOffRate > 0.2 && stats.avgTimeSpentMs < 5000 ? 15 : 0, text: `${(stats.dropOffRate * 100).toFixed(0)}% drop-off, fast exit` },
    { label: 'Frequently skipped', score: stats.skipRate > 0.3 ? 10 : 0, text: `Skipped by ${(stats.skipRate * 100).toFixed(0)}% of users` },
  ].filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  const totalScore = signals.reduce((sum, s) => sum + s.score, 0);
  return {
    label: totalScore === 0 ? 'No strong signal' : signals[0].label,
    confidence: Math.min(Math.round(totalScore), 95),
    evidence: signals.slice(0, 3).map((s) => s.text),
  };
}

// Friction Score (0–100): how much trouble users have with a field, blended from
// the behavioural signals we already track. Higher = more friction. The weights
// below sum to 100 and each term is normalised to 0–1, so the result is 0–100.
function computeFrictionScore(stats) {
  const cap = (v, max) => Math.min(1, Math.max(0, (v || 0) / max));
  const score = cap(stats.dropOffRate, 0.5) * 35 // abandonment at the field — strongest signal
    + cap(stats.avgErrorCount, 2) * 20 // validation errors per visit
    + cap(stats.thrashRate, 0.3) * 15 // repeated same error across sessions
    + cap(Math.max(0, stats.avgVisitCount - 1), 2) * 10 // revisits beyond the first
    + cap(stats.avgIdleTimeMs, 15000) * 10 // hesitation before typing
    + cap(stats.avgTimeSpentMs, 30000) * 10; // unusually long dwell
  return Math.round(score);
}

function frictionLevel(score) {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

export function filterGhostSessions(sessions) {
  return sessions.filter((session) => {
    const evTypes = new Set(session.events.map((e) => e.type));
    // Field interaction or visibility = definitely real
    if (evTypes.has('field_focus') || evTypes.has('field_blur') || evTypes.has('field_visible')) return true;
    // Forms that fire errors on load (e.g. API validation on page init) are real sessions
    // even if the user never touched a field before leaving.
    if (evTypes.has('form_error') || evTypes.has('api_error') || evTypes.has('js_error')) return true;
    // Step changes indicate the user navigated the wizard — real session.
    if (evTypes.has('step_change')) return true;
    // Pure ghost: only form_start / form_fields / form_scan_end fired (live-reload or bot).
    return false;
  });
}

// Compare the path completers took vs the path abandoners took, step by step,
// then surface where the flow breaks and which errors correlate with leaving.
// This is "flow / fallout" analysis: the value is in the DIFFERENCE between the
// two cohorts, not the aggregate.
// Wilson score interval for a proportion x/n at 95% confidence. Unlike the
// normal approximation, it stays valid at small samples and never gives
// impossible bounds (<0 or >1) — which is exactly our situation (few sessions).
function wilson(x, n) {
  if (n === 0) return { lo: 0, hi: 0, p: 0 };
  const z = 1.96;
  const p = x / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { lo: Math.max(0, center - margin), hi: Math.min(1, center + margin), p };
}

// Overall confidence in the comparison, driven by how many sessions are in the
// SMALLER of the two cohorts (the bottleneck for any comparison).
function confidenceLevel(completedCount, abandonedCount) {
  const smaller = Math.min(completedCount, abandonedCount);
  if (smaller >= 20) return { level: 'high', note: 'Enough sessions in both groups to trust these patterns.' };
  if (smaller >= 8) return { level: 'medium', note: 'A reasonable sample — patterns are indicative but not conclusive.' };
  return {
    level: 'low',
    note: `Only ${completedCount} completed and ${abandonedCount} abandoned so far — treat these as early signals, not proof. Aim for ~20+ in each group to confirm.`,
  };
}

// Contrast two cohorts (finishers vs quitters) across many dimensions to answer
// "what was DIFFERENT about the people who quit" — errors the happy flow never
// hit, friction signals, device split, and behaviour — even on the same path.
function buildCohortContrast(completed, abandoned) {
  const has = (s, type) => s.events.some((e) => e.type === type);
  const rate = (cohort, fn) => (cohort.length ? cohort.filter(fn).length / cohort.length : 0);
  const avg = (cohort, fn) => (cohort.length ? cohort.reduce((sum, s) => sum + fn(s), 0) / cohort.length : 0);
  const duration = (s) => {
    const ab = s.events.find((e) => e.type === 'form_abandon');
    if (ab?.pageTimeMs) return ab.pageTimeMs;
    const last = s.events[s.events.length - 1];
    return last ? last.timestamp - (s.startTime || 0) : 0;
  };
  const fieldsTouched = (s) => new Set(s.events.filter((e) => e.type === 'field_focus').map((e) => e.field)).size;
  const errorCount = (s) => s.events.filter((e) => ['field_error', 'api_error', 'form_error'].includes(e.type)).length;

  // boolean signals: % of each cohort that hit them. The "diff" is the contrast.
  const signals = [
    { label: 'Hit a network / API error', cat: 'Errors', test: (s) => has(s, 'api_error') },
    { label: 'Hit a submit error', cat: 'Errors', test: (s) => has(s, 'form_error') },
    { label: 'Hit a JavaScript error', cat: 'Errors', test: (s) => has(s, 'js_error') },
    { label: 'Got stuck in a validation loop', cat: 'Friction', test: (s) => has(s, 'validation_thrash') },
    { label: 'Rage-clicked (frustration)', cat: 'Friction', test: (s) => has(s, 'rage_click') },
    { label: 'Clicked something unresponsive', cat: 'Friction', test: (s) => has(s, 'dead_click') },
    { label: 'Clicked a disabled button', cat: 'Friction', test: (s) => has(s, 'disabled_click') },
    { label: 'Copied a field label (confusion)', cat: 'Friction', test: (s) => has(s, 'label_copied') },
    { label: 'Bounced between steps repeatedly', cat: 'Friction', test: (s) => has(s, 'step_thrash') },
    { label: 'Had slow page load (LCP poor)', cat: 'Performance', test: (s) => s.events.some((e) => e.type === 'perf_vitals' && e.metric === 'LCP' && e.rating === 'poor') },
    { label: 'Hit a UI freeze (long task >500ms)', cat: 'Performance', test: (s) => has(s, 'perf_long_task') },
    { label: 'Hit storage quota limit', cat: 'Technical', test: (s) => has(s, 'storage_quota') },
    { label: 'Session previously crashed', cat: 'Technical', test: (s) => has(s, 'suspected_crash') },
  ];
  const factors = signals
    .map((sig) => ({
      label: sig.label,
      cat: sig.cat,
      abandonedRate: rate(abandoned, sig.test),
      completedRate: rate(completed, sig.test),
      diff: rate(abandoned, sig.test) - rate(completed, sig.test),
    }))
    .filter((d) => d.abandonedRate > 0 || d.completedRate > 0)
    .sort((a, b) => b.diff - a.diff);

  // device split — completion rate per device (catches "mobile users quit more")
  const allDevices = [...new Set([...completed, ...abandoned].map((s) => s.device || 'desktop'))];
  const devices = allDevices.map((dev) => {
    const inDev = (s) => (s.device || 'desktop') === dev;
    const comp = completed.filter(inDev).length;
    const aban = abandoned.filter(inDev).length;
    return {
      device: dev, completed: comp, abandoned: aban, total: comp + aban, completionRate: (comp + aban) ? comp / (comp + aban) : 0,
    };
  }).sort((a, b) => b.total - a.total);

  // behaviour averages — how the two groups behaved differently overall
  const behaviour = [
    { label: 'Fields filled', completed: avg(completed, fieldsTouched), abandoned: avg(abandoned, fieldsTouched), unit: '' },
    { label: 'Errors hit', completed: avg(completed, errorCount), abandoned: avg(abandoned, errorCount), unit: '' },
    { label: 'Time on form', completed: avg(completed, duration) / 1000, abandoned: avg(abandoned, duration) / 1000, unit: 's' },
  ];

  // ── EXACT field-level divergence ──
  // For every field, contrast: did each group reach/touch it, and did each group
  // error on it. Surfaces the precise field where the two paths split.
  const fieldNames = new Set();
  [...completed, ...abandoned].forEach((s) => s.events.forEach((e) => {
    if ((e.type === 'field_focus' || e.type === 'field_error') && e.field) fieldNames.add(e.field);
    // API/submit errors fire near a field (e.g. clicking Verify on "organisation")
    if ((e.type === 'api_error' || e.type === 'form_error') && e.nearestField) fieldNames.add(e.nearestField);
  }));
  const fields = [...fieldNames].map((field) => {
    const touched = (s) => s.events.some((e) => e.type === 'field_focus' && e.field === field);
    // an error "on" this field = inline validation OR an action (button) call that fired near it
    const inlineErr = (s) => s.events.some((e) => e.type === 'field_error' && e.field === field);
    const actionErr = (s) => s.events.some((e) => (e.type === 'api_error' || e.type === 'form_error') && e.nearestField === field);
    const errored = (s) => inlineErr(s) || actionErr(s);
    const completerTouch = rate(completed, touched);
    const abandonerTouch = rate(abandoned, touched);
    const completerErr = rate(completed, errored);
    const abandonerErr = rate(abandoned, errored);
    const errDiff = abandonerErr - completerErr; // abandoners errored more here
    const reachDiff = completerTouch - abandonerTouch; // finishers reached it, abandoners didn't
    // was the error triggered by an action (button/API) rather than plain typing?
    const viaAction = abandoned.concat(completed).some(actionErr);
    const kind = errDiff >= reachDiff ? 'error' : 'dropped';
    return {
      field, completerTouch, abandonerTouch, completerErr, abandonerErr, errDiff, reachDiff, kind, viaAction, score: Math.max(errDiff, reachDiff),
    };
  }).filter((f) => f.score > 0.1).sort((a, b) => b.score - a.score).slice(0, 6);

  // ── EXACT element-level divergence (buttons) ──
  // Which specific button did each group rage/dead/disabled-click?
  const elementRate = (cohort) => {
    const m = new Map();
    cohort.forEach((s) => {
      const seen = new Set();
      s.events.filter((e) => ['disabled_click', 'rage_click', 'dead_click'].includes(e.type) && e.element).forEach((e) => {
        const key = `${e.element}||${e.type}`;
        if (!seen.has(key)) { seen.add(key); m.set(key, (m.get(key) || 0) + 1); }
      });
    });
    return m;
  };
  const aEl = elementRate(abandoned);
  const cEl = elementRate(completed);
  const clickLabels = { disabled_click: 'disabled', rage_click: 'rage-clicked', dead_click: 'unresponsive' };
  const elements = [...aEl.entries()].map(([key, aCount]) => {
    const [element, type] = key.split('||');
    const cCount = cEl.get(key) || 0;
    return {
      element,
      type: clickLabels[type] || type,
      abandonerRate: aCount / abandoned.length,
      completerRate: cCount / completed.length,
      diff: aCount / abandoned.length - cCount / completed.length,
    };
  }).filter((e) => e.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 5);

  return {
    factors, devices, behaviour, fields, elements,
  };
}

export function buildFlowComparison(sessions) {
  const real = filterGhostSessions(sessions);
  const completed = real.filter(didSessionComplete);
  const abandoned = real.filter((s) => !didSessionComplete(s)
    && s.events.some((e) => e.type === 'field_focus'));

  if (completed.length === 0 || abandoned.length === 0) {
    return {
      ready: false,
      completedCount: completed.length,
      abandonedCount: abandoned.length,
      message: completed.length === 0
        ? 'No completed sessions yet — need at least one successful submission to compare the happy path against.'
        : 'No abandoned sessions yet — nothing to compare against the happy path.',
    };
  }

  // Build the canonical ordered step list from step_change events (by stepName).
  // Using stepName (not stepsInfo index) avoids the sub-panel index:0 quirk.
  const stepFirstSeen = new Map();
  real.forEach((s) => {
    s.events.filter((e) => e.type === 'step_change' && e.stepName).forEach((e) => {
      const n = typeof e.step === 'number' ? e.step : 999;
      if (!stepFirstSeen.has(e.stepName) || stepFirstSeen.get(e.stepName) > n) {
        stepFirstSeen.set(e.stepName, n);
      }
    });
  });
  const steps = ['Start', ...[...stepFirstSeen.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name)];
  const numSteps = steps.length;
  const stepIndex = new Map(steps.map((name, i) => [name, i]));

  // For one session: furthest step reached + errors attributed to the step the
  // user was on when each error fired (events are time-ordered).
  const walk = (session, isCompleted) => {
    let curIdx = 0;
    let furthest = 0;
    const errorsByStep = new Array(numSteps).fill(0);
    const errorEventsByStep = new Array(numSteps).fill(null).map(() => []);
    session.events.forEach((e) => {
      if (e.type === 'step_change' && e.stepName && stepIndex.has(e.stepName)) {
        curIdx = stepIndex.get(e.stepName);
        if (curIdx > furthest) furthest = curIdx;
      }
      if (['field_error', 'form_error', 'api_error'].includes(e.type)) {
        const idx = Math.min(curIdx, numSteps - 1);
        errorsByStep[idx] += 1;
        errorEventsByStep[idx].push(e);
      }
    });
    if (isCompleted) furthest = numSteps - 1;
    return { furthest, errorsByStep, errorEventsByStep };
  };

  const cWalks = completed.map((s) => walk(s, true));
  const aWalks = abandoned.map((s) => walk(s, false));

  const stepStats = steps.map((name, i) => {
    const cReached = cWalks.filter((w) => w.furthest >= i).length;
    const aReached = aWalks.filter((w) => w.furthest >= i).length;
    const stuckHere = aWalks.filter((w) => w.furthest === i).length;
    return {
      name,
      completedReachPct: cReached / completed.length,
      abandonedReachPct: aReached / abandoned.length,
      completedErrAvg: cWalks.reduce((sum, w) => sum + w.errorsByStep[i], 0) / completed.length,
      abandonedErrAvg: aWalks.reduce((sum, w) => sum + w.errorsByStep[i], 0) / abandoned.length,
      stuckHere,
      stuckHerePct: stuckHere / abandoned.length,
    };
  });

  // Divergence = the step where the most abandoners got stuck (their furthest step).
  const divergence = [...stepStats].sort((a, b) => b.stuckHere - a.stuckHere)[0];

  // Smoking-gun error: the error signature most over-represented in abandoned vs
  // completed sessions (the "lift").
  // Describe an error in human terms. API/submit errors are usually triggered by
  // a button/action (e.g. clicking Verify after filling a field), so attribute
  // them to the field they fired near + the endpoint, not just "a field".
  const sig = (e) => {
    const endpoint = e.url ? e.url.split('?')[0].split('/').filter(Boolean).pop() : null;
    const status = e.status ? `HTTP ${e.status}` : (e.statusText || 'failed');
    if (e.type === 'api_error') {
      // Prefer the button label (triggeredBy) — it's more accurate than nearestField,
      // which may be a field the user happened to focus before clicking the button.
      if (e.triggeredBy) return `"${e.triggeredBy}" failed${endpoint ? ` — ${endpoint} returned ${status}` : ` (${status})`}`;
      if (e.nearestField) return `The Verify action on "${e.nearestField}" failed${endpoint ? ` — ${endpoint} returned ${status}` : ` (${status})`}`;
      return `${endpoint ? `${endpoint} call` : 'A server call'} returned ${status}`;
    }
    if (e.type === 'form_error') return `Submitting the form failed${endpoint ? ` — ${endpoint} returned ${status}` : ` (${status})`}`;
    return `Validation error on "${e.field || 'a field'}"`;
  };
  const errRate = (cohort) => {
    const map = new Map();
    cohort.forEach((s) => {
      const seen = new Set();
      s.events.filter((e) => ['field_error', 'form_error', 'api_error'].includes(e.type)).forEach((e) => {
        const key = sig(e);
        if (!seen.has(key)) { seen.add(key); map.set(key, (map.get(key) || 0) + 1); }
      });
    });
    return map;
  };
  const cErr = errRate(completed);
  const aErr = errRate(abandoned);
  const errorComparison = [...aErr.entries()].map(([error, aCount]) => {
    const cCount = cErr.get(error) || 0;
    return {
      error,
      abandonedRate: aCount / abandoned.length,
      completedRate: cCount / completed.length,
      lift: (aCount / abandoned.length) - (cCount / completed.length),
    };
  }).sort((a, b) => b.lift - a.lift);
  const topError = errorComparison[0] || null;

  // Group quitters by the step they actually got stuck on, and find EACH group's
  // own top reason. Different people leave at different steps for different reasons —
  // this captures that instead of collapsing everyone into one break point.
  const dropoffs = steps.map((name, i) => {
    const groupIdx = aWalks.map((w, j) => (w.furthest === i ? j : -1)).filter((j) => j >= 0);
    if (!groupIdx.length) return null;
    const reasonMap = new Map();
    groupIdx.forEach((j) => {
      const seen = new Set();
      // Use step-indexed errors so Declaration can't be blamed for a Session Preferences error
      aWalks[j].errorEventsByStep[i].forEach((e) => {
        const key = sig(e);
        if (!seen.has(key)) { seen.add(key); reasonMap.set(key, (reasonMap.get(key) || 0) + 1); }
      });
    });
    const topReason = [...reasonMap.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    // Confidence interval on this group's share of quitters, so a "56%" built on
    // 5 of 9 people is shown as the wide range it really is.
    const ci = wilson(groupIdx.length, abandoned.length);
    return {
      step: name,
      count: groupIdx.length,
      pct: groupIdx.length / abandoned.length,
      ciLo: ci.lo,
      ciHi: ci.hi,
      confident: groupIdx.length >= 5, // a single drop group needs ~5+ to be more than anecdote
      reason: topReason ? topReason[0] : null,
      reasonCount: topReason ? topReason[1] : 0,
    };
  }).filter(Boolean).sort((a, b) => b.count - a.count);

  const confidence = confidenceLevel(completed.length, abandoned.length);
  const contrast = buildCohortContrast(completed, abandoned);

  const pct = (r) => `${Math.round(r * 100)}%`;
  // soften the verb when we don't have the numbers to be sure
  const hedge = confidence.level === 'low' ? 'appears to be' : 'is';
  const insights = [];
  const meaningfulDrops = dropoffs.filter((d) => d.step !== 'Start');
  if (meaningfulDrops.length > 1) {
    insights.push(`People quit at ${meaningfulDrops.length} different points — the biggest ${hedge} "${meaningfulDrops[0].step}" (${pct(meaningfulDrops[0].pct)} of quitters). Each drop-off has its own cause below.`);
  } else if (dropoffs[0] && dropoffs[0].step !== 'Start') {
    insights.push(`${pct(dropoffs[0].pct)} of people who gave up did so at "${dropoffs[0].step}".`);
  }
  if (topError && topError.lift > 0.1) {
    insights.push(`"${topError.error}" hit ${pct(topError.abandonedRate)} of quitters but only ${pct(topError.completedRate)} of finishers — the strongest single signal of why people leave.`);
  }
  if (confidence.level === 'low') {
    insights.push(`⚠ ${confidence.note}`);
  }
  if (!insights.length) {
    insights.push('Finishers and quitters followed similar paths with similar errors — no single break point stands out yet. More sessions will sharpen this.');
  }

  // Summarise one session into an ordered list of the meaningful things the user
  // did — used to show the exact path a user followed across refresh attempts.
  const summarizeSteps = (session) => {
    const didComplete = didSessionComplete(session);
    const out = [];
    const seenSteps = new Set();
    session.events.forEach((e) => {
      if (e.type === 'step_change' && e.stepName && !seenSteps.has(e.stepName)) {
        seenSteps.add(e.stepName);
        out.push({ kind: 'step', text: `Reached "${e.stepName}"` });
      } else if (e.type === 'field_error' && e.field) {
        out.push({ kind: 'error', text: `Validation error on "${e.field}"${e.validationMessage ? ` — "${e.validationMessage}"` : ''}` });
      } else if (e.type === 'api_error' || e.type === 'form_error') {
        out.push({ kind: 'error', text: sig(e) });
      } else if (e.type === 'disabled_click') {
        out.push({ kind: 'friction', text: `Clicked a disabled button${e.element ? ` (${e.element})` : ''}` });
      } else if (e.type === 'rage_click') {
        out.push({ kind: 'friction', text: 'Rage-clicked (frustration)' });
      } else if (e.type === 'form_abandon' && !didComplete) {
        // Only a genuine give-up — suppress false abandons (tab-blur) on sessions
        // that ultimately submitted.
        out.push({ kind: 'end', text: 'Gave up and left' });
      } else if (e.type === 'form_submit' && !e.failed && didComplete) {
        out.push({ kind: 'success', text: 'Submitted successfully' });
      }
    });
    return out;
  };

  // Detect avoidance completions: journeys where the user had errors in an
  // earlier session (same journeyId), refreshed, and only succeeded by not
  // triggering the same action again. Capture the exact step trace per attempt.
  const ERROR_TYPES = new Set(['field_error', 'form_error', 'api_error', 'js_error']);
  const sessionsByJourney = new Map();
  real.forEach((s) => {
    if (!s.journeyId) return;
    if (!sessionsByJourney.has(s.journeyId)) sessionsByJourney.set(s.journeyId, []);
    sessionsByJourney.get(s.journeyId).push(s);
  });

  const avoidanceJourneys = [];
  const avoidanceErrors = new Map();
  completed.forEach((s) => {
    if (!s.journeyId) return;
    const siblings = (sessionsByJourney.get(s.journeyId) || [])
      .filter((r) => r.sessionId !== s.sessionId && r.startTime < (s.startTime || 0));
    const priorErrors = siblings.flatMap((r) => r.events.filter((e) => ERROR_TYPES.has(e.type)));
    if (priorErrors.length === 0) return;

    priorErrors.forEach((e) => {
      const key = e.type === 'field_error' ? `Validation error on "${e.field || 'a field'}"` : sig(e);
      avoidanceErrors.set(key, (avoidanceErrors.get(key) || 0) + 1);
    });

    // Build the ordered attempt trace: each prior session + the final success.
    const ordered = [...siblings, s].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    const attempts = ordered.map((sess, idx) => ({
      attempt: idx + 1,
      outcome: didSessionComplete(sess) ? 'completed' : 'abandoned',
      steps: summarizeSteps(sess),
    }));
    avoidanceJourneys.push({ journeyId: s.journeyId, attempts });
  });

  const avoidance = avoidanceJourneys.length > 0 ? {
    count: avoidanceJourneys.length,
    topErrors: [...avoidanceErrors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([error, count]) => ({ error, count })),
    journeys: avoidanceJourneys.slice(0, 5),
  } : null;

  // ── What happened & what to do — turn the contrast into plain recommendations ──
  const recommendations = [];
  if (topError && topError.lift > 0.1) {
    recommendations.push({
      problem: `${pct(topError.abandonedRate)} of people who quit hit "${topError.error}", versus only ${pct(topError.completedRate)} of finishers.`,
      action: /HTTP|returned|call|server/i.test(topError.error)
        ? 'This is a backend/API failure. Check the endpoint health and add a clear retry message instead of letting the call silently fail.'
        : 'Review this field\'s validation rule — it\'s likely firing too aggressively or the message is unclear. Consider moving the check to blur instead of every keystroke.',
    });
  }
  if (divergence && divergence.name !== 'Start' && divergence.stuckHerePct > 0.2) {
    recommendations.push({
      problem: `The most common place to give up is "${divergence.name}" — ${pct(divergence.stuckHerePct)} of quitters stopped exactly there.`,
      action: `Simplify "${divergence.name}": reduce required fields, clarify labels, or split it into smaller steps.`,
    });
  }
  const topFactor = (contrast.factors || []).find((f) => f.diff > 0.2);
  if (topFactor) {
    recommendations.push({
      problem: `Quitters were far more likely to: ${topFactor.label.toLowerCase()} (${pct(topFactor.abandonedRate)} vs ${pct(topFactor.completedRate)} of finishers).`,
      action: 'This friction signal barely shows up on the happy path — fixing it should move more people into the completing group.',
    });
  }
  if (avoidance) {
    recommendations.push({
      problem: `${avoidance.count} ${avoidance.count === 1 ? 'person' : 'people'} only completed after refreshing past an error — they avoided the problem rather than the form being fixed.`,
      action: 'These "successes" hide a real defect. Real customers who don\'t think to refresh will be lost. Treat the avoided error as a genuine bug.',
    });
  }
  if (!recommendations.length) {
    recommendations.push({
      problem: 'Finishers and quitters followed similar paths — no single dominant cause yet.',
      action: 'Collect more sessions to sharpen the comparison.',
    });
  }

  return {
    ready: true,
    completedCount: completed.length,
    abandonedCount: abandoned.length,
    confidence,
    contrast,
    steps: stepStats,
    divergence,
    dropoffs,
    errorComparison: errorComparison.slice(0, 5),
    avoidance,
    recommendations,
    insights,
  };
}

// Group sessions into journeys. All sessions sharing the same journeyId are kept
// together as ONE journey — that is the contract: one journeyId = one user's
// continuous interaction, whether it spans multiple URLs or multiple returns to
// the same URL. Single sessions (or sessions with no journeyId) become their own journey.
// Returns [{ key, members }].
export function groupSessionsIntoJourneys(sessions) {
  const byJid = new Map();
  sessions.forEach((s) => {
    const key = s.journeyId || s.sessionId;
    if (!byJid.has(key)) byJid.set(key, []);
    byJid.get(key).push(s);
  });

  const journeys = [];
  byJid.forEach((members, key) => {
    journeys.push({ key, members });
  });
  return journeys;
}

// Merge each multi-page journey's sessions into one synthetic session so every
// form-level metric (counts, completion, funnel, drop-off, errors) is computed per
// JOURNEY rather than per page-load. Single-page journeys (incl. single-URL reloads,
// which groupSessionsIntoJourneys keeps separate) pass through unchanged. Events are
// concatenated in page order; a form_abandon on any page except the last reached is
// just the user navigating onward, so it is dropped — only a true final abandonment
// counts as a drop-off.
export function mergeIntoJourneySessions(sessions) {
  return groupSessionsIntoJourneys(sessions).map(({ members }) => {
    if (members.length === 1) return members[0];
    const ordered = [...members].sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0)
      || (a.startTime ?? 0) - (b.startTime ?? 0));
    const lastIdx = ordered.length - 1;
    const events = [];
    ordered.forEach((m, i) => {
      (m.events || []).forEach((e) => {
        if (e.type === 'form_abandon' && i !== lastIdx) return; // navigation, not abandonment
        events.push(e);
      });
    });
    const first = ordered[0];
    return {
      ...first,
      sessionId: first.journeyId || first.sessionId,
      journeyId: first.journeyId,
      pageIndex: 1,
      startTime: ordered[0].startTime,
      returned: ordered.some((m) => m.returned),
      events,
    };
  });
}

export function analyzeSessions(sessions) {
  // eslint-disable-next-line no-param-reassign
  sessions = filterGhostSessions(sessions);

  if (sessions.length < config.minSessions) {
    return {
      ready: false,
      message: `Need at least ${config.minSessions} sessions. Currently have ${sessions.length}.`,
    };
  }

  const totalSessions = sessions.length;
  const completed = sessions.filter(didSessionComplete).length;
  const submitErrors = sessions.filter((s) => s.events.some((e) => e.type === 'form_submit' && e.failed)).length;
  // A session is a drop-off if the user engaged (focused a field OR hit a friction/error
  // signal) but never successfully submitted. This includes explicit abandons, failed-submit
  // sessions, and users blocked by an error before they could focus a field.
  const abandoned = sessions.filter((s) => !didSessionComplete(s)
    && (s.events.some((e) => e.type === 'field_focus')
      || s.events.some((e) => FRICTION_EVENT_TYPES.has(e.type)))).length;
  const returned = sessions.filter((s) => s.returned).length;

  const hasEvent = (s, type) => s.events.some((e) => e.type === type);
  const sessionsWithJsErrors = sessions.filter((s) => hasEvent(s, 'js_error')).length;
  const sessionsWithApiErrors = sessions.filter((s) => hasEvent(s, 'api_error')).length;
  const sessionsWithRageClicks = sessions.filter((s) => hasEvent(s, 'rage_click')).length;
  const sessionsWithDisabledClicks = sessions.filter((s) => hasEvent(s, 'disabled_click')).length;
  const sessionsWithSubmitErrors = sessions.filter(
    (s) => hasEvent(s, 'form_error') || hasEvent(s, 'submit_error'),
  ).length;
  const sessionsWithDeadClicks = sessions.filter((s) => hasEvent(s, 'dead_click')).length;
  const sessionsWithStepThrash = sessions.filter((s) => hasEvent(s, 'step_thrash')).length;
  const sessionsWithSuspectedCrash = sessions.filter((s) => hasEvent(s, 'suspected_crash')).length;
  const sessionsWithStorageQuota = sessions.filter((s) => hasEvent(s, 'storage_quota')).length;
  const sessionsWithPoorLcp = sessions.filter((s) => s.events.some((e) => e.type === 'perf_vitals' && e.metric === 'LCP' && e.rating === 'poor')).length;
  const sessionsWithSlowInp = sessions.filter((s) => s.events.some((e) => e.type === 'perf_vitals' && e.metric === 'INP' && e.rating !== 'good')).length;
  const sessionsWithLongTasks = sessions.filter((s) => hasEvent(s, 'perf_long_task')).length;

  // step thrash — most common bounced step pair
  const stepThrashMap = {};
  sessions.forEach((s) => {
    s.events.filter((e) => e.type === 'step_thrash').forEach((e) => {
      const key = `Step ${e.stepA + 1} ↔ Step ${e.stepB + 1}${e.stepName ? ` (${e.stepName})` : ''}`;
      stepThrashMap[key] = (stepThrashMap[key] || 0) + 1;
    });
  });
  const topStepThrash = Object.entries(stepThrashMap).sort((a, b) => b[1] - a[1])[0] || null;

  // worst LCP across sessions
  const lcpValues = sessions.flatMap((s) => s.events.filter((e) => e.type === 'perf_vitals' && e.metric === 'LCP').map((e) => e.valueMs)).filter(Boolean);
  const avgLcpMs = lcpValues.length ? Math.round(lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length) : null;

  // avg API latency per callType from perf_timing events
  const latencyBuckets = {};
  sessions.forEach((s) => {
    s.events.filter((e) => e.type === 'perf_timing' && e.callType && e.latencyMs > 0).forEach((e) => {
      if (!latencyBuckets[e.callType]) latencyBuckets[e.callType] = { sum: 0, count: 0 };
      latencyBuckets[e.callType].sum += e.latencyMs;
      latencyBuckets[e.callType].count += 1;
    });
  });
  const avgLatency = Object.fromEntries(
    Object.entries(latencyBuckets).map(([type, { sum, count }]) => [type, Math.round(sum / count)]),
  );

  // full breakdown by callType across all form_error events
  const submitErrorBreakdown = {};
  const submitErrorStatuses = {};
  sessions.forEach((s) => {
    const errs = s.events.filter((e) => e.type === 'form_error' || e.type === 'submit_error');
    errs.forEach((e) => {
      const type = e.callType || 'submit';
      submitErrorBreakdown[type] = (submitErrorBreakdown[type] || 0) + 1;
      const key = e.status ? `${e.status} — ${e.statusText} (${type})` : `${e.statusText} (${type})`;
      submitErrorStatuses[key] = (submitErrorStatuses[key] || 0) + 1;
    });
  });
  const topSubmitError = Object.entries(submitErrorStatuses).sort((a, b) => b[1] - a[1])[0] || null;

  // most rage-clicked element and step — element label is set from the clicked DOM node
  // so it is reliable. stepName disambiguates same-named buttons across steps.
  const rageClickMap = {};
  sessions.forEach((s) => {
    s.events.filter((e) => e.type === 'rage_click').forEach((e) => {
      const elem = e.element || 'unknown button';
      const key = e.stepName ? `${elem} (${e.stepName})` : elem;
      rageClickMap[key] = (rageClickMap[key] || 0) + 1;
    });
  });
  const topRageClick = Object.entries(rageClickMap).sort((a, b) => b[1] - a[1])[0] || null;

  // most common api_error — prefer stepName+URL over nearestField because old sessions
  // recorded nearestField from hidden wizard steps (tracker bug now fixed). stepName
  // was always read from the active DOM step so it is reliable for both old and new sessions.
  const apiErrorMap = {};
  sessions.forEach((s) => {
    s.events.filter((e) => e.type === 'api_error').forEach((e) => {
      let key;
      if (e.stepName) {
        if (e.url) {
          try {
            const endpoint = new URL(e.url).pathname.split('/').filter(Boolean).pop();
            key = `${e.stepName} (${endpoint})`;
          } catch (_) {
            key = e.stepName;
          }
        } else {
          key = e.stepName;
        }
      } else if (e.nearestField) {
        key = e.nearestField;
      } else {
        key = e.url || 'unknown';
      }
      apiErrorMap[key] = (apiErrorMap[key] || 0) + 1;
    });
  });
  const topApiError = Object.entries(apiErrorMap).sort((a, b) => b[1] - a[1])[0] || null;

  // most clicked disabled button — element is the button's text label from the DOM,
  // reliable across old and new sessions. stepName disambiguates "Next" buttons.
  const disabledClickMap = {};
  sessions.forEach((s) => {
    s.events.filter((e) => e.type === 'disabled_click').forEach((e) => {
      const elem = e.element || 'unknown button';
      const key = e.stepName ? `${elem} (${e.stepName})` : elem;
      disabledClickMap[key] = (disabledClickMap[key] || 0) + 1;
    });
  });
  const topDisabledClick = Object.entries(disabledClickMap).sort((a, b) => b[1] - a[1])[0] || null;

  const abandonmentByStep = {};
  sessions.forEach((s) => {
    const ae = s.events.find((e) => e.type === 'form_abandon');
    if (!ae || didSessionComplete(s)) return;
    if (!s.events.some((e) => e.type === 'field_focus')) return;
    const key = ae.stepName || (ae.step != null ? `Step ${ae.step + 1}` : null);
    if (!key) return;
    if (!abandonmentByStep[key]) abandonmentByStep[key] = { count: 0, lastFields: {} };
    abandonmentByStep[key].count += 1;
    if (ae.lastField) {
      abandonmentByStep[key].lastFields[ae.lastField] = (abandonmentByStep[key].lastFields[ae.lastField] || 0) + 1;
    }
  });

  // scan phase: sessions where user never interacted with any field and never submitted.
  // Includes sessions without form_abandon (tab closed, network drop, etc.). A session
  // that hit a friction/error signal is NOT a passive scan — exclude it.
  const scanOnlySessions = sessions.filter((s) => {
    if (s.events.some((e) => e.type === 'field_focus')) return false;
    if (didSessionComplete(s)) return false;
    if (s.events.some((e) => FRICTION_EVENT_TYPES.has(e.type))) return false;
    return true;
  });

  // bounce sessions: landed by mistake — left within 15s, scrolled < 25%, never filled a field.
  // 15s (not 10s) accounts for slow network / mobile render time so fast readers aren't miscounted.
  // A session with a friction/error signal is a blocked user, not a bounce — exclude it.
  const bounceSessions = sessions.filter((s) => {
    const hasFieldFocus = s.events.some((e) => e.type === 'field_focus');
    if (hasFieldFocus) return false;
    if (s.events.some((e) => FRICTION_EVENT_TYPES.has(e.type))) return false;
    const abandonEvent = s.events.find((e) => e.type === 'form_abandon');
    if (!abandonEvent) return false; // no confirmed departure — don't guess
    const pageTimeMs = abandonEvent.pageTimeMs ?? 0;
    const scrollDepth = abandonEvent.maxScrollDepth ?? 100;
    return pageTimeMs < 15000 && scrollDepth < 25;
  });
  const scanEndEvents = sessions.map((s) => s.events.find((e) => e.type === 'form_scan_end')).filter(Boolean);
  const avgScanTimeMs = scanEndEvents.length
    ? scanEndEvents.reduce((sum, e) => sum + (e.scanTimeMs || 0), 0) / scanEndEvents.length
    : 0;
  const avgFieldsScannedBeforeFill = scanEndEvents.length
    ? scanEndEvents.reduce((sum, e) => sum + (e.scannedCount || 0), 0) / scanEndEvents.length
    : 0;

  // form-level signals (progress indicator, account creation, step field counts)
  const formStartEvents = sessions.map((s) => s.events.find((e) => e.type === 'form_start')).filter(Boolean);
  const hasProgressIndicator = formStartEvents.some((e) => e.hasProgressIndicator);
  const hasAccountCreation = formStartEvents.some((e) => e.hasAccountCreation);

  // step field counts — use the first session that has stepsInfo
  const stepsInfo = formStartEvents.find((e) => e.stepsInfo?.length)?.stepsInfo || [];
  const overwhelmingSteps = stepsInfo.filter((s) => s.fieldCount >= 6);

  // deep abandonment — user filled >50% of fields but never submitted
  const formFieldsEv = sessions[0]?.events.find((e) => e.type === 'form_fields');
  const totalFieldCount = formFieldsEv?.fields?.length || 0;
  const fieldMetaSrc = formFieldsEv?.fieldMeta || [];
  const requiredFieldCount = fieldMetaSrc.filter((m) => m.isRequired).length;
  const requiredRatio = totalFieldCount > 0 ? requiredFieldCount / totalFieldCount : 0;
  const deepAbandons = sessions.filter((s) => {
    const hasSubmit = didSessionComplete(s);
    if (hasSubmit) return false;
    const filledFields = new Set(s.events.filter((e) => e.type === 'field_blur' && !e.skipped).map((e) => e.field));
    return totalFieldCount > 0 && filledFields.size / totalFieldCount > 0.5;
  }).length;

  // aggregate per-field stats
  const fieldMap = {};

  // initialize all known fields from form_fields events
  sessions.forEach((session) => {
    const formFieldsEvent = session.events.find((e) => e.type === 'form_fields');
    if (formFieldsEvent && formFieldsEvent.fields) {
      formFieldsEvent.fields.forEach((field, i) => {
        if (!fieldMap[field]) {
          fieldMap[field] = {
            field,
            meta: formFieldsEvent.fieldMeta?.find((m) => m.name === field) || null,
            totalInteractions: 0,
            dropOffCount: 0,
            abandonCount: 0,
            totalTimeSpentMs: 0,
            totalIdleTimeMs: 0,
            totalErrors: 0,
            copyPasteCount: 0,
            labelCopyCount: 0,
            visibleCount: 0,
            totalVisitCount: 0,
            skipCount: 0,
            autofillCount: 0,
            thrashCount: 0,
          };
        }
      });
    }
  });

  sessions.forEach((session) => {
    const blurEvents = session.events.filter((e) => e.type === 'field_blur');
    const abandonEvent = session.events.find((e) => e.type === 'form_abandon');
    const submitEvent = didSessionComplete(session)
      ? session.events.find((e) => e.type === 'form_submit' && !e.failed)
      : null;

    // label copy events — one count per session per field (not per copy action)
    const labelCopiedFields = new Set(
      session.events.filter((e) => e.type === 'label_copied').map((e) => e.field),
    );
    labelCopiedFields.forEach((field) => {
      if (fieldMap[field]) fieldMap[field].labelCopyCount += 1;
    });

    blurEvents.forEach((blur) => {
      const { field } = blur;
      if (!fieldMap[field]) {
        fieldMap[field] = {
          field,
          totalInteractions: 0,
          dropOffCount: 0,
          totalTimeSpentMs: 0,
          totalIdleTimeMs: 0,
          totalErrors: 0,
          copyPasteCount: 0,
          labelCopyCount: 0,
          visibleCount: 0,
          totalVisitCount: 0,
          totalHesitationMs: 0,
          hesitationCount: 0,  // blurs where hesitationMs was recorded
          totalCorrectionCount: 0,
          blurWithoutChangeCount: 0,
        };
      }

      const f = fieldMap[field];
      f.totalInteractions += 1;
      f.totalTimeSpentMs += blur.timeSpentMs || 0;
      f.totalIdleTimeMs += blur.idleTimeMs || 0;
      f.totalErrors += blur.errorCount || 0;
      f.totalVisitCount += blur.visitCount || 1;
      if (blur.copyPasted) f.copyPasteCount += 1;
      if (blur.skipped) f.skipCount += 1;
      if (blur.hesitationMs != null) {
        f.totalHesitationMs += blur.hesitationMs;
        f.hesitationCount += 1;
      }
      if (blur.correctionCount) f.totalCorrectionCount += blur.correctionCount;
      if (blur.changedDuringFocus === false) f.blurWithoutChangeCount += 1;

    });

    // drop-off + abandonCount: both use abandon.lastField as the definitive signal.
    // The old approach (last blur event) is wrong when users fill out of order —
    // e.g. they blur dob, then focus national_id without blurring, then abandon.
    // Last blur = dob, but they actually dropped at national_id.
    // abandon.lastField is set from the last field_focus/field_blur at abandon time,
    // so it always points to the field the user was actually on.
    if (abandonEvent && !submitEvent) {
      // if the abandon event itself says the user was blocked by a disabled button,
      // don't attribute the drop-off to any field — the issue is the button, not the form
      if (!abandonEvent.blockedByDisabledButton) {
        const dropField = abandonEvent.lastField
          ?? (blurEvents.length > 0 ? blurEvents[blurEvents.length - 1].field : null);
        if (dropField && fieldMap[dropField]) {
          fieldMap[dropField].dropOffCount += 1;
          fieldMap[dropField].abandonCount += 1;
        }
      }
    }

    // track validation thrashing — deduplicate per session per field
    const thrashInSession = new Set(
      session.events.filter((e) => e.type === 'validation_thrash').map((e) => e.field),
    );
    thrashInSession.forEach((field) => {
      if (fieldMap[field]) fieldMap[field].thrashCount += 1;
    });

    // track autofill — deduplicate per session
    const autofilledInSession = new Set(
      session.events.filter((e) => e.type === 'field_autofilled').map((e) => e.field),
    );
    autofilledInSession.forEach((field) => {
      if (fieldMap[field]) fieldMap[field].autofillCount += 1;
    });

    // track visibility — deduplicate per session so one session = max 1 count per field
    const visibleInSession = new Set(
      session.events.filter((e) => e.type === 'field_visible').map((e) => e.field),
    );
    visibleInSession.forEach((field) => {
      if (fieldMap[field]) fieldMap[field].visibleCount += 1;
    });
  });

  const fields = Object.values(fieldMap).map((f) => {
    const stats = {
      field: f.field,
      meta: f.meta || null,
      dropOffRate: f.dropOffCount / totalSessions,
      abandonCount: f.abandonCount,
      avgTimeSpentMs: f.totalInteractions ? f.totalTimeSpentMs / f.totalInteractions : 0,
      avgIdleTimeMs: f.totalInteractions ? f.totalIdleTimeMs / f.totalInteractions : 0,
      avgErrorCount: f.totalInteractions ? f.totalErrors / f.totalInteractions : 0,
      copyPasteRate: f.totalInteractions ? f.copyPasteCount / f.totalInteractions : 0,
      labelCopyRate: totalSessions ? f.labelCopyCount / totalSessions : 0,
      visibilityRate: totalSessions ? f.visibleCount / totalSessions : 0,
      avgVisitCount: f.totalInteractions ? f.totalVisitCount / f.totalInteractions : 1,
      skipRate: totalSessions ? f.skipCount / totalSessions : 0,
      autofillRate: totalSessions ? f.autofillCount / totalSessions : 0,
      thrashRate: totalSessions ? f.thrashCount / totalSessions : 0,
      avgHesitationMs: f.hesitationCount ? f.totalHesitationMs / f.hesitationCount : 0,
      avgCorrectionCount: f.totalInteractions ? f.totalCorrectionCount / f.totalInteractions : 0,
      blurWithoutChangeRate: f.totalInteractions ? f.blurWithoutChangeCount / f.totalInteractions : 0,
    };
    stats.severityScore = stats.dropOffRate * 3
      + (stats.avgErrorCount / 2)
      + (stats.avgIdleTimeMs / 20000)
      + (stats.avgVisitCount > 1.5 ? 0.3 : 0)
      + (stats.copyPasteRate * 0.5)
      + (stats.labelCopyRate * 0.8)
      + (stats.skipRate * 1.2)
      + (stats.thrashRate * 1.5)
      + (stats.avgHesitationMs > 5000 ? 0.3 : 0)
      + (stats.avgCorrectionCount > 3 ? 0.4 : 0)
      + (stats.blurWithoutChangeRate > 0.3 ? 0.5 : 0);
    stats.diagnosis = getDiagnosis(stats);
    stats.possibleReason = stats.diagnosis.label;
    stats.frictionScore = computeFrictionScore(stats);
    stats.frictionLevel = frictionLevel(stats.frictionScore);
    return stats;
  });

  fields.sort((a, b) => b.severityScore - a.severityScore);

  // per-device completion breakdown
  const deviceBreakdown = {};
  sessions.forEach((s) => {
    const d = s.device || 'desktop';
    if (!deviceBreakdown[d]) deviceBreakdown[d] = { total: 0, completed: 0, abandoned: 0 };
    deviceBreakdown[d].total += 1;
    if (didSessionComplete(s)) deviceBreakdown[d].completed += 1;
    else if (s.events.some((e) => e.type === 'form_abandon') && s.events.some((e) => e.type === 'field_focus')) deviceBreakdown[d].abandoned += 1;
  });

  // per-platform (OS / browser) breakdown — only sessions carrying deviceInfo
  // (from the standalone tracker). Tracks completion AND error rate per platform
  // so the dashboard can surface "errors concentrated on iOS Safari" etc.
  const hasError = (s) => s.events.some((e) => ['js_error', 'api_error', 'console_error', 'rule_failed', 'form_error', 'field_error'].includes(e.type));
  const tally = (map, key, s) => {
    if (!key) return;
    if (!map[key]) {
      map[key] = {
        total: 0, completed: 0, abandoned: 0, withError: 0,
      };
    }
    map[key].total += 1;
    if (didSessionComplete(s)) map[key].completed += 1;
    else if (s.events.some((e) => e.type === 'form_abandon') && s.events.some((e) => e.type === 'field_focus')) map[key].abandoned += 1;
    if (hasError(s)) map[key].withError += 1;
  };
  const osBreakdown = {};
  const browserBreakdown = {};
  sessions.forEach((s) => {
    const info = s.deviceInfo;
    if (!info) return;
    tally(osBreakdown, info.os, s);
    tally(browserBreakdown, info.browser, s);
  });

  // rule trigger aggregation
  const ruleTriggersByField = {};
  sessions.forEach((s) => {
    s.events.filter((e) => e.type === 'rule_triggered').forEach((e) => {
      if (!ruleTriggersByField[e.field]) ruleTriggersByField[e.field] = { shown: 0, hidden: 0 };
      if (e.to) ruleTriggersByField[e.field].shown += 1;
      else ruleTriggersByField[e.field].hidden += 1;
    });
  });
  const sessionsWithRuleTriggers = sessions.filter((s) => s.events.some((e) => e.type === 'rule_triggered')).length;
  const sessionsWithRuleFailures = sessions.filter((s) => s.events.some((e) => e.type === 'rule_failed')).length;

  return {
    ready: true,
    summary: {
      totalSessions,
      completionRate: completed / totalSessions,
      submitErrorRate: submitErrors / totalSessions,
      dropOffRate: abandoned / totalSessions,
      returnRate: returned / totalSessions,
      scanOnlyRate: scanOnlySessions.length / totalSessions,
      bounceRate: bounceSessions.length / totalSessions,
      avgScanTimeMs,
      avgFieldsScannedBeforeFill,
      abandonmentByStep,
      deepAbandonRate: deepAbandons / totalSessions,
      deviceBreakdown,
      osBreakdown,
      browserBreakdown,
      formDesign: {
        hasProgressIndicator,
        hasAccountCreation,
        totalFieldCount,
        overwhelmingSteps,
        requiredFieldCount,
        requiredRatio,
      },
      errors: {
        jsErrors: sessionsWithJsErrors,
        apiErrors: sessionsWithApiErrors,
        rageClicks: sessionsWithRageClicks,
        disabledClicks: sessionsWithDisabledClicks,
        topRageClick: topRageClick ? { label: topRageClick[0], count: topRageClick[1] } : null,
        topApiError: topApiError ? { label: topApiError[0], count: topApiError[1] } : null,
        topDisabledClick: topDisabledClick ? { label: topDisabledClick[0], count: topDisabledClick[1] } : null,
        submitErrors: sessionsWithSubmitErrors,
        submitErrorBreakdown,
        topSubmitError: topSubmitError ? { label: topSubmitError[0], count: topSubmitError[1] } : null,
        deadClicks: sessionsWithDeadClicks,
        stepThrash: sessionsWithStepThrash,
        topStepThrash: topStepThrash ? { label: topStepThrash[0], count: topStepThrash[1] } : null,
        suspectedCrashes: sessionsWithSuspectedCrash,
        storageQuota: sessionsWithStorageQuota,
        poorLcp: sessionsWithPoorLcp,
        slowInp: sessionsWithSlowInp,
        longTasks: sessionsWithLongTasks,
        avgLcpMs,
      },
      ruleActivity: {
        sessionsWithTriggers: sessionsWithRuleTriggers,
        sessionsWithFailures: sessionsWithRuleFailures,
        triggersByField: ruleTriggersByField,
      },
      performance: {
        avgLatency,
      },
    },
    fields,
  };
}

// ── Timeline bucketing ────────────────────────────────────────────────────────

function pad2(n) { return String(n).padStart(2, '0'); }

function bucketKey(ts, granularity) {
  const d = new Date(ts);
  const Y = d.getFullYear();
  const M = pad2(d.getMonth() + 1);
  const D = pad2(d.getDate());
  const H = pad2(d.getHours());
  if (granularity === 'hour') {
    return `${Y}-${M}-${D}T${H}`;
  }
  if (granularity === 'week') {
    const day = d.getDay(); // 0=Sun … 6=Sat
    const diffToMon = (day === 0 ? -6 : 1 - day);
    const mon = new Date(ts + diffToMon * 86400000);
    return `${mon.getFullYear()}-${pad2(mon.getMonth() + 1)}-${pad2(mon.getDate())}`;
  }
  return `${Y}-${M}-${D}`;
}

function bucketLabel(key, granularity) {
  if (granularity === 'hour') {
    const [datePart, hourPart] = key.split('T');
    const [, mm, dd] = datePart.split('-');
    const d = new Date(`${datePart}T00:00:00`);
    const mon = d.toLocaleString('en', { month: 'short' });
    return `${mon} ${parseInt(dd, 10)} ${hourPart}:00`;
  }
  if (granularity === 'week') {
    const d = new Date(`${key}T00:00:00`);
    const end = new Date(d.getTime() + 6 * 86400000);
    const fmt = (x) => `${x.toLocaleString('en', { month: 'short' })} ${x.getDate()}`;
    return `${fmt(d)}–${fmt(end)}`;
  }
  const d = new Date(`${key}T00:00:00`);
  return `${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}`;
}

function stepMs(granularity) {
  if (granularity === 'hour') return 3600000;
  if (granularity === 'week') return 7 * 86400000;
  return 86400000;
}

export function buildTimeline(sessions, sinceTs, untilTs) {
  if (!sessions.length) return { granularity: 'day', buckets: [] };

  const effectiveSince = sinceTs || Math.min(...sessions.map((s) => s.startTime));
  const effectiveUntil = untilTs || Date.now();
  const spanMs = effectiveUntil - effectiveSince;

  const granularity = spanMs <= 2 * 86400000 ? 'hour' : spanMs <= 366 * 86400000 ? 'day' : 'week';

  const ERROR_TYPES = new Set(['js_error', 'rage_click', 'api_error', 'disabled_click', 'field_error']);

  const empty = () => ({
    sessions: 0, completions: 0, dropoffs: 0, errorDropoffs: 0,
    totalErrors: 0, jsErrors: 0, rageClicks: 0, apiErrors: 0, disabledClicks: 0, fieldErrors: 0,
  });

  const map = {};

  sessions.forEach((s) => {
    const key = bucketKey(s.startTime, granularity);
    if (!map[key]) map[key] = empty();
    const b = map[key];
    b.sessions += 1;
    const hasSuccessfulSubmit = didSessionComplete(s);
    const hasFocus = s.events.some((e) => e.type === 'field_focus');
    const hasError = s.events.some((e) => ERROR_TYPES.has(e.type));
    if (hasSuccessfulSubmit) b.completions += 1;
    const isDropoff = !hasSuccessfulSubmit && hasFocus;
    if (isDropoff) b.dropoffs += 1;
    // Sessions where user hit an error AND then abandoned — true correlation signal.
    if (isDropoff && hasError) b.errorDropoffs += 1;
    s.events.forEach((e) => {
      if (e.type === 'js_error') { b.jsErrors += 1; b.totalErrors += 1; }
      else if (e.type === 'rage_click') { b.rageClicks += 1; b.totalErrors += 1; }
      else if (e.type === 'api_error') { b.apiErrors += 1; b.totalErrors += 1; }
      else if (e.type === 'disabled_click') { b.disabledClicks += 1; b.totalErrors += 1; }
      else if (e.type === 'field_error') { b.fieldErrors += 1; b.totalErrors += 1; }
    });
  });

  // gap-fill every expected bucket in range
  const step = stepMs(granularity);
  const allKeys = [];
  // Parse bucket keys as local time (no Z suffix) so cursor matches local bucketKey().
  const suffix = granularity === 'hour' ? ':00:00' : 'T00:00:00';
  // Start one step before the first session so scrolling left reveals an empty lead-in bucket.
  let cursor = new Date(bucketKey(effectiveSince, granularity) + suffix).getTime() - step;
  // end = local midnight of the until bucket; cursor <= end ensures last bucket is included.
  const end = new Date(bucketKey(effectiveUntil, granularity) + suffix).getTime();
  while (cursor <= end) {
    const k = bucketKey(cursor, granularity);
    if (!allKeys.includes(k)) allKeys.push(k);
    cursor += step;
  }

  const buckets = allKeys.map((key) => ({
    key,
    label: bucketLabel(key, granularity),
    ...(map[key] || empty()),
  }));

  return { granularity, buckets };
}
