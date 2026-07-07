// FIS Page Tracker — lightweight tracker for non-form pages (landing, thank-you, etc.)
// Stitches these page visits into the same journey as form-tracker sessions.
//
// Usage: add to any page that links to (or receives traffic from) a form page:
//   <script async src="https://your-fis-server/fis-page-tracker.js"
//           data-server="https://your-fis-server"></script>
//
// Journey stitching works in both directions:
//   Landing page → form:  this script injects ?_fis_jid=<id> into outbound same-origin links
//   Form → thank-you:     the form server can redirect with ?_fis_jid=<id>; this script
//                         picks it up from the URL params and continues the same journey

(function fisPageTracker() {
  'use strict';

  const JOURNEY_KEY_PREFIX = 'fis_journey:';
  const JID_PARAM = '_fis_jid';
  const PIDX_PARAM = '_fis_pidx';
  const PREV_SID_PARAM = '_fis_prev_sid';
  const JOURNEY_TTL_MS = (window.FIS_JOURNEY_TTL_MS || 2 * 60 * 60 * 1000);

  const scriptEl = document.currentScript
    || document.querySelector('script[src*="fis-page-tracker"]');
  const SERVER_BASE = (scriptEl?.dataset?.server || 'http://localhost:3000').replace(/\/$/, '');
  const SERVER_URL = `${SERVER_BASE}/events`;

  const pagePath = window.location.pathname;
  const storageKey = `${JOURNEY_KEY_PREFIX}${pagePath}`;

  // ── Journey state ─────────────────────────────────────────────────────────────

  function readStoredJourney() {
    try {
      const raw = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed.journeyId || (Date.now() - (parsed.savedAt || 0)) > JOURNEY_TTL_MS) {
        sessionStorage.removeItem(storageKey);
        localStorage.removeItem(storageKey);
        return null;
      }
      return parsed;
    } catch { return null; }
  }

  function saveJourney(journeyId, pageCount, prevSessionId) {
    const obj = { journeyId, pageCount, savedAt: Date.now() };
    if (prevSessionId) obj.prevSessionId = prevSessionId;
    const val = JSON.stringify(obj);
    try { sessionStorage.setItem(storageKey, val); } catch { /* quota */ }
    try { localStorage.setItem(storageKey, val); } catch { /* quota */ }
  }

  function getOrCreateJourney() {
    const params = new URLSearchParams(window.location.search);
    const urlJid = params.get(JID_PARAM);
    const urlPidx = params.get(PIDX_PARAM);
    const urlPrevSid = params.get(PREV_SID_PARAM);

    const stored = readStoredJourney();
    if (stored) {
      const pageCount = stored.pageCount + 1;
      // Preserve prevSessionId from incoming URL params (takes priority) or from prior stored state
      const prevSid = urlPrevSid || stored.prevSessionId || null;
      saveJourney(stored.journeyId, pageCount, prevSid);
      return { journeyId: stored.journeyId, pageIndex: pageCount, prevSessionId: prevSid };
    }

    if (urlJid) {
      const pageIndex = urlPidx ? parseInt(urlPidx, 10) : 2;
      saveJourney(urlJid, pageIndex, urlPrevSid || null);
      return { journeyId: urlJid, pageIndex, prevSessionId: urlPrevSid || null };
    }

    const journeyId = `j-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    saveJourney(journeyId, 1, null);
    return { journeyId, pageIndex: 1, prevSessionId: null };
  }

  // ── Link injection ────────────────────────────────────────────────────────────
  // Append ?_fis_jid=<id>&_fis_pidx=<n+1> to same-origin links so the form tracker
  // (or another page tracker) on the destination page joins the same journey.

  function injectJourneyIntoLinks(journeyId, pageIndex, prevSessionId) {
    document.querySelectorAll('a[href]').forEach((a) => {
      try {
        const href = a.getAttribute('href');
        if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) return;
        const isAbsolute = /^https?:\/\//i.test(href);
        if (isAbsolute && !href.startsWith(window.location.origin)) return;
        if (href.includes(JID_PARAM)) return;
        const url = new URL(href, window.location.href);
        url.searchParams.set(JID_PARAM, journeyId);
        url.searchParams.set(PIDX_PARAM, String(pageIndex + 1));
        if (prevSessionId) url.searchParams.set(PREV_SID_PARAM, prevSessionId);
        a.href = url.toString();
      } catch { /* ignore */ }
    });
  }

  // ── Session init ──────────────────────────────────────────────────────────────

  const { journeyId, pageIndex, prevSessionId } = getOrCreateJourney();
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const startTime = Date.now();

  let maxScrollDepth = 0;
  let visibleMs = 0;
  let visibleSince = document.visibilityState === 'hidden' ? null : Date.now();
  let beaconSent = false;

  function getVisibleMs() {
    return visibleSince !== null ? visibleMs + (Date.now() - visibleSince) : visibleMs;
  }

  // ── Scroll depth ──────────────────────────────────────────────────────────────

  window.addEventListener('scroll', () => {
    try {
      const total = document.documentElement.scrollHeight;
      if (!total) return;
      const depth = Math.round(((window.scrollY + window.innerHeight) / total) * 100);
      if (depth > maxScrollDepth) maxScrollDepth = Math.min(depth, 100);
    } catch { /* ignore */ }
  }, { passive: true });

  // ── Visible time ──────────────────────────────────────────────────────────────

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (visibleSince !== null) { visibleMs += Date.now() - visibleSince; visibleSince = null; }
    } else {
      visibleSince = Date.now();
    }
  });

  // ── Link injection setup ──────────────────────────────────────────────────────

  function setupLinkInjection() {
    injectJourneyIntoLinks(journeyId, pageIndex, prevSessionId);
    const obs = new MutationObserver(() => injectJourneyIntoLinks(journeyId, pageIndex, prevSessionId));
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLinkInjection);
  } else {
    setupLinkInjection();
  }

  // ── Send page_view on unload ──────────────────────────────────────────────────

  function sendPageView() {
    if (beaconSent) return;
    beaconSent = true;

    const payload = {
      sessionId,
      meta: {
        formId: pagePath,
        journeyId,
        pageIndex,
        pagePath,
        device: window.innerWidth <= 768 ? 'mobile' : 'desktop',
        startTime,
        returned: false,
        isPageView: true,
      },
      events: [{
        type: 'page_view',
        timestamp: startTime,
        referrer: document.referrer || null,
        title: (document.title || '').slice(0, 100) || null,
        scrollDepth: maxScrollDepth,
        timeOnPageMs: getVisibleMs(),
      }],
    };

    const body = JSON.stringify(payload);
    const sent = navigator.sendBeacon(SERVER_URL, new Blob([body], { type: 'text/plain' }));
    if (!sent) {
      fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }

  window.addEventListener('pagehide', sendPageView);
}());
