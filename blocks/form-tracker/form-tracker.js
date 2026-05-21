const SESSION_KEY = 'fis_session';
const PROGRESS_KEY = 'fis_progress';
const SERVER_URL = 'http://localhost:3000/events';

function getDeviceType() {
  return window.innerWidth <= 768 ? 'mobile' : 'desktop';
}

function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getOrCreateSession(formId) {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) return JSON.parse(stored);

  const session = {
    sessionId: generateSessionId(),
    formId,
    device: getDeviceType(),
    startTime: Date.now(),
    events: [],
    returned: false,
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

async function sendToServer(session) {
  try {
    await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
  } catch {
    // server not running yet, store locally
    const pending = JSON.parse(localStorage.getItem('fis_pending') || '[]');
    pending.push(session);
    localStorage.setItem('fis_pending', JSON.stringify(pending));
  }
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

function restoreProgress(formEl) {
  const progress = getProgress();
  if (!progress) return;

  formEl.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.name && progress[el.name] !== undefined) {
      el.value = progress[el.name];
    }
  });

  if (progress._lastField) {
    const lastField = formEl.querySelector(`[name="${progress._lastField}"]`);
    if (lastField) lastField.focus();
  }
}

function showContinueBanner(formEl, session) {
  const banner = document.createElement('div');
  banner.className = 'fis-continue-banner';
  banner.innerHTML = `
    <p>Welcome back! Continue where you left off?</p>
    <button class="fis-btn-yes">Yes</button>
    <button class="fis-btn-no">Start fresh</button>
  `;

  banner.querySelector('.fis-btn-yes').addEventListener('click', () => {
    restoreProgress(formEl);
    session.returned = true;
    addEvent(session, 'returned', { choice: 'continue' });
    banner.remove();
  });

  banner.querySelector('.fis-btn-no').addEventListener('click', () => {
    clearProgress();
    session.returned = false;
    addEvent(session, 'returned', { choice: 'fresh' });
    banner.remove();
  });

  formEl.prepend(banner);
}

function trackField(fieldEl, session, formEl) {
  const fieldName = fieldEl.name || fieldEl.id || 'unknown';
  let focusTime = null;
  let idleTimer = null;
  let idleStart = null;
  let idleTotalMs = 0;
  let errorCount = 0;
  let visitCount = 0;
  let copyPasted = false;

  fieldEl.addEventListener('focus', () => {
    focusTime = Date.now();
    visitCount += 1;
    idleStart = Date.now();

    idleTimer = setInterval(() => {
      idleTotalMs += 1000;
    }, 1000);

    addEvent(session, 'field_focus', { field: fieldName, visitCount });
  });

  fieldEl.addEventListener('input', () => {
    // reset idle timer on input
    idleTotalMs = 0;
    idleStart = Date.now();
  });

  fieldEl.addEventListener('paste', () => {
    copyPasted = true;
  });

  fieldEl.addEventListener('blur', () => {
    clearInterval(idleTimer);
    const timeSpent = focusTime ? Date.now() - focusTime : 0;

    addEvent(session, 'field_blur', {
      field: fieldName,
      timeSpentMs: timeSpent,
      idleTimeMs: idleTotalMs,
      copyPasted,
      visitCount,
      errorCount,
    });

    saveProgress(formEl, fieldName);

    idleTotalMs = 0;
    copyPasted = false;
  });

  fieldEl.addEventListener('invalid', () => {
    errorCount += 1;
    addEvent(session, 'field_error', { field: fieldName, errorCount });
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

export default function decorate(block) {
  const formEl = block.closest('form') || block.querySelector('form') || block;
  const formId = formEl.id || formEl.dataset.formId || window.location.pathname;

  const session = getOrCreateSession(formId);

  // show continue banner if returning user has saved progress
  const progress = getProgress();
  if (progress) {
    showContinueBanner(formEl, session);
  }

  // track all fields
  formEl.querySelectorAll('input, select, textarea').forEach((field) => {
    trackField(field, session, formEl);
  });

  // observe dynamically added fields
  const mutationObserver = new MutationObserver(() => {
    formEl.querySelectorAll('input, select, textarea').forEach((field) => {
      if (!field.dataset.fisTracked) {
        field.dataset.fisTracked = 'true';
        trackField(field, session, formEl);
      }
    });
  });
  mutationObserver.observe(formEl, { childList: true, subtree: true });

  // track abandonment
  window.addEventListener('beforeunload', () => {
    const hasSubmitted = session.events.some((e) => e.type === 'form_submit');
    if (!hasSubmitted) {
      addEvent(session, 'form_abandon');
      sendToServer(session);
    }
  });

  // track submission
  formEl.addEventListener('submit', () => {
    addEvent(session, 'form_submit');
    clearProgress();
    sendToServer(session);
  });

  addEvent(session, 'form_start');
}
