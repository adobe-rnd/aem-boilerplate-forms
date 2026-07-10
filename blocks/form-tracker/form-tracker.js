const SESSION_KEY = 'fis_session';
const PROGRESS_KEY = 'fis_progress';

const DEFERRED_SESSION_KEY = 'fis_deferred_ss';
const JOURNEY_KEY = 'fis_journey';
// Not scoped by formId/path — lets a same-origin, multi-path redirect chain (e.g. a
// bank's own KYC flow that does full page loads at different paths, with no _fis_jid
// URL param we control) hand off the journey via sessionStorage, which survives real
// navigations within the same origin. The per-form JOURNEY_KEY above can't help here
// since each step has a different formId/path.
const ORIGIN_JOURNEY_KEY = 'fis_journey_origin';
const ORIGIN_JOURNEY_TTL = 60 * 1000;
const JID_PARAM = '_fis_jid';
const PIDX_PARAM = '_fis_pidx';
const PREV_SID_PARAM = '_fis_prev_sid';
const DEFAULT_SERVER = 'http://localhost:3000';
let SERVER_URL = `${DEFAULT_SERVER}/events`;
let SERVER_BASE = DEFAULT_SERVER;

// Journey TTL: how long a partial journey is kept across page loads.
// Override via window.FIS_JOURNEY_TTL_MS for forms that take longer than 2 hours
// (e.g. government or insurance forms where users save and return the next day).
const JOURNEY_TTL_MS = window.FIS_JOURNEY_TTL_MS || 2 * 60 * 60 * 1000;

// File upload validation limits.
// Override via window.FIS_UPLOAD_MAX_MB (number) and window.FIS_UPLOAD_ALLOWED_TYPES (string[]).
// Set FIS_UPLOAD_ALLOWED_TYPES = [] to skip MIME type checking entirely.
const UPLOAD_MAX_MB = window.FIS_UPLOAD_MAX_MB ?? 10;
const UPLOAD_ALLOWED_TYPES = window.FIS_UPLOAD_ALLOWED_TYPES ?? ['image/jpeg', 'image/png', 'application/pdf', 'image/gif'];

// When the browser restores this page from the back-forward cache (BFCache),
// the Web Worker has been terminated but the DOM still shows the old field values.
// The form model in the worker has no memory of those values, so submitting
// triggers "please fill this field" errors even though the fields look filled.
// Force a real reload to resync the model with the DOM.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
});


function getDeviceType() {
  return window.innerWidth <= 768 ? 'mobile' : 'desktop';
}

function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function stripRefreshAbandon() {
  // Must run BEFORE getOrCreateSession so the session is clean when it's read.
  // On every page load, check if the previous unload was a quick refresh of the
  // same URL (within 10 s). If so, remove the form_abandon that was added at
  // pagehide — it was a reload, not a real abandon.
  try {
    const unloadRaw = sessionStorage.getItem('fis_unload');
    if (!unloadRaw) return;
    const { ts, url } = JSON.parse(unloadRaw);
    if (!ts || Date.now() - ts > 10000) { sessionStorage.removeItem('fis_unload'); return; }
    if (url !== window.location.pathname) return;
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return;
    const prev = JSON.parse(stored);
    if (!prev.events.some((e) => e.type === 'form_abandon')) return;
    prev.events = prev.events.filter((e) => e.type !== 'form_abandon');
    prev.events.push({ type: 'page_refreshed', timestamp: Date.now() });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(prev));
    // re-post cleaned session so server removes the abandon it received at pagehide
    fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prev),
    }).catch(() => {});
    // same-page refresh is not an abandon — discard any deferred screenshot too
    localStorage.removeItem(DEFERRED_SESSION_KEY);
  } catch { /* ignore */ }
}

// Journey state is keyed PER FORM (journeyKey(formId)) so that filling one form
// across multiple pages is one journey, while switching to an unrelated form
// starts its own independent journey instead of merging into the previous one.
function journeyKey(formId) {
  return `${JOURNEY_KEY}:${formId}`;
}

function getOrCreateJourney(formId) {
  try {
    const KEY = journeyKey(formId);
    const params = new URLSearchParams(window.location.search);
    const urlJid = params.get(JID_PARAM);
    const urlPidx = params.get(PIDX_PARAM);
    const urlPrevSid = params.get(PREV_SID_PARAM);
    const saveJourney = (journey) => {
      const val = JSON.stringify({ ...journey, formId, savedAt: Date.now() });
      sessionStorage.setItem(KEY, val);
      localStorage.setItem(KEY, val);
    };

    const clearStored = () => {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
    };

    const rawStored = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
    const stored = rawStored && (Date.now() - (JSON.parse(rawStored).savedAt || 0)) < JOURNEY_TTL_MS
      ? rawStored : null;
    if (!stored && rawStored) clearStored();

    if (stored) {
      const journey = JSON.parse(stored);
      const unloadRaw = sessionStorage.getItem('fis_unload');
      if (unloadRaw) {
        const { ts, url } = JSON.parse(unloadRaw);
        if (url === window.location.pathname && Date.now() - ts < 10000) {
          return { journeyId: journey.journeyId, pageIndex: journey.pageCount };
        }
      }
      // A prior page in this journey sent form_abandon at pagehide without knowing the
      // user would return to continue (e.g. a mid-flow redirect to KYC and back). Expose
      // its sessionId so trackForm can retract that premature abandon.
      if (journey.prevSessionId) {
        window.__FIS_RETRACT_SESSION_ID = journey.prevSessionId;
        delete journey.prevSessionId;
      }
      journey.pageCount += 1;
      saveJourney(journey);
      return { journeyId: journey.journeyId, pageIndex: journey.pageCount };
    }

    if (urlJid) {
      const pageCount = urlPidx ? parseInt(urlPidx, 10) : 1;
      const journey = { journeyId: urlJid, pageCount };
      // If a fis-page-tracker intermediate page passed a prevSessionId via URL,
      // honour it so retract-abandon fires for the correct prior session.
      if (urlPrevSid && !window.__FIS_RETRACT_SESSION_ID) {
        window.__FIS_RETRACT_SESSION_ID = urlPrevSid;
      }
      saveJourney(journey);
      return { journeyId: urlJid, pageIndex: pageCount };
    }

    // same-origin, different-path continuation (see ORIGIN_JOURNEY_KEY comment
    // above) — consumed immediately so an unrelated later visit to another form on
    // this origin, in the same tab, doesn't inherit a stale journey.
    const rawOrigin = sessionStorage.getItem(ORIGIN_JOURNEY_KEY);
    if (rawOrigin) sessionStorage.removeItem(ORIGIN_JOURNEY_KEY);
    const originJourney = rawOrigin && (Date.now() - (JSON.parse(rawOrigin).savedAt || 0)) < ORIGIN_JOURNEY_TTL
      ? JSON.parse(rawOrigin) : null;
    if (originJourney) {
      if (originJourney.prevSessionId && !window.__FIS_RETRACT_SESSION_ID) {
        window.__FIS_RETRACT_SESSION_ID = originJourney.prevSessionId;
      }
      const pageCount = originJourney.pageIndex + 1;
      const journey = { journeyId: originJourney.journeyId, pageCount };
      saveJourney(journey);
      return { journeyId: originJourney.journeyId, pageIndex: pageCount };
    }

    const journeyId = `j-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const journey = { journeyId, pageCount: 1 };
    saveJourney(journey);
    return { journeyId, pageIndex: 1 };
  } catch {
    return { journeyId: null, pageIndex: 1 };
  }
}

// Clear the per-form journey so the next visit starts a fresh journey
// (called on successful submit — the journey is complete).
function clearJourney(formId) {
  try {
    const KEY = journeyKey(formId);
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

function getOrCreateSession(formId) {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    const hasSubmit = parsed.events.some((e) => e.type === 'form_submit');
    const hasAbandon = parsed.events.some((e) => e.type === 'form_abandon');
    // reuse only if same form page AND still in-progress (no submit, no abandon)
    if (parsed.formId === formId && !hasSubmit && !hasAbandon) return parsed;
    // post-submit redirect — page reloaded within 5 s of a successful submit
    if (hasSubmit) {
      try {
        const unloadRaw = sessionStorage.getItem('fis_unload');
        if (unloadRaw) {
          const { ts } = JSON.parse(unloadRaw);
          if (ts && Date.now() - ts < 5000) return null;
        }
      } catch { /* ignore */ }
    }
  }

  const { journeyId, pageIndex } = getOrCreateJourney(formId);
  const prevProgress = localStorage.getItem(PROGRESS_KEY);
  const isReturned = !!prevProgress;
  const session = {
    sessionId: generateSessionId(),
    formId,
    journeyId,
    pageIndex,
    pagePath: window.location.pathname,
    device: getDeviceType(),
    startTime: Date.now(),
    events: isReturned ? [{ type: 'session_returned', timestamp: Date.now(), hadSavedProgress: true }] : [],
    returned: isReturned,
    lastSentIndex: 0,
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function saveSession(session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage quota exceeded — in-memory copy stays authoritative.
    // Push once; the next natural sendToServer call (or pagehide beacon) will flush it.
    if (!window.__FIS_STORAGE_QUOTA_NOTIFIED) {
      window.__FIS_STORAGE_QUOTA_NOTIFIED = true;
      session.events.push({ type: 'storage_quota', timestamp: Date.now(), store: 'sessionStorage' });
    }
  }
}

function addEvent(session, type, data = {}) {
  session.events.push({ type, timestamp: Date.now(), ...data });
  saveSession(session);
}

async function sendToServer(session) {
  // Guard against concurrent sends (e.g. the periodic flush overlapping an
  // event-driven send). Both would slice from the same lastSentIndex before it
  // advances, double-posting the same events. If a screenshot finishes while a
  // send is open, queue one more pass so the updated event is not stranded.
  if (session.sendInFlight) {
    session.sendAgain = true;
    return;
  }
  const fromIdx = session.lastSentIndex || 0;
  const newEvents = session.events.slice(fromIdx);
  if (!newEvents.length) return;

  const payload = { sessionId: session.sessionId, events: newEvents };
  if (fromIdx === 0) {
    payload.meta = {
      formId: session.formId,
      journeyId: session.journeyId,
      pageIndex: session.pageIndex,
      pagePath: session.pagePath,
      device: session.device,
      startTime: session.startTime,
      returned: session.returned,
    };
  }

  session.sendInFlight = true;
  try {
    await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    session.lastSentIndex = Math.max(session.lastSentIndex || 0, fromIdx + newEvents.length);
    if (typeof session.resendFromIndex === 'number') {
      session.lastSentIndex = Math.min(session.lastSentIndex, session.resendFromIndex);
      session.resendFromIndex = null;
      session.sendAgain = true;
    }
    saveSession(session);
  } catch {
    // offline or server not running — queue for retry
    try {
      const pending = JSON.parse(localStorage.getItem('fis_pending') || '[]');
      pending.push(payload);
      localStorage.setItem('fis_pending', JSON.stringify(pending));
    } catch { /* quota exceeded — discard, tracker continues working */ }
  } finally {
    session.sendInFlight = false;
    if (session.sendAgain) {
      session.sendAgain = false;
      sendToServer(session);
    }
  }
}

async function flushPendingSessions() {
  const pending = JSON.parse(localStorage.getItem('fis_pending') || '[]');
  if (!pending.length) return;
  const failed = [];
  await Promise.all(pending.map(async (s) => {
    try {
      await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
    } catch {
      failed.push(s);
    }
  }));
  if (failed.length) {
    localStorage.setItem('fis_pending', JSON.stringify(failed));
  } else {
    localStorage.removeItem('fis_pending');
  }
}

// Send a session that was saved to localStorage on a previous pagehide
// (used to deliver abandon screenshots that couldn't be sent at close time).
function flushDeferredSession() {
  const raw = localStorage.getItem(DEFERRED_SESSION_KEY);
  if (!raw) return;
  localStorage.removeItem(DEFERRED_SESSION_KEY);
  fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw,
  }).catch(() => {
    try { localStorage.setItem(DEFERRED_SESSION_KEY, raw); } catch { /* ignore */ }
  });
}

function saveProgress(formEl, fieldName) {
  const progress = {};
  formEl.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.name) progress[el.name] = el.value;
  });
  progress._lastField = fieldName;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function getProgress() {
  const stored = localStorage.getItem(PROGRESS_KEY);
  return stored ? JSON.parse(stored) : null;
}

function clearProgress() {
  localStorage.removeItem(PROGRESS_KEY);
}

function restoreProgress(formEl, session) {
  const progress = getProgress();
  if (!progress) return;

  let restoredCount = 0;
  formEl.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.name && progress[el.name] !== undefined) {
      el.value = progress[el.name];
      restoredCount += 1;
    }
  });

  if (progress._lastField) {
    const lastField = formEl.querySelector(`[name="${progress._lastField}"]`);
    if (lastField) lastField.focus();
  }

  if (session && restoredCount > 0) {
    addEvent(session, 'progress_restored', {
      restoredFieldCount: restoredCount,
      lastField: progress._lastField || null,
    });
  }
}


function rememberInteractionContext(kind, label, rect) {
  try {
    window.__FIS_lastInteractionContext = { kind, label, rect, time: Date.now() };
  } catch { /* ignore */ }
}

function trackField(fieldEl, session, formEl, getVisibleMs, onScreenshot) {
  const fieldName = fieldEl.name || fieldEl.id || 'unknown';
  let focusVisibleMs = null; // visible-time snapshot taken at focus
  let idleTimer = null;
  let idleTotalMs = 0;
  let errorCount = 0;
  let visitCount = 0;
  let copyPasted = false;
  let isFocused = false;
  let focusWallClock = null;   // wall-clock ms at focus (for hesitation)
  let firstKeystrokeMs = null; // ms from focus to first keystroke
  let correctionCount = 0;     // backspace/delete strokes (rework signal)
  let valueAtFocus = '';       // value when focused (to detect blur-without-change)
  let changedDuringFocus = false;

  fieldEl.addEventListener('focus', () => {
    isFocused = true;
    focusVisibleMs = getVisibleMs();
    focusWallClock = Date.now();
    firstKeystrokeMs = null;
    correctionCount = 0;
    valueAtFocus = fieldEl.value || '';
    changedDuringFocus = false;
    visitCount += 1;

    idleTimer = setInterval(() => {
      idleTotalMs += 1000;
    }, 1000);

    rememberInteractionContext('field', fieldName, fieldEl.getBoundingClientRect());
    addEvent(session, 'field_focus', { field: fieldName, visitCount });
  });

  fieldEl.addEventListener('keydown', (ev) => {
    if (firstKeystrokeMs === null && focusWallClock !== null) {
      firstKeystrokeMs = Date.now() - focusWallClock;
    }
    if (ev.key === 'Backspace' || ev.key === 'Delete') correctionCount += 1;
  });

  fieldEl.addEventListener('input', () => {
    idleTotalMs = 0;
    changedDuringFocus = true;
  });

  fieldEl.addEventListener('paste', () => {
    copyPasted = true;
    changedDuringFocus = true;
  });

  fieldEl.addEventListener('blur', () => {
    isFocused = false;
    clearInterval(idleTimer);
    const timeSpent = focusVisibleMs != null ? getVisibleMs() - focusVisibleMs : 0;
    focusVisibleMs = null;
    const isEmpty = fieldEl.type === 'checkbox' ? !fieldEl.checked : fieldEl.value.trim() === '';
    const skipped = isEmpty && fieldEl.required;

    addEvent(session, 'field_blur', {
      field: fieldName,
      timeSpentMs: timeSpent,
      idleTimeMs: idleTotalMs,
      copyPasted,
      visitCount,
      errorCount,
      skipped,
      hesitationMs: firstKeystrokeMs,    // ms from focus to first keystroke; null = no keystroke
      correctionCount,                    // backspace/delete count — high = confusion/rework
      changedDuringFocus,                 // false = user looked at field but left it untouched
    });

    saveProgress(formEl, fieldName);

    idleTotalMs = 0;
    copyPasted = false;
    changedDuringFocus = false;
  });

  // pause idle timer when page is hidden (tab switch / sleep), resume on return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (isFocused) clearInterval(idleTimer);
    } else if (isFocused) {
      idleTimer = setInterval(() => { idleTotalMs += 1000; }, 1000);
    }
  });

  fieldEl.addEventListener('invalid', () => {
    // skip submit-triggered validation on fields the user never visited — those are
    // not the user being stuck, they're just unfilled required fields on submit
    if (!visitCount) return;
    errorCount += 1;
    addEvent(session, 'field_error', {
      field: fieldName,
      errorCount,
      validationMessage: fieldEl.validationMessage || null,
    });
    // capture once on first error — shows exactly which field is red and why
    if (errorCount === 1 && onScreenshot) {
      onScreenshot('field_error', {
        field: fieldName,
        validationMessage: fieldEl.validationMessage,
      });
    }
    if (errorCount === 3) {
      addEvent(session, 'validation_thrash', { field: fieldName, thrashCount: errorCount });
    }
  });

  // autofill detection via CSS animation trick (works in Chrome/Edge/Safari)
  fieldEl.addEventListener('animationstart', (e) => {
    if (e.animationName === 'onAutoFillStart') {
      addEvent(session, 'field_autofilled', { field: fieldName });
    }
  });

  // track scroll visibility
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        addEvent(session, 'field_visible', { field: fieldName });
        observer.unobserve(fieldEl);
      }
    });
  });
  observer.observe(fieldEl);
}

function getActiveStepInfo(formEl) {
  const active = formEl.querySelector('fieldset.current-wizard-step');
  if (!active) return { index: 0, name: null };
  const index = parseInt(active.dataset.index ?? 0, 10);
  const name = active.querySelector('legend')?.textContent?.trim()
    || active.id
    || `Step ${index + 1}`;
  return { index, name };
}

// Whether a field has no user-provided value. Radios need group-aware logic:
// a radio always carries a non-empty `value` attribute whether or not it is
// selected, so an unchecked group must be detected via :checked — not value.
function isFieldEmpty(el, formEl) {
  if (el.type === 'radio') {
    return !formEl.querySelector(`input[type="radio"][name="${el.name}"]:checked`);
  }
  if (el.type === 'checkbox') return !el.checked;
  return !el.value.trim();
}

// ── Error classification ──────────────────────────────────────────────────────

function classifyConsoleError(msg) {
  if (/access.*blocked.*cors|cors.*block|has been blocked by cors/i.test(msg)) return 'cors';
  if (/cannot read prop|cannot read properties of null|undefined is not an object/i.test(msg)) return 'null_reference';
  if (/is not a function/i.test(msg)) return 'type_error';
  if (/guideBridge.*not defined|guideBridge is not/i.test(msg)) return 'guideBridge_not_ready';
  if (/afb-runtime|rule.?engine/i.test(msg)) return 'rule_engine';
  if (/failed to fetch|networkerror when attempting/i.test(msg)) return 'network';
  if (/content security policy|csp/i.test(msg)) return 'csp';
  if (/404|not found/i.test(msg)) return 'missing_resource';
  if (/script error/i.test(msg)) return 'cross_origin_script';
  if (/maximum call stack|stack overflow/i.test(msg)) return 'infinite_recursion';
  if (/uncaught.*error/i.test(msg)) return 'uncaught';
  return 'unknown';
}

function classifyNetworkError(reason) {
  if (/access.*blocked.*cors|has been blocked by cors/i.test(reason)) return 'cors';
  if (/failed to fetch|networkerror/i.test(reason)) return 'network_down';
  if (/timeout|timed out/i.test(reason)) return 'timeout';
  if (/aborted/i.test(reason)) return 'aborted';
  if (/401|unauthorized/i.test(reason)) return 'auth';
  if (/403|forbidden/i.test(reason)) return 'auth';
  if (/404|not found/i.test(reason)) return 'not_found';
  if (/429|too many/i.test(reason)) return 'rate_limited';
  if (/5\d\d/.test(reason)) return 'server_error';
  if (/4\d\d/.test(reason)) return 'client_error';
  return 'unknown';
}

// Some backend APIs return HTTP 200 while reporting a real failure inside the
// response body (e.g. panEnquiry.json's "TH99500: Backend Service Provided
// Unexpected Response", consentreceipts.json's "aemInternalError", or
// docUpload.json's "AEM-FDM-001-016") — response.ok is true in every one of these
// cases, so a plain HTTP-status check never sees them. This inspects the body for
// the error shapes we've actually seen across these endpoints and returns a plain-
// English description when one matches, or null for a genuinely successful body.
function extractEmbeddedError(bodyText) {
  let json;
  try { json = JSON.parse(bodyText); } catch { return null; }
  const candidates = [
    json?.status,
    ...(Array.isArray(json) ? json.map((e) => e?.status || e) : []),
    json,
  ].filter((c) => c && typeof c === 'object');

  for (const c of candidates) {
    const errorCode = typeof c.errorCode === 'string' ? c.errorCode.trim() : c.errorCode;
    const errorDesc = (c.errorDesc || c.errorMessage || '').toString().trim();
    const responseCode = c.responseCode != null ? String(c.responseCode) : null;
    const statusField = c.status != null ? String(c.status) : null;

    const isFailure = (errorCode && !/^0+$/.test(String(errorCode)))
      || responseCode === '1'
      || (statusField && /^[45]\d\d$/.test(statusField))
      || /does not exist|unable to process|unexpected response|not found|fail|invalid/i.test(errorDesc);

    if (isFailure) {
      const detail = errorDesc || errorCode || statusField || 'unspecified failure';
      return {
        description: `Backend reported a failure despite HTTP 200: ${detail}`,
        errorCode: errorCode || null,
        errorDesc: errorDesc || null,
      };
    }
  }
  return null;
}

function isFinalSubmissionFailureText(text = '') {
  return /personal loan request could not be submitted|request could not be submitted|could not be submitted|application number\s*not generated|not generated|there seems to be an error in the application|contact nearest branch|try later/i.test(text);
}

function compactText(text = '') {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

// ── Screenshot capture ────────────────────────────────────────────────────────

let html2canvasReady = false;
let html2canvasFailed = false;

function loadHtml2Canvas() {
  if (html2canvasReady || window.html2canvas) { html2canvasReady = true; return Promise.resolve(); }
  if (html2canvasFailed) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => { html2canvasReady = true; resolve(); };
    s.onerror = () => { html2canvasFailed = true; resolve(); };
    document.head.appendChild(s);
  });
}

async function captureAnnotatedScreenshot(formEl, eventType, context = {}) {
  try {
    // html2canvas returns a blank white canvas when the tab is hidden — bail early
    if (document.visibilityState === 'hidden') return null;
    await loadHtml2Canvas();
    if (!window.html2canvas) return null;
    // use device pixel ratio for sharp screenshots on retina screens, capped at 2×
    const SCALE = Math.min(window.devicePixelRatio || 1, 2);
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const stripExternalMedia = false;

    // Pre-capture all element positions NOW — before html2canvas (which takes 100–500ms).
    // By the time html2canvas resolves, the page may have scrolled or re-rendered,
    // making getBoundingClientRect() return wrong values relative to the screenshot.
    const preRects = {};
    if (eventType === 'disabled_click') {
      (context.invalidFields || []).forEach((name) => {
        const el = formEl.querySelector(`[name="${name}"]`);
        if (el) preRects[name] = el.getBoundingClientRect();
      });
      // use the exact rect captured at click time — querySelector('[disabled]') finds
      // the first disabled element in DOM order, which may not be the clicked button
      if (context.btnRect) {
        preRects.__btn = context.btnRect;
      } else {
        const btn = formEl.querySelector('[disabled]');
        if (btn) preRects.__btn = btn.getBoundingClientRect();
      }
    }
    if (eventType === 'form_abandon') {
      Object.keys(context.fieldState || {}).forEach((name) => {
        const el = formEl.querySelector(`[name="${name}"]`);
        if (el) preRects[name] = el.getBoundingClientRect();
      });
    }
    if (eventType === 'field_error') {
      const el = formEl.querySelector(`[name="${context.field}"]`);
      if (el) preRects[context.field] = el.getBoundingClientRect();
    }
    if (eventType === 'api_error' && context.btnRect) {
      preRects.__btn = context.btnRect;
    }
    // action_context: rolling "what was the user just doing" snapshot, used as the
    // "before" shot for errors that replace the whole screen (form_error/js_error/
    // console_error) — those errors' own screenshot can no longer show the field or
    // button that caused them, so this highlights it ahead of time.
    if (eventType === 'action_context') {
      if (context.btnRect) preRects.__btn = context.btnRect;
      else if (context.fieldRect) preRects.__field = context.fieldRect;
    }

    // capture exactly what the user sees — viewport only, at device resolution
    const canvas = await window.html2canvas(document.body, {
      scale: SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      x: window.scrollX,
      y: window.scrollY,
      width: vpW,
      height: vpH,
      windowWidth: vpW,
      windowHeight: vpH,
      onclone: (_doc, clonedEl) => {
        if (stripExternalMedia) {
          clonedEl.querySelectorAll('img, picture, source, iframe, video, canvas, object, embed').forEach((el) => el.remove());
          clonedEl.querySelectorAll('*').forEach((el) => {
            if (el.style) el.style.backgroundImage = 'none';
          });
        }
        // Mask all user-entered values — never expose PII in screenshots
        clonedEl.querySelectorAll('input, textarea').forEach((el) => {
          if (!el.value) return;
          if (el.type === 'password' || el.type === 'email' || el.type === 'tel') {
            el.value = '••••••••';
          } else if (el.type === 'number' || el.type === 'range') {
            el.value = '###';
          } else if (el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'submit' && el.type !== 'button') {
            el.value = '•'.repeat(Math.min(el.value.length, 12));
          }
        });
        clonedEl.querySelectorAll('select').forEach((el) => {
          const opts = el.querySelectorAll('option:checked');
          opts.forEach((o) => { if (o.value) o.textContent = '••••••'; });
        });
        clonedEl.querySelectorAll('[contenteditable="true"]').forEach((el) => {
          if (el.textContent.trim()) el.textContent = '•'.repeat(12);
        });
        // Mask checked state of radio buttons and checkboxes — selected option
        // can reveal sensitive answers (e.g. disability status, income range).
        // Clear the property, the default-checked flag, AND the attribute: a
        // pre-selected option carries the `checked` attribute into the clone,
        // which html2canvas renders (and which keeps `:checked` card styling
        // applied) even after the property is set to false.
        clonedEl.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach((el) => {
          el.checked = false;
          el.defaultChecked = false;
          el.removeAttribute('checked');
        });
      },
    });
    const ctx = canvas.getContext('2d');

    // Screen-replacing errors (js/console/form) draw a top banner with the error
    // message. When we know what the user clicked/focused right before it (from the
    // rolling action-context cache), add it as a second banner line so the "why"
    // is baked into the image itself, not just a separate dashboard caption.
    const triggerText = context.triggerLabel
      ? `${context.triggerKind === 'field' ? 'Focused' : 'Clicked'} "${context.triggerLabel}"${context.triggerStep ? ` at step "${context.triggerStep}"` : ''} right before this`
      : null;
    function drawErrorBanner(bg, mainText) {
      const h = triggerText ? 38 : 24;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(mainText, 6, 15);
      if (triggerText) {
        ctx.font = '8px sans-serif';
        ctx.fillText(triggerText, 6, 30);
      }
    }

    if (eventType === 'disabled_click') {
      (context.invalidFields || []).forEach((name) => {
        const r = preRects[name];
        if (!r || r.bottom < 0 || r.top > vpH) return;
        const x = r.left * SCALE;
        const y = r.top * SCALE;
        const w = r.width * SCALE;
        const h = r.height * SCALE;
        ctx.strokeStyle = '#e53e3e';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
        const lbl = context.fieldState?.[name] === 'invalid' ? 'INVALID' : 'EMPTY';
        ctx.fillStyle = '#e53e3e';
        ctx.fillRect(x - 2, y - 14, lbl.length * 6 + 6, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText(lbl, x + 1, y - 4);
      });
      const r = preRects.__btn;
      if (r) {
        const x = r.left * SCALE;
        const y = r.top * SCALE;
        const w = r.width * SCALE;
        const h = r.height * SCALE;
        ctx.fillStyle = 'rgba(229,62,62,0.2)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#e53e3e';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#e53e3e';
        ctx.fillRect(x + w - 54, y + 2, 52, 13);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText('BLOCKED', x + w - 52, y + 12);
      }
    }

    if (eventType === 'js_error') {
      drawErrorBanner('rgba(197,48,48,0.92)', `JS ERROR: ${(context.message || 'unknown').slice(0, 90)}`);
    }

    if (eventType === 'console_error') {
      drawErrorBanner('rgba(197,48,48,0.92)', `CONSOLE ERROR: ${(context.message || 'unknown').slice(0, 85)}`);
    }

    if (eventType === 'form_error') {
      drawErrorBanner(
        (context.status || 0) >= 500 ? 'rgba(197,48,48,0.92)' : 'rgba(201,99,0,0.92)',
        `${(context.callType || 'API').toUpperCase()} ERROR ${context.status || ''}: ${(context.statusText || '').slice(0, 70)}`,
      );
    }

    if (eventType === 'api_error') {
      ctx.fillStyle = 'rgba(201,99,0,0.92)';
      ctx.fillRect(0, 0, canvas.width, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`NETWORK ERROR: ${(context.reason || '').slice(0, 85)}`, 6, 15);
      const r = preRects.__btn;
      if (r && r.bottom >= 0 && r.top <= vpH) {
        const x = r.left * SCALE;
        const y = r.top * SCALE;
        const w = r.width * SCALE;
        const h = r.height * SCALE;
        ctx.fillStyle = 'rgba(201,99,0,0.18)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#c96300';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#c96300';
        ctx.fillRect(x + w - 66, y + 2, 64, 13);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText('API FAILED', x + w - 64, y + 12);
      }
    }

    if (eventType === 'form_abandon') {
      Object.entries(context.fieldState || {}).forEach(([name, state]) => {
        const r = preRects[name];
        if (!r || r.bottom < 0 || r.top > vpH) return;
        const x = r.left * SCALE;
        const y = r.top * SCALE;
        const w = r.width * SCALE;
        const h = r.height * SCALE;
        if (state === 'filled') {
          // Radio/checkbox selections are masked for privacy, so a filled choice
          // field would otherwise look untouched. Draw a neutral ANSWERED badge
          // so we can see the user responded — without revealing which option.
          const type = context.fieldTypes?.[name];
          if (type !== 'radio' && type !== 'checkbox') return;
          ctx.strokeStyle = '#16a34a';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
          ctx.fillStyle = '#16a34a';
          ctx.fillRect(x - 1, y - 13, 'ANSWERED'.length * 6 + 4, 11);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 8px sans-serif';
          ctx.fillText('ANSWERED', x + 2, y - 4);
          return;
        }
        const color = state === 'invalid' ? '#d97706' : '#e53e3e';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = color;
        ctx.fillRect(x - 1, y - 13, state.length * 6 + 4, 11);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText(state.toUpperCase(), x + 2, y - 4);
      });
    }

    if (eventType === 'field_error') {
      // red banner across the top
      ctx.fillStyle = 'rgba(197,48,48,0.92)';
      ctx.fillRect(0, 0, canvas.width, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      const msg = (context.validationMessage || 'Validation error').slice(0, 70);
      ctx.fillText(`FIELD ERROR — ${context.field}: ${msg}`, 6, 15);

      const r = preRects[context.field];
      if (r && r.bottom >= 0 && r.top <= vpH) {
        const x = r.left * SCALE;
        const y = r.top * SCALE;
        const w = r.width * SCALE;
        const h = r.height * SCALE;
        ctx.strokeStyle = '#e53e3e';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
        ctx.fillStyle = 'rgba(197,48,48,0.85)';
        ctx.fillRect(x - 3, y - 16, 58, 13);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText('INVALID', x, y - 5);
      }
    }

    if (eventType === 'action_context') {
      const r = preRects.__btn || preRects.__field;
      if (r && r.bottom >= 0 && r.top <= vpH) {
        const x = r.left * SCALE;
        const y = r.top * SCALE;
        const w = r.width * SCALE;
        const h = r.height * SCALE;
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
        const lbl = (context.label || (preRects.__btn ? 'CLICKED' : 'FOCUSED')).slice(0, 20).toUpperCase();
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(x - 3, y - 16, lbl.length * 6 + 6, 13);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText(lbl, x, y - 5);
      }
    }

    return canvas.toDataURL('image/jpeg', 0.85);
  } catch { return null; }
}

export function trackForm(formEl, serverBaseUrl) {
  if (serverBaseUrl) {
    SERVER_BASE = serverBaseUrl.replace(/\/$/, '');
    SERVER_URL = `${SERVER_BASE}/events`;
  }
  if (formEl.dataset.fisTracked) return;
  formEl.dataset.fisTracked = 'true';

  // load html2canvas eagerly so screenshots work even if the user later goes offline
  loadHtml2Canvas();

  // send any abandon screenshot that was deferred from the previous page close
  flushDeferredSession();

  // retry any sessions that failed to send while offline
  flushPendingSessions();
  window.addEventListener('online', flushPendingSessions, { once: false });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushPendingSessions();
  });

  try {
    const formId = window.location.pathname;
    stripRefreshAbandon(); // must run before getOrCreateSession reads sessionStorage
    const session = getOrCreateSession(formId);
    // null means this is a post-submit page reload — skip tracking entirely
    // so the refreshed empty form doesn't create a phantom abandoned session
    if (!session) return;

    // If a prior page in this journey abandoned but the user returned to continue,
    // getOrCreateJourney flagged that session — retract its premature form_abandon.
    if (window.__FIS_RETRACT_SESSION_ID) {
      const retractId = window.__FIS_RETRACT_SESSION_ID;
      window.__FIS_RETRACT_SESSION_ID = null;
      fetch(`${SERVER_BASE}/retract-abandon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: retractId }),
      }).catch(() => {});
    }
    window.__fisSession = session; // dev helper — check tracker is active: window.__fisSession

    // Same-origin handoff for the next page — written synchronously so a redirect
    // to a different path on this origin (no _fis_jid URL param involved) reliably
    // continues the journey instead of that next page minting a brand-new one.
    try {
      sessionStorage.setItem(ORIGIN_JOURNEY_KEY, JSON.stringify({
        journeyId: session.journeyId,
        pageIndex: session.pageIndex,
        savedAt: Date.now(),
        prevSessionId: session.sessionId,
      }));
    } catch { /* ignore */ }

    // ── Periodic flush ──────────────────────────────────────────────────────────
    // field_focus / field_blur / input only buffer events locally (addEvent does not
    // send). Without a trailing change / step_change / error event, those buffered
    // events never reach the server, so an in-progress session shows stale data —
    // e.g. only the first couple of fields the user touched. Flush every 5s so the
    // dashboard reflects everything the user has done on the current page.
    const fisFlushTimer = setInterval(() => {
      try {
        if (session.events.length > (session.lastSentIndex || 0)) sendToServer(session);
      } catch { /* ignore */ }
    }, 5000);
    window.addEventListener('pagehide', () => clearInterval(fisFlushTimer));

    // ── Crash detection ───────────────────────────────────────────────────────
    // Write a heartbeat to localStorage every 30s. On a normal close (pagehide)
    // we clear it. A stale heartbeat on next load = previous session crashed.
    const CRASH_KEY = 'fis_alive';
    try {
      const prevAlive = localStorage.getItem(CRASH_KEY);
      if (prevAlive) {
        const aliveData = JSON.parse(prevAlive);
        if (aliveData.sessionId && aliveData.sessionId !== session.sessionId
            && Date.now() - (aliveData.ts || 0) < JOURNEY_TTL_MS) {
          addEvent(session, 'suspected_crash', {
            prevSessionId: aliveData.sessionId,
            prevFormId: aliveData.formId,
            staleSinceMs: Date.now() - (aliveData.ts || 0),
          });
          sendToServer(session);
        }
      }
    } catch { /* ignore */ }
    const writeCrashAlive = () => {
      try {
        localStorage.setItem(CRASH_KEY, JSON.stringify({
          sessionId: session.sessionId, formId, ts: Date.now(),
        }));
      } catch { /* ignore */ }
    };
    writeCrashAlive();
    const crashAliveTimer = setInterval(writeCrashAlive, 30000);
    window.addEventListener('pagehide', () => {
      clearInterval(crashAliveTimer);
      try { localStorage.removeItem(CRASH_KEY); } catch { /* ignore */ }
    });

    // Returns the name of the field the user was most recently interacting with.
    // Rules (in priority order):
    //   1. A form input/select/textarea is currently focused → use it directly.
    //   2. Otherwise → use the last field_blur or field_focus event that:
    //      a. happened within the last 10 seconds (avoids blaming a field touched
    //         minutes ago on a previous step), AND
    //      b. whose element is still visible in the DOM (offsetParent !== null),
    //         which filters out fields from inactive wizard steps.
    // This intentionally does NOT try to infer a field from the active button's
    // panel siblings — that always returned the first (not the last-used) field.
    function getNearestField() {
      const active = document.activeElement;
      if (active && formEl.contains(active)) {
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName) && active.name) return active.name;
      }
      const now = Date.now();
      const lastFE = [...session.events].reverse().find((e) => {
        if (e.type !== 'field_blur' && e.type !== 'field_focus') return false;
        if (now - e.timestamp > 10000) return false;
        const el = formEl.querySelector(`[name="${e.field}"]`);
        return el && el.offsetParent !== null;
      });
      return lastFE?.field ?? null;
    }

    // Pre-capture a screenshot periodically so it's ready if the user closes the tab.
    // html2canvas can't run after pagehide (page unloads in <10ms), so we cache
    // the last screenshot in memory and attach it synchronously at close time.
    let cachedScreenshot = null;
    function scheduleScreenshotCache() {
      const capture = () => {
        captureAnnotatedScreenshot(formEl, 'form_abandon', {}).then((dataUrl) => {
          if (dataUrl) cachedScreenshot = dataUrl;
        }).catch(() => {});
        if (window.requestIdleCallback) {
          window.requestIdleCallback(capture, { timeout: 30000 });
        } else {
          setTimeout(capture, 30000);
        }
      };
      if (window.requestIdleCallback) {
        window.requestIdleCallback(capture, { timeout: 2000 });
      } else {
        setTimeout(capture, 2000);
      }
    }
    scheduleScreenshotCache();

    // Rolling "before" snapshot: refreshed frequently, highlighting whichever the user
    // last interacted with (a clicked button, else the currently focused field). Errors
    // that replace the whole screen (form_error/js_error/console_error) can no longer
    // show the trigger in their OWN screenshot, so this is attached as screenshotBefore.
    const ACTION_CONTEXT_MAX_AGE_MS = 45000;
    const FINAL_ERROR_CONTEXT_MAX_AGE_MS = 2 * 60 * 1000;
    const ACTION_CONTEXT_STORAGE_KEY = 'fis_action_context';
    let cachedActionScreenshot = (() => {
      try {
        const stored = JSON.parse(sessionStorage.getItem(ACTION_CONTEXT_STORAGE_KEY) || localStorage.getItem(ACTION_CONTEXT_STORAGE_KEY) || 'null');
        if (!stored || !stored.dataUrl || Date.now() - stored.time > FINAL_ERROR_CONTEXT_MAX_AGE_MS) return null;
        if (stored.journeyId && session.journeyId && stored.journeyId !== session.journeyId) return null;
        return stored;
      } catch { return null; }
    })();
    function rememberActionScreenshot(action) {
      cachedActionScreenshot = { ...action, journeyId: session.journeyId || null };
      try { sessionStorage.setItem(ACTION_CONTEXT_STORAGE_KEY, JSON.stringify(cachedActionScreenshot)); } catch { /* ignore */ }
      try { localStorage.setItem(ACTION_CONTEXT_STORAGE_KEY, JSON.stringify(cachedActionScreenshot)); } catch { /* ignore */ }
    }
    async function getFallbackTriggerContext() {
      try {
        const cache = cachedActionScreenshot;
        const actionShotAge = cache ? Date.now() - cache.time : Infinity;
        const maxActionAge = ACTION_CONTEXT_MAX_AGE_MS;
        if (cache && actionShotAge < maxActionAge) return cache;
        const interaction = window.__FIS_lastInteractionContext;
        if (!interaction || Date.now() - interaction.time > maxActionAge) return null;
        const context = interaction.kind === 'button'
          ? { btnRect: interaction.rect, label: interaction.label }
          : { fieldRect: interaction.rect, label: interaction.label };
        const dataUrl = await captureAnnotatedScreenshot(formEl, 'action_context', context);
        if (dataUrl) {
          rememberActionScreenshot({ dataUrl, time: Date.now(), label: interaction.label, kind: interaction.kind });
          return cachedActionScreenshot;
        }
      } catch { /* ignore */ }
      return null;
    }
    function scheduleActionScreenshotCache() {
      const capture = () => {
        try {
          const lastClick = window.__FIS_lastButtonClick;
          const btnClickAge = lastClick ? Date.now() - lastClick.time : Infinity;
          const recentBtn = btnClickAge < ACTION_CONTEXT_MAX_AGE_MS ? lastClick : null;
          const active = document.activeElement;
          const isFocusedField = !recentBtn && active && formEl.contains(active) && active.name;
          const focusedField = isFocusedField ? active : null;

          let context = null;
          let kind = null;
          if (recentBtn) {
            context = { btnRect: recentBtn.rect, label: recentBtn.label };
            kind = 'button';
          } else if (focusedField) {
            context = { fieldRect: focusedField.getBoundingClientRect(), label: focusedField.name };
            kind = 'field';
          }
          if (context) {
            captureAnnotatedScreenshot(formEl, 'action_context', context).then((dataUrl) => {
              if (dataUrl) rememberActionScreenshot({ dataUrl, time: Date.now(), label: context.label, kind });
            }).catch(() => {});
          }
        } catch { /* ignore */ }
        if (window.requestIdleCallback) {
          window.requestIdleCallback(capture, { timeout: 5000 });
        } else {
          setTimeout(capture, 5000);
        }
      };
      if (window.requestIdleCallback) {
        window.requestIdleCallback(capture, { timeout: 2000 });
      } else {
        setTimeout(capture, 2000);
      }
    }
    scheduleActionScreenshotCache();

    // ── Visible-time counter ──────────────────────────────────────────────────
    // Only ticks while the page is actually visible — excludes tab switches,
    // sleep, and any period where the user has the page open but is elsewhere.
    // Used for scanTimeMs, pageTimeMs, and per-field timeSpentMs / idleTimeMs.
    let visibleMs = 0;
    let visibleSince = document.visibilityState === 'hidden' ? null : Date.now();

    function getVisibleMs() {
      return visibleSince !== null
        ? visibleMs + (Date.now() - visibleSince)
        : visibleMs;
    }

    formEl.querySelectorAll('input, select, textarea').forEach((field) => {
      // skip hidden fields and extension-injected fields (no name = not a real form field)
      if (!field.name || field.type === 'hidden') return;
      field.dataset.fisTracked = 'true';
      try { trackField(field, session, formEl, getVisibleMs, attachScreenshot); } catch { /* ignore */ }

      // File inputs never fire real focus/blur — the picker opens via programmatic
      // .click() (both the form's attachButton and plain HTML upload boxes do this).
      // Synthesise focus when anything in the field's container triggers a click that
      // opens the picker, and blur when the window regains focus (picker dismissed).
      if (field.type === 'file') {
        try {
          const container = field.closest('.field-wrapper, .upload-box, .file-drag-area, .field-group') || field.parentElement;
          let pickerOpenAt = 0; // timestamp — 0 means closed

          const onContainerClick = () => {
            // already open, or re-fired within 600 ms of opening (double-click / bubbled click)
            if (pickerOpenAt && Date.now() - pickerOpenAt < 600) return;
            pickerOpenAt = Date.now();
            field.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
          };

          const onWindowFocus = () => {
            if (!pickerOpenAt) return;
            // ignore focus events in the first 600 ms — those are OS dialog init noise,
            // not the picker actually closing (Chrome fires window focus on dialog open too)
            if (Date.now() - pickerOpenAt < 600) return;
            pickerOpenAt = 0;
            setTimeout(() => field.dispatchEvent(new FocusEvent('blur', { bubbles: true })), 150);
          };

          container.addEventListener('click', onContainerClick);
          window.addEventListener('focus', onWindowFocus);

          // file chosen — definitive close, dispatch blur immediately
          field.addEventListener('change', () => {
            pickerOpenAt = 0;
            setTimeout(() => field.dispatchEvent(new FocusEvent('blur', { bubbles: true })), 50);
          });
        } catch { /* ignore */ }
      }
    });

    // label copy — signals the user didn't understand what the label meant
    formEl.addEventListener('copy', () => {
      try {
        const copiedText = window.getSelection()?.toString().trim();
        if (!copiedText || copiedText.length < 3) return;
        formEl.querySelectorAll('label').forEach((label) => {
          const labelText = label.textContent.trim();
          if (!labelText || labelText.length < 3) return;
          // only fire if the copied text is the label or the label is what was copied
          if (copiedText === labelText || labelText.includes(copiedText) || copiedText.includes(labelText)) {
            const forId = label.getAttribute('for');
            const fieldEl = forId ? formEl.querySelector(`[id="${forId}"]`) : null;
            const field = fieldEl?.name || fieldEl?.id || forId || labelText.slice(0, 40);
            addEvent(session, 'label_copied', { field, labelText });
          }
        });
      } catch { /* ignore */ }
    });

    // scroll depth — track how far down the page the user reached (0–100)
    let maxScrollDepth = 0;
    window.addEventListener('scroll', () => {
      try {
        const scrolled = window.scrollY + window.innerHeight;
        const total = document.documentElement.scrollHeight;
        const depth = Math.round((scrolled / total) * 100);
        if (depth > maxScrollDepth) maxScrollDepth = depth;
      } catch { /* ignore */ }
    }, { passive: true });

    // scan phase state — declared here so sendAbandon can access them
    let firstInteractionRecorded = false;
    const scannedFields = [];

    // step/panel tracking for wizard forms
    let currentStep = getActiveStepInfo(formEl);
    // Step thrash detection: same two steps bouncing 3+ times = user is confused
    let stepPairBounce = { a: -1, b: -1, count: 0 };
    const stepThrashFired = new Set();
    const stepObserver = new MutationObserver(() => {
      try {
        const step = getActiveStepInfo(formEl);
        if (step.index !== currentStep.index) {
          const direction = step.index > currentStep.index ? 'next' : 'back';
          const fromIdx = currentStep.index;
          currentStep = step;
          addEvent(session, 'step_change', {
            step: currentStep.index,
            stepName: currentStep.name,
            direction,
          });
          // track back-and-forth between the same step pair
          const pairA = Math.min(fromIdx, currentStep.index);
          const pairB = Math.max(fromIdx, currentStep.index);
          const pairKey = `${pairA}-${pairB}`;
          if (pairA === stepPairBounce.a && pairB === stepPairBounce.b) {
            stepPairBounce.count += 1;
            if (stepPairBounce.count >= 3 && !stepThrashFired.has(pairKey)) {
              stepThrashFired.add(pairKey);
              addEvent(session, 'step_thrash', {
                stepA: pairA,
                stepB: pairB,
                bounceCount: stepPairBounce.count,
                step: currentStep.index,
                stepName: currentStep.name,
              });
              sendToServer(session);
            }
          } else {
            stepPairBounce = { a: pairA, b: pairB, count: 1 };
          }
        }
      } catch { /* ignore */ }
    });
    formEl.querySelectorAll('fieldset').forEach((fs) => {
      stepObserver.observe(fs, { attributes: true, attributeFilter: ['class'] });
    });

    function attachScanTracking(fieldEl) {
      try {
        if (fieldEl.dataset.fisScanTracked) return;
        fieldEl.dataset.fisScanTracked = 'true';
        const fieldName = fieldEl.name || fieldEl.id;
        if (!fieldName) return;

        fieldEl.addEventListener('focus', () => {
          try {
            if (!firstInteractionRecorded) {
              firstInteractionRecorded = true;
              addEvent(session, 'form_scan_end', {
                scannedFields: [...scannedFields],
                scannedCount: scannedFields.length,
                scanTimeMs: getVisibleMs(),
              });
            }
          } catch { /* ignore */ }
        });

        const scanObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            try {
              if (entry.isIntersecting && !firstInteractionRecorded && !scannedFields.includes(fieldName)) {
                scannedFields.push(fieldName);
              }
            } catch { /* ignore */ }
          });
        });
        scanObserver.observe(fieldEl);
      } catch { /* ignore */ }
    }

    formEl.querySelectorAll('input, select, textarea').forEach(attachScanTracking);

    const mutationObserver = new MutationObserver(() => {
      formEl.querySelectorAll('input, select, textarea').forEach((field) => {
        if (!field.name || field.type === 'hidden') return;
        if (!field.dataset.fisTracked) {
          field.dataset.fisTracked = 'true';
          try { trackField(field, session, formEl, getVisibleMs, attachScreenshot); } catch { /* ignore */ }
        }
        attachScanTracking(field);
      });
    });
    mutationObserver.observe(formEl, { childList: true, subtree: true });

    // track SPA url changes mid-journey
    ['pushState', 'replaceState'].forEach((method) => {
      const original = history[method].bind(history);
      history[method] = function (...args) {
        const prevPath = window.location.pathname + window.location.search;
        original(...args);
        const nextPath = window.location.pathname + window.location.search;
        if (nextPath !== prevPath) {
          addEvent(session, 'url_change', { from: prevPath, to: nextPath });
          sendToServer(session);
        }
      };
    });

    // rule_triggered: rules/index.js sets data-visible on .field-wrapper when a rule fires
    const ruleVisibilityObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        try {
          if (mutation.attributeName !== 'data-visible') return;
          const wrapper = mutation.target;
          const fieldInput = wrapper.querySelector('[name]');
          const fieldName = fieldInput?.name || wrapper.id || 'panel';
          const isNowVisible = wrapper.dataset.visible !== 'false';
          const wasVisible = mutation.oldValue !== 'false';
          if (isNowVisible === wasVisible) return;
          addEvent(session, 'rule_triggered', {
            field: fieldName,
            property: 'visible',
            from: wasVisible,
            to: isNowVisible,
            step: currentStep.index,
            stepName: currentStep.name,
          });
          // A "thank you" / success panel becoming visible is the form's own rule
          // engine confirming real completion — a reliable signal independent of
          // which network mechanism the actual submit call used (fetch, XHR, an
          // iframe we don't patch, or even a native form POST that bypasses both).
          // Without this, a genuinely successful submission can be missed entirely
          // and later reported as abandoned.
          if (isNowVisible && !wasVisible && /thank.?you/i.test(fieldName)) {
            recordSubmitOutcomeFromPanel(wrapper, 'thank_you_fragment');
          }
        } catch { /* ignore */ }
      });
    });
    ruleVisibilityObserver.observe(formEl, {
      attributes: true,
      attributeFilter: ['data-visible'],
      attributeOldValue: true,
      subtree: true,
    });

    let abandonSent = false;
    let submitAttempts = 0;

    function recordSubmitOutcomeFromPanel(panel, source = 'submit_panel') {
      window.setTimeout(() => {
        try {
          const text = compactText(panel?.textContent || document.body?.textContent || '').slice(0, 500);
          if (isFinalSubmissionFailureText(text)) {
            if (!session.events.some((e) => e.type === 'form_error' && isFinalSubmissionFailureText(e.statusText || e.message || ''))) {
              addEvent(session, 'form_error', {
                callType: 'ui_message',
                statusText: text.slice(0, 300),
                nearestField: getNearestField(),
                step: currentStep.index,
                stepName: currentStep.name,
              });
            }
            if (!session.events.some((e) => e.type === 'form_submit' && e.failed)) {
              addEvent(session, 'form_submit', {
                attemptNumber: submitAttempts || 1,
                failed: true,
                source: 'final_ui_failure',
                step: currentStep.index,
                stepName: currentStep.name,
              });
            }
            attachScreenshot('form_error', { callType: 'ui_message', statusText: text.slice(0, 300) });
            sendToServer(session);
            return;
          }
          if (!session.events.some((e) => e.type === 'form_submit')) {
            addEvent(session, 'form_submit', { attemptNumber: submitAttempts || 1, viaRuleEngine: true, source });
            clearProgress();
            clearJourney(session.formId);
            sendToServer(session);
          }
        } catch { /* ignore */ }
      }, 800);
    }

    // attach a screenshot to the most recently added event of the given type.
    // Only one screenshot is captured per event type per session to avoid data bloat —
    // repeated firings are counted in the analytics timeline, not re-screenshotted.
    async function attachScreenshot(eventType, context) {
      try {
        const isFinalSubmitFailure = eventType === 'form_error'
          && isFinalSubmissionFailureText(context?.statusText || context?.message || '');
        if (!isFinalSubmitFailure && session.events.some((e) => e.type === eventType && e.screenshot)) {
          // mark the latest matching event so the timeline can show "repeated error"
          const latest = [...session.events].reverse().find((e) => e.type === eventType && !e.screenshot && !e.screenshotDeduped);
          if (latest) latest.screenshotDeduped = true;
          return;
        }
        // These error types replace the whole screen, so their OWN screenshot can no
        // longer show what the user clicked/focused just before — freeze the rolling
        // "before" snapshot now (it can be overwritten before capture resolves) and
        // pass its label into the capture so the AFTER banner shows it too, not just
        // the dashboard caption.
        const screenReplacingError = ['form_error', 'api_error', 'js_error', 'console_error'].includes(eventType);
        const cache = cachedActionScreenshot;
        const actionShotAge = cache ? Date.now() - cache.time : Infinity;
        const maxActionAge = isFinalSubmitFailure ? FINAL_ERROR_CONTEXT_MAX_AGE_MS : ACTION_CONTEXT_MAX_AGE_MS;
        const latestClick = window.__FIS_lastButtonClick || null;
        const cacheMatchesLatestClick = !isFinalSubmitFailure
          || !latestClick
          || cache?.time >= (latestClick.time - 250);
        let trigger = null;
        if (screenReplacingError && !isFinalSubmitFailure) {
          trigger = actionShotAge < maxActionAge && cacheMatchesLatestClick ? cache : null;
          if (!trigger) {
            trigger = await getFallbackTriggerContext();
          }
        }
        const captureContext = trigger
          ? {
            ...context,
            triggerLabel: trigger.label,
            triggerKind: trigger.kind,
            triggerStep: currentStep.name,
          }
          : context;
        captureAnnotatedScreenshot(formEl, eventType, captureContext).then((dataUrl) => {
          if (!dataUrl) return;
          const ev = [...session.events].reverse().find((e) => e.type === eventType && !e.screenshot);
          if (!ev) return;
          ev.screenshot = dataUrl;
          if (trigger) {
            ev.screenshotBefore = trigger.dataUrl;
            // Caption text for the dashboard — "what did they click/focus right before
            // this" — shown even when the screenshot itself isn't visible/loaded yet.
            ev.triggeredByLabel = trigger.label;
            ev.triggeredByKind = trigger.kind;
          }
          // Screenshots are large (300KB–1MB base64). Persist to sessionStorage
          // without them so we never hit the 5MB quota; the server is the store.
          try {
            const stripShots = (e) => (e.screenshot ? { ...e, screenshot: undefined, screenshotBefore: undefined } : e);
            const lean = { ...session, events: session.events.map(stripShots) };
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(lean));
          } catch { /* quota exceeded — skip storage, server copy is authoritative */ }
          // The event may already be sent, or the original send may still be in
          // flight. Mark the event index for resend so the server receives the
          // screenshot and screenshotBefore once capture finishes.
          const evIdx = session.events.indexOf(ev);
          if (evIdx >= 0) {
            session.resendFromIndex = Math.min(
              typeof session.resendFromIndex === 'number' ? session.resendFromIndex : evIdx,
              evIdx,
            );
            if (evIdx < (session.lastSentIndex || 0)) {
              session.lastSentIndex = evIdx;
            }
          }
          sendToServer(session);
        }).catch(() => {});
      } catch { /* ignore */ }
    }

    // ── Refresh vs real-abandon detection ────────────────────────────────────
    // Strategy: always send the abandon on pagehide. On the NEXT page load of
    // the SAME URL (i.e. a genuine refresh), strip form_abandon and re-POST to
    // overwrite the server copy. Navigating to a different URL (e.g. analytics)
    // and coming back must NOT undo a real abandon.
    const UNLOAD_KEY = 'fis_unload';

    function sendAbandon() {
      try {
        if (abandonSent) return;
        const hasSubmitted = session.events.some((e) => e.type === 'form_submit');
        if (!hasSubmitted) {
          abandonSent = true;
          // capture scan data for users who previewed but never filled a field
          if (!firstInteractionRecorded) {
            firstInteractionRecorded = true;
            addEvent(session, 'form_scan_end', {
              scannedFields: [...scannedFields],
              scannedCount: scannedFields.length,
              scanTimeMs: getVisibleMs(),
            });
          }
          // replace any prior form_abandon so the beacon always has the latest step/field
          session.events = session.events.filter((e) => e.type !== 'form_abandon');
          // Only consider field events from the current step — scanning all events would
          // return a field from a previous step if the user navigated forward without
          // touching any field on the current step, falsely attributing the drop-off to
          // the wrong step in the abandonment chart.
          const stepEnteredAt = [...session.events].reverse()
            .find((e) => e.type === 'step_change' && e.stepName === currentStep.name)?.timestamp ?? 0;
          const lastFieldEvent = [...session.events].reverse()
            .find((e) => (e.type === 'field_blur' || e.type === 'field_focus') && e.timestamp >= stepEnteredAt);
          const lastDisabledClick = [...session.events].reverse()
            .find((e) => e.type === 'disabled_click');
          const ERROR_TYPES = new Set(['api_error', 'console_error', 'js_error', 'field_error']);
          const lastErrorEvent = [...session.events].reverse()
            .find((e) => ERROR_TYPES.has(e.type));
          // if the user clicked a disabled button AFTER their last field interaction,
          // the problem is the button — don't attribute the drop-off to the last field
          const blockedByButton = lastDisabledClick && lastFieldEvent
            && lastDisabledClick.timestamp > lastFieldEvent.timestamp;
          // if an error fired after the last field interaction, attribute drop-off to that error
          const blockedByError = !blockedByButton && lastErrorEvent
            && (!lastFieldEvent || lastErrorEvent.timestamp > lastFieldEvent.timestamp);
          // eslint-disable-next-line no-nested-ternary
          const lastField = blockedByButton ? null
            : blockedByError ? (lastErrorEvent.nearestField ?? lastFieldEvent?.field ?? null)
              : (lastFieldEvent?.field ?? null);
          addEvent(session, 'form_abandon', {
            step: currentStep.index,
            stepName: currentStep.name,
            lastField,
            blockedByError: blockedByError ? lastErrorEvent.type : undefined,
            blockedByDisabledButton: blockedByButton || undefined,
            pageTimeMs: getVisibleMs(),
            maxScrollDepth,
          });

          // Record this session as the journey's last-abandoned page so that if the user
          // returns to continue (e.g. back from a KYC redirect), the next page load can
          // retract this abandon and the journey reads as one continuous flow.
          try {
            if (session.journeyId) {
              const jkey = journeyKey(session.formId);
              const jraw = sessionStorage.getItem(jkey) || localStorage.getItem(jkey);
              if (jraw) {
                const j = JSON.parse(jraw);
                if (j.journeyId === session.journeyId) {
                  j.prevSessionId = session.sessionId;
                  j.savedAt = Date.now();
                  const jval = JSON.stringify(j);
                  try { sessionStorage.setItem(jkey, jval); } catch { /* quota */ }
                  try { localStorage.setItem(jkey, jval); } catch { /* quota */ }
                }
              }
            }
          } catch { /* ignore */ }

          // sendBeacon is synchronously queued by the browser at unload time,
          // guaranteeing the data is in-flight before the next page's requests.
          // Cross-origin note: form runs on :3001, server on :3000. Beacons with
          // application/json require a CORS preflight that browsers skip, so the
          // body gets dropped. text/plain is a "simple" CORS request — no preflight
          // needed — and the server parses it as JSON via express.text() middleware.
          const body = JSON.stringify(session);
          const sent = navigator.sendBeacon(
            SERVER_URL,
            new Blob([body], { type: 'text/plain' }),
          );
          if (!sent) {
            fetch(SERVER_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
              keepalive: true,
            }).catch(() => {});
          }
        }
      } catch { /* ignore */ }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // stop the visible-time counter
        if (visibleSince !== null) {
          visibleMs += Date.now() - visibleSince;
          visibleSince = null;
        }
        // snapshot field state before sendAbandon so annotation shows accurate state
        const fieldStateSnap = {};
        const fieldTypeSnap = {};
        try {
          formEl.querySelectorAll('input, select, textarea').forEach((el) => {
            if (!el.name || el.type === 'hidden') return;
            const empty = isFieldEmpty(el, formEl);
            fieldStateSnap[el.name] = empty ? 'empty' : (el.checkValidity?.() !== false ? 'filled' : 'invalid');
            fieldTypeSnap[el.name] = el.type;
          });
        } catch { /* ignore */ }
        sendAbandon();
        attachScreenshot('form_abandon', { fieldState: fieldStateSnap, fieldTypes: fieldTypeSnap });
      } else {
        // resume the visible-time counter
        visibleSince = Date.now();
        abandonSent = false;
      }
    });

    // write the unload record AFTER sendAbandon — stores the URL so
    // undoRefreshAbandon can tell a same-page refresh from a navigation away.
    // No screenshot here: the page unloads in <10ms after pagehide; html2canvas
    // takes ~300ms and will never resolve before the context is destroyed.
    window.addEventListener('pagehide', () => {
      sendAbandon();

      // If the form was submitted, flush any events still not sent to the server.
      // This catches the edge case where the periodic-flush sendInFlight guard was
      // active at submit time and the submit-time sendToServer returned early.
      const hasSubmitted = session.events.some((ev) => ev.type === 'form_submit');
      if (hasSubmitted) {
        try {
          const fromIdx = session.lastSentIndex || 0;
          const unsent = session.events.slice(fromIdx);
          if (unsent.length > 0) {
            const p = { sessionId: session.sessionId, events: unsent };
            if (fromIdx === 0) {
              p.meta = {
                formId: session.formId,
                journeyId: session.journeyId,
                pageIndex: session.pageIndex,
                pagePath: session.pagePath,
                device: session.device,
                startTime: session.startTime,
                returned: session.returned,
              };
            }
            const body = JSON.stringify(p);
            const beaconSent = navigator.sendBeacon(
              SERVER_URL,
              new Blob([body], { type: 'text/plain' }),
            );
            if (!beaconSent) {
              fetch(SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true,
              }).catch(() => {});
            }
          }
        } catch { /* ignore */ }
      }

      // Attach the pre-cached screenshot to the form_abandon event and save the full
      // session to localStorage. flushDeferredSession() will POST it on the next load
      // — bypassing both the beacon 64KB limit and the pagehide timing constraint.
      if (cachedScreenshot) {
        const abandonEv = [...session.events].reverse().find((e) => e.type === 'form_abandon' && !e.screenshot);
        if (abandonEv) {
          abandonEv.screenshot = cachedScreenshot;
          try { localStorage.setItem(DEFERRED_SESSION_KEY, JSON.stringify(session)); } catch { /* quota */ }
        }
      }
      try {
        sessionStorage.setItem(UNLOAD_KEY, JSON.stringify({
          ts: Date.now(),
          url: window.location.pathname,
        }));
      } catch { /* ignore */ }
    });

    formEl.addEventListener('submit', () => {
      try {
        submitAttempts += 1;
        // form_submit is recorded only when the submit fetch actually succeeds
        // (see fetch interceptor below) — avoids counting validation-blocked submits
      } catch { /* ignore */ }
    });

    // ── Submit error detection — intercept fetch to catch form submit failures ─
    // These hooks (fetch, XHR, console, window error/rejection, setTimeout/
    // setInterval) are page-global. AEM forms re-render and call trackForm again
    // on new containers; without this guard each call re-wraps window.fetch around
    // the previous wrapper, so one real API error is logged once per re-render
    // (seen as a hugely inflated count). Install them exactly once per page.
    if (!window.__FIS_GLOBAL_HOOKS) {
      window.__FIS_GLOBAL_HOOKS = true;
      window.__FIS_lastButtonClick = null;

    // URL pattern → callType for every form lifecycle endpoint
    const FORM_CALL_PATTERNS = [
      [/\/adobe\/forms\/af\/submit\//i, 'submit'],
      [/\/adobe\/forms\/af\/prefill\//i, 'prefill'],
      [/\/adobe\/forms\/af\/validate\//i, 'validate'],
      [/\/adobe\/forms\/af\/draft\//i, 'draft'],
      [/\/adobe\/forms\/af\/fileupload\//i, 'file_upload'],
      [/\/adobe\/forms\/af\/captcha\//i, 'captcha'],
      [/\/libs\/granite\/csrf\/token\.json/i, 'csrf'],
      // Some integrations aren't an AEM Adaptive Forms submit at all — they're a
      // custom banking/business API whose own "submit" call is the real completion
      // moment for that journey (e.g. HDFC's applyForLoan.json).
      [/\/applyForLoan\.json/i, 'submit'],
    ];

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        const matched = FORM_CALL_PATTERNS.find(([pattern]) => pattern.test(url));

        if (matched) {
          // ── Form lifecycle calls (submit, prefill, validate, …) ──────────────
          const callType = matched[1];
          const callStart = Date.now();
          try {
            const response = await originalFetch(...args);
            addEvent(session, 'perf_timing', {
              callType,
              latencyMs: Date.now() - callStart,
              status: response.status,
              step: currentStep.index,
            });
            let embeddedError = null;
            if (response.ok) {
              try { embeddedError = extractEmbeddedError(await response.clone().text()); } catch { /* ignore */ }
            }
            if (response.ok && embeddedError) {
              // HTTP 200 but the body reports a real failure (e.g. applyForLoan.json
              // can return 200 with a business-level rejection) — don't record this
              // as a successful form_submit just because the transport layer was fine.
              addEvent(session, 'form_error', {
                callType,
                status: response.status,
                statusText: embeddedError.description,
                responseBody: embeddedError.errorDesc || embeddedError.errorCode,
                layer: 'backend',
                url: url.replace(/[?#].*/, '').split('/').slice(-3).join('/'),
                step: currentStep.index,
                stepName: currentStep.name,
              });
              attachScreenshot('form_error', { callType, status: response.status, statusText: embeddedError.description });
              if (callType === 'submit') {
                addEvent(session, 'form_submit', { attemptNumber: submitAttempts, failed: true });
              }
            } else if (response.ok) {
              if (callType === 'submit') {
                addEvent(session, 'form_submit', { attemptNumber: submitAttempts });
                clearProgress();
                clearJourney(session.formId);
                // Wait for any concurrent periodic flush to finish before we send,
                // otherwise sendInFlight blocks us and form_submit is never delivered.
                // eslint-disable-next-line no-await-in-loop
                for (let w = 0; session.sendInFlight && w < 40; w += 1) {
                  // eslint-disable-next-line no-await-in-loop
                  await new Promise((r) => setTimeout(r, 50));
                }
                await sendToServer(session);
              }
            } else {
              let responseBody = null;
              try { responseBody = (await response.clone().text()).slice(0, 300); } catch { /* ignore */ }
              const statusText = response.status === 403
                ? 'Session / CSRF expired'
                : response.statusText || String(response.status);
              if (callType === 'submit') {
                addEvent(session, 'form_submit', { attemptNumber: submitAttempts, failed: true });
              }
              addEvent(session, 'form_error', {
                callType,
                status: response.status,
                statusText,
                responseBody,
                url: url.replace(/[?#].*/, '').split('/').slice(-3).join('/'),
                step: currentStep.index,
                stepName: currentStep.name,
              });
              attachScreenshot('form_error', { callType, status: response.status, statusText });
            }
            return response;
          } catch (err) {
            addEvent(session, 'form_error', {
              callType,
              status: 0,
              statusText: err.message || 'Network error',
              step: currentStep.index,
              stepName: currentStep.name,
            });
            attachScreenshot('form_error', { callType, status: 0, statusText: err.message || 'Network error' });
            err._fisTracked = true;
            throw err;
          }
        } else {
          // ── All other fetch calls — catch silent 4xx/5xx and network failures ─
          // Skip static assets, platform infra, the analytics server itself, and extensions
          // so we don't flood the tracker with irrelevant noise.
          // Deliberately excludes "json" — business APIs (panEnquiry.json,
          // consentreceipts.json, docUpload.json, …) all end in .json, so including
          // it here silently skipped every one of them from failure tracking.
          const isStaticAsset = /\.(css|js|mjs|html|png|jpg|jpeg|gif|svg|woff2?|ttf|ico|webp|avif)(\?|$)/i.test(url);
          const isAemInfra = /nav\.plain|footer\.plain|metadata\.json|\.plain\.html|\/aem\/|\/scripts\/|\/styles\/|\/fonts\/|\/icons\//i.test(url);
          const isAnalyticsServer = SERVER_BASE && url.startsWith(SERVER_BASE);
          const isExtension = /^(chrome|moz|safari)-extension:\/\//i.test(url);

          if (isStaticAsset || isAemInfra || isAnalyticsServer || isExtension || !url) {
            return originalFetch(...args);
          }

          // track this non-lifecycle API call for silent failures and waterfall
          const shortUrl = url.replace(/[?#].*/, '').split('/').slice(-3).join('/');
          const netT0 = Date.now();
          try {
            const response = await originalFetch(...args);
            if (!session.__netReqCount) session.__netReqCount = 0;
            if (session.__netReqCount < 200) {
              session.__netReqCount += 1;
              addEvent(session, 'network_request', {
                url: shortUrl,
                method: ((typeof args[1] === 'object' ? args[1]?.method : null) || 'GET').toUpperCase(),
                status: response.status,
                durationMs: Date.now() - netT0,
                step: currentStep.index,
              });
            }
            if (!response.ok) {
              const statusText = response.statusText || String(response.status);
              const reason = `HTTP ${response.status} ${statusText} — ${shortUrl}`;
              const triggeredByBtn = window.__FIS_lastButtonClick && Date.now() - window.__FIS_lastButtonClick.time < 5000 ? window.__FIS_lastButtonClick : null;
              addEvent(session, 'api_error', {
                reason,
                errorClass: classifyNetworkError(String(response.status)),
                status: response.status,
                url: shortUrl,
                nearestField: getNearestField(),
                triggeredBy: triggeredByBtn?.label || null,
                step: currentStep.index,
                stepName: currentStep.name,
              });
              attachScreenshot('api_error', { reason, btnRect: triggeredByBtn?.rect || null });
              sendToServer(session);
            } else {
              // Fix 3: detect silent failures — 2xx responses with error payload.
              // Uses extractEmbeddedError so this catches the same real-world shapes
              // (errorCode, responseCode: "1", embedded 4xx/5xx, failure phrases)
              // as the lifecycle-call branch above, not just a generic success:false.
              const ct = response.headers.get('content-type') || '';
              const cl = parseInt(response.headers.get('content-length') || '0', 10);
              if (ct.includes('application/json') && (cl === 0 || cl < 51200)) {
                response.clone().text().then((body) => {
                  try {
                    const embedded = extractEmbeddedError(body);
                    if (embedded) {
                      addEvent(session, 'api_error', {
                        reason: `${embedded.description} — ${shortUrl}`,
                        errorClass: 'backend_business_error',
                        status: response.status,
                        url: shortUrl,
                        nearestField: getNearestField(),
                        step: currentStep.index,
                        stepName: currentStep.name,
                      });
                      sendToServer(session);
                    }
                  } catch { /* not JSON */ }
                }).catch(() => {});
              }
            }
            return response;
          } catch (err) {
            const reason = err.message || 'Network error';
            const triggeredByBtn2 = window.__FIS_lastButtonClick && Date.now() - window.__FIS_lastButtonClick.time < 5000 ? window.__FIS_lastButtonClick : null;
            addEvent(session, 'api_error', {
              reason: `${reason} — ${shortUrl}`,
              errorClass: classifyNetworkError(reason),
              url: shortUrl,
              nearestField: getNearestField(),
              triggeredBy: triggeredByBtn2?.label || null,
              step: currentStep.index,
              stepName: currentStep.name,
            });
            attachScreenshot('api_error', { reason: `${reason} — ${shortUrl}`, btnRect: triggeredByBtn2?.rect || null });
            sendToServer(session);
            // mark as tracked so the unhandledrejection handler doesn't double-count it
            err._fisTracked = true;
            throw err;
          }
        }
      } catch (outerErr) {
        return originalFetch(...args);
      }
    };

    // ── Fix 1: XHR interception — catches AEM components that use XMLHttpRequest ─
    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function FisXHR() {
      const xhr = new OriginalXHR();
      let xhrUrl = '';
      const origOpen = xhr.open.bind(xhr);
      xhr.open = function xhrOpen(method, url, ...rest) {
        xhrUrl = String(url || '');
        return origOpen(method, url, ...rest);
      };
      const origSend = xhr.send.bind(xhr);
      xhr.send = function xhrSend(...sendArgs) {
        try {
          const shortUrl = xhrUrl.replace(/[?#].*/, '').split('/').slice(-3).join('/');
          // Deliberately excludes "json" — business APIs (panEnquiry.json,
          // consentreceipts.json, docUpload.json, …) all end in .json, so including
          // it here silently skipped every one of them from failure tracking.
          const skip = !xhrUrl
            || /\.(css|js|mjs|html|png|jpg|svg|woff2?|ttf|ico|webp)(\?|$)/i.test(xhrUrl)
            || /nav\.plain|footer\.plain|metadata\.json|\/aem\/|\/scripts\/|\/styles\//i.test(xhrUrl)
            || (SERVER_BASE && xhrUrl.startsWith(SERVER_BASE));
          // Lifecycle calls (submit/prefill/validate/…) can go out via XHR just as
          // easily as fetch — without this check here too, a 'submit' call that
          // happens to use XHR (e.g. a bank's own applyForLoan-style endpoint)
          // never gets recorded as form_submit, and the abandon logic then fires a
          // false form_abandon on the very next pagehide even though the form
          // actually completed successfully.
          const xhrMatched = FORM_CALL_PATTERNS.find(([pattern]) => pattern.test(xhrUrl));
          if (!skip) {
            const xhrT0 = Date.now();
            xhr.addEventListener('load', () => {
              try {
                if (xhr.status >= 400) {
                  if (xhrMatched?.[1] === 'submit') {
                    addEvent(session, 'form_submit', { attemptNumber: submitAttempts, failed: true });
                  }
                  addEvent(session, 'api_error', {
                    reason: `XHR HTTP ${xhr.status} — ${shortUrl}`,
                    errorClass: classifyNetworkError(String(xhr.status)),
                    status: xhr.status,
                    url: shortUrl,
                    nearestField: getNearestField(),
                    step: currentStep.index,
                    stepName: currentStep.name,
                  });
                  sendToServer(session);
                } else {
                  if (!session.__netReqCount) session.__netReqCount = 0;
                  if (session.__netReqCount < 200) {
                    session.__netReqCount += 1;
                    addEvent(session, 'network_request', {
                      url: shortUrl,
                      method: 'XHR',
                      status: xhr.status,
                      durationMs: Date.now() - xhrT0,
                      step: currentStep.index,
                    });
                  }
                  // HTTP 2xx doesn't mean success on these APIs — check the body too
                  const embedded = extractEmbeddedError(xhr.responseText || '');
                  if (embedded) {
                    if (xhrMatched?.[1] === 'submit') {
                      addEvent(session, 'form_submit', { attemptNumber: submitAttempts, failed: true });
                    }
                    addEvent(session, 'api_error', {
                      reason: `${embedded.description} — ${shortUrl}`,
                      errorClass: 'backend_business_error',
                      status: xhr.status,
                      url: shortUrl,
                      nearestField: getNearestField(),
                      step: currentStep.index,
                      stepName: currentStep.name,
                    });
                    sendToServer(session);
                  } else if (xhrMatched?.[1] === 'submit') {
                    addEvent(session, 'form_submit', { attemptNumber: submitAttempts });
                    clearProgress();
                    clearJourney(session.formId);
                    sendToServer(session);
                  }
                }
              } catch { /* ignore */ }
            });
            xhr.addEventListener('error', () => {
              try {
                addEvent(session, 'api_error', {
                  reason: `XHR network error — ${shortUrl}`,
                  errorClass: 'network_down',
                  url: shortUrl,
                  nearestField: getNearestField(),
                  step: currentStep.index,
                  stepName: currentStep.name,
                });
                sendToServer(session);
              } catch { /* ignore */ }
            });
            xhr.addEventListener('timeout', () => {
              try {
                addEvent(session, 'api_error', {
                  reason: `XHR timeout — ${shortUrl}`,
                  errorClass: 'timeout',
                  url: shortUrl,
                  nearestField: getNearestField(),
                  step: currentStep.index,
                  stepName: currentStep.name,
                });
                sendToServer(session);
              } catch { /* ignore */ }
            });
          }
        } catch { /* ignore */ }
        return origSend(...sendArgs);
      };
      return xhr;
    };
    window.XMLHttpRequest.prototype = OriginalXHR.prototype;

    // ── Fix 2: Web Worker error interception ─────────────────────────────────
    const OriginalWorker = window.Worker;
    if (OriginalWorker) {
      window.Worker = function FisWorker(scriptURL, options) {
        const worker = new OriginalWorker(scriptURL, options);
        worker.addEventListener('error', (e) => {
          try {
            addEvent(session, 'js_error', {
              message: e.message || 'Worker error',
              errorType: 'WorkerError',
              source: String(scriptURL || '').split('/').pop(),
              line: e.lineno,
              col: e.colno,
              nearestField: getNearestField(),
              step: currentStep.index,
              stepName: currentStep.name,
            });
            attachScreenshot('js_error', { message: e.message || 'Worker error' });
            sendToServer(session);
          } catch { /* ignore */ }
        });
        return worker;
      };
      window.Worker.prototype = OriginalWorker.prototype;
    }

    // ── Rule engine errors via guideBridge ───────────────────────────────────
    const tryAttachGuideBridge = () => {
      try {
        if (!window.guideBridge?.connect) return;
        window.guideBridge.connect(() => {
          try {
            // covers both expression errors and rule evaluation failures
            ['elementExpressionChanged', 'elementRuleError'].forEach((evtName) => {
              window.guideBridge.on(evtName, (bridgeEvent) => {
                try {
                  if (!bridgeEvent?.detail?.error && !bridgeEvent?.detail?.exception) return;
                  const errorText = bridgeEvent.detail?.error
                    || bridgeEvent.detail?.exception?.message
                    || 'Rule engine error';
                  // dedicated rule_failed event — separate from generic form_error
                  addEvent(session, 'rule_failed', {
                    field: bridgeEvent.detail?.fieldName || null,
                    expression: bridgeEvent.detail?.expression || null,
                    errorText,
                    step: currentStep.index,
                    stepName: currentStep.name,
                  });
                  // keep legacy form_error for backward compatibility
                  addEvent(session, 'form_error', {
                    callType: 'rule_engine',
                    statusText: errorText,
                    field: bridgeEvent.detail?.fieldName || null,
                    step: currentStep.index,
                    stepName: currentStep.name,
                  });
                  attachScreenshot('form_error', { callType: 'rule_engine', statusText: errorText });
                } catch { /* ignore */ }
              });
            });
          } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
    };
    tryAttachGuideBridge();
    setTimeout(tryAttachGuideBridge, 3000);

    // ── File upload errors — size and type checks ─────────────────────────────
    formEl.querySelectorAll('input[type="file"]').forEach((fileInput) => {
      try {
        fileInput.addEventListener('change', () => {
          try {
            [...(fileInput.files || [])].forEach((file) => {
              if (file.size > UPLOAD_MAX_MB * 1024 * 1024) {
                const statusText = `File "${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — exceeds ${UPLOAD_MAX_MB}MB limit`;
                addEvent(session, 'form_error', {
                  callType: 'file_too_large',
                  statusText,
                  field: fileInput.name || fileInput.id || 'file',
                  step: currentStep.index,
                });
                attachScreenshot('form_error', { callType: 'file_too_large', statusText });
              }
              if (UPLOAD_ALLOWED_TYPES.length && !UPLOAD_ALLOWED_TYPES.includes(file.type)) {
                const statusText = `File type "${file.type}" not allowed`;
                addEvent(session, 'form_error', {
                  callType: 'file_type_not_allowed',
                  statusText,
                  field: fileInput.name || fileInput.id || 'file',
                  step: currentStep.index,
                });
                attachScreenshot('form_error', { callType: 'file_type_not_allowed', statusText });
              }
            });
          } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
    });

    // ── Technical errors ──────────────────────────────────────────────────────

    // intercept console.error — catches explicit logging from form scripts
    // (window.onerror only catches uncaught exceptions, not console.error calls)
    const origConsoleError = console.error.bind(console);
    // eslint-disable-next-line no-console
    console.error = (...args) => {
      origConsoleError(...args);
      try {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ').slice(0, 300);
        const consoleNearestField = getNearestField();
        addEvent(session, 'console_error', {
          message: msg,
          errorClass: classifyConsoleError(msg),
          nearestField: consoleNearestField,
          step: currentStep.index,
          stepName: currentStep.name,
        });
        attachScreenshot('console_error', { message: msg });
        sendToServer(session);
      } catch { /* ignore */ }
    };

    // Fix 4: console.warn — only track warnings that match known AEM/form error patterns
    const origConsoleWarn = console.warn.bind(console);
    // eslint-disable-next-line no-console
    console.warn = (...args) => {
      origConsoleWarn(...args);
      try {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ').slice(0, 300);
        if (/guideBridge|afb-runtime|rule.?engine|null ref|undefined is not|cannot read|failed to|cors/i.test(msg)) {
          addEvent(session, 'console_error', {
            message: `[warn] ${msg}`,
            errorClass: classifyConsoleError(msg),
            nearestField: getNearestField(),
            step: currentStep.index,
            stepName: currentStep.name,
          });
          sendToServer(session);
        }
      } catch { /* ignore */ }
    };

    // console.log and console.info — rate-limited general log capture (max 50/session)
    let fisConsoleLogCount = 0;
    const FIS_LOG_NOISE = /afb-runtime|guideBridge|html2canvas|fis_|webpack|hot.?reload|\[HMR\]|livereload|vite/i;
    ['log', 'info'].forEach((level) => {
      const origLevel = console[level].bind(console);
      // eslint-disable-next-line no-console
      console[level] = (...args) => {
        origLevel(...args);
        try {
          if (fisConsoleLogCount >= 50) return;
          const msg = args.map((a) => {
            try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch { return '[object]'; }
          }).join(' ').slice(0, 200);
          if (FIS_LOG_NOISE.test(msg)) return;
          fisConsoleLogCount += 1;
          addEvent(session, 'console_log', { level, message: msg });
        } catch { /* ignore */ }
      };
    });

    // capture phase catches both JS errors and resource load failures (img/script/link 404s)
    window.addEventListener('error', (e) => {
      try {
        const target = e.target;
        const isResourceError = target && target !== window && target.tagName;

        if (isResourceError) {
          // resource load failure — script/img/link/video failed to load
          const tag = target.tagName.toLowerCase();
          if (!['img', 'script', 'link', 'video', 'audio', 'source'].includes(tag)) return;
          const src = target.src || target.href || '';
          // skip platform infrastructure resources and browser extensions
          if (/^(chrome|moz|safari)-extension:\/\//i.test(src)) return;
          if (/html2canvas/i.test(src)) return;
          if (/\/(aem|scripts|styles|fonts|icons)\//i.test(src)
            || /nav\.plain|footer\.plain|metadata\.json/i.test(src)) return;
          const shortSrc = src.split('/').slice(-2).join('/') || src.slice(-60);
          addEvent(session, 'console_error', {
            message: `Failed to load ${tag}: ${shortSrc}`,
            errorClass: 'missing_resource',
            nearestField: getNearestField(),
            step: currentStep.index,
            stepName: currentStep.name,
          });
          sendToServer(session);
          return;
        }

        // JS exception
        const src = e.filename || '';
        if (/^(chrome|moz|safari)-extension:\/\//i.test(src)) return;
        if (/\/(aem|scripts|styles|fonts|icons)\//i.test(src)
          || /nav\.plain|footer\.plain|metadata\.json/i.test(src)) return;
        const jsNearestField = getNearestField();
        addEvent(session, 'js_error', {
          message: e.message,
          errorType: e.error?.constructor?.name || 'Error',
          source: src.split('/').pop(),
          line: e.lineno,
          col: e.colno,
          stack: e.error?.stack?.split('\n').slice(0, 4).join(' | ').slice(0, 300) || null,
          nearestField: jsNearestField,
          step: currentStep.index,
          stepName: currentStep.name,
        });
        attachScreenshot('js_error', { message: e.message });
        sendToServer(session);
      } catch { /* ignore */ }
    }, true); // true = capture phase, required for resource load errors

    // CSP violations — Chrome/Edge only, shows in console as "Refused to load..."
    try {
      if ('ReportingObserver' in window) {
        const reportingObserver = new ReportingObserver((reports) => {
          reports.forEach((report) => {
            try {
              const body = report.body || {};
              const msg = report.type === 'csp-violation'
                ? `CSP violation: blocked ${body.blockedURL || 'unknown'} (${body.effectiveDirective || report.type})`
                : `Browser report: ${report.type} — ${body.message || body.blockedURL || ''}`;
              addEvent(session, 'console_error', {
                message: msg.slice(0, 300),
                errorClass: report.type === 'csp-violation' ? 'csp' : 'unknown',
                nearestField: getNearestField(),
                step: currentStep.index,
                stepName: currentStep.name,
              });
              sendToServer(session);
            } catch { /* ignore */ }
          });
        }, { buffered: true });
        reportingObserver.observe();
      }
    } catch { /* ignore — ReportingObserver not available */ }

    window.addEventListener('unhandledrejection', (e) => {
      try {
        const reason = e.reason?.message || String(e.reason);
        // ignore static asset / platform infrastructure 404s — not user-facing API failures
        const isAsset = /\.(css|js|html|png|svg|woff2?|ttf|ico)(\?|$)/i.test(reason)
          || /nav\.plain|footer\.plain|metadata\.json|\.plain\.html/i.test(reason)
          || e.reason instanceof Event; // script/link element onerror fired as rejection
        // browser extension message channel errors — not related to the form
        const isExtension = /message channel closed|asynchronous response by returning true/i.test(reason);
        // form lifecycle API calls are already captured by the fetch interceptor as form_error —
        // catching them here too would double-count them as api_error.
        // Other fetch failures are also captured by the expanded interceptor (_fisTracked flag).
        const isFormLifecycleApi = /\/adobe\/forms\/af\//i.test(reason)
          || /\/libs\/granite\/csrf\//i.test(reason);
        const alreadyTracked = e.reason?._fisTracked === true;
        if (isAsset || isExtension || isFormLifecycleApi || alreadyTracked) return;
        const triggeredByBtn3 = window.__FIS_lastButtonClick && Date.now() - window.__FIS_lastButtonClick.time < 5000 ? window.__FIS_lastButtonClick : null;
        addEvent(session, 'api_error', {
          reason: reason.slice(0, 200),
          errorClass: classifyNetworkError(reason),
          nearestField: getNearestField(),
          triggeredBy: triggeredByBtn3?.label || null,
          step: currentStep.index,
          stepName: currentStep.name,
        });
        attachScreenshot('api_error', { reason, btnRect: triggeredByBtn3?.rect || null });
        sendToServer(session);
      } catch { /* ignore */ }
    });

    // ── Fix 5: setTimeout/setInterval wrapping — catches errors that escape window.onerror ─
    const origSetTimeout = window.setTimeout;
    const origSetInterval = window.setInterval;

    window.setTimeout = function fisSetTimeout(fn, delay, ...rest) {
      if (typeof fn !== 'function') return origSetTimeout(fn, delay, ...rest);
      return origSetTimeout(() => {
        try { fn(...rest); } catch (err) {
          try {
            if (!err._fisTracked) {
              err._fisTracked = true;
              addEvent(session, 'js_error', {
                message: err.message || 'setTimeout callback error',
                errorType: err.constructor?.name || 'Error',
                stack: err.stack?.split('\n').slice(0, 4).join(' | ').slice(0, 300) || null,
                nearestField: getNearestField(),
                step: currentStep.index,
                stepName: currentStep.name,
              });
              sendToServer(session);
            }
          } catch { /* ignore */ }
          throw err;
        }
      }, delay);
    };

    window.setInterval = function fisSetInterval(fn, delay, ...rest) {
      if (typeof fn !== 'function') return origSetInterval(fn, delay, ...rest);
      return origSetInterval(() => {
        try { fn(...rest); } catch (err) {
          try {
            if (!err._fisTracked) {
              err._fisTracked = true;
              addEvent(session, 'js_error', {
                message: err.message || 'setInterval callback error',
                errorType: err.constructor?.name || 'Error',
                stack: err.stack?.split('\n').slice(0, 4).join(' | ').slice(0, 300) || null,
                nearestField: getNearestField(),
                step: currentStep.index,
                stepName: currentStep.name,
              });
              sendToServer(session);
            }
          } catch { /* ignore */ }
          // don't rethrow — one bad tick shouldn't cancel the interval
        }
      }, delay);
    };
    } // end one-time global hooks

    // ── Core Web Vitals ───────────────────────────────────────────────────────
    // Observed once per page via a separate guard so AEM re-renders don't
    // double-register observers. Uses the first trackForm call's session/step.
    if (!window.__FIS_PERF_HOOKS && 'PerformanceObserver' in window) {
      window.__FIS_PERF_HOOKS = true;

      // LCP — Largest Contentful Paint (good <2500ms, poor ≥4000ms)
      try {
        let lcpMs = 0;
        const lcpObs = new PerformanceObserver((list) => {
          try {
            const entries = list.getEntries();
            if (entries.length) lcpMs = Math.round(entries[entries.length - 1].startTime);
          } catch { /* ignore */ }
        });
        lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
        // LCP finalises on first user interaction or page hide — report at that point
        const reportLcp = () => {
          if (!lcpMs) return;
          const v = lcpMs;
          lcpMs = 0; // prevent double-report
          addEvent(session, 'perf_vitals', {
            metric: 'LCP',
            valueMs: v,
            rating: v < 2500 ? 'good' : v < 4000 ? 'needs-improvement' : 'poor',
            step: currentStep.index,
          });
          if (v >= 2500) sendToServer(session); // only flush if actionable
        };
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') reportLcp();
        });
        ['pointerdown', 'keydown'].forEach((ev) => {
          document.addEventListener(ev, reportLcp, { once: true, passive: true });
        });
      } catch { /* PerformanceObserver unavailable */ }

      // INP — Interaction to Next Paint: max observed interaction latency
      // good <200ms, needs-improvement <500ms, poor ≥500ms
      try {
        let inpMax = 0;
        const inpObs = new PerformanceObserver((list) => {
          try {
            list.getEntries().forEach((entry) => {
              if (entry.duration > inpMax) inpMax = Math.round(entry.duration);
            });
          } catch { /* ignore */ }
        });
        inpObs.observe({ type: 'event', durationThreshold: 16, buffered: true });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'hidden' || inpMax < 200) return;
          addEvent(session, 'perf_vitals', {
            metric: 'INP',
            valueMs: inpMax,
            rating: inpMax < 200 ? 'good' : inpMax < 500 ? 'needs-improvement' : 'poor',
            step: currentStep.index,
          });
          sendToServer(session);
        });
      } catch { /* ignore — event observer not available in all browsers */ }

      // Long Tasks — individual JS tasks that block the main thread >500ms
      try {
        const ltObs = new PerformanceObserver((list) => {
          try {
            list.getEntries().forEach((entry) => {
              if (entry.duration < 500) return; // ignore brief jank; 500ms+ noticeably freezes the UI
              addEvent(session, 'perf_long_task', {
                durationMs: Math.round(entry.duration),
                step: currentStep.index,
                stepName: currentStep.name,
              });
              sendToServer(session);
            });
          } catch { /* ignore */ }
        });
        ltObs.observe({ type: 'longtask', buffered: false });
      } catch { /* longtask not supported in this browser */ }
    }

    // ── Behavioural frustration ───────────────────────────────────────────────

    // Rage click: 3+ clicks on same button within 600ms
    let rageState = { el: null, count: 0, time: 0, fired: false };
    formEl.addEventListener('click', (e) => {
      try {
        const target = e.target.closest('button, [role="button"], input[type="submit"]');
        if (!target) return;
        const label = target.textContent?.trim().slice(0, 40) || target.id || target.value || 'button';
        const rect = target.getBoundingClientRect();
        window.__FIS_lastButtonClick = {
          label,
          rect,
          time: Date.now(),
        };
        rememberInteractionContext('button', label, rect);
        addEvent(session, 'button_click', {
          element: label,
          step: currentStep.index,
          stepName: currentStep.name,
        });
        const now = Date.now();
        if (target === rageState.el && now - rageState.time < 600) {
          rageState.count += 1;
          rageState.time = now;
          if (rageState.count >= 2 && !rageState.fired) {
            rageState.fired = true;
            addEvent(session, 'rage_click', {
              element: label,
              clicks: rageState.count + 1,
              step: currentStep.index,
              stepName: currentStep.name,
            });
            attachScreenshot('rage_click', { element: label });
          }
        } else {
          rageState = { el: target, count: 0, time: now, fired: false };
        }
      } catch { /* ignore */ }
    });

    // Disabled button click: user doesn't know why they can't proceed.
    // Use pointerdown — browsers suppress 'click' on disabled elements but
    // pointerdown always fires, even in capture phase.
    formEl.addEventListener('pointerdown', (e) => {
      try {
        const target = e.target.closest('[disabled]')
          || (e.target.hasAttribute?.('disabled') ? e.target : null);
        if (!target) return;

        // capture which fields are blocking submission right now
        const invalidFields = [];
        const currentFieldState = {};
        try {
          formEl.querySelectorAll('input, select, textarea').forEach((el) => {
            if (!el.name || el.type === 'hidden') return;
            const empty = isFieldEmpty(el, formEl);
            currentFieldState[el.name] = empty ? 'empty' : (el.checkValidity?.() !== false ? 'filled' : 'invalid');
            if (el.required && (empty || !el.checkValidity())) invalidFields.push(el.name || el.id || 'unknown');
          });
          if (window.guideBridge?.isConnected?.()) {
            const result = window.guideBridge.validate();
            if (result?.invalidFields?.length) invalidFields.splice(0, invalidFields.length, ...result.invalidFields);
          }
        } catch { /* ignore */ }

        addEvent(session, 'disabled_click', {
          element: target.textContent?.trim().slice(0, 40) || target.id || 'button',
          step: currentStep.index,
          stepName: currentStep.name,
          invalidFields: invalidFields.slice(0, 10),
        });
        const btnRect = target.getBoundingClientRect();
        attachScreenshot('disabled_click', { invalidFields, fieldState: currentFieldState, btnRect });
        // send immediately so analytics shows it even before abandon/submit
        sendToServer(session);
      } catch { /* ignore */ }
    }, true);

    // Dead click: click on non-interactive element with no resulting DOM change.
    // Observe formEl only — document.body would pick up unrelated nav/header/footer
    // mutations and mask real dead clicks inside the form.
    let lastDomMutationTime = Date.now();
    const deadClickObserver = new MutationObserver(() => { lastDomMutationTime = Date.now(); });
    deadClickObserver.observe(formEl, { childList: true, subtree: true, attributes: true });

    formEl.addEventListener('click', (e) => {
      try {
        if (e.target.closest('button, a, input, select, textarea, label, [role="button"], [tabindex], [onclick]')) return;
        // only count as dead click when the element shows a pointer cursor —
        // that means the browser told the user "this is clickable" but nothing happened.
        // clicks on plain text, paragraphs, or whitespace are reading behaviour, not dead clicks.
        const cursor = window.getComputedStyle(e.target).cursor;
        if (cursor !== 'pointer') return;
        const clickTime = Date.now();
        const tag = e.target.tagName?.toLowerCase() || 'unknown';
        const cls = String(e.target.className || '').trim().split(/\s+/)[0];
        const el = `${tag}${e.target.id ? `#${e.target.id}` : cls ? `.${cls}` : ''}`.slice(0, 60);
        setTimeout(() => {
          if (lastDomMutationTime < clickTime) {
            addEvent(session, 'dead_click', { element: el, step: currentStep.index, stepName: currentStep.name });
            attachScreenshot('dead_click', { element: el });
          }
        }, 400);
      } catch { /* ignore */ }
    });

    // detect progress indicator presence — no indicator = users can't gauge form length
    const hasProgressIndicator = !!(
      document.querySelector('[role="progressbar"], .progress, .progress-bar, .step-indicator, .wizard-steps, .fis-steps, nav[aria-label*="step" i]')
    );

    // detect forced account creation — password field in first visible step
    const firstStep = formEl.querySelector('fieldset') || formEl;
    const hasAccountCreation = !!firstStep.querySelector('input[type="password"]');

    // field count per step — high count per step signals overwhelming form
    // only query step fieldsets that the wizard assigned data-index to;
    // the outer wizard panel is also a fieldset but has no data-index, so
    // a plain querySelectorAll('fieldset') would include it and shift all
    // indices by 1, causing Declaration (data-index 3) to never match.
    const stepsInfo = [...formEl.querySelectorAll('fieldset[data-index]')].map((fs) => {
      const idx = parseInt(fs.dataset.index, 10);
      return {
        index: idx,
        name: fs.querySelector('legend')?.textContent?.trim() || `Step ${idx + 1}`,
        fieldCount: fs.querySelectorAll('input, select, textarea').length,
        requiredCount: fs.querySelectorAll('[required]').length,
      };
    });

    if (!session.events.some((e) => e.type === 'form_start')) {
      addEvent(session, 'form_start', { hasProgressIndicator, hasAccountCreation, stepsInfo });
    }

    const allFields = [...formEl.querySelectorAll('input, select, textarea')]
      .map((el) => el.name || el.id)
      .filter(Boolean);

    // capture metadata for text-type fields (placeholder suggestions) and file fields
    // (so the analyzer can suppress inapplicable signals like revisit anxiety for uploads)
    const TEXT_TYPES = new Set(['text', 'email', 'number', 'tel', 'password', 'search', 'url', 'textarea']);
    const SENSITIVE_KEYWORDS = ['ssn', 'national_id', 'nin', 'passport', 'dob', 'birth', 'salary', 'income', 'bank', 'account', 'card', 'tax', 'credit', 'debit', 'iban', 'license', 'visa', 'identity'];
    const fieldMeta = [...formEl.querySelectorAll('input, select, textarea')]
      .filter((el) => el.name && (TEXT_TYPES.has(el.type || el.tagName.toLowerCase()) || el.type === 'file' || el.tagName.toLowerCase() === 'select'))
      .map((el) => {
        const wrapper = el.closest('.field-wrapper') || el.parentElement;
        const descEl = wrapper?.querySelector('.field-description, [class*="description"], [class*="hint"]');
        const labelEl = wrapper?.querySelector('label') || formEl.querySelector(`label[for="${el.id}"]`);
        const labelText = labelEl?.textContent?.trim().replace(/\s*\*\s*$/, '') || '';
        const fieldKey = (el.name || el.id || '').toLowerCase();
        return {
          name: el.name,
          fieldType: el.type || el.tagName.toLowerCase(),
          hasPlaceholder: !!(el.placeholder?.trim()),
          hasDescription: !!(descEl?.textContent?.trim()),
          isRequired: el.required,
          labelLength: labelText.length,
          labelWordCount: labelText ? labelText.split(/\s+/).filter(Boolean).length : 0,
          isSensitive: SENSITIVE_KEYWORDS.some((kw) => fieldKey === kw || fieldKey.includes(kw)),
        };
      });

    addEvent(session, 'form_fields', { fields: allFields, fieldMeta });
  } catch { /* tracker failed silently — form continues working normally */ }
}

export default function decorate(block) {
  const serverBaseUrl = block.dataset.serverUrl || DEFAULT_SERVER;
  const formEl = block.closest('form') || block.querySelector('form') || block;
  trackForm(formEl, serverBaseUrl);
}
