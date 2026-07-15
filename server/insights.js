import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrock, AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { dominantErrorSignature } from './knowledge-base.js';

// ── Claude tool schema ────────────────────────────────────────────────────────

const INSIGHT_TOOL = {
  name: 'report_insight',
  description: 'Report a single UX insight about one or more fields that share the same root problem, OR a session-level behavioural/technical issue. Call once per distinct issue type.',
  input_schema: {
    type: 'object',
    properties: {
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Field names this insight applies to. Empty array for session-level issues (rage clicks, JS errors, etc.)',
      },
      fieldDetails: {
        type: 'array',
        description: 'One entry per field with its key stat and priority. Empty array for session-level issues.',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            stat: { type: 'string', description: 'Key metric e.g. "45% drop-off" or "12s idle"' },
          },
          required: ['field', 'priority', 'stat'],
        },
      },
      insight: {
        type: 'string',
        description: 'What the data shows — cite exact percentages and field names. One or two sentences.',
      },
      fix: {
        type: 'string',
        description: 'Specific, actionable fix. Name the field/button and say exactly what to change — not generic advice.',
      },
      why: {
        type: 'string',
        description: 'One sentence explaining why this fix improves the metric.',
      },
      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['fields', 'fieldDetails', 'insight', 'fix', 'why', 'priority'],
  },
};

function formatBreakdown(obj = {}) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label}: ${count}`)
    .join(', ');
}

// ── Format all analytics into a rich prompt ───────────────────────────────────

function formatAnalysisForClaude(analysis) {
  const { summary, fields } = analysis;
  const s = summary;
  const e = s.errors || {};
  const n = s.totalSessions;

  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  const rate = (count) => (n ? pct(count / n) : '0.0%');

  const lines = [
    '## Session Overview',
    `- Total sessions: ${n}`,
    `- Completion rate: ${pct(s.completionRate)}`,
    `- Drop-off rate: ${pct(s.dropOffRate)}`,
    `- Return rate: ${pct(s.returnRate)}`,
    `- Scroll-only (never filled a field): ${pct(s.scanOnlyRate ?? 0)}`,
    `- Avg time scanning before first interaction: ${((s.avgScanTimeMs ?? 0) / 1000).toFixed(1)}s`,
    `- Avg fields previewed before filling: ${(s.avgFieldsScannedBeforeFill ?? 0).toFixed(1)}`,
  ];

  if (s.abandonmentByStep && Object.keys(s.abandonmentByStep).length) {
    lines.push('', '## Abandonment by Wizard Step');
    Object.entries(s.abandonmentByStep)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([step, data]) => {
        const topField = Object.entries(data.lastFields || {})
          .sort((a, b) => b[1] - a[1])[0];
        lines.push(
          `- ${step}: ${data.count} abandonments${topField ? `, most left at field "${topField[0]}"` : ''}`,
        );
      });
  }

  // Form design signals
  const fd = s.formDesign || {};
  lines.push(
    '',
    '## Form Design Signals',
    `- Progress indicator present: ${fd.hasProgressIndicator ? 'YES' : 'NO — users cannot gauge form length'}`,
    `- Forced account creation (password field in step 1): ${fd.hasAccountCreation ? 'YES — major abandonment trigger' : 'no'}`,
    `- Total field count: ${fd.totalFieldCount || 'unknown'}`,
    `- Required field ratio: ${fd.requiredRatio != null ? `${(fd.requiredRatio * 100).toFixed(0)}% required (${fd.requiredFieldCount ?? '?'} of ${fd.totalFieldCount ?? '?'} fields)` : 'unknown'}`,
    `- Deep abandonment rate (filled >50% but no submit): ${pct(s.deepAbandonRate ?? 0)}`,
    `- Bounce rate (left in <10s, scrolled <25%, never filled): ${pct(s.bounceRate ?? 0)} — likely arrived by mistake or wrong page`,
  );
  if (fd.overwhelmingSteps?.length) {
    fd.overwhelmingSteps.forEach((st) => {
      lines.push(`- Step "${st.name}" has ${st.fieldCount} fields (${st.requiredCount} required) — may feel overwhelming`);
    });
  }

  lines.push('', '## Frustration & Technical Errors');

  // JS errors — include total event count so Claude can compute per-session average
  if (e.jsErrors > 0) {
    const totalJsEvents = e.jsErrorEventCount || e.jsErrors;
    const perSession = n ? (totalJsEvents / n).toFixed(1) : '?';
    lines.push(`- JavaScript runtime errors: ${e.jsErrors} sessions (${rate(e.jsErrors)}) — ${totalJsEvents} total error events, avg ${perSession}×/session${e.topJsError ? ` — most common: "${e.topJsError.message || e.topJsError.label}" (${e.topJsError.count} events)` : ''}`);
  } else {
    lines.push('- JavaScript runtime errors: 0 sessions');
  }

  // API errors
  if (e.apiErrors > 0) {
    const totalApiEvents = e.apiErrorEventCount || e.apiErrors;
    const perSession = n ? (totalApiEvents / n).toFixed(1) : '?';
    const statusBreakdown = formatBreakdown(e.apiErrorStatusBreakdown);
    lines.push(`- API / fetch failures: ${e.apiErrors} sessions (${rate(e.apiErrors)}) — ${totalApiEvents} total error events, avg ${perSession}×/session${e.topApiError ? ` — endpoint: "${e.topApiError.label}" (${e.topApiError.count} events)` : ''}${statusBreakdown ? ` — exact HTTP statuses: ${statusBreakdown}` : ''}`);
  } else {
    lines.push('- API / fetch failures: 0 sessions');
  }

  // Submit / validation errors (ui_message, server errors)
  if (e.submitErrors > 0) {
    const totalSubmitEvents = Object.values(e.submitErrorBreakdown || {}).reduce((a, b) => a + b, 0);
    const perSession = n ? (totalSubmitEvents / n).toFixed(1) : '?';
    const breakdown = Object.entries(e.submitErrorBreakdown || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
    const statusBreakdown = formatBreakdown(e.submitErrorStatusBreakdown);
    lines.push(`- Submit / validation errors: ${e.submitErrors} sessions (${rate(e.submitErrors)}) — ${totalSubmitEvents} total error events, avg ${perSession}×/session (${breakdown})${statusBreakdown ? ` — exact HTTP statuses: ${statusBreakdown}` : ''}${e.topSubmitError ? ` — most common message: "${e.topSubmitError.label}" appeared in ${e.topSubmitError.count} sessions` : ''}`);
  }

  // Rage clicks
  lines.push(`- Rage clicks: ${e.rageClicks || 0} sessions (${rate(e.rageClicks || 0)})${e.topRageClick ? ` — most on "${e.topRageClick.label}" (${e.topRageClick.count}×)` : ''}`);

  // Disabled button clicks
  lines.push(`- Disabled button clicks: ${e.disabledClicks || 0} sessions (${rate(e.disabledClicks || 0)})${e.topDisabledClick ? ` — most on "${e.topDisabledClick.label}" (${e.topDisabledClick.count}×)` : ''} — user clicked a button that was disabled`);

  // Step thrashing
  if ((e.stepThrash || 0) > 0) {
    lines.push(`- Step thrash (back-and-forth 3+ times): ${e.stepThrash} sessions (${rate(e.stepThrash)})${e.topStepThrash ? ` — most common: "${e.topStepThrash.label}" (${e.topStepThrash.count}×)` : ''} — user confused navigating wizard steps`);
  }

  // Performance
  if ((e.poorLcp || 0) > 0 || (e.avgLcpMs || 0) > 0) {
    lines.push(`- Slow page load (LCP poor ≥4s): ${e.poorLcp || 0} sessions (${rate(e.poorLcp || 0)})${e.avgLcpMs ? ` — avg LCP ${e.avgLcpMs}ms across all sessions` : ''}`);
  }
  if ((e.slowInp || 0) > 0) {
    lines.push(`- Slow interactions (INP ≥200ms): ${e.slowInp} sessions (${rate(e.slowInp)}) — form felt unresponsive`);
  }
  if ((e.longTasks || 0) > 0) {
    lines.push(`- UI freezes (long task >500ms): ${e.longTasks} sessions (${rate(e.longTasks)}) — main thread blocked`);
  }

  // Reliability
  if ((e.suspectedCrashes || 0) > 0) {
    lines.push(`- Suspected tab crashes: ${e.suspectedCrashes} sessions (${rate(e.suspectedCrashes)}) — heartbeat not cleared normally`);
  }
  if ((e.storageQuota || 0) > 0) {
    lines.push(`- Browser storage quota exceeded: ${e.storageQuota} sessions (${rate(e.storageQuota)}) — session progress could not be persisted`);
  }

  if (s.performance?.avgLatency && Object.keys(s.performance.avgLatency).length) {
    lines.push('', '## API Performance');
    Object.entries(s.performance.avgLatency).forEach(([type, latMs]) => {
      const flag = latMs > 2000 ? '⚠ HIGH — likely causing abandonment' : latMs > 1000 ? 'borderline — monitor' : 'ok';
      lines.push(`- ${type}: ${latMs}ms [${flag}]`);
    });
  }

  // Only include fields that breach at least one threshold — keeps the prompt small for large forms
  const flaggedFields = fields.filter((f) => (
    f.dropOffRate > 0.10
    || f.avgErrorCount > 0.5
    || f.avgVisitCount > 1.5
    || (f.labelCopyRate ?? 0) > 0.2
    || (f.skipRate ?? 0) > 0.2
    || f.visibilityRate < 0.5
    || f.severityScore > 0.3
  ));

  if (flaggedFields.length) {
    lines.push(
      '',
      `## Per-Field Statistics (${flaggedFields.length} flagged of ${fields.length} total)`,
      'field | drop-off% | errors/visit | copy-paste% | label-copy% | visibility% | avg-revisits | skip% | abandon-count | severity | required',
    );
    flaggedFields.forEach((f) => {
      lines.push([
        f.field,
        (f.dropOffRate * 100).toFixed(0),
        f.avgErrorCount.toFixed(2),
        (f.copyPasteRate * 100).toFixed(0),
        ((f.labelCopyRate ?? 0) * 100).toFixed(0),
        (f.visibilityRate * 100).toFixed(0),
        f.avgVisitCount.toFixed(2),
        ((f.skipRate ?? 0) * 100).toFixed(0),
        f.abandonCount ?? 0,
        f.severityScore.toFixed(2),
        f.meta ? (f.meta.isRequired ? 'yes' : 'no') : 'unknown',
      ].join(' | '));
    });
  }

  // Explicit threshold violations — so Claude cannot miss or skip any signal
  const violations = [];
  const n2 = n || 1;

  if (e.jsErrors > 0) {
    const totalJsEvents = e.jsErrorEventCount || e.jsErrors;
    violations.push(`[MUST REPORT] JS errors: ${e.jsErrors}/${n} sessions — ${totalJsEvents} total events, avg ${n ? (totalJsEvents / n).toFixed(1) : '?'}×/session${e.topJsError ? ` — error: "${e.topJsError.message || e.topJsError.label}"` : ''}`);
  }
  if (e.apiErrors > 0) {
    const totalApiEvents = e.apiErrorEventCount || e.apiErrors;
    const statusBreakdown = formatBreakdown(e.apiErrorStatusBreakdown);
    violations.push(`[MUST REPORT] API errors: ${e.apiErrors}/${n} sessions — ${totalApiEvents} total events, avg ${n ? (totalApiEvents / n).toFixed(1) : '?'}×/session${e.topApiError ? ` — endpoint: "${e.topApiError.label}"` : ''}${statusBreakdown ? ` — exact HTTP statuses: ${statusBreakdown}` : ''}`);
  }
  if (e.submitErrors > 0) {
    const totalSubmitEvents = Object.values(e.submitErrorBreakdown || {}).reduce((a, b) => a + b, 0);
    const statusBreakdown = formatBreakdown(e.submitErrorStatusBreakdown);
    violations.push(`[MUST REPORT] Submit/validation errors: ${e.submitErrors}/${n} sessions — ${totalSubmitEvents} total events, avg ${n ? (totalSubmitEvents / n).toFixed(1) : '?'}×/session${statusBreakdown ? ` — exact HTTP statuses: ${statusBreakdown}` : ''}${e.topSubmitError ? ` — message: "${e.topSubmitError.label}"` : ''}`);
  }
  if (e.topHttpStatusError) {
    violations.push(`[MUST REPORT] Top exact HTTP failure: ${e.topHttpStatusError.label} (${e.topHttpStatusError.count} events). Use this exact status in the insight title/body when explaining backend/service failures.`);
  }
  if ((e.rageClicks || 0) / n2 > 0.10) violations.push(`[MUST REPORT] Rage clicks: ${e.rageClicks} sessions (${rate(e.rageClicks)})${e.topRageClick ? ` on "${e.topRageClick.label}"` : ''}`);
  if ((e.disabledClicks || 0) / n2 > 0.15) violations.push(`[MUST REPORT] Disabled button clicks: ${e.disabledClicks} sessions (${rate(e.disabledClicks)})${e.topDisabledClick ? ` — button: "${e.topDisabledClick.label}"` : ''}`);
  if ((e.stepThrash || 0) > 0) violations.push(`[MUST REPORT] Step thrash: ${e.stepThrash} sessions (${rate(e.stepThrash)}) bouncing between steps${e.topStepThrash ? ` — pair: "${e.topStepThrash.label}"` : ''}`);
  if ((e.poorLcp || 0) / n2 > 0.10) violations.push(`[MUST REPORT] Slow page load: ${e.poorLcp} sessions (${rate(e.poorLcp)}) with LCP ≥4s${e.avgLcpMs ? ` — avg ${e.avgLcpMs}ms` : ''}`);
  if ((e.suspectedCrashes || 0) > 0) violations.push(`[MUST REPORT] Suspected crashes: ${e.suspectedCrashes} sessions — heartbeat stale, tab likely crashed`);

  if (s.abandonmentByStep) {
    Object.entries(s.abandonmentByStep).forEach(([step, data]) => {
      if (data.count > 0) {
        const topField = Object.entries(data.lastFields || {}).sort((a, b) => b[1] - a[1])[0];
        violations.push(`[MUST REPORT] Abandonment in step "${step}": ${data.count} users left${topField ? `, last field: "${topField[0]}"` : ''}`);
      }
    });
  }

  fields.forEach((f) => {
    const flags = [];
    if (f.dropOffRate > 0.10) flags.push(`drop-off ${(f.dropOffRate * 100).toFixed(0)}%`);
    if (f.avgErrorCount > 0.5) flags.push(`${f.avgErrorCount.toFixed(1)} errors/visit`);
    if (f.avgVisitCount > 1.5) flags.push(`revisited ${f.avgVisitCount.toFixed(1)}×`);
    if ((f.labelCopyRate ?? 0) > 0.2) flags.push(`${((f.labelCopyRate) * 100).toFixed(0)}% label copied`);
    if ((f.skipRate ?? 0) > 0.2) flags.push(`${((f.skipRate) * 100).toFixed(0)}% skipped`);
    if (f.visibilityRate < 0.5) flags.push(`only ${(f.visibilityRate * 100).toFixed(0)}% visible`);
    if (flags.length) violations.push(`[MUST REPORT] Field "${f.field}": ${flags.join(', ')}`);
  });

  if (fd.overwhelmingSteps?.length) {
    fd.overwhelmingSteps.forEach((st) => violations.push(`[MUST REPORT] Step "${st.name}" has ${st.fieldCount} fields — may feel overwhelming`));
  }
  if ((s.deepAbandonRate ?? 0) > 0.20) violations.push(`[MUST REPORT] Deep abandon rate ${pct(s.deepAbandonRate)} — users fill >50% then quit`);

  if (violations.length) {
    lines.push('', `## ⚠ Issues to Report (${violations.length} total) — call report_insight once per item:`);
    violations.forEach((v, i) => lines.push(`${i + 1}. ${v}`));
  }

  return lines.join('\n');
}

// ── Claude-powered insight generation ────────────────────────────────────────

async function callBedrockRuntime(model, body) {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
  const region = process.env.AWS_REGION || 'us-east-1';
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/invoke`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', ...body }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err}`);
  }
  return res.json();
}

async function generateClaudeInsights(analysis, resolvedFixes = []) {
  const bedrockToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
  const model = process.env.BEDROCK_MODEL || process.env.ANTHROPIC_MODEL
    || (bedrockToken ? 'us.anthropic.claude-sonnet-4-6' : 'claude-opus-4-7');

  const client = bedrockToken ? null : new Anthropic();

  console.log(`Generating insights via ${bedrockToken ? `Bedrock Runtime (${model})` : 'Anthropic API'}`);

  const systemPrompt = `You are a senior UX analyst generating insight cards for a form analytics dashboard.

Analyse the session data and produce a JSON array of insight objects. Each object must have exactly these fields:
- "fields": string[] — field names this insight covers. Use [] for session-level issues (errors, rage clicks, form design).
- "fieldDetails": array of { "field": string, "priority": "high"|"medium"|"low", "stat": string } — one entry per field with its key metric. Use [] for session-level insights.
- "insight": string — 2–3 sentences describing WHAT the data shows. For errors, always cite: how many sessions were affected, the total event count, the per-session average (e.g. "firing 19× per session on average"), and the exact error message or endpoint. For field issues, cite the field name, step name, and the exact metric. Be specific — name the field, the step, the button.
- "fix": string — specific actionable change. Name the exact field or button. Say precisely what to add, remove, or change. Not generic advice.
- "why": string — one sentence: why this fix improves the specific metric you cited.
- "priority": "high" | "medium" | "low"

Ordering — always output cards in this exact sequence:
1. JS errors / uncaught exceptions — MANDATORY if jsErrors > 0
2. API / network errors — MANDATORY if apiErrors > 0
3. Suspected crashes — MANDATORY if suspectedCrashes > 0
4. Disabled button clicks and rage clicks — MANDATORY if disabledClicks/totalSessions > 0.15 or rageClicks/totalSessions > 0.10
5. Step thrash — MANDATORY if stepThrash > 0 (name the step pair)
6. Performance issues — MANDATORY if poorLcp/totalSessions > 0.10 or longTasks > 0
7. Storage quota errors — MANDATORY if storageQuota > 0
8. Abandonment hotspots — MANDATORY for every step in abandonmentByStep with count > 0 (name the step and last field)
9. Field-level issues — dropOffRate > 0.10, avgErrorCount > 0.5, avgVisitCount > 1.5, skipRate > 0.2, labelCopyRate > 0.2, visibilityRate < 0.5
10. Overwhelming steps — steps with excessive field counts

NEVER generate cards for:
- Missing progress indicators
- Missing placeholders or hint text
- Idle time on fields (avgIdleTimeMs)
- Bounce rate
- Deep abandon rate unless > 0.40

Rules:
- Cover EVERY [MUST REPORT] item in the violations list. Do not skip any.
- Errors (JS, API, disabled clicks, rage clicks) must always appear first — even if there is only 1 session.
- Group fields that share the exact same root cause and fix into one card.
- Do NOT invent numbers — only use figures from the provided data.
- Output ONLY a valid JSON array. No markdown fences, no explanation text, no preamble.`;

  const resolvedSection = resolvedFixes?.length
    ? `\n\n## Already Resolved Issues — do NOT generate cards for these:\n${resolvedFixes.map((f) => `- ${f.field}: ${f.fix}`).join('\n')}`
    : '';

  const userMessage = `Generate UX insight cards for the following form session data. Output a JSON array only.\n\n${formatAnalysisForClaude(analysis)}${resolvedSection}`;

  const body = {
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };

  const response = bedrockToken
    ? await callBedrockRuntime(model, body)
    : await client.messages.create({ model, ...body });

  const text = response.content.find((b) => b.type === 'text')?.text || '[]';
  console.log(`Response stop_reason: ${response.stop_reason}, output length: ${text.length} chars`);

  // Extract JSON array from the response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    console.warn('Claude did not return a JSON array — raw response:', text.slice(0, 300));
    return [];
  }

  let insights;
  let jsonStr = match[0];
  try {
    insights = JSON.parse(jsonStr);
  } catch {
    // Response was truncated mid-JSON — recover completed objects only
    console.warn('JSON truncated, attempting recovery...');
    try {
      // Strip everything after the last complete object (ends with "}")
      const lastClose = jsonStr.lastIndexOf('},');
      if (lastClose !== -1) jsonStr = `${jsonStr.slice(0, lastClose + 1)}]`;
      insights = JSON.parse(jsonStr);
      console.log(`Recovered ${insights.length} insights from truncated response`);
    } catch (err2) {
      console.warn('Failed to recover truncated JSON:', err2.message);
      return [];
    }
  }

  // Ensure required fields exist on each card
  insights = insights.filter(
    (i) => i && typeof i.insight === 'string' && typeof i.fix === 'string' && i.priority,
  ).map((i) => ({
    fields: i.fields || [],
    fieldDetails: i.fieldDetails || [],
    insight: i.insight,
    fix: i.fix,
    why: i.why || '',
    priority: i.priority,
  }));

  console.log(`Total insights generated: ${insights.length}`);
  const order = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => order[a.priority] - order[b.priority]);
  return insights;
}

// ── Rule-based fallback (used ONLY when ANTHROPIC_API_KEY is not set) ─────────

const FIELD_RULES = [
  {
    match: (f) => f.labelCopyRate > 0.2,
    stat: (f) => `${(f.labelCopyRate * 100).toFixed(0)}% label copied`,
    insight: (f) => `${(f.labelCopyRate * 100).toFixed(0)}% of sessions copied this field's label — users searched for its meaning.`,
    groupInsight: (d) => `Users copied the labels of ${d.length} fields to look up their meaning — these labels are unclear.`,
    fix: 'Rewrite the label in plain language and add a short hint explaining exactly what to enter (e.g. "National Insurance number — format: AB 12 34 56 C").',
    why: 'When users copy a label they are searching elsewhere. Clarifying in-place removes that friction.',
    priority: (f) => (f.labelCopyRate > 0.4 ? 'high' : 'medium'),
  },
  {
    match: (f) => f.avgIdleTimeMs > 8000 && f.meta && !f.meta.hasPlaceholder && !f.meta.hasDescription,
    stat: (f) => `${(f.avgIdleTimeMs / 1000).toFixed(0)}s idle, no placeholder`,
    insight: (f) => `Users paused ${(f.avgIdleTimeMs / 1000).toFixed(0)}s on "${f.field}" — there is no placeholder or hint telling them what to enter.`,
    groupInsight: (d) => `${d.length} fields have high idle time and no placeholder or description — users are unsure what format is expected.`,
    fix: (f) => `Add a placeholder to the "${f.field}" field showing a real example of what to enter (e.g. the expected format or a sample value).`,
    why: 'A placeholder gives users an immediate example without needing to read separate help text.',
    priority: (f) => (f.avgIdleTimeMs > 20000 ? 'high' : 'medium'),
  },
  {
    match: (f) => f.avgIdleTimeMs > 8000,
    stat: (f) => `${(f.avgIdleTimeMs / 1000).toFixed(0)}s idle`,
    insight: (f) => `Users paused ${(f.avgIdleTimeMs / 1000).toFixed(0)}s on average — they are unsure what to enter.`,
    groupInsight: (d) => `Users paused 8+ seconds on ${d.length} fields — they are unsure what each expects.`,
    fix: 'Add a placeholder example or helper text showing the expected format (e.g. "DD/MM/YYYY" or "AB 12 34 56 C").',
    why: 'Concrete examples reduce hesitation and idle time.',
    priority: (f) => (f.avgIdleTimeMs > 20000 ? 'high' : 'medium'),
  },
  {
    match: (f) => f.avgErrorCount > 0.5 && f.meta && !f.meta.hasPlaceholder && !f.meta.hasDescription,
    stat: (f) => `${f.avgErrorCount.toFixed(1)} errors/visit, no hint`,
    insight: (f) => `"${f.field}" gets ${f.avgErrorCount.toFixed(1)} validation errors per visit and has no placeholder or description — users can only discover the required format by failing.`,
    groupInsight: (d) => `${d.length} fields have repeated errors and no format hints — users learn the requirements only by failing.`,
    fix: (f) => `Add a placeholder or description to "${f.field}" showing the required format before the user submits (e.g. "Must be 8 digits" or "Format: AB-123456").`,
    why: 'Revealing format requirements upfront prevents avoidable validation failures.',
    priority: (f) => (f.avgErrorCount > 2 ? 'high' : 'medium'),
  },
  {
    match: (f) => f.avgErrorCount > 0.5,
    stat: (f) => `${f.avgErrorCount.toFixed(1)} errors/visit`,
    insight: (f) => `Users trigger ${f.avgErrorCount.toFixed(1)} validation errors per visit — constraints are not shown upfront.`,
    groupInsight: (d) => `Users hit repeated errors on ${d.length} fields — validation constraints are hidden until submission.`,
    fix: 'Display the format requirement before submission (e.g. "Must be 6 digits — no spaces") rather than only on error.',
    why: 'Showing constraints upfront prevents repeated failed attempts.',
    priority: (f) => (f.avgErrorCount > 2 ? 'high' : 'medium'),
  },
  {
    match: (f) => f.dropOffRate > 0.1,
    stat: (f) => `${(f.dropOffRate * 100).toFixed(0)}% drop-off`,
    insight: (f) => `${(f.dropOffRate * 100).toFixed(0)}% of sessions drop off at this field.`,
    groupInsight: (d) => `${d.length} fields are abandonment points where users exit the form.`,
    fix: 'Consider making this field optional, moving it later, or explaining why the information is required.',
    why: 'Reducing friction at drop-off fields directly improves overall completion rate.',
    priority: (f) => (f.dropOffRate > 0.3 ? 'high' : 'medium'),
  },
  {
    match: (f) => f.copyPasteRate > 0.3,
    stat: (f) => `${(f.copyPasteRate * 100).toFixed(0)}% copy-pasted`,
    insight: (f) => `${(f.copyPasteRate * 100).toFixed(0)}% of users copy-pasted — they had to look up the value elsewhere.`,
    groupInsight: (d) => `${d.length} fields have high copy-paste rates — users leave the form to fetch values.`,
    fix: 'Provide a lookup tool or a direct link to where users can find this information without leaving the form.',
    why: 'Removing context-switching keeps users focused and reduces abandonment.',
    priority: () => 'low',
  },
  {
    match: (f) => f.visibilityRate < 0.5,
    stat: (f) => `${(f.visibilityRate * 100).toFixed(0)}% visible`,
    insight: (f) => `Only ${(f.visibilityRate * 100).toFixed(0)}% of sessions scrolled this field into view — most never reach it.`,
    groupInsight: (d) => `${d.length} fields are rarely seen — most users never scroll down to them.`,
    fix: 'Move this field earlier or reduce the amount of content above it.',
    why: 'Fields users never see cannot be completed — form length is a hidden drop-off driver.',
    priority: () => 'medium',
  },
  {
    match: (f) => f.avgVisitCount > 1.5,
    stat: (f) => `${f.avgVisitCount.toFixed(1)}× revisited`,
    insight: (f) => `Users return to this field ${f.avgVisitCount.toFixed(1)} times — they are not confident in their first answer.`,
    groupInsight: (d) => `Users revisit ${d.length} fields multiple times — they second-guess their answers.`,
    fix: 'Add inline validation so users get immediate confirmation when their input is correct.',
    why: 'Real-time confirmation reduces second-guessing.',
    priority: (f) => (f.avgVisitCount > 2.5 ? 'high' : 'medium'),
  },
  {
    match: (f) => f.skipRate > 0.2,
    stat: (f) => `${(f.skipRate * 100).toFixed(0)}% skipped it`,
    insight: (f) => `${(f.skipRate * 100).toFixed(0)}% of sessions focused this required field and left it empty — users don't think they need to fill it.`,
    groupInsight: (d) => `${d.length} required fields are frequently skipped empty — users don't understand why they are mandatory.`,
    fix: 'Add a short explanation of why this field is required (e.g. "Needed to verify your identity"). Consider making it optional if it is not strictly necessary.',
    why: "Users skip required fields when the reason isn't obvious — explaining it reduces resistance.",
    priority: (f) => (f.skipRate > 0.4 ? 'high' : 'medium'),
  },
  {
    match: (f) => (f.meta?.labelLength ?? 0) > 80,
    stat: (f) => `${f.meta.labelLength}-char label`,
    insight: (f) => `The label for "${f.field}" is ${f.meta.labelLength} characters long — long labels slow users down and are often skimmed or misread.`,
    groupInsight: (d) => `${d.length} fields have labels over 80 characters — long labels increase cognitive load and cause hesitation.`,
    fix: (f) => `Shorten the "${f.field}" label to 5–8 words. Move the extra detail into a description/hint text below the input.`,
    why: 'Short labels are scanned in under 200ms. Long labels cause users to slow down, skim, or misunderstand the question.',
    priority: (f) => ((f.meta?.labelLength ?? 0) > 150 ? 'high' : 'medium'),
  },
  {
    match: (f) => !!(f.meta?.isSensitive && !f.meta?.hasDescription && f.dropOffRate > 0.05),
    stat: (f) => `sensitive field, ${(f.dropOffRate * 100).toFixed(0)}% drop-off`,
    insight: (f) => `"${f.field}" collects sensitive personal or financial data with no explanation of why it is needed — ${(f.dropOffRate * 100).toFixed(0)}% of users abandon here.`,
    groupInsight: (d) => `${d.length} sensitive fields (personal or financial data) have no explanation of why the data is needed — users hesitate without context.`,
    fix: (f) => `Add a description below "${f.field}" explaining why this data is required and how it will be used (e.g. "Used to verify your identity — never shared with third parties").`,
    why: 'Users share sensitive data more readily when the purpose is explained clearly upfront.',
    priority: (f) => (f.dropOffRate > 0.2 ? 'high' : 'medium'),
  },
];

// Parallel map to FIELD_RULES — identifies the primary metric/threshold/direction
// used by each rule so detectRegressions() can compare current vs snapshot values.
const REGRESSION_METRICS = [
  { metric: 'labelCopyRate',  threshold: 0.2,  direction: 'above' }, // rule 0
  { metric: 'avgIdleTimeMs',  threshold: 8000, direction: 'above' }, // rule 1
  { metric: 'avgIdleTimeMs',  threshold: 8000, direction: 'above' }, // rule 2
  { metric: 'avgErrorCount',  threshold: 0.5,  direction: 'above' }, // rule 3
  { metric: 'avgErrorCount',  threshold: 0.5,  direction: 'above' }, // rule 4
  { metric: 'dropOffRate',    threshold: 0.1,  direction: 'above' }, // rule 5
  { metric: 'copyPasteRate',  threshold: 0.3,  direction: 'above' }, // rule 6
  { metric: 'visibilityRate', threshold: 0.5,  direction: 'below' }, // rule 7
  { metric: 'avgVisitCount',  threshold: 1.5,  direction: 'above' }, // rule 8
  { metric: 'skipRate',       threshold: 0.2,  direction: 'above' }, // rule 9
  { metric: 'dropOffRate',    threshold: 0.1,  direction: 'above' }, // rule 10 — long label (static; regression = drop-off returns after rewrite)
  { metric: 'dropOffRate',    threshold: 0.05, direction: 'above' }, // rule 11 — sensitive field without context
];

function formatMetricStat(metric, value) {
  if (metric.includes('Ms')) return `${(value / 1000).toFixed(1)}s`;
  return `${(value * 100).toFixed(0)}%`;
}

const SESSION_REGRESSION_CHECKS = [
  { metric: 'completionRate', label: 'completion rate', direction: 'below', threshold: 0.1, worseFactor: 0.8 },
  { metric: 'dropOffRate', label: 'drop-off rate', direction: 'above', threshold: 0.5, worseFactor: 1.3 },
  { metric: 'jsErrorRate', label: 'JS error rate', direction: 'above', threshold: 0.1, worseFactor: 1.5 },
  { metric: 'apiErrorRate', label: 'API error rate', direction: 'above', threshold: 0.1, worseFactor: 1.5 },
  { metric: 'crashRate', label: 'crash rate', direction: 'above', threshold: 0.05, worseFactor: 2.0 },
];

function detectSessionRegressions(analysis, resolvedFixes) {
  const regressions = [];
  const s = analysis.summary;
  const n = s.totalSessions || 1;
  const current = {
    completionRate: s.completionRate,
    dropOffRate: s.dropOffRate,
    jsErrorRate: (s.errors?.jsErrors || 0) / n,
    apiErrorRate: (s.errors?.apiErrors || 0) / n,
    crashRate: (s.errors?.suspectedCrashes || 0) / n,
  };

  for (const fix of resolvedFixes) {
    if (!fix.snapshot?.__session__) continue;
    const snap = fix.snapshot.__session__;
    const regressedChecks = SESSION_REGRESSION_CHECKS.filter(({ metric, direction, threshold, worseFactor }) => {
      const cur = current[metric];
      const snapVal = snap[metric];
      if (snapVal == null || cur == null) return false;
      const aboveThreshold = direction === 'above' ? cur > threshold : cur < threshold;
      const worsenedFromSnap = direction === 'above' ? cur > snapVal * worseFactor : cur < snapVal * worseFactor;
      return aboveThreshold && worsenedFromSnap;
    });
    if (!regressedChecks.length) continue;

    const primary = regressedChecks[0];
    const pct = (v) => `${(v * 100).toFixed(1)}%`;
    regressions.push({
      fields: [],
      fieldDetails: [],
      insight: `Session-level regression: ${primary.label} is ${pct(current[primary.metric])} — worse than ${pct(snap[primary.metric])} when this fix was resolved.${regressedChecks.length > 1 ? ` Also regressed: ${regressedChecks.slice(1).map((c) => c.label).join(', ')}.` : ''}`,
      fix: fix.fix,
      why: 'A session-level metric has regressed beyond its baseline since the fix was deployed.',
      priority: 'high',
      isRegression: true,
      regressionDetail: { metric: primary.metric, snapshotValue: snap[primary.metric], currentValue: current[primary.metric] },
    });
  }
  return regressions;
}

export function detectRegressions(analysis, resolvedFixes) {
  const fieldStatsMap = new Map(analysis.fields.map((f) => [f.field, f]));
  const regressions = [...detectSessionRegressions(analysis, resolvedFixes)];

  for (const fix of resolvedFixes) {
    if (!fix.snapshot) continue;
    if (fix.field.startsWith('__session__')) continue;

    const fieldNames = fix.field.split(',');
    const regressedFields = [];

    for (const fieldName of fieldNames) {
      const current = fieldStatsMap.get(fieldName);
      const snap = fix.snapshot?.[fieldName];
      if (!current || !snap) continue;

      const ruleIdx = FIELD_RULES.findIndex((r) => r.match(current));
      if (ruleIdx === -1) continue;

      const { metric, threshold, direction } = REGRESSION_METRICS[ruleIdx];
      const currentVal = current[metric];
      const snapVal = snap[metric];
      if (snapVal == null) continue;

      const aboveThreshold = direction === 'above' ? currentVal > threshold : currentVal < threshold;
      const worseThanSnapshot = direction === 'above'
        ? currentVal > snapVal * 1.5
        : currentVal < snapVal / 1.5;

      if (aboveThreshold && worseThanSnapshot) {
        regressedFields.push({
          fieldName, metric, currentVal, snapVal, threshold,
          rule: FIELD_RULES[ruleIdx],
        });
      }
    }

    if (!regressedFields.length) continue;

    const primary = regressedFields[0];
    const priority = primary.rule.priority(fieldStatsMap.get(primary.fieldName));
    regressions.push({
      fields: fieldNames,
      fieldDetails: regressedFields.map((rf) => ({
        field: rf.fieldName,
        priority: rf.rule.priority(fieldStatsMap.get(rf.fieldName)),
        stat: `${formatMetricStat(rf.metric, rf.currentVal)} ${rf.metric.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`,
      })),
      insight: `${primary.fieldName} — a previously resolved issue has returned. ${formatMetricStat(primary.metric, primary.currentVal)} now vs ${formatMetricStat(primary.metric, primary.snapVal)} when it was marked resolved.`,
      fix: fix.fix,
      why: 'A deployed fix has regressed — the metric is above threshold again and significantly worse than at resolution time.',
      priority,
      isRegression: true,
      regressionDetail: {
        metric: primary.metric,
        snapshotValue: primary.snapVal,
        currentValue: primary.currentVal,
        threshold: primary.threshold,
      },
    });
  }

  return regressions;
}

function insightKey(insight) {
  return insight.fields.length > 0
    ? insight.fields.slice().sort().join(',')
    : `__session__${insight.fix.slice(0, 60)}`;
}

export function generateRuleBasedInsights(analysis, resolvedFixes = [], sessions = []) {
  const resolvedKeys = new Set(resolvedFixes.map((f) => f.field));
  const order = { high: 0, medium: 1, low: 2 };
  const ruleGroups = new Map();

  analysis.fields.forEach((f) => {
    const matched = FIELD_RULES.filter((r) => r.match(f));
    if (!matched.length) return;
    const rule = matched.sort((a, b) => order[a.priority(f)] - order[b.priority(f)])[0];
    const idx = FIELD_RULES.indexOf(rule);
    if (!ruleGroups.has(idx)) ruleGroups.set(idx, []);
    ruleGroups.get(idx).push({ field: f.field, priority: rule.priority(f), stat: rule.stat(f) });
  });

  const insights = [];

  ruleGroups.forEach((fieldDetails, idx) => {
    const rule = FIELD_RULES[idx];
    const sorted = [...fieldDetails].sort((a, b) => order[a.priority] - order[b.priority]);
    const singleField = analysis.fields.find((f) => f.field === fieldDetails[0].field);
    const fixText = typeof rule.fix === 'function'
      ? (fieldDetails.length === 1 ? rule.fix(singleField) : rule.fix(singleField))
      : rule.fix;
    insights.push({
      fields: fieldDetails.map((d) => d.field),
      fieldDetails,
      insight: fieldDetails.length === 1 ? rule.insight(singleField) : rule.groupInsight(fieldDetails),
      fix: fixText,
      why: rule.why,
      priority: sorted[0].priority,
    });
  });

  // Session-level form design signals
  const { errors, totalSessions, formDesign, deepAbandonRate } = analysis.summary;

  if (formDesign) {
    if (!formDesign.hasProgressIndicator && totalSessions > 0) {
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: 'This form has no progress indicator — users cannot tell how long it will take, making abandonment more likely.',
        fix: 'Add a step counter ("Step 2 of 4") or a progress bar at the top of the form so users know what to expect before they start.',
        why: "Uncertainty about form length is one of the top reasons users abandon before starting.",
        priority: 'medium',
      });
    }

    if (formDesign.overwhelmingSteps?.length > 0) {
      const worst = formDesign.overwhelmingSteps.sort((a, b) => b.fieldCount - a.fieldCount)[0];
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `"${worst.name}" has ${worst.fieldCount} fields on one screen — this may feel overwhelming and cause users to abandon before starting.`,
        fix: `Split "${worst.name}" into two shorter steps, or group related fields visually with subheadings so the page looks less dense.`,
        why: 'Forms that look long at first glance have higher scan-only rates — users abandon before they fill a single field.',
        priority: worst.fieldCount >= 8 ? 'high' : 'medium',
      });
    }

    if (formDesign.requiredRatio > 0.7 && totalSessions > 0) {
      const pct = (formDesign.requiredRatio * 100).toFixed(0);
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `${pct}% of all fields are marked required (${formDesign.requiredFieldCount} of ${formDesign.totalFieldCount}) — forms where most fields are required feel demanding and increase early abandonment.`,
        fix: 'Review each required field and ask whether the form truly cannot be processed without it. Mark only the minimum set as required and collect optional data after submission or on a follow-up page.',
        why: 'Every required field adds friction — reducing mandatory fields is one of the fastest ways to improve completion rates.',
        priority: formDesign.requiredRatio > 0.9 ? 'high' : 'medium',
      });
    }

    if (formDesign.hasAccountCreation) {
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: 'The form requires account creation (password field detected in the first step) — this is a major abandonment trigger for new users.',
        fix: 'Allow users to complete the form as a guest first. Offer account creation as an optional step on the thank-you page after submission.',
        why: 'Forced registration before value delivery loses a large portion of users who are not yet committed.',
        priority: 'high',
      });
    }
  }

  const bounceRate = analysis.summary.bounceRate ?? 0;
  if (bounceRate > 0.15) {
    insights.push({
      fields: [],
      fieldDetails: [],
      insight: `${(bounceRate * 100).toFixed(0)}% of sessions left within 15 seconds having scrolled less than a quarter of the page — these users likely landed here by mistake or the page didn't match what they expected.`,
      fix: 'Check that the page title, meta description, and any links pointing here accurately describe this form. Add a clear one-line summary at the very top explaining what the form is for and who should fill it.',
      why: 'Users who arrive by mistake cannot be converted — reducing misdirected traffic improves all other metrics.',
      priority: bounceRate > 0.35 ? 'high' : 'medium',
    });
  }

  if (deepAbandonRate > 0.2) {
    insights.push({
      fields: [],
      fieldDetails: [],
      insight: `${(deepAbandonRate * 100).toFixed(0)}% of sessions filled more than half the form but did not submit — these users were invested but something stopped them at the end.`,
      fix: 'Add a "Save and continue later" option that emails users a link to resume their filled form. Review the final step for unexpected fields or a confusing declaration.',
      why: 'Users who filled 50%+ have shown intent — a resume link converts them without requiring them to start over.',
      priority: deepAbandonRate > 0.4 ? 'high' : 'medium',
    });
  }

  // Session-level frustration signals
  if (errors && totalSessions) {
    const rageRate = (errors.rageClicks || 0) / totalSessions;
    if (rageRate > 0.1) {
      const label = errors.topRageClick?.label || 'a button';
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `${(rageRate * 100).toFixed(0)}% of sessions rage-clicked "${label}" — users clicked repeatedly because the UI gave no response.`,
        fix: `Add a loading spinner immediately after the first click on "${label}". Show a tooltip on the disabled state listing exactly which fields must be completed.`,
        why: 'Repeated clicks with no feedback are a leading cause of frustrated abandonment.',
        priority: rageRate > 0.3 ? 'high' : 'medium',
      });
    }
    const disabledRate = (errors.disabledClicks || 0) / totalSessions;
    if (disabledRate > 0.15) {
      const disabledBtn = errors.topDisabledClick?.label || 'a disabled button';
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `${(disabledRate * 100).toFixed(0)}% of sessions clicked "${disabledBtn}" while it was disabled — users could not tell why they were blocked.`,
        fix: `Show an inline validation summary near "${disabledBtn}" listing incomplete required fields. Highlight those fields when the disabled button is clicked.`,
        why: "Users who can't identify the blocking issue will abandon rather than search the form.",
        priority: disabledRate > 0.4 ? 'high' : 'medium',
      });
    }
    const apiErrRate = (errors.apiErrors || 0) / totalSessions;
    if (apiErrRate > 0.05) {
      const apiTarget = errors.topApiError?.label || 'an API call';
      const topApiStatus = Object.entries(errors.apiErrorStatusBreakdown || {}).sort((a, b) => b[1] - a[1])[0] || null;
      const apiSig = dominantErrorSignature(sessions, 'api_error');
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `${(apiErrRate * 100).toFixed(0)}% of sessions hit an API failure near "${apiTarget}"${topApiStatus ? ` — top status: ${topApiStatus[0]} (${topApiStatus[1]} events)` : ''}.`,
        fix: topApiStatus
          ? `Fix the ${topApiStatus[0]} API failure triggered near "${apiTarget}" first. Add a user-facing retry message so users are not left stuck when the call fails.`
          : `Investigate the API failure triggered near "${apiTarget}". Add a user-facing error message with a retry option so users are not left stuck when the call fails.`,
        why: 'Silent API failures leave users in an unknown state — they cannot tell whether to retry or start over.',
        priority: apiErrRate > 0.2 ? 'high' : 'medium',
        errorSignature: apiSig?.signature || null,
        errorLabel: apiSig?.label || null,
      });
    }
    const jsErrRate = (errors.jsErrors || 0) / totalSessions;
    if (jsErrRate > 0.05) {
      const jsSig = dominantErrorSignature(sessions, 'js_error');
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `${(jsErrRate * 100).toFixed(0)}% of sessions hit a JavaScript runtime error — some users had a broken experience.`,
        fix: 'Check browser console logs for the error source. Add error boundaries around conditional rules and validation so a single failure does not freeze the form.',
        why: 'A silent JS error can disable submit or navigation — leaving users stuck with no explanation.',
        priority: jsErrRate > 0.2 ? 'high' : 'medium',
        errorSignature: jsSig?.signature || null,
        errorLabel: jsSig?.label || null,
      });
    }

    const consoleErrSessions = sessions.filter((s) => s.events.some((e) => e.type === 'console_error'));
    const consoleErrRate = consoleErrSessions.length / totalSessions;
    if (consoleErrRate > 0.1) {
      const classMap = {};
      consoleErrSessions.forEach((s) => s.events.filter((e) => e.type === 'console_error' && e.errorClass).forEach((e) => {
        classMap[e.errorClass] = (classMap[e.errorClass] || 0) + 1;
      }));
      const topClass = Object.entries(classMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
      const classDiagMap = {
        cors: 'CORS policy blocking API calls',
        null_reference: 'null reference errors in form rules',
        rule_engine: 'rule engine crashes',
        guideBridge_not_ready: 'guideBridge called before initialization',
        csp: 'Content Security Policy violations',
      };
      const classFixMap = {
        cors: 'Add CORS headers to all APIs the form calls. Or proxy requests through the same origin.',
        null_reference: 'Add null checks in custom functions and adaptive form rules before accessing field values.',
        rule_engine: 'Update afb-runtime and audit conditional rules for circular dependencies or invalid expressions.',
        guideBridge_not_ready: 'Use guideBridge.on("bridgeInitializeStart", ...) to wait for the bridge before calling its methods.',
        csp: 'Update the Content-Security-Policy header to allow the blocked resources.',
      };
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `${(consoleErrRate * 100).toFixed(0)}% of sessions logged console errors — most are ${classDiagMap[topClass] || 'unclassified errors'}.`,
        fix: classFixMap[topClass] || 'Check browser console logs for recurring errors and fix the root cause.',
        why: 'Console errors appearing in more than 10% of sessions indicate a systematic bug affecting all users, not an isolated incident.',
        priority: consoleErrRate > 0.3 ? 'high' : 'medium',
        // only fingerprint classified console errors — "unknown" is too generic
        // to match accurately across forms
        errorSignature: topClass !== 'unknown' ? `console:${topClass}` : null,
        errorLabel: topClass !== 'unknown' ? `Console error (${topClass})` : null,
      });
    }

    const submitErrSessions = sessions.filter((s) => s.events.some((e) => e.type === 'form_error' && e.status >= 400));
    if (submitErrSessions.length / totalSessions > 0.05) {
      const topSubmit = errors.topSubmitError;
      const topSubmitStatus = Object.entries(errors.submitErrorStatusBreakdown || {}).sort((a, b) => b[1] - a[1])[0] || null;
      const submitSig = dominantErrorSignature(sessions, 'form_error');
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `${((submitErrSessions.length / totalSessions) * 100).toFixed(0)}% of sessions hit a form API error${topSubmitStatus ? ` — top status: ${topSubmitStatus[0]} (${topSubmitStatus[1]} events)` : ''}${topSubmit ? ` — most common: "${topSubmit.label}" (${topSubmit.count} sessions)` : ''}.`,
        fix: topSubmitStatus
          ? `Fix the ${topSubmitStatus[0]} submit failure first. Check the submission service logs for that status and keep the user on the final screen with a retry option.`
          : topSubmit
            ? `Fix the "${topSubmit.label}" error first — it affects ${topSubmit.count} sessions. Check server logs for the root cause.`
            : 'Check server logs for form submission endpoint errors. Add error boundaries and user-facing retry messages.',
        why: 'API errors after form completion are the most demoralising failure — users filled the whole form and received nothing in return.',
        priority: submitErrSessions.length / totalSessions > 0.15 ? 'high' : 'medium',
        errorSignature: submitSig?.signature || null,
        errorLabel: submitSig?.label || null,
      });
    }

    // Application error MESSAGES shown to the user (form_error with callType
    // 'ui_message' — no HTTP status, but the form told the user something broke).
    // These block completion just as hard as a 500, so surface them too.
    const uiMsgSessions = sessions.filter((s) => s.events.some((e) => e.type === 'form_error' && e.callType === 'ui_message'));
    if (uiMsgSessions.length / totalSessions > 0.05) {
      // most common message text across these sessions
      const msgCounts = {};
      uiMsgSessions.forEach((s) => {
        const seen = new Set();
        s.events.filter((e) => e.type === 'form_error' && e.callType === 'ui_message' && e.statusText).forEach((e) => {
          const m = e.statusText.replace(/Ok$/i, '').trim().slice(0, 120);
          if (!seen.has(m)) { seen.add(m); msgCounts[m] = (msgCounts[m] || 0) + 1; }
        });
      });
      const topMsg = Object.entries(msgCounts).sort((a, b) => b[1] - a[1])[0];
      const rate = uiMsgSessions.length / totalSessions;
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `${(rate * 100).toFixed(0)}% of sessions saw an in-form error message${topMsg ? ` — most common: "${topMsg[0]}" (${topMsg[1]} sessions)` : ''}. This blocks users from proceeding.`,
        fix: topMsg
          ? `Investigate what triggers "${topMsg[0]}". A generic "something went wrong" message with no recovery path forces users to abandon — fix the underlying cause and give a clear next step.`
          : 'Investigate the in-form error messages. Replace generic failure messages with a clear cause and a recovery action so users are not stuck.',
        why: 'An application error shown mid-form is a hard stop — the user cannot continue regardless of how much they have filled, so these directly cap completion rate.',
        priority: rate > 0.15 ? 'high' : 'medium',
        errorSignature: topMsg ? `ui_message:${topMsg[0].toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)}` : null,
        errorLabel: topMsg ? `App error: ${topMsg[0].slice(0, 50)}` : null,
      });
    }

    // Step thrash — back-and-forth wizard navigation
    if ((errors.stepThrash ?? 0) > 0) {
      const thrashRate = errors.stepThrash / totalSessions;
      const stepLabel = errors.topStepThrash?.label ? ` — most between "${errors.topStepThrash.label}"` : '';
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `${(thrashRate * 100).toFixed(0)}% of sessions went back and forth between wizard steps 3 or more times${stepLabel} — users are confused about which step contains what.`,
        fix: 'Add a visible step title and a one-line description of what each step covers. Show a review summary on the final step so users can verify earlier answers without going back.',
        why: 'Step thrashing indicates unclear step boundaries — users lose confidence and often abandon after multiple back-and-forth cycles.',
        priority: thrashRate > 0.25 ? 'high' : 'medium',
      });
    }

    // Slow page load (LCP ≥ 4s)
    if ((errors.poorLcp ?? 0) / totalSessions > 0.10) {
      const lcpRate = errors.poorLcp / totalSessions;
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `${(lcpRate * 100).toFixed(0)}% of sessions experienced a slow page load (LCP ≥ 4s)${errors.avgLcpMs ? ` — average LCP was ${errors.avgLcpMs}ms` : ''}.`,
        fix: 'Audit large images, render-blocking scripts, and third-party embeds on the form page. Defer non-critical scripts and serve images in WebP format.',
        why: 'Every extra second of load time increases abandonment before a field is even filled.',
        priority: lcpRate > 0.30 ? 'high' : 'medium',
      });
    }

    // Suspected tab crashes
    if ((errors.suspectedCrashes ?? 0) > 0) {
      const crashRate = errors.suspectedCrashes / totalSessions;
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `${errors.suspectedCrashes} session${errors.suspectedCrashes > 1 ? 's' : ''} (${(crashRate * 100).toFixed(0)}%) likely crashed — the heartbeat was never cleared normally, indicating the tab was killed or the browser crashed.`,
        fix: 'Enable auto-save on every field change so in-progress data is not lost. Show a "Progress saved" notice periodically to reassure users.',
        why: 'Crashes are unrecoverable without auto-save — users who lose their progress rarely return.',
        priority: crashRate > 0.10 ? 'high' : 'medium',
      });
    }

    // Browser storage quota exceeded
    if ((errors.storageQuota ?? 0) > 0) {
      const quotaRate = errors.storageQuota / totalSessions;
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `${errors.storageQuota} session${errors.storageQuota > 1 ? 's' : ''} (${(quotaRate * 100).toFixed(0)}%) exceeded browser storage limits — progress could not be saved locally for these users.`,
        fix: 'Reduce the amount of data persisted in localStorage. Store only field values, not full session event logs.',
        why: 'Users whose progress cannot be saved are forced to start over if they close or reload the tab.',
        priority: quotaRate > 0.10 ? 'high' : 'medium',
      });
    }
  }

  // Return rate — users coming back after abandonment
  const returnRate = analysis.summary.returnRate ?? 0;
  if (returnRate > 0.20 && totalSessions > 0) {
    insights.push({
      fields: [],
      fieldDetails: [],
      insight: `${(returnRate * 100).toFixed(0)}% of sessions returned to the form after abandoning — users want to complete it but cannot finish in one sitting.`,
      fix: 'Add a "Save and continue later" button that emails users a link to their partially filled form.',
      why: 'Users who return have already shown intent — a resume link converts them without requiring a fresh start.',
      priority: returnRate > 0.35 ? 'high' : 'medium',
    });
  }

  // Scan-only — scrolled through but never filled a field
  const scanOnlyRate = analysis.summary.scanOnlyRate ?? 0;
  if (scanOnlyRate > 0.30 && totalSessions > 0) {
    insights.push({
      fields: [],
      fieldDetails: [],
      insight: `${(scanOnlyRate * 100).toFixed(0)}% of sessions scrolled through the form without filling a single field — the form may look too long or complex at first glance.`,
      fix: 'Add a short summary at the top listing what users will need (documents, info, estimated time) before they start. Reduce the visual density of the first screen.',
      why: "Users who scroll without filling have already decided the form is too difficult — a 'what you need' checklist sets expectations and reduces this pre-abandonment.",
      priority: scanOnlyRate > 0.50 ? 'high' : 'medium',
    });
  }

  // Abandonment hotspots by wizard step (top 3 only)
  const { abandonmentByStep } = analysis.summary;
  if (abandonmentByStep && totalSessions > 0) {
    Object.entries(abandonmentByStep)
      .filter(([, data]) => data.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .forEach(([step, data]) => {
        const abandonRate = data.count / totalSessions;
        const topField = Object.entries(data.lastFields || {}).sort((a, b) => b[1] - a[1])[0];
        insights.push({
          fields: topField ? [topField[0]] : [],
          fieldDetails: topField ? [{ field: topField[0], priority: abandonRate > 0.30 ? 'high' : 'medium', stat: `${data.count} abandonments` }] : [],
          insight: `${data.count} user${data.count > 1 ? 's' : ''} (${(abandonRate * 100).toFixed(0)}%) abandoned in step "${step}"${topField ? ` — most last touched the "${topField[0]}" field` : ''}.`,
          fix: topField
            ? `Review the "${topField[0]}" field in step "${step}" — consider adding helper text, making it optional, or splitting the step into two shorter ones.`
            : `Review step "${step}" for fields that may be confusing or missing format hints.`,
          why: 'The last field a user touches before abandoning is typically the blocking field — fixing it yields the highest completion lift.',
          priority: abandonRate > 0.30 ? 'high' : 'medium',
        });
      });
  }

  // Mobile-specific abandonment — flag if mobile completion rate is significantly below desktop
  const db = analysis.summary.deviceBreakdown;
  if (db) {
    const mobile = db.mobile;
    const desktop = db.desktop;
    if (mobile && desktop && mobile.total >= 10 && desktop.total >= 10) {
      const mobileRate = mobile.completed / mobile.total;
      const desktopRate = desktop.completed / desktop.total;
      if (desktopRate > 0 && mobileRate < desktopRate * 0.7) {
        insights.push({
          fields: [],
          fieldDetails: [],
          insight: `Mobile completion rate is ${(mobileRate * 100).toFixed(0)}% vs ${(desktopRate * 100).toFixed(0)}% on desktop — mobile users are abandoning at a disproportionately higher rate.`,
          fix: 'Test the form on a phone. Check for fields with small tap targets, date pickers without mobile-friendly inputs, file upload fields without camera access, and multi-column layouts that break on small screens.',
          why: 'Mobile UX issues are invisible on desktop — a device-specific gap this large usually indicates layout or input type problems.',
          priority: mobileRate < desktopRate * 0.5 ? 'high' : 'medium',
        });
      }
    }
  }

  // Step-length imbalance — flag if one wizard step has significantly more required fields than average
  if (analysis.summary.formDesign?.overwhelmingSteps?.length > 0) {
    const steps = analysis.summary.formDesign.overwhelmingSteps;
    const avgFields = steps.reduce((s, st) => s + st.fieldCount, 0) / steps.length;
    const outliers = steps.filter((st) => st.fieldCount > avgFields * 1.5 && st.fieldCount > avgFields + 3);
    outliers.forEach((st) => {
      const alreadyReported = insights.some((i) => i.insight.includes(st.name));
      if (alreadyReported) return;
      insights.push({
        fields: [],
        fieldDetails: [],
        insight: `"${st.name}" has ${st.fieldCount} fields — ${((st.fieldCount / avgFields - 1) * 100).toFixed(0)}% more than the average step. This imbalance makes the form feel unevenly paced.`,
        fix: `Move some fields from "${st.name}" to adjacent steps or create a new intermediate step. Aim for no more than 5 fields per screen.`,
        why: 'Uneven form pacing causes abandonment spikes at overloaded steps — users who reach a dense step after easy ones feel blindsided.',
        priority: st.fieldCount >= 10 ? 'high' : 'medium',
      });
    });
  }

  insights.sort((a, b) => order[a.priority] - order[b.priority]);
  return insights.filter((i) => !resolvedKeys.has(insightKey(i)));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateInsights(analysis, resolvedFixes = [], sessions = []) {
  const hasCredentials = process.env.ANTHROPIC_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!hasCredentials) {
    console.log('No API credentials (ANTHROPIC_API_KEY or AWS_BEARER_TOKEN_BEDROCK) — using rule-based fallback');
    return { insights: generateRuleBasedInsights(analysis, resolvedFixes, sessions), source: 'rules' };
  }

  try {
    const insights = await generateClaudeInsights(analysis, resolvedFixes);
    if (insights.length) return { insights, source: 'claude-api' };
    console.warn('Claude returned no insights — falling back to rules');
    return { insights: generateRuleBasedInsights(analysis, resolvedFixes, sessions), source: 'rules' };
  } catch (err) {
    console.error('Claude insights error — falling back to rules:', err.message);
    return { insights: generateRuleBasedInsights(analysis, resolvedFixes, sessions), source: 'rules' };
  }
}
