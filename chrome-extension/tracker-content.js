// Re-injection guard. The manifest auto-injects this script on page load; the popup's
// "Start Tracking" injects it again. Both land in the same isolated world, so a second
// run would redeclare the top-level consts and throw. On re-injection we skip all the
// declarations and just honor a forced start via the already-loaded start function.
if (window.__FIS_CONTENT_LOADED) {
  if (window.__FIS_FORCE === true && typeof window.__fisStartTracking === 'function') {
    window.__fisStartTracking();
  }
} else {
  window.__FIS_CONTENT_LOADED = true;

const SESSION_KEY = 'fis_session';
const PROGRESS_KEY = 'fis_progress';

const DEFERRED_SESSION_KEY = 'fis_deferred_ss';
const JOURNEY_KEY = 'fis_journey';
// Not scoped by formId/path — lets a same-origin, multi-path redirect chain (e.g. an
// SPA that does full page loads between KYC steps at different paths) hand off the
// journey via sessionStorage, which is written and read synchronously. The per-form
// JOURNEY_KEY above can't help here since each step has a different formId/path, and
// the async chrome.storage.local handoff (below) can lose the race when a step
// auto-redirects before that write's IPC round-trip completes.
const ORIGIN_JOURNEY_KEY = 'fis_journey_origin';
const ORIGIN_JOURNEY_TTL = 60 * 1000;
const JID_PARAM = '_fis_jid';
const PIDX_PARAM = '_fis_pidx';
const PREV_SID_PARAM = '_fis_prev_sid';
const DEFAULT_SERVER = window.__FIS_SERVER || 'http://localhost:3000';
let SERVER_URL = `${DEFAULT_SERVER}/events`;
let SERVER_BASE = DEFAULT_SERVER;

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
    const JOURNEY_TTL = 2 * 60 * 60 * 1000;

    const saveJourney = (journey) => {
      const val = JSON.stringify({ ...journey, formId, savedAt: Date.now() });
      sessionStorage.setItem(KEY, val);
      localStorage.setItem(KEY, val);
      // cross-domain: write to extension storage so the tracker on other domains
      // (e.g. HDFC's KYC page) can continue this journey within the 60s TTL
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({
            fis_xdomain_journey: {
              journeyId: journey.journeyId,
              pageIndex: journey.pageCount,
              savedAt: Date.now(),
              fromHost: window.location.host,
            },
          });
        }
      } catch { /* ignore — extension context may be unavailable */ }
    };

    const clearStored = () => {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
    };

    const rawStored = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
    const stored = rawStored && (Date.now() - (JSON.parse(rawStored).savedAt || 0)) < JOURNEY_TTL
      ? rawStored : null;
    if (!stored && rawStored) clearStored();

    if (stored) {
      const journey = JSON.parse(stored);
      // same-page refresh detection — don't increment if URL unchanged within 10s
      const unloadRaw = sessionStorage.getItem('fis_unload');
      if (unloadRaw) {
        const { ts, url } = JSON.parse(unloadRaw);
        if (url === window.location.pathname && Date.now() - ts < 10000) {
          return { journeyId: journey.journeyId, pageIndex: journey.pageCount };
        }
      }
      journey.pageCount += 1;
      saveJourney(journey);
      return { journeyId: journey.journeyId, pageIndex: journey.pageCount };
    }

    // same-origin, different-path continuation (see ORIGIN_JOURNEY_KEY comment above) —
    // consumed immediately so an unrelated later visit to another form on this origin,
    // in the same tab, doesn't inherit a stale journey.
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

    // cross-domain redirect — journeyId passed via URL param
    if (urlJid) {
      const pageCount = urlPidx ? parseInt(urlPidx, 10) : 1;
      const journey = { journeyId: urlJid, pageCount };
      if (urlPrevSid && !window.__FIS_RETRACT_SESSION_ID) {
        window.__FIS_RETRACT_SESSION_ID = urlPrevSid;
      }
      saveJourney(journey);
      return { journeyId: urlJid, pageIndex: pageCount };
    }

    // cross-domain continuation — loaded by init() from chrome.storage.local before tracking starts
    if (window.__FIS_XDOMAIN_JOURNEY) {
      const xj = window.__FIS_XDOMAIN_JOURNEY;
      window.__FIS_XDOMAIN_JOURNEY = null; // consume so only one page uses it
      const pageCount = xj.pageIndex + 1;
      const journey = { journeyId: xj.journeyId, pageCount };
      saveJourney(journey);
      return { journeyId: xj.journeyId, pageIndex: pageCount };
    }

    // new journey
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
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function addEvent(session, type, data = {}) {
  session.events.push({ type, timestamp: Date.now(), ...data });
  saveSession(session);
}

function postToServer(url, body) {
  // Route through the extension background service worker when available —
  // background workers bypass the page's CSP and mixed-content restrictions,
  // which would otherwise block connections from HTTPS pages to localhost.
  if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'FIS_FETCH', url, body }, (response) => {
          // Reading lastError marks it handled and avoids an unchecked-error warning.
          if (chrome.runtime.lastError || !response?.ok) resolve(false);
          else resolve(true);
        });
      } catch {
        // "Extension context invalidated" — the extension was reloaded while this
        // old content script is still running. Fail quietly; a page reload will
        // load a fresh script. (We don't fall back to a direct fetch here because
        // an HTTPS page → localhost call would be blocked by mixed-content anyway.)
        resolve(false);
      }
    });
  }
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).then((r) => r.ok).catch(() => false);
}

async function sendToServer(session) {
  // Guard against concurrent sends (e.g. the periodic flush overlapping an
  // event-driven send). Both would slice from the same lastSentIndex before it
  // advances, double-posting the same events. Skipped events are picked up by the
  // next call — the 5s flush guarantees they aren't stranded.
  if (session.sendInFlight) return;
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

  const body = JSON.stringify(payload);
  session.sendInFlight = true;
  let ok = false;
  try {
    ok = await postToServer(SERVER_URL, body);
  } finally {
    session.sendInFlight = false;
  }
  if (ok) {
    session.lastSentIndex = fromIdx + newEvents.length;
    saveSession(session);
  } else {
    try {
      const pending = JSON.parse(localStorage.getItem('fis_pending') || '[]');
      pending.push(payload);
      localStorage.setItem('fis_pending', JSON.stringify(pending));
    } catch { /* quota exceeded — discard, tracker continues working */ }
  }
}

async function flushPendingSessions() {
  const pending = JSON.parse(localStorage.getItem('fis_pending') || '[]');
  if (!pending.length) return;
  const failed = [];
  await Promise.all(pending.map(async (p) => {
    const ok = await postToServer(SERVER_URL, JSON.stringify(p));
    if (!ok) failed.push(p);
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


function trackField(fieldEl, session, formEl, getVisibleMs, onScreenshot) {
  const fieldName = fieldEl.name || fieldEl.id || 'unknown';
  let focusVisibleMs = null; // visible-time snapshot taken at focus
  let idleTimer = null;
  let idleTotalMs = 0;
  let errorCount = 0;
  let visitCount = 0;
  let copyPasted = false;
  let isFocused = false;
  let focusWallClock = null;
  let firstKeystrokeMs = null;
  let correctionCount = 0;
  let valueAtFocus = '';
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
      hesitationMs: firstKeystrokeMs,
      correctionCount,
      changedDuringFocus,
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
    addEvent(session, 'field_error', { field: fieldName, errorCount });
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
  // AEM uses multiple mechanisms to mark the active wizard step:
  //   1. class="current-wizard-step"  — standard EDS wizard
  //   2. data-active="true"           — rule-engine driven navigation
  //   3. aria-hidden="false" when others are "true"  — ARIA-based visibility
  var active = formEl.querySelector('fieldset.current-wizard-step')
    || formEl.querySelector('fieldset[data-active="true"]')
    || (function() {
      // pick the first visible fieldset when no explicit marker is present
      var all = Array.from(formEl.querySelectorAll('fieldset'));
      if (!all.length) return null;
      var visible = all.filter(function(fs) {
        return fs.getAttribute('aria-hidden') !== 'true'
          && fs.getAttribute('hidden') == null
          && getComputedStyle(fs).display !== 'none';
      });
      return visible[0] || all[0];
    }());
  if (!active) return { index: 0, name: null };
  var index = parseInt(active.dataset.index != null ? active.dataset.index : 0, 10);
  var name = (active.querySelector('legend') || {}).textContent
    ? active.querySelector('legend').textContent.trim()
    : active.id || ('Step ' + (index + 1));
  return { index: index, name: name };
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

// ── Screenshot capture ────────────────────────────────────────────────────────

let html2canvasReady = false;
let html2canvasFailed = false;

function loadHtml2Canvas() {
  // html2canvas ships with the extension and is injected as a content script
  // BEFORE this file (see manifest content_scripts), so it's already on window.
  // We never load it from a CDN — that violates strict page CSPs (e.g. the HDFC
  // banking forms) and floods the console with blocked-script errors.
  if (window.html2canvas) html2canvasReady = true;
  else html2canvasFailed = true;
  return Promise.resolve();
}

async function captureAnnotatedScreenshot(formEl, eventType, context = {}) {
  try {
    await loadHtml2Canvas();
    if (!window.html2canvas) return null;
    // use device pixel ratio for sharp screenshots on retina screens, capped at 2×
    const SCALE = Math.min(window.devicePixelRatio || 1, 2);
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

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

    // Find images that already failed to load (404) on the live page so
    // html2canvas doesn't re-fetch them on every capture — a broken image would
    // otherwise be re-requested each time and flood the console with 404s.
    const brokenImgSrcs = new Set();
    document.querySelectorAll('img').forEach((img) => {
      if (img.complete && img.naturalWidth === 0 && (img.currentSrc || img.src)) {
        brokenImgSrcs.add(img.currentSrc || img.src);
      }
    });

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
        // Mask all user-entered values — never expose PII in screenshots
        clonedEl.querySelectorAll('input, textarea').forEach((el) => {
          if (!el.value) return;
          if (el.type === 'password' || el.type === 'email' || el.type === 'tel') {
            el.value = '••••••••';
          } else if (el.type === 'number' || el.type === 'range') {
            // number/range inputs reject non-numeric values (console warning) —
            // switch to text in the clone so we can show a masked placeholder
            el.type = 'text';
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
        // Strip images that are broken on the live page so html2canvas won't
        // re-request them — otherwise a 404 image is re-fetched on every capture.
        clonedEl.querySelectorAll('img').forEach((img) => {
          if (brokenImgSrcs.has(img.currentSrc || img.src)) {
            img.removeAttribute('src');
            img.removeAttribute('srcset');
            const pic = img.closest('picture');
            if (pic) pic.querySelectorAll('source').forEach((s) => s.removeAttribute('srcset'));
          }
        });
      },
    });
    const ctx = canvas.getContext('2d');

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
      ctx.fillStyle = 'rgba(197,48,48,0.92)';
      ctx.fillRect(0, 0, canvas.width, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`JS ERROR: ${(context.message || 'unknown').slice(0, 90)}`, 6, 15);
    }

    if (eventType === 'console_error') {
      ctx.fillStyle = 'rgba(197,48,48,0.92)';
      ctx.fillRect(0, 0, canvas.width, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`CONSOLE ERROR: ${(context.message || 'unknown').slice(0, 85)}`, 6, 15);
    }

    if (eventType === 'form_error') {
      ctx.fillStyle = (context.status || 0) >= 500 ? 'rgba(197,48,48,0.92)' : 'rgba(201,99,0,0.92)';
      ctx.fillRect(0, 0, canvas.width, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`${(context.callType || 'API').toUpperCase()} ERROR ${context.status || ''}: ${(context.statusText || '').slice(0, 70)}`, 6, 15);
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
        if (state === 'filled') return;
        const r = preRects[name];
        if (!r || r.bottom < 0 || r.top > vpH) return;
        const x = r.left * SCALE;
        const y = r.top * SCALE;
        const w = r.width * SCALE;
        const h = r.height * SCALE;
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

    return canvas.toDataURL('image/jpeg', 0.85);
  } catch { return null; }
}

function trackForm(formEl, serverBaseUrl) {
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
    const urlParams = new URLSearchParams(window.location.search);
    const formId = window.location.pathname;
    stripRefreshAbandon(); // must run before getOrCreateSession reads sessionStorage
    const session = getOrCreateSession(formId);
    // null means this is a post-submit page reload — skip tracking entirely
    // so the refreshed empty form doesn't create a phantom abandoned session
    if (!session) return;
    window.__fisSession = session; // dev helper — check tracker is active: window.__fisSession

    // Store this session's ID in chrome.storage.local so the next page (on any domain,
    // or a different path on the same domain — e.g. a multi-step KYC SPA that does full
    // page loads between steps) can continue this journey and retract this session's
    // abandon if it detects it was a redirect, not a real abandon.
    //
    // Written directly (no preceding get()) — every field below is fully replaced
    // regardless of what was there before, so reading the old value first serves no
    // purpose except adding an extra async round-trip. That round-trip is exactly what
    // was making this handoff unreliable: on a page that redirects quickly (e.g. an
    // eKYC step that auto-advances right after load), the write could lose the race
    // against navigation and never land, leaving the next page with stale/no handoff
    // data and forcing it to mint a brand-new journeyId — fragmenting one real visit
    // into several disconnected journeys in the dashboard.
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({
          fis_xdomain_journey: {
            journeyId: session.journeyId,
            pageIndex: session.pageIndex,
            savedAt: Date.now(),
            fromHost: window.location.host,
            prevSessionId: session.sessionId,
          },
        });
      }
    } catch { /* ignore */ }

    // If this page was reached via a cross-domain redirect, the previous session
    // sent a form_abandon at pagehide (it didn't know a next page was coming).
    // Retract that abandon now — the previous page's work was done, not abandoned.
    if (window.__FIS_RETRACT_SESSION_ID) {
      const retractId = window.__FIS_RETRACT_SESSION_ID;
      window.__FIS_RETRACT_SESSION_ID = null;
      postToServer(`${SERVER_BASE}/retract-abandon`, JSON.stringify({ sessionId: retractId }))
        .catch(() => {});
    }

    // ── Periodic flush ──────────────────────────────────────────────────────────
    // field_focus / field_blur / input only buffer events locally (addEvent does not
    // send). Without a trailing change / step_change / error event, those buffered
    // events never reach the server, so an in-progress session shows stale data.
    // Also retry fis_pending so events queued during server downtime (e.g. ngrok
    // outage) are delivered once connectivity is restored.
    const flushTimer = setInterval(() => {
      try {
        if (session.events.length > (session.lastSentIndex || 0)) sendToServer(session);
        flushPendingSessions();
      } catch { /* ignore */ }
    }, 5000);
    window.addEventListener('pagehide', () => clearInterval(flushTimer));

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

    // Cache an abandon screenshot so it's ready if the user closes the tab
    // (html2canvas can't run after pagehide — the page unloads in <10ms).
    // We capture ONCE shortly after load, then refresh only when the user is
    // about to leave (tab hidden) — NOT on a 30s loop. The old loop ran
    // html2canvas continuously, which re-cloned the page and re-fetched every
    // image (including any broken 404 image) over and over, flooding the console.
    let cachedScreenshot = null;
    function captureAbandonShot() {
      captureAnnotatedScreenshot(formEl, 'form_abandon', {}).then((dataUrl) => {
        if (dataUrl) cachedScreenshot = dataUrl;
      }).catch(() => {});
    }
    if (window.requestIdleCallback) {
      window.requestIdleCallback(captureAbandonShot, { timeout: 8000 });
    } else {
      setTimeout(captureAbandonShot, 8000);
    }
    document.addEventListener('visibilitychange', () => {
      // refresh the cached shot when the user switches away / is about to leave
      if (document.visibilityState === 'hidden') captureAbandonShot();
    });

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
      if ((!field.name && !field.id) || field.type === 'hidden') return;
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
    const stepObserver = new MutationObserver(() => {
      try {
        const step = getActiveStepInfo(formEl);
        if (step.index !== currentStep.index) {
          const direction = step.index > currentStep.index ? 'next' : 'back';
          currentStep = step;
          addEvent(session, 'step_change', {
            step: currentStep.index,
            stepName: currentStep.name,
            direction,
          });
          sendToServer(session);
        }
      } catch { /* ignore */ }
    });
    // Watch class AND data-visible/data-active — AEM uses different attributes
    // depending on whether navigation is rule-driven or user-driven.
    // Also observe the form container itself so new fieldsets added dynamically
    // (lazy-loaded panels) get picked up automatically.
    var observedFieldsets = new WeakSet();
    function observeFieldset(fs) {
      if (observedFieldsets.has(fs)) return;
      observedFieldsets.add(fs);
      stepObserver.observe(fs, {
        attributes: true,
        attributeFilter: ['class', 'data-visible', 'data-active', 'aria-hidden', 'hidden'],
      });
    }
    formEl.querySelectorAll('fieldset').forEach(observeFieldset);
    // Also observe the form container for new fieldsets added by rules/lazy-loading
    var fieldsetWatcher = new MutationObserver(function() {
      formEl.querySelectorAll('fieldset').forEach(observeFieldset);
    });
    fieldsetWatcher.observe(formEl, { childList: true, subtree: true });

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
        if ((!field.name && !field.id) || field.type === 'hidden') return;
        if (!field.dataset.fisTracked) {
          field.dataset.fisTracked = 'true';
          try { trackField(field, session, formEl, getVisibleMs, attachScreenshot); } catch { /* ignore */ }
        }
        attachScanTracking(field);
      });
    });
    mutationObserver.observe(formEl, { childList: true, subtree: true });

    // ── Delegation fallback for AEM / Angular / React ─────────────────────────
    // AEM Adaptive Forms re-render inputs when rules fire, destroying direct
    // listeners. focusin bubbles (unlike focus) so it fires even on re-rendered
    // elements — we use it to re-attach trackField immediately on first interaction.
    formEl.addEventListener('focusin', function(e) {
      try {
        const t = e.target;
        if (!t || !['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
        if (t.type === 'hidden' || (!t.name && !t.id)) return;
        if (t.dataset.fisTracked) return; // direct listener already handles it
        t.dataset.fisTracked = 'true';
        trackField(t, session, formEl, getVisibleMs, attachScreenshot);
      } catch { /* ignore */ }
    });

    // change fires even when focus/blur are swallowed — last resort to record interaction
    formEl.addEventListener('change', function(e) {
      try {
        const t = e.target;
        if (!t || !['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
        if (t.type === 'hidden' || (!t.name && !t.id)) return;
        if (!t.dataset.fisTracked) {
          t.dataset.fisTracked = 'true';
          trackField(t, session, formEl, getVisibleMs, attachScreenshot);
        }
        const fieldName = t.name || t.id;
        if (!session.events.some(function(ev) {
          return ev.type === 'field_blur' && ev.field === fieldName;
        })) {
          addEvent(session, 'field_blur', {
            field: fieldName, timeSpentMs: 0, idleTimeMs: 0,
            copyPasted: false, visitCount: 1, errorCount: 0, skipped: false,
          });
          sendToServer(session);
        }
      } catch { /* ignore */ }
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

    // attach a screenshot to the most recently added event of the given type.
    // Only one screenshot is captured per event type per session to avoid data bloat —
    // repeated firings are counted in the analytics timeline, not re-screenshotted.
    // Error events often re-render the form (error banner, blanked panel, modal).
    // Give the DOM a moment to settle so we capture the painted error state, not
    // a half-rendered blank frame. Non-error events (clicks) are already stable.
    const SETTLE_DELAY_MS = 400;
    const SETTLE_TYPES = new Set(['form_error', 'api_error', 'js_error', 'console_error', 'field_error']);

    function attachScreenshot(eventType, context) {
      try {
        if (session.events.some((e) => e.type === eventType && e.screenshot)) return;
        const capture = () => captureAnnotatedScreenshot(formEl, eventType, context).then((dataUrl) => {
          if (!dataUrl) return;
          const ev = [...session.events].reverse().find((e) => e.type === eventType && !e.screenshot);
          if (!ev) return;
          ev.screenshot = dataUrl;
          // Screenshots are large (300KB–1MB base64). Persist to sessionStorage
          // without them so we never hit the 5MB quota; the server is the store.
          try {
            const lean = { ...session, events: session.events.map((e) => (e.screenshot ? { ...e, screenshot: undefined } : e)) };
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(lean));
          } catch { /* quota exceeded — skip storage, server copy is authoritative */ }
          // Rewind lastSentIndex to include this event — the event was already sent
          // without a screenshot (sendToServer ran before html2canvas resolved), so
          // we need to re-send it with the screenshot attached.
          const evIdx = session.events.indexOf(ev);
          if (evIdx >= 0 && evIdx < (session.lastSentIndex || 0)) {
            session.lastSentIndex = evIdx;
          }
          sendToServer(session);
        }).catch(() => {});
        if (SETTLE_TYPES.has(eventType)) setTimeout(capture, SETTLE_DELAY_MS);
        else capture();
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
          const lastFieldEvent = [...session.events].reverse()
            .find((e) => e.type === 'field_blur' || e.type === 'field_focus');
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
        try {
          formEl.querySelectorAll('input, select, textarea').forEach((el) => {
            if (!el.name || el.type === 'hidden') return;
            const empty = el.type === 'checkbox' ? !el.checked : !el.value.trim();
            fieldStateSnap[el.name] = empty ? 'empty' : (el.checkValidity?.() !== false ? 'filled' : 'invalid');
          });
        } catch { /* ignore */ }
        sendAbandon();
        attachScreenshot('form_abandon', { fieldState: fieldStateSnap });
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
      // Refresh the cross-domain journey TTL so it's measured from when the user
      // LEFT this page, not when they arrived. This ensures a KYC redirect (or any
      // mid-flow cross-domain hop) can stitch the journey even if the user spent
      // more than 60s on this form. The retract-abandon mechanism on the next page
      // handles whether the abandon was real or a redirect.
      //
      // Written directly, no preceding get()+journeyId check — this runs at
      // pagehide, the single riskiest moment for an async get() to lose its race
      // against navigation and silently drop the refresh (the exact failure mode
      // that was fragmenting one real multi-page visit into several disconnected
      // journeys). The dropped safety check only mattered for the rare case of
      // another concurrent tab owning a newer journey; a single automated or
      // typical single-tab user flow doesn't hit that case.
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({
            fis_xdomain_journey: {
              journeyId: session.journeyId,
              pageIndex: session.pageIndex,
              fromHost: window.location.host,
              savedAt: Date.now(),
              prevSessionId: session.sessionId,
            },
          });
        }
      } catch { /* ignore */ }
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
    // These hooks (fetch, XHR, console, window error/rejection) are page-global.
    // AEM forms re-render and call trackForm again on new containers; without this
    // guard each call re-wraps window.fetch around the previous wrapper, so one
    // real API error gets logged once per re-render (seen as "fired 126×").
    // Install them exactly once per page.
    if (!window.__FIS_GLOBAL_HOOKS) {
      window.__FIS_GLOBAL_HOOKS = true;

    // URL pattern → callType for every form lifecycle endpoint
    const FORM_CALL_PATTERNS = [
      [/\/adobe\/forms\/af\/submit\//i, 'submit'],
      [/\/adobe\/forms\/af\/prefill\//i, 'prefill'],
      [/\/adobe\/forms\/af\/validate\//i, 'validate'],
      [/\/adobe\/forms\/af\/draft\//i, 'draft'],
      [/\/adobe\/forms\/af\/fileupload\//i, 'file_upload'],
      [/\/adobe\/forms\/af\/captcha\//i, 'captcha'],
      [/\/libs\/granite\/csrf\/token\.json/i, 'csrf'],
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
            if (response.ok) {
              if (callType === 'submit') {
                addEvent(session, 'form_submit', { attemptNumber: submitAttempts });
                clearProgress();
                clearJourney(session.formId);
                // Refresh the cross-domain journey TTL from submit time, not from
                // tracking-start time. Without this, users who spend >60s filling
                // the form lose journey stitching on the post-submit redirect page.
                // Written directly (no preceding get()+journeyId check) — same
                // reasoning as the pagehide refresh above: an async get() here risks
                // losing the race against the post-submit redirect and silently
                // dropping the refresh, which is worse than the rare multi-tab edge
                // case the check was guarding against.
                try {
                  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                    chrome.storage.local.set({
                      fis_xdomain_journey: {
                        journeyId: session.journeyId,
                        pageIndex: session.pageIndex,
                        fromHost: window.location.host,
                        savedAt: Date.now(),
                        prevSessionId: session.sessionId,
                      },
                    });
                  }
                } catch { /* ignore */ }
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
                layer: response.status >= 500 ? 'backend'
                  : response.status === 401 || response.status === 403 ? 'auth'
                  : response.status === 404 ? 'config'
                  : response.status === 413 ? 'payload'
                  : response.status === 422 || response.status === 400 ? 'validation'
                  : response.status === 429 ? 'rate_limit'
                  : response.status === 0 ? 'network'
                  : 'client',
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
              layer: 'network',
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
          const isStaticAsset = /\.(css|js|mjs|html|png|jpg|jpeg|gif|svg|woff2?|ttf|ico|webp|avif|json)(\?|$)/i.test(url);
          const isAemInfra = /nav\.plain|footer\.plain|metadata\.json|\.plain\.html|\/aem\/|\/scripts\/|\/styles\/|\/fonts\/|\/icons\//i.test(url);
          const isAnalyticsServer = SERVER_BASE && url.startsWith(SERVER_BASE);
          const isExtension = /^(chrome|moz|safari)-extension:\/\//i.test(url);

          if (isStaticAsset || isAemInfra || isAnalyticsServer || isExtension || !url) {
            return originalFetch(...args);
          }

          // track this non-lifecycle API call for silent failures
          const shortUrl = url.replace(/[?#].*/, '').split('/').slice(-3).join('/');
          try {
            const response = await originalFetch(...args);
            if (!response.ok) {
              const statusText = response.statusText || String(response.status);
              const reason = `HTTP ${response.status} ${statusText} — ${shortUrl}`;
              const triggeredByBtn = lastButtonClick && Date.now() - lastButtonClick.time < 5000 ? lastButtonClick : null;
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
            }
            return response;
          } catch (err) {
            const reason = err.message || 'Network error';
            const triggeredByBtn2 = lastButtonClick && Date.now() - lastButtonClick.time < 5000 ? lastButtonClick : null;
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
            const MAX_MB = 10;
            const ALLOWED = ['image/jpeg', 'image/png', 'application/pdf', 'image/gif'];
            [...(fileInput.files || [])].forEach((file) => {
              if (file.size > MAX_MB * 1024 * 1024) {
                const statusText = `File "${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — exceeds ${MAX_MB}MB limit`;
                addEvent(session, 'form_error', {
                  callType: 'file_too_large',
                  statusText,
                  field: fileInput.name || fileInput.id || 'file',
                  step: currentStep.index,
                });
                attachScreenshot('form_error', { callType: 'file_too_large', statusText });
              }
              if (ALLOWED.length && !ALLOWED.includes(file.type)) {
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

    // ── XHR interception — AEM rule engine uses XHR not fetch ────────────────
    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function fisXHROpen(method, url, ...rest) {
      this._fisMethod = method;
      this._fisUrl = String(url || '');
      return origXHROpen.apply(this, [method, url, ...rest]);
    };
    XMLHttpRequest.prototype.send = function fisXHRSend(...args) {
      const xhrUrl = this._fisUrl || '';
      const xhrMethod = this._fisMethod || 'GET';
      const isStaticAsset = /\.(css|js|html|png|jpg|jpeg|gif|svg|woff2?|ttf|ico|webp|avif)(\?|$)/i.test(xhrUrl);
      const isAnalyticsServer = SERVER_BASE && xhrUrl.startsWith(SERVER_BASE);
      if (!isStaticAsset && !isAnalyticsServer && xhrUrl) {
        this.addEventListener('load', () => {
          try {
            if (this.status >= 400) {
              const shortUrl = xhrUrl.replace(/[?#].*/, '').split('/').slice(-3).join('/');
              addEvent(session, 'api_error', {
                reason: `HTTP ${this.status} — ${shortUrl}`,
                url: shortUrl,
                status: this.status,
                method: xhrMethod,
                errorClass: this.status >= 500 ? 'server_error' : 'client_error',
                nearestField: getNearestField(),
                step: currentStep.index,
                stepName: currentStep.name,
              });
              sendToServer(session);
            }
          } catch { /* ignore */ }
        });
        this.addEventListener('error', () => {
          try {
            const shortUrl = xhrUrl.replace(/[?#].*/, '').split('/').slice(-3).join('/');
            addEvent(session, 'api_error', {
              reason: `Network error — ${shortUrl}`,
              url: shortUrl,
              status: 0,
              method: xhrMethod,
              errorClass: 'network_down',
              nearestField: getNearestField(),
              step: currentStep.index,
              stepName: currentStep.name,
            });
            sendToServer(session);
          } catch { /* ignore */ }
        });
      }
      return origXHRSend.apply(this, args);
    };

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

    // intercept console.log — AEM afb-runtime logs errors via log, not error
    const origConsoleLog = console.log.bind(console);
    // eslint-disable-next-line no-console
    console.log = (...args) => {
      origConsoleLog(...args);
      try {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        const isAemError = /Form Validation Error|Error invoking a rest API|Query params invalid|Error while fetching response/i.test(msg);
        if (isAemError) {
          const errorClass = /validation/i.test(msg) ? 'validation_error'
            : /rest API|fetching response/i.test(msg) ? 'rule_engine_api'
            : 'rule_engine';
          addEvent(session, 'console_error', {
            message: msg.slice(0, 200),
            errorClass,
            nearestField: getNearestField(),
            step: currentStep.index,
            stepName: currentStep.name,
          });
          sendToServer(session);
        }
      } catch { /* ignore */ }
    };

    // deduplicate resource errors — same broken asset can fire hundreds of times
    const reportedResourceUrls = new Set();

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
          // deduplicate — same broken asset fires many times (e.g. 404 image in rule-triggered re-renders)
          const dedupeKey = src.replace(/[?#].*/, '');
          if (reportedResourceUrls.has(dedupeKey)) return;
          reportedResourceUrls.add(dedupeKey);
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
        const triggeredByBtn3 = lastButtonClick && Date.now() - lastButtonClick.time < 5000 ? lastButtonClick : null;
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
    } // end one-time global hooks

    // ── Behavioural frustration ───────────────────────────────────────────────

    // Track the last button clicked so api_error events can be attributed to it.
    let lastButtonClick = null;

    // Rage click: 3+ clicks on same button within 600ms
    let rageState = { el: null, count: 0, time: 0, fired: false };
    formEl.addEventListener('click', (e) => {
      try {
        const target = e.target.closest('button, [role="button"], input[type="submit"]');
        if (!target) return;
        lastButtonClick = {
          label: target.textContent?.trim().slice(0, 40) || target.id || target.value || 'button',
          rect: target.getBoundingClientRect(),
          time: Date.now(),
        };
        const now = Date.now();
        if (target === rageState.el && now - rageState.time < 600) {
          rageState.count += 1;
          rageState.time = now;
          if (rageState.count >= 2 && !rageState.fired) {
            rageState.fired = true;
            addEvent(session, 'rage_click', {
              element: target.textContent?.trim().slice(0, 40) || target.id || 'button',
              clicks: rageState.count + 1,
              step: currentStep.index,
              stepName: currentStep.name,
            });
            attachScreenshot('rage_click', { element: target.textContent?.trim().slice(0, 40) || target.id || 'button' });
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
            const empty = el.type === 'checkbox' ? !el.checked : !el.value.trim();
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

    if (!session.events.some(function(e) { return e.type === 'form_start'; })) {
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

    // ── Business / UI error detection ─────────────────────────────────────────
    // Many forms show errors as DOM text (e.g. "PAN Update failed") rather than
    // HTTP 4xx/5xx responses. Watch for elements matching common error patterns
    // and capture them as form_error events with a screenshot.
    // Only genuine errors/alerts — NOT hints, descriptions, help text, tooltips,
    // or file-size notes. Broad class matches like "message"/"notification"/
    // "status"/"polite" pick up the form's informational text and wrongly inflate
    // the error count, so we restrict to error-specific signals.
    // Install the DOM-error watcher once per page. trackForm runs again on every
    // re-render; without this guard each run sets up its own observer with its own
    // dedupe set, so the same message is recorded once per re-render (inflated count).
    if (!window.__FIS_DOM_ERR_HOOK) {
      window.__FIS_DOM_ERR_HOOK = true;

    const ERROR_SELECTORS = [
      '[role="alert"]',
      '[aria-live="assertive"]',
      '[class*="error"]:not(script):not(style)',
    ].join(',');

    // Class fragments that mean "informational, not a failure" — skip these even
    // if they somehow match (e.g. an "error" wrapper that also holds help text).
    const NON_ERROR_CLASS = /hint|descrip|longdesc|\bhelp\b|tooltip|guidance|\binfo\b|placeholder|optional|qm-|question-mark/i;

    function isRealError(el) {
      try {
        if (el.offsetParent === null) return false; // not visible → not shown to user
        const cls = (el.className && el.className.toString) ? el.className.toString() : '';
        if (NON_ERROR_CLASS.test(cls)) return false; // it's helper text, not an error
        const role = el.getAttribute ? (el.getAttribute('role') || '') : '';
        const live = el.getAttribute ? (el.getAttribute('aria-live') || '') : '';
        if (role === 'alert' || live === 'assertive') return true; // semantically an alert
        return /error/i.test(cls); // class-based: must actually say "error"
      } catch { return false; }
    }

    const seenDomErrors = new Set();

    function checkDomErrors() {
      try {
        const matches = Array.from(document.querySelectorAll(ERROR_SELECTORS)).filter(isRealError);
        // An error screen often nests several error-classed divs whose text
        // overlaps (Fragment > Error Screen Root > message). Keep only the
        // outermost one so a single error is captured once, not once per layer.
        const outermost = matches.filter(function(el) {
          return !matches.some(function(other) { return other !== el && other.contains(el); });
        });
        outermost.forEach(function(el) {
          const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 300);
          if (!text || text.length < 5) return;
          if (seenDomErrors.has(text)) return;
          seenDomErrors.add(text);
          addEvent(session, 'form_error', {
            callType: 'ui_message',
            statusText: text,
            nearestField: getNearestField(),
            step: currentStep.index,
            stepName: currentStep.name,
          });
          attachScreenshot('form_error', { callType: 'ui_message', statusText: text });
          sendToServer(session);
        });
      } catch { /* ignore */ }
    }

    // Run once immediately (catches errors already on page at inject time)
    checkDomErrors();

    // Watch for new error messages appearing dynamically
    const domErrorObserver = new MutationObserver(function() {
      checkDomErrors();
    });
    domErrorObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    } // end one-time DOM-error watcher

  } catch { /* tracker failed silently — form continues working normally */ }
}


(function fisAutoInit() {
  let SERVER = window.__FIS_SERVER || 'http://localhost:3000';
  const tracked = new Set();

  // Find every possible form container on the page.
  // Tries specific selectors first (most precise), falls back to
  // heuristic container detection, then document.body as last resort.
  function findContainers() {
    const found = new Set();

    // 1. Native HTML <form>
    document.querySelectorAll('form').forEach(function(el) { found.add(el); });

    // 2. ARIA role="form" (div-based forms with accessibility role)
    document.querySelectorAll('[role="form"]').forEach(function(el) { found.add(el); });

    // 3. Angular reactive forms ([formGroup]) and template-driven (ng-form / [ngForm])
    document.querySelectorAll('[formgroup],[formGroup],[ng-form],ng-form,[ngForm]')
      .forEach(function(el) { found.add(el); });

    // 4. Common custom data-attribute patterns used by design systems
    document.querySelectorAll('[data-form],[data-form-id],[data-form-type],[data-form-name],[data-form-key]')
      .forEach(function(el) { found.add(el); });

    // 5. Web-component / framework form wrappers with common class names
    document.querySelectorAll('.form-container,.form-wrapper,.form-body,.form-content,.fds-form')
      .forEach(function(el) { found.add(el); });

    // De-duplicate: remove any container that is a descendant of another
    // already in the set so we never double-track nested forms.
    var unique = Array.from(found).filter(function(el) {
      return !Array.from(found).some(function(other) {
        return other !== el && other.contains(el);
      });
    });

    if (unique.length > 0) return unique;

    // 6. Heuristic fallback: find the tightest DOM element that wraps ALL
    //    visible inputs — covers React, Vue, plain-div forms, etc.
    var allInputs = Array.from(
      document.querySelectorAll('input:not([type="hidden"]),select,textarea')
    ).filter(function(el) { return el.offsetParent !== null; });

    if (allInputs.length === 0) return [];

    var total = allInputs.length;
    var best = null;
    var bestCount = Infinity;

    allInputs.forEach(function(input) {
      var el = input.parentElement;
      while (el && el !== document.documentElement) {
        var count = el.querySelectorAll(
          'input:not([type="hidden"]),select,textarea'
        ).length;
        if (count >= total && count < bestCount) {
          bestCount = count;
          best = el;
        }
        el = el.parentElement;
      }
    });

    if (best) return [best];

    // 7. Last resort: track everything on the page
    return [document.body];
  }

  function tryTrack() {
    findContainers().forEach(function(container) {
      if (!tracked.has(container)) {
        tracked.add(container);
        try { trackForm(container, SERVER); } catch (e) { /* ignore */ }
      }
    });
  }

  // Re-run when new elements are added to the DOM (lazy-loaded / modal forms)
  var mutationTimer = null;
  var domObserver = new MutationObserver(function() {
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(tryTrack, 300);
  });

  // Patch pushState / replaceState so SPA route changes re-trigger detection
  function patchHistory(method) {
    var original = history[method].bind(history);
    history[method] = function() {
      var prevPath = window.location.pathname + window.location.search;
      original.apply(history, arguments);
      var nextPath = window.location.pathname + window.location.search;
      if (nextPath !== prevPath && window.__fisSession) {
        addEvent(window.__fisSession, 'url_change', {
          from: prevPath,
          to: nextPath,
        });
        sendToServer(window.__fisSession);
      }
      setTimeout(tryTrack, 600);
    };
  }

  function startTracking() {
    // Guard on a window flag (not a closure var) so re-injection — e.g. the
    // popup's manual "Start Tracking" after the content script already ran —
    // never attaches the observers twice.
    if (window.__FIS_TRACKING_STARTED) return;
    window.__FIS_TRACKING_STARTED = true;
    tryTrack();
    domObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
    patchHistory('pushState');
    patchHistory('replaceState');
    window.addEventListener('popstate', function() { setTimeout(tryTrack, 600); });
  }

  // Never track the FIS analytics dashboard itself — it's not a form, and running
  // html2canvas on its large DOM floods the console and creates junk sessions.
  function isFisDashboard() {
    return !!document.getElementById('dashboard')
      && /Form Intelligence/i.test(document.title || '');
  }

  function init() {
    if (isFisDashboard()) return;
    // The popup's manual button sets __FIS_FORCE to start regardless of pins.
    var forced = window.__FIS_FORCE === true;
    // Persist the force flag in sessionStorage so same-tab round-trips (e.g. ETB → eKYC → ETB)
    // resume tracking on return without needing the domain to be pinned.
    try {
      if (forced) {
        sessionStorage.setItem('fis_tracking_active', '1');
      } else if (sessionStorage.getItem('fis_tracking_active') === '1') {
        forced = true;
      }
    } catch { /* ignore quota/security errors */ }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['serverUrl', 'pinnedUrls', 'fis_xdomain_journey'], function(result) {
        if (result.serverUrl) {
          SERVER = result.serverUrl.replace(/\/$/, '');
          SERVER_BASE = SERVER;
          SERVER_URL = SERVER + '/events';
        }
        // If a journey was saved recently (within 15 min), expose it so
        // getOrCreateJourney can continue it instead of starting a new one.
        // 15 min covers KYC/OTP/biometric flows that take longer than the old 60s limit.
        //
        // This used to only continue the journey when fromHost !== location.host,
        // on the assumption that a same-host return would find its own journey via
        // localStorage automatically. That assumption is wrong: getOrCreateJourney
        // namespaces the stored journey by formId (the page's pathname), so landing
        // on a *different path* on the same host (e.g. a multi-step KYC SPA moving
        // from /kycengine/ekyc to /kycengine/aadhaar via full page loads, not client
        // routing) finds nothing under the new path's key and mints a brand-new
        // journeyId — fragmenting one real visit into several unrelated journeys in
        // the dashboard. Continuing the journey here regardless of host fixes that;
        // same-path revisits are unaffected since getOrCreateJourney's own
        // sessionStorage/localStorage check already short-circuits those.
        var xj = result.fis_xdomain_journey;
        var withinTTL = xj && (Date.now() - xj.savedAt) < 15 * 60 * 1000;
        if (xj && withinTTL) {
          window.__FIS_XDOMAIN_JOURNEY = xj;
          // the previous page sent form_abandon at pagehide not knowing we'd continue —
          // retract it once trackForm runs and SERVER_BASE is set
          if (xj.prevSessionId) {
            window.__FIS_RETRACT_SESSION_ID = xj.prevSessionId;
          }
        }
        var pinned = result.pinnedUrls || [];
        if (forced || pinned.indexOf(location.host) !== -1) {
          startTracking();
        }
      });
    } else {
      startTracking();
    }
  }

  // expose so a re-injection (popup force-start) can start tracking without re-running the file
  window.__fisStartTracking = startTracking;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
} // end __FIS_CONTENT_LOADED re-injection guard
