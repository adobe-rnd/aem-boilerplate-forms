// ── Error pattern library — maps raw error data to root cause + fix ────────────

const JS_PATTERNS = [
  {
    test: (e) => /cannot read prop|cannot read properties of null|undefined is not an object/i.test(e.message || ''),
    cause: 'Null reference — a rule or custom function accessed a field or object that does not exist yet',
    fix: 'Add a null check before accessing the value: if (!el || el.value === undefined) return; Verify all field names referenced in rules match the actual field names in the form definition.',
    severity: 'high',
  },
  {
    test: (e) => /is not a function/i.test(e.message || ''),
    cause: 'Function called on wrong type — a custom function name is misspelled or was not registered in functionRegistration.js',
    fix: 'Verify the function name in the rule editor matches exactly what is exported from functions.js. Check functionRegistration.js includes the function.',
    severity: 'high',
  },
  {
    test: (e) => /guideBridge.*not defined|guideBridge is not|guideBridge.*null/i.test(e.message || ''),
    cause: 'guideBridge API not ready — a form rule ran before the bridge object was initialized',
    fix: 'Wrap any guideBridge calls in: if (typeof window.guideBridge !== "undefined" && window.guideBridge.isConnected()) { ... }',
    severity: 'critical',
  },
  {
    test: (e) => /afb-runtime|rule.?engine/i.test((e.message || '') + (e.source || '')),
    cause: 'Rule engine crash — an error inside afb-runtime broke the entire rule evaluation pipeline for this session',
    fix: 'Open the form in authoring and test each rule individually. Look for rules that reference fields conditionally shown/hidden. Update afb-runtime to the latest version.',
    severity: 'critical',
  },
  {
    test: (e) => /maximum call stack|stack overflow/i.test(e.message || ''),
    cause: 'Infinite recursion — a rule or custom function calls itself endlessly, crashing the JavaScript engine',
    fix: 'Check for circular rule dependencies (Rule A shows Field B which triggers Rule B which shows Field A). Add a recursion guard.',
    severity: 'critical',
  },
  {
    test: (e) => /syntaxerror/i.test(e.errorType || ''),
    cause: 'Syntax error in a custom function or inline rule expression',
    fix: 'Check the custom function file for missing brackets, semicolons, or invalid expressions. Validate with a JS linter.',
    severity: 'critical',
  },
  {
    test: (e) => /script error/i.test(e.message || ''),
    cause: 'Cross-origin script error — a third-party script threw an error but browser security hides the details',
    fix: 'Add crossorigin="anonymous" to external <script> tags and ensure the script server sends CORS headers.',
    severity: 'medium',
  },
  {
    test: (e) => /failed to fetch|networkerror/i.test(e.message || ''),
    cause: 'Network request failed before reaching the server — user may be offline or a CORS preflight was rejected',
    fix: 'Check CORS headers on the API server. Add offline detection and a "check your connection" message.',
    severity: 'medium',
  },
];

const HTTP_STATUS_PATTERNS = [
  { status: 0, cause: 'Network failure — request never reached the server (offline, DNS failure, or CORS preflight rejected)', fix: 'Check internet connectivity and CORS configuration. Add a retry button and offline detection message.' },
  { status: 400, cause: 'Bad request — form data did not match what the server expected', fix: 'Check that field names in the form match the server-side schema. Log the request payload to see what the server received.' },
  { status: 401, cause: 'Unauthorized — user session expired or authentication is missing', fix: 'Add session refresh logic. Show a "session expired, please re-login" message with a link.' },
  { status: 403, cause: 'Forbidden — CSRF token is missing, expired, or invalid', fix: 'Refresh the CSRF token before each submission. Check the token lifetime — it may expire on long form sessions.' },
  { status: 404, cause: 'Endpoint not found — the API URL is wrong or the service is not deployed to this environment', fix: 'Verify the form submission URL. Check whether the path changed between environments (dev/stage/prod).' },
  { status: 409, cause: 'Conflict — a duplicate submission was detected or data integrity check failed on the server', fix: 'Add idempotency to the submission handler. Show "already submitted" message if the user submits twice.' },
  { status: 413, cause: 'Payload too large — the form data or uploaded file exceeds the server body size limit', fix: 'Increase the server body-size limit OR add client-side file size validation before submission.' },
  { status: 422, cause: 'Unprocessable entity — server-side validation rejected the data (client validation was insufficient)', fix: 'Display the server validation errors in the form fields. Check that client-side and server-side validation rules match.' },
  { status: 429, cause: 'Rate limited — too many submission attempts from this user or IP address', fix: 'Add debounce to the submit button. Show a "too many attempts — wait X seconds" message with a countdown.' },
  { status: 500, cause: 'Internal server error — the backend crashed while processing the form data', fix: 'Check the server error logs for the stack trace. Add try-catch around all form submission handlers on the server.' },
  { status: 502, cause: 'Bad gateway — the API server behind the load balancer is down or unreachable', fix: 'Check if the upstream service is running. Implement retry with exponential backoff and show a friendly error.' },
  { status: 503, cause: 'Service unavailable — server is overloaded or in scheduled maintenance', fix: 'Show a maintenance message with an expected return time. Save form progress so users do not lose data.' },
  { status: 504, cause: 'Gateway timeout — the request took too long and was cut off by the load balancer', fix: 'Optimise the slow server endpoint. Show a loading state so users know the form did not freeze.' },
];

const CONSOLE_PATTERNS = [
  {
    test: (msg) => /access.*blocked.*cors|cors.*block|has been blocked by cors/i.test(msg),
    cause: 'CORS policy blocked — the form is calling an API from a different origin without the correct CORS headers',
    fix: 'Add "Access-Control-Allow-Origin: https://your-form-domain.com" to the API server response headers. Or proxy the request through the same origin to avoid CORS entirely.',
    severity: 'critical',
  },
  {
    test: (msg) => /guideBridge/i.test(msg),
    cause: 'guideBridge API error — the bridge is not ready or a method was called incorrectly',
    fix: 'Use guideBridge.on("bridgeInitializeStart", ...) to wait for the bridge before calling its methods.',
    severity: 'critical',
  },
  {
    test: (msg) => /afb-runtime|rule.?engine/i.test(msg),
    cause: 'Rule engine error — form rule evaluation failed, possibly due to an invalid rule expression or circular dependency',
    fix: 'Check adaptive form rules for circular dependencies and invalid expressions. Update afb-runtime to the latest version.',
    severity: 'critical',
  },
  {
    test: (msg) => /cannot read prop|undefined is not an object|null is not an object/i.test(msg),
    cause: 'Null reference in form scripts — a rule or component accessed an element that does not exist',
    fix: 'Add null guards in custom functions and adaptive form rules that access field values or DOM elements.',
    severity: 'high',
  },
  {
    test: (msg) => /net::err_connection_refused|err_name_not_resolved|failed to load resource/i.test(msg),
    cause: 'Resource load failure — an API endpoint, script, or asset URL returned no response (server down or wrong URL)',
    fix: "Verify all API endpoints are deployed and accessible from the form's origin. Check browser Network tab for 404/502 responses.",
    severity: 'high',
  },
  {
    test: (msg) => /content security policy|csp/i.test(msg),
    cause: "Content Security Policy violation — a script, style, or request was blocked by the page's CSP header",
    fix: 'Update the Content-Security-Policy header to allow the blocked resource. Check which directive is triggering the violation (script-src, connect-src, etc.).',
    severity: 'high',
  },
  {
    test: (msg) => /maximum call stack|stack overflow/i.test(msg),
    cause: 'Infinite recursion in form scripts — a rule or function keeps calling itself until the browser crashes it',
    fix: 'Look for circular rule dependencies in the adaptive form rules editor. Add a guard condition to break the cycle.',
    severity: 'critical',
  },
];

const API_ERROR_CLASSES = {
  cors: {
    cause: 'CORS block on untracked fetch — an API call outside the monitored patterns was rejected by CORS policy',
    fix: 'Add CORS headers to all API endpoints the form calls. Check browser Network tab for the specific blocked URL.',
    severity: 'critical',
  },
  network_down: {
    cause: 'Network failure — a fetch call failed before reaching the server',
    fix: 'Add offline detection. Show a "check your connection" message and retry button.',
    severity: 'high',
  },
  timeout: {
    cause: 'Request timed out — the server took too long to respond',
    fix: 'Show a loading state after 3s. Add a retry mechanism. Investigate slow server endpoints.',
    severity: 'high',
  },
  auth: {
    cause: 'Authentication or authorization failure — session expired or token is missing',
    fix: 'Add session refresh logic. Show a "session expired" message and re-login prompt.',
    severity: 'high',
  },
  not_found: {
    cause: 'API endpoint not found — the URL the form is calling does not exist or has moved',
    fix: 'Verify the API endpoint URL. Check deployment configuration for environment-specific paths.',
    severity: 'high',
  },
  rate_limited: {
    cause: 'Rate limited (429) — too many requests from this user or IP in a short window',
    fix: 'Add debounce to the button that triggers this call. Show a "please wait" message with a countdown before retrying.',
    severity: 'high',
  },
  server_error: {
    cause: 'Server error (5xx) — the backend crashed or is unavailable while processing the request',
    fix: 'Check server logs for the stack trace at the time of the error. Add a user-facing retry button and a friendly error message so users are not left stuck.',
    severity: 'critical',
  },
  client_error: {
    cause: 'Client error (4xx) — the request was rejected by the server, likely due to invalid data or a missing parameter',
    fix: 'Check what data is being sent with this request. Compare client-side field values against the server-side validation schema.',
    severity: 'high',
  },
};

export function diagnoseEvent(event) {
  if (!event) return null;

  if (event.type === 'js_error') {
    const p = JS_PATTERNS.find((pat) => pat.test(event));
    return p ? { cause: p.cause, fix: p.fix, severity: p.severity } : null;
  }

  if (event.type === 'form_error') {
    // try exact status match first
    const p = HTTP_STATUS_PATTERNS.find((pat) => pat.status === event.status);
    if (p) return { cause: p.cause, fix: p.fix, severity: event.status >= 500 ? 'critical' : 'high' };
    // range fallback
    if (event.status >= 500) return { cause: 'Server error — backend crashed processing the form data', fix: 'Check server logs for the stack trace. Add try-catch on form submission handlers.', severity: 'critical' };
    if (event.status >= 400) return { cause: `Client error (${event.status}) — form data was rejected by the server`, fix: 'Review the server validation rules and compare against client-side validation.', severity: 'high' };
    return null;
  }

  if (event.type === 'console_error') {
    const p = CONSOLE_PATTERNS.find((pat) => pat.test(event.message || ''));
    return p ? { cause: p.cause, fix: p.fix, severity: p.severity } : null;
  }

  if (event.type === 'api_error') {
    const cls = API_ERROR_CLASSES[event.errorClass];
    return cls ? { ...cls } : null;
  }

  if (event.type === 'storage_quota') {
    const store = event.store || 'storage';
    return {
      cause: `Browser ${store} quota exceeded — session data can no longer be persisted locally`,
      fix: 'Reduce the amount of data stored per session (e.g. compress or trim event payloads). Consider pruning old fis_pending entries from localStorage on tracker init.',
      severity: 'high',
    };
  }

  if (event.type === 'suspected_crash') {
    const age = event.staleSinceMs ? `${Math.round(event.staleSinceMs / 1000)}s ago` : 'unknown time ago';
    return {
      cause: `Suspected browser tab crash or force-kill — the previous session's heartbeat was never cleared (last seen ${age})`,
      fix: 'Check for memory-intensive operations or large file uploads that could exhaust the tab\'s memory. Add a "resume where you left off" prompt on the next load to recover in-progress sessions.',
      severity: 'high',
    };
  }

  if (event.type === 'rage_click') {
    const el = event.element ? `"${event.element}"` : 'an element';
    return {
      cause: `Rage clicks on ${el} — the user clicked repeatedly because nothing responded`,
      fix: `Add an immediate loading/pressed state on ${el} after the first click. If it is disabled, show why (which fields are blocking).`,
      severity: 'high',
    };
  }

  if (event.type === 'disabled_click') {
    const fields = (event.invalidFields || []).slice(0, 3).join(', ');
    return {
      cause: `Clicks on a disabled button — the user could not tell why they were blocked${fields ? ` (incomplete: ${fields})` : ''}`,
      fix: 'Show an inline list of the incomplete required fields near the button and highlight them when a disabled click happens, instead of silently blocking.',
      severity: 'high',
    };
  }

  if (event.type === 'dead_click') {
    const el = event.element ? `"${event.element}"` : 'an element';
    return {
      cause: `Dead clicks on ${el} — the user clicked something that looked interactive but did nothing`,
      fix: `Either make ${el} respond to the click, or change its styling so it no longer looks clickable.`,
      severity: 'medium',
    };
  }

  if (event.type === 'perf_vitals') {
    if (event.rating === 'poor') {
      return {
        cause: `${event.metric} is ${event.valueMs}ms — in the "poor" range (${event.metric === 'LCP' ? '≥4000ms' : '≥500ms'}). Users experience a visibly slow or unresponsive form.`,
        fix: event.metric === 'LCP'
          ? 'Defer non-critical scripts, preload key fonts/images, and ensure the form HTML is server-rendered or cached at the edge.'
          : 'Profile the main thread for long tasks triggered by user interactions. Look for synchronous rule evaluation or large DOM updates blocking the event loop.',
        severity: 'high',
      };
    }
    if (event.rating === 'needs-improvement') {
      return {
        cause: `${event.metric} is ${event.valueMs}ms — borderline (${event.metric === 'LCP' ? '2500–4000ms' : '200–500ms'}). Some users will notice sluggishness.`,
        fix: event.metric === 'LCP'
          ? 'Audit resource load order. Move render-blocking scripts to defer/async.'
          : 'Batch DOM updates after user interactions. Debounce rule evaluation triggered by input events.',
        severity: 'medium',
      };
    }
    return null;
  }

  if (event.type === 'perf_long_task') {
    return {
      cause: `Main-thread task blocked for ${event.durationMs}ms — the browser could not respond to user input during this time`,
      fix: 'Profile the form\'s rule evaluation and DOM update pipeline. Break long synchronous operations into chunks using scheduler.yield() or setTimeout(fn, 0). Check for expensive afb-runtime rule chains.',
      severity: event.durationMs >= 1000 ? 'high' : 'medium',
    };
  }

  if (event.type === 'step_thrash') {
    return {
      cause: `User navigated back and forth between step ${event.stepA + 1} and step ${event.stepB + 1} at least ${event.bounceCount} times — a strong signal of confusion or missing information`,
      fix: `Review what information or validation is blocking progress at step ${event.stepB + 1}. Add inline help text, improve error messaging, or restructure the step to surface all required fields upfront.`,
      severity: 'medium',
    };
  }

  return null;
}

export function severityOrder(sev) {
  const ORDER = {
    critical: 0, high: 1, medium: 2, low: 3,
  };
  return ORDER[sev] ?? 4;
}
