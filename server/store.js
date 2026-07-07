import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { buildSessionSummaries, groupSessionsIntoJourneys } from './analyzer.js';

const dbPath = path.resolve(config.dbFile);
const insightsCachePath = path.resolve('./server/data/insights-cache.json');
const fixesPath = path.resolve('./server/data/resolved-fixes.json');
const snapshotsPath = path.resolve('./server/data/cycle-snapshots.json');
const cyclesPath = path.resolve('./server/data/cycles.json');
const screenshotsDir = path.resolve('./server/data/screenshots');

let sessionsCache = null;

// Keep up to MAX_SS_PER_KEY screenshots per error identity per session so repeated
// failures are visible without unbounded storage. Successful submit resets the counters.
const SS_EVENT_TYPES = new Set(['disabled_click', 'form_error', 'form_abandon', 'dead_click', 'api_error']);
const MAX_SS_PER_KEY = 3;

function ssKey(ev) {
  if (ev.type === 'disabled_click') return `disabled_click:${ev.element || ''}`;
  if (ev.type === 'dead_click') return `dead_click:${ev.element || ''}`;
  if (ev.type === 'form_error') return `form_error:${ev.status || ''}`;
  if (ev.type === 'form_abandon') return 'form_abandon';
  if (ev.type === 'api_error') return `api_error:${ev.url || ev.reason?.slice(0, 60) || ''}`;
  return null;
}

function deduplicateScreenshots(existingEvents, newEvents) {
  const counts = new Map();

  existingEvents.forEach((ev) => {
    if (ev.type === 'form_submit' && !ev.failed) { counts.clear(); return; }
    const k = ssKey(ev);
    if (k && ev.screenshot) counts.set(k, (counts.get(k) || 0) + 1);
  });

  return newEvents.map((ev) => {
    if (ev.type === 'form_submit' && !ev.failed) { counts.clear(); return ev; }
    if (!ev.screenshot || !SS_EVENT_TYPES.has(ev.type)) return ev;
    const k = ssKey(ev);
    if (!k) return ev;
    const count = counts.get(k) || 0;
    if (count >= MAX_SS_PER_KEY) {
      const { screenshot, ...rest } = ev;
      return { ...rest, screenshotDeduped: true };
    }
    counts.set(k, count + 1);
    return ev;
  });
}

function ensureDb() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
  if (!fs.existsSync(dbPath)) { fs.writeFileSync(dbPath, JSON.stringify([])); sessionsCache = []; }
}

function extractScreenshots(sessionId, events) {
  return events.map((ev) => {
    if (!ev.screenshot || !ev.screenshot.startsWith('data:image')) return ev;
    try {
      const match = ev.screenshot.match(/^data:image\/(\w+);base64,(.+)$/s);
      if (!match) return ev;
      const [, ext, b64] = match;
      const filename = `${sessionId}_${ev.timestamp || Date.now()}.${ext}`;
      const filepath = path.join(screenshotsDir, filename);
      fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
      return { ...ev, screenshot: `/screenshots/${filename}` };
    } catch {
      return ev;
    }
  });
}

export function saveSession(session) {
  ensureDb();
  const sessions = getAllSessions();
  const existing = sessions.findIndex((s) => s.sessionId === session.sessionId);
  const deduped = deduplicateScreenshots([], session.events || []);
  const extracted = extractScreenshots(session.sessionId, deduped);
  const final = { ...session, events: extracted };
  if (existing >= 0) {
    sessions[existing] = final;
  } else {
    sessions.push(final);
  }
  fs.writeFileSync(dbPath, JSON.stringify(sessions, null, 2));
  sessionsCache = sessions;
}

export function getAllSessions() {
  ensureDb();
  if (sessionsCache) return sessionsCache;
  sessionsCache = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  return sessionsCache;
}

export function getSessionsByFormId(formId) {
  return getAllSessions().filter((s) => s.formId === formId);
}

export function appendEvents(sessionId, newEvents, meta = null) {
  ensureDb();
  const sessions = getAllSessions();
  const idx = sessions.findIndex((s) => s.sessionId === sessionId);
  if (idx >= 0) {
    const existing = sessions[idx].events || [];
    // If retract-abandon already ran but form_abandon arrived late (race condition),
    // swap the incoming form_abandon for form_continued and clear the pending flag.
    let incoming = newEvents;
    if (sessions[idx].retractPending) {
      const hasLateAbandon = incoming.some((e) => e.type === 'form_abandon');
      if (hasLateAbandon) {
        incoming = incoming.map((e) => (e.type === 'form_abandon'
          ? { type: 'form_continued', timestamp: e.timestamp }
          : e));
        delete sessions[idx].retractPending;
      }
    }
    const deduped = deduplicateScreenshots(existing, incoming);
    const extracted = extractScreenshots(sessionId, deduped);
    sessions[idx].events = [...existing, ...extracted];
    if (meta) Object.assign(sessions[idx], meta);
  } else if (meta) {
    const deduped = deduplicateScreenshots([], newEvents);
    sessions.push({ sessionId, ...meta, events: extractScreenshots(sessionId, deduped) });
  } else {
    return;
  }
  fs.writeFileSync(dbPath, JSON.stringify(sessions, null, 2));
  sessionsCache = sessions;
}

export function clearSessionsByFormId(formId) {
  ensureDb();
  const remaining = getAllSessions().filter((s) => s.formId !== formId);
  fs.writeFileSync(dbPath, JSON.stringify(remaining, null, 2));
  sessionsCache = remaining;
}

export function getSessionsByFormIdAndRange(formId, rangeMs, sinceTs = null, untilTs = null) {
  let sessions = getAllSessions().filter((s) => s.formId === formId);
  if (sinceTs) sessions = sessions.filter((s) => (s.startTime || 0) >= sinceTs);
  if (untilTs) sessions = sessions.filter((s) => (s.startTime || 0) <= untilTs);
  if (!sinceTs && rangeMs) {
    const since = Date.now() - rangeMs;
    sessions = sessions.filter((s) => (s.startTime || 0) >= since);
  }
  return sessions;
}

export function getJourneysByDomain(domain) {
  const sessions = getAllSessions().filter((s) => s.journeyId);

  // Step 1: find sessions that belong to this exact form
  const seed = domain
    ? sessions.filter((s) => (s.pagePath || s.formId || '') === domain
        || (s.pagePath || s.formId || '').startsWith(`${domain}/`))
    : sessions;

  // Step 2: collect all journeyIds that touched this form
  const relevantJourneyIds = new Set(seed.map((s) => s.journeyId));

  // Step 3: include ALL sessions sharing those journeyIds (the full multi-page journey)
  const relevant = domain
    ? sessions.filter((s) => relevantJourneyIds.has(s.journeyId))
    : sessions;

  const map = new Map();
  relevant.forEach((s) => {
    if (!map.has(s.journeyId)) map.set(s.journeyId, []);
    map.get(s.journeyId).push(s);
  });

  return [...map.entries()].map(([journeyId, pages]) => {
    const sorted = [...pages].sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0));
    const completed = sorted.some((p) => p.events?.some((e) => e.type === 'form_submit' && !e.failed));
    const abandonPage = sorted.find((p) => p.events?.some((e) => e.type === 'form_abandon'));
    return {
      journeyId,
      pages: sorted.map((p) => ({
        sessionId: p.sessionId,
        pageIndex: p.pageIndex,
        pagePath: p.pagePath || p.formId,
        startTime: p.startTime,
        fieldCount: (p.events || []).filter((e) => e.type === 'field_change').length,
        errorCount: (p.events || []).filter((e) => ['api_error', 'js_error', 'console_error', 'form_error', 'field_error'].includes(e.type)).length,
        completed: p.events?.some((e) => e.type === 'form_submit' && !e.failed) ?? false,
        abandoned: p.events?.some((e) => e.type === 'form_abandon') ?? false,
      })),
      startTime: sorted[0]?.startTime ?? 0,
      pagesVisited: sorted.length,
      completed,
      droppedAtPage: completed ? null : (abandonPage?.pagePath || abandonPage?.formId || null),
    };
  }).sort((a, b) => b.startTime - a.startTime);
}

// Group all sessions for ONE form into journeys. A journey = one user's fill of the
// form, possibly spread across multiple pages/URLs (sessions sharing a journeyId).
// Unlike getJourneysByDomain (which matches on pagePath and breaks for multi-URL
// forms where pagePath differs but formId is shared), this keys strictly on formId.
// Sessions without a journeyId become a single-page journey keyed by their sessionId.
export function getJourneysByFormId(formId) {
  const sessions = getSessionsByFormId(formId);
  // per-session summary (category, durationMs, errorCount) computed once, indexed by id
  const summaryById = new Map();
  buildSessionSummaries(sessions).forEach((sum) => summaryById.set(sum.sessionId, sum));

  const ERROR_EVENT_TYPES = new Set([
    'js_error', 'form_error', 'api_error', 'console_error',
    'rage_click', 'dead_click', 'disabled_click', 'suspected_crash', 'storage_quota', 'field_error',
  ]);

  return groupSessionsIntoJourneys(sessions).map(({ key: journeyId, members: pageSessions }) => {
    const sorted = [...pageSessions].sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0));
    const completed = sorted.some((p) => p.events?.some((e) => e.type === 'form_submit' && !e.failed));
    // last page (highest pageIndex) that abandoned without completing = where they dropped
    const abandonPage = [...sorted].reverse()
      .find((p) => p.events?.some((e) => e.type === 'form_abandon')
        && !p.events?.some((e) => e.type === 'form_submit' && !e.failed));

    // collect distinct error types + a searchable blob (types, statuses, messages, fields)
    // across the journey so the dashboard can filter/search journeys by error.
    const errorTypes = new Set();
    const searchParts = [];
    sorted.forEach((p) => {
      searchParts.push(p.pagePath || p.formId || '');
      (p.events || []).forEach((e) => {
        if (!ERROR_EVENT_TYPES.has(e.type)) return;
        errorTypes.add(e.type);
        searchParts.push(e.type, e.status, e.statusText, e.message, e.reason,
          e.errorClass, e.element, e.field, e.nearestField);
      });
    });
    const searchBlob = searchParts.filter(Boolean).join(' ').toLowerCase();

    return {
      journeyId,
      pages: sorted.map((p) => {
        const sum = summaryById.get(p.sessionId) || {};
        return {
          sessionId: p.sessionId,
          pageIndex: p.pageIndex,
          pagePath: p.pagePath || p.formId,
          startTime: p.startTime,
          category: sum.category || 'in-progress',
          errorCount: sum.errorCount ?? 0,
          durationMs: sum.durationMs ?? 0,
          completed: p.events?.some((e) => e.type === 'form_submit' && !e.failed) ?? false,
          abandoned: p.events?.some((e) => e.type === 'form_abandon') ?? false,
        };
      }),
      startTime: sorted[0]?.startTime ?? 0,
      pagesVisited: sorted.length,
      completed,
      droppedAtPage: completed ? null : (abandonPage?.pagePath || abandonPage?.formId || null),
      errorTypes: [...errorTypes],
      searchBlob,
    };
  }).sort((a, b) => b.startTime - a.startTime);
}

export function getJourneyStats(domain) {
  const journeys = getJourneysByDomain(domain);
  const total = journeys.length;
  const completed = journeys.filter((j) => j.completed).length;

  // build page-level funnel: count how many journeys reached each pagePath
  const pageReach = new Map();
  const pageOrder = new Map(); // pagePath → min pageIndex seen
  journeys.forEach((j) => {
    j.pages.forEach((p) => {
      pageReach.set(p.pagePath, (pageReach.get(p.pagePath) || 0) + 1);
      if (!pageOrder.has(p.pagePath) || pageOrder.get(p.pagePath) > p.pageIndex) {
        pageOrder.set(p.pagePath, p.pageIndex);
      }
    });
  });

  const sortedPages = [...pageReach.entries()]
    .sort((a, b) => (pageOrder.get(a[0]) ?? 99) - (pageOrder.get(b[0]) ?? 99));

  // cap each step at the previous step's count — orphan sessions that start
  // mid-funnel cannot have more users than steps before them
  let prevCount = Infinity;
  const pageStats = sortedPages.map(([pagePath, rawCount], idx, arr) => {
    const count = Math.min(rawCount, prevCount);
    prevCount = count;
    const nextRaw = arr[idx + 1]?.[1] ?? completed;
    const nextCount = Math.min(nextRaw, count);
    return {
      pagePath,
      reachedCount: count,
      dropOffCount: Math.max(0, count - nextCount),
      dropOffRate: count > 0 ? Math.max(0, (count - nextCount) / count) : 0,
    };
  });

  const dropOffByPage = {};
  journeys.filter((j) => !j.completed && j.droppedAtPage).forEach((j) => {
    dropOffByPage[j.droppedAtPage] = (dropOffByPage[j.droppedAtPage] || 0) + 1;
  });

  return {
    totalJourneys: total,
    completedJourneys: completed,
    completionRate: total > 0 ? completed / total : 0,
    avgPagesVisited: total > 0 ? journeys.reduce((s, j) => s + j.pagesVisited, 0) / total : 0,
    pageStats,
    dropOffByPage,
  };
}

export function saveInsightsCache(formId, insights) {
  const cache = fs.existsSync(insightsCachePath)
    ? JSON.parse(fs.readFileSync(insightsCachePath, 'utf-8'))
    : {};
  cache[formId] = { insights, generatedAt: Date.now() };
  fs.writeFileSync(insightsCachePath, JSON.stringify(cache, null, 2));
}

export function getInsightsCache(formId) {
  if (!fs.existsSync(insightsCachePath)) return null;
  const cache = JSON.parse(fs.readFileSync(insightsCachePath, 'utf-8'));
  return cache[formId] || null;
}

export function clearInsightsCache(formId) {
  if (!fs.existsSync(insightsCachePath)) return;
  const cache = JSON.parse(fs.readFileSync(insightsCachePath, 'utf-8'));
  delete cache[formId];
  fs.writeFileSync(insightsCachePath, JSON.stringify(cache, null, 2));
}

export function saveResolvedFix(
  formId, field, fix, snapshot = null, cycleId = null,
  actualFix = null, usedSuggested = true, errorSignature = null, insightText = null,
) {
  const data = fs.existsSync(fixesPath)
    ? JSON.parse(fs.readFileSync(fixesPath, 'utf-8'))
    : {};
  if (!data[formId]) data[formId] = [];
  const entry = {
    field,
    fix,
    actualFix,
    usedSuggested,
    errorSignature,
    insightText,
    resolvedAt: Date.now(),
    snapshot,
    cycleId,
  };
  const existingIdx = data[formId].findIndex((f) => f.field === field);
  if (existingIdx >= 0) {
    data[formId][existingIdx] = entry; // overwrite with fresh snapshot on re-resolve
  } else {
    data[formId].push(entry);
  }
  fs.writeFileSync(fixesPath, JSON.stringify(data, null, 2));
}

export function getResolvedFixes(formId) {
  if (!fs.existsSync(fixesPath)) return [];
  const data = JSON.parse(fs.readFileSync(fixesPath, 'utf-8'));
  return data[formId] || [];
}

export function clearResolvedFixes(formId) {
  if (!fs.existsSync(fixesPath)) return;
  const data = JSON.parse(fs.readFileSync(fixesPath, 'utf-8'));
  delete data[formId];
  fs.writeFileSync(fixesPath, JSON.stringify(data, null, 2));
}

export function saveCycleSnapshot(formId, summary, activeInsightCount = 0, resolvedInsightCount = 0) {
  const data = fs.existsSync(snapshotsPath)
    ? JSON.parse(fs.readFileSync(snapshotsPath, 'utf-8'))
    : {};
  if (!data[formId]) data[formId] = [];
  data[formId].push({
    savedAt: Date.now(),
    totalSessions: summary.totalSessions || 0,
    completionRate: summary.completionRate || 0,
    dropOffRate: summary.dropOffRate || 0,
    bounceRate: summary.bounceRate || 0,
    deepAbandonRate: summary.deepAbandonRate || 0,
    disabledClicks: summary.errors?.disabledClicks || 0,
    rageClicks: summary.errors?.rageClicks || 0,
    activeInsightCount,
    resolvedInsightCount,
  });
  if (data[formId].length > 20) data[formId] = data[formId].slice(-20);
  fs.writeFileSync(snapshotsPath, JSON.stringify(data, null, 2));
}

export function getCycleSnapshots(formId) {
  if (!fs.existsSync(snapshotsPath)) return [];
  const data = JSON.parse(fs.readFileSync(snapshotsPath, 'utf-8'));
  return data[formId] || [];
}

function readCycles() {
  return fs.existsSync(cyclesPath) ? JSON.parse(fs.readFileSync(cyclesPath, 'utf-8')) : {};
}

function writeCycles(data) {
  fs.writeFileSync(cyclesPath, JSON.stringify(data, null, 2));
}

export function getFormCycles(formId) {
  return readCycles()[formId] || [];
}

export function saveFormCycle(formId, cycle) {
  const data = readCycles();
  if (!data[formId]) data[formId] = [];
  const idx = data[formId].findIndex((c) => c.id === cycle.id);
  if (idx >= 0) {
    data[formId][idx] = cycle;
  } else {
    data[formId].push(cycle);
  }
  writeCycles(data);
}

export function updateFormCycleSnapshot(formId, cycleId, snapshot) {
  const data = readCycles();
  if (!data[formId]) return;
  const cycle = data[formId].find((c) => c.id === cycleId);
  if (cycle) { cycle.snapshot = snapshot; writeCycles(data); }
}

export function deleteFormCycle(formId, cycleId) {
  const data = readCycles();
  if (!data[formId]) return;
  data[formId] = data[formId].filter((c) => c.id !== cycleId);
  writeCycles(data);
}
