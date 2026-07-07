// ── Knowledge Base — learns from past incidents, recommends proven fixes ───────
//
// When a fix is marked resolved, we record what actually worked, keyed by a
// PRECISE error signature. When the exact same error appears again on any form,
// we recommend the fix that worked before — turning one-off fixes into reusable
// organisational knowledge.
//
// Matching is deliberately strict (see signatureForError) so we only ever
// recommend a fix for genuinely the same error, never a loose keyword match.

import fs from 'fs';
import path from 'path';

const kbPath = path.resolve('./server/data/knowledge-base.json');

// Normalise an endpoint URL to a stable path: drop origin + query string, and
// collapse numeric / UUID path segments to ":id" so /api/users/123 and
// /api/users/456 are recognised as the same endpoint.
function normalizeEndpoint(url) {
  if (!url) return '';
  let pathPart = url;
  try {
    pathPart = new URL(url, 'http://x').pathname;
  } catch {
    [pathPart] = String(url).split('?');
  }
  return pathPart
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id')
    .replace(/\/+$/, '') || '/';
}

// Strip the volatile parts of a JS error message (numbers, quotes, line:col,
// hex addresses) so the same bug produces the same signature every time.
function normalizeMessage(msg) {
  return String(msg || '')
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/\b0x[0-9a-f]+\b/g, '')
    .replace(/:\d+:\d+/g, '')
    .replace(/\bline \d+\b/g, '')
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

// PRECISE signature for a single error event. Returns null for events we can't
// fingerprint accurately (we'd rather match nothing than match wrongly).
export function signatureForError(event) {
  if (!event) return null;
  if (event.type === 'api_error' || event.type === 'form_error') {
    const status = event.status || 0;
    const endpoint = normalizeEndpoint(event.url);
    if (!status && !endpoint) return null;
    return {
      signature: `api:${status}:${endpoint}`,
      label: `HTTP ${status || '?'} on ${endpoint || 'an endpoint'}`,
    };
  }
  if (event.type === 'js_error') {
    const kind = (event.errorType || 'Error');
    const msg = normalizeMessage(event.message);
    if (!msg) return null;
    return { signature: `js:${kind}:${msg}`, label: `${kind}: ${msg}` };
  }
  if (event.type === 'console_error') {
    const cls = event.errorClass || normalizeMessage(event.message);
    if (!cls) return null;
    return { signature: `console:${cls}`, label: `Console error (${cls})` };
  }
  return null;
}

// The most common error signature of a given type across a set of sessions —
// used to fingerprint an aggregate error insight ("12% of sessions hit a 404").
export function dominantErrorSignature(sessions, type) {
  const counts = new Map();
  const meta = new Map();
  (sessions || []).forEach((s) => (s.events || []).forEach((e) => {
    if (e.type !== type) return;
    const sig = signatureForError(e);
    if (!sig) return;
    counts.set(sig.signature, (counts.get(sig.signature) || 0) + 1);
    if (!meta.has(sig.signature)) meta.set(sig.signature, sig);
  }));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? meta.get(top[0]) : null;
}

function readKb() {
  if (!fs.existsSync(kbPath)) return [];
  try { return JSON.parse(fs.readFileSync(kbPath, 'utf-8')); } catch { return []; }
}

function writeKb(entries) {
  const dir = path.dirname(kbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(kbPath, JSON.stringify(entries, null, 2));
}

// Record what actually resolved an incident. Keyed by the precise signature.
// If the same signature + fix already exists, bump recency / applied count.
export function recordResolution({
  signature, label, fix, usedSuggested, formId, formName,
}) {
  if (!signature || !fix) return;
  const entries = readKb();
  const existing = entries.find((e) => e.signature === signature && e.fix === fix);
  if (existing) {
    existing.timesApplied += 1;
    existing.lastAppliedAt = Date.now();
    if (formId && !existing.forms.includes(formId)) existing.forms.push(formId);
  } else {
    entries.push({
      id: `kb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      signature,
      label: label || signature,
      fix,
      usedSuggested: !!usedSuggested,
      forms: formId ? [formId] : [],
      formName: formName || formId || 'unknown',
      firstResolvedAt: Date.now(),
      lastAppliedAt: Date.now(),
      timesApplied: 1,
    });
  }
  writeKb(entries);
}

// Find a proven resolution for an error signature. By default returns matches
// from OTHER forms (true org-level learning); includeSameForm also matches the
// form's own earlier history.
export function lookupResolution(signature, currentFormId, { includeSameForm = false } = {}) {
  if (!signature) return null;
  const matches = readKb()
    .filter((e) => e.signature === signature)
    .filter((e) => (includeSameForm ? true : !e.forms.every((f) => f === currentFormId)))
    .sort((a, b) => b.lastAppliedAt - a.lastAppliedAt);
  return matches[0] || null;
}

export function getKnowledgeBase() {
  return readKb().sort((a, b) => b.lastAppliedAt - a.lastAppliedAt);
}

export function clearKnowledgeBase() {
  writeKb([]);
}
