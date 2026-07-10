const API = '';

// When this dashboard is served through an ngrok free-tier tunnel, ngrok returns an
// interstitial HTML page for browser GET requests that lack this header — which would
// make every JSON API call return HTML and show no data. Injecting the header on each
// request skips the interstitial; it is harmless when served from localhost.
const origFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('ngrok-skip-browser-warning', 'true');
  return origFetch(input, { ...init, headers });
};

let currentFormId = null;
let currentRange = 'all';
let currentSince = null;
let currentUntil = null;
let compareMode = false;
let activeCycleId = null;
let lastLoadedFields = null;
let dropOffChart = null;
let timeChart = null;
let compareChart = null;
let errorChart = null;
let sidebarWidth = 340;
let stepChart = null;
let timelineChart = null;

// client-side insights cache — avoids re-hitting the server on repeated clicks
// for the same form + date range. Cleared when form or range changes.
let insightsCache = null; // { formId, range, since, until, data }

function getInsightsFromCache(formId, range, since, until) {
  if (!insightsCache) return null;
  if (insightsCache.formId !== formId) return null;
  if (insightsCache.range !== range) return null;
  if (insightsCache.since !== since || insightsCache.until !== until) return null;
  return insightsCache.data;
}

function setInsightsCache(formId, range, since, until, data) {
  insightsCache = { formId, range, since, until, data };
}

function clearInsightsCache() {
  insightsCache = null;
}

// ── Project persistence (localStorage) ───────────────────────────────────────

const PROJECTS_KEY = 'fis_projects';

// ── Deploy cycles (write-through: localStorage cache + server persistence) ────

const CYCLES_KEY = 'fis_cycles';

function getCycles(formId) {
  try { return JSON.parse(localStorage.getItem(CYCLES_KEY) || '{}')[formId] || []; } catch { return []; }
}

function setCyclesLocal(formId, cycles) {
  try {
    const all = JSON.parse(localStorage.getItem(CYCLES_KEY) || '{}');
    all[formId] = cycles;
    localStorage.setItem(CYCLES_KEY, JSON.stringify(all));
  } catch { /* quota */ }
}

function saveCycle(formId, cycle) {
  const all = JSON.parse(localStorage.getItem(CYCLES_KEY) || '{}');
  if (!all[formId]) all[formId] = [];
  all[formId].push(cycle);
  localStorage.setItem(CYCLES_KEY, JSON.stringify(all));
  fetch(`${SERVER_BASE}/cycles/${encodeURIComponent(formId)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cycle),
  }).catch(() => {});
}

function updateCycleSnapshot(formId, cycleId, snapshot) {
  const all = JSON.parse(localStorage.getItem(CYCLES_KEY) || '{}');
  if (!all[formId]) return;
  const cycle = all[formId].find((c) => c.id === cycleId);
  if (cycle) { cycle.snapshot = snapshot; localStorage.setItem(CYCLES_KEY, JSON.stringify(all)); }
  fetch(`${SERVER_BASE}/cycles/${encodeURIComponent(formId)}/${cycleId}/snapshot`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot),
  }).catch(() => {});
}

function deleteCycle(formId, cycleId) {
  const all = JSON.parse(localStorage.getItem(CYCLES_KEY) || '{}');
  if (!all[formId]) return;
  all[formId] = all[formId].filter((c) => c.id !== cycleId);
  localStorage.setItem(CYCLES_KEY, JSON.stringify(all));
  fetch(`${SERVER_BASE}/cycles/${encodeURIComponent(formId)}/${cycleId}`, { method: 'DELETE' }).catch(() => {});
}

async function syncCyclesFromServer(formId) {
  try {
    const res = await fetch(`${SERVER_BASE}/cycles/${encodeURIComponent(formId)}`);
    if (!res.ok) return;
    const serverCycles = await res.json();
    if (serverCycles.length) setCyclesLocal(formId, serverCycles);
  } catch { /* server unreachable — localStorage remains authoritative */ }
}

function getActiveWindow(formId, range) {
  if (activeCycleId) {
    const cycles = getCycles(formId);
    const idx = cycles.findIndex((c) => c.id === activeCycleId);
    if (idx >= 0) {
      return {
        sinceTs: cycles[idx].timestamp,
        untilTs: cycles[idx + 1] ? cycles[idx + 1].timestamp : null,
      };
    }
    activeCycleId = null;
  }
  return { sinceTs: currentSince || computeSince(range), untilTs: currentUntil ?? computeUntil(range) };
}

function buildQueryStr(sinceTs, untilTs) {
  let q = sinceTs ? `since=${sinceTs}` : 'range=all';
  if (untilTs) q += `&until=${untilTs}`;
  return q;
}

function ageLabel(ts) {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  return `${mins > 0 ? mins : 1}m ago`;
}

function closeCyclesPanel() {
  document.getElementById('cyclesPanel').classList.add('hidden');
  document.getElementById('cyclesTrigger').classList.remove('open');
}

function renderCyclesList(formId) {
  const cycles = getCycles(formId);
  const list = document.getElementById('cyclesList');
  if (!cycles.length) {
    list.innerHTML = '<p class="fis-cycles-empty">No cycles yet.<br>Click "+ New" each time you deploy a fix to track progress over time.</p>';
    return;
  }
  list.innerHTML = [...cycles].reverse().map((cycle, ri) => {
    const origIdx = cycles.length - 1 - ri;
    const nextCycle = cycles[origIdx + 1] || null;
    const isActive = cycle.id === activeCycleId;
    const date = new Date(cycle.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const windowLabel = nextCycle
      ? `${Math.round((nextCycle.timestamp - cycle.timestamp) / 86400000)}d window`
      : ageLabel(cycle.timestamp);
    return `
      <div class="fis-cycle-row${isActive ? ' fis-cycle-row--active' : ''}" data-id="${cycle.id}">
        <div class="fis-cycle-dot"></div>
        <div class="fis-cycle-info">
          <span class="fis-cycle-name">${cycle.name}</span>
          <span class="fis-cycle-meta">${date} · ${windowLabel}</span>
        </div>
        ${cycle.snapshot ? '<span class="fis-cycle-snap" title="Has progress snapshot">●</span>' : ''}
        <button class="fis-cycle-del" data-id="${cycle.id}" title="Delete">×</button>
      </div>`;
  }).join('');

  list.querySelectorAll('.fis-cycle-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('fis-cycle-del')) return;
      activeCycleId = activeCycleId === row.dataset.id ? null : row.dataset.id;
      updateCyclesUI(formId);
      closeCyclesPanel();
      if (currentFormId) {
        if (currentTab === 'sessions') loadJourneys(currentFormId, currentRange);
        else loadAnalytics(currentFormId, currentRange);
      }
    });
  });

  list.querySelectorAll('.fis-cycle-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCycle(formId, btn.dataset.id);
      if (activeCycleId === btn.dataset.id) activeCycleId = null;
      updateCyclesUI(formId);
      if (currentFormId) loadAnalytics(currentFormId, currentRange);
    });
  });
}

function updateCyclesUI(formId) {
  const cycles = getCycles(formId);
  const active = cycles.find((c) => c.id === activeCycleId);
  const label = document.getElementById('cyclesLabel');
  const trigger = document.getElementById('cyclesTrigger');
  label.textContent = active ? active.name : (cycles.length > 0 ? `Cycles (${cycles.length})` : 'Cycles');
  trigger.classList.toggle('fis-cycles-trigger--active', !!active);
  renderCyclesList(formId);
}

function getProjects() {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]'); } catch { return []; }
}

function saveProjects(list) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
}

function renderProjectList() {
  const list = document.getElementById('projectList');
  if (!list) return;
  const searchEl = document.getElementById('projectSearch');
  const rawQuery = (searchEl ? searchEl.value : '').trim();
  const queryPath = rawQuery ? extractFormId(rawQuery).toLowerCase() : '';
  const projects = getProjects();
  const filtered = rawQuery
    ? projects.filter((p) => {
      const normalizedName = p.name.toLowerCase();
      const normalizedFormId = p.formId.toLowerCase();
      const rawLower = rawQuery.toLowerCase();
      return normalizedName.includes(rawLower)
        || normalizedFormId.includes(rawLower)
        || normalizedFormId.includes(queryPath);
    })
    : projects;

  if (filtered.length === 0) {
    list.innerHTML = `<li class="fis-project-empty">${rawQuery ? 'No matches' : 'No forms yet'}</li>`;
    return;
  }

  list.innerHTML = filtered.map((p, i) => `
    <li class="fis-project-item${p.formId === currentFormId ? ' active' : ''}" data-formid="${p.formId}">
      <div class="fis-project-item-info">
        <span class="fis-project-item-name">${p.name}</span>
        <span class="fis-project-item-path">${p.formId}</span>
      </div>
      <button class="fis-project-del" data-formid="${p.formId}" title="Remove">×</button>
    </li>`).join('');

  list.querySelectorAll('.fis-project-item').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('fis-project-del')) return;
      const formId = row.dataset.formid;
      document.getElementById('formIdInput').value = formId;
      loadAnalytics(formId);
    });
  });

  list.querySelectorAll('.fis-project-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const allProjects = getProjects();
      const idx = allProjects.findIndex((p) => p.formId === btn.dataset.formid);
      if (idx >= 0) allProjects.splice(idx, 1);
      saveProjects(allProjects);
      renderProjectList();
    });
  });
}

function initProjects() {
  const searchEl = document.getElementById('projectSearch');
  // browsers can restore a stale search value on refresh, which would filter
  // the form list down to nothing — always start with an empty search box
  if (searchEl) {
    searchEl.value = '';
    searchEl.addEventListener('input', () => renderProjectList());
  }

  const addBtn = document.getElementById('addProjectBtn');
  const addForm = document.getElementById('addProjectForm');
  const confirmBtn = document.getElementById('addProjectConfirm');
  const cancelBtn = document.getElementById('addProjectCancel');
  const nameInput = document.getElementById('addProjectName');
  const pathInput = document.getElementById('addProjectPath');

  addBtn.addEventListener('click', () => {
    const hidden = addForm.classList.toggle('hidden');
    addBtn.textContent = hidden ? '+ Add Form' : '− Hide';
    if (!hidden) {
      pathInput.value = '';
      nameInput.value = '';
      nameInput.focus();
    }
  });

  cancelBtn.addEventListener('click', () => {
    addForm.classList.add('hidden');
    addBtn.textContent = '+ Add Form';
    nameInput.value = '';
    pathInput.value = '';
  });

  confirmBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const formId = extractFormId(pathInput.value);
    if (!formId) { pathInput.style.outline = '2px solid #e53e3e'; return; }
    pathInput.style.outline = '';
    const projects = getProjects().filter((p) => p.formId !== formId);
    projects.unshift({ name: name || formId.split('/').pop() || formId, formId });
    saveProjects(projects);
    renderProjectList();
    addForm.classList.add('hidden');
    addBtn.textContent = '+ Add Form';
    nameInput.value = '';
    pathInput.value = '';
    // load the newly added project
    document.getElementById('formIdInput').value = formId;
    loadAnalytics(formId);
  });

  // auto-load last project on open (unless URL has formId param)
  const urlFormId = new URLSearchParams(window.location.search).get('formId');
  if (urlFormId) {
    document.getElementById('formIdInput').value = urlFormId;
    loadAnalytics(urlFormId);
  } else {
    const last = getProjects()[0];
    if (last) {
      document.getElementById('formIdInput').value = last.formId;
      loadAnalytics(last.formId);
    }
  }

  renderProjectList();
}

// ── Range → since-timestamp ───────────────────────────────────────────────

function computeSince(range) {
  const now = Date.now();
  const d = new Date();
  switch (range) {
    case 'today': return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    case 'yesterday': return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime();
    case '1h': return now - 3600000;
    case '24h': return now - 86400000;
    case '7d': return now - 7 * 86400000;
    case '14d': return now - 14 * 86400000;
    case '28d': return now - 28 * 86400000;
    case '30d': return now - 30 * 86400000;
    case '90d': return now - 90 * 86400000;
    case '180d': return now - 180 * 86400000;
    case 'last_week': {
      const day = d.getDay() || 7;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day - 6).getTime();
    }
    case 'last_month': return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
    case 'this_week': {
      const day = d.getDay() || 7;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1)).getTime();
    }
    case 'this_month': return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    case 'ytd': return new Date(d.getFullYear(), 0, 1).getTime();
    default: return null;
  }
}

// Returns an explicit upper bound for ranges that are "closed" (not ending today).
// Open ranges (7d, 30d, 90d, today, etc.) return null so data up to now is included.
function computeUntil(range) {
  const d = new Date();
  switch (range) {
    case 'yesterday':
      // end of yesterday (23:59:59.999 local)
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - 1;
    case 'last_week': {
      // end of last Sunday (one day before this Monday)
      const day = d.getDay() || 7;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1)).getTime() - 1;
    }
    case 'last_month':
      // end of last day of last month
      return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999).getTime();
    default:
      return null;
  }
}

function pct(val) {
  return `${(val * 100).toFixed(1)}%`;
}

function shortLabel(name, max = 14) {
  if (name.length <= max) return name;
  const trimmed = name
    .replace(/^next_of_kin_/, 'nok_')
    .replace(/^address_/, 'addr_');
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function ms(val) {
  return `${(val / 1000).toFixed(1)}s`;
}

function severityLabel(score) {
  if (score > 1.5) return 'high';
  if (score > 0.5) return 'medium';
  return 'low';
}

// delta badge: direction is 'up-good' or 'down-good'
// up-good = higher is better (sessions, completion, return)
// down-good = lower is better (drop-off, errors, bounce)
function renderDelta(elId, current, prev, direction) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (prev == null || prev === 0) { el.classList.add('hidden'); return; }
  const diff = current - prev;
  const pctDiff = (diff / prev) * 100;
  if (Math.abs(pctDiff) < 0.5) {
    el.textContent = '—';
    el.className = 'fis-card-delta fis-delta-neutral';
    return;
  }
  const arrow = diff > 0 ? '▲' : '▼';
  const good = (direction === 'up-good' && diff > 0) || (direction === 'down-good' && diff < 0);
  el.textContent = `${arrow} ${Math.abs(pctDiff).toFixed(0)}%`;
  el.className = `fis-card-delta ${good ? 'fis-delta-good' : 'fis-delta-bad'}`;
}

function clearDeltas() {
  document.querySelectorAll('.fis-card-delta').forEach((el) => {
    el.classList.add('hidden');
    el.className = 'fis-card-delta hidden';
  });
}

function renderOverview(summary, prev) {
  document.getElementById('totalSessions').textContent = summary.totalSessions;
  document.getElementById('completionRate').textContent = pct(summary.completionRate);
  document.getElementById('dropOffRate').textContent = pct(summary.dropOffRate);
  document.getElementById('returnRate').textContent = pct(summary.returnRate);
  document.getElementById('scanOnlyRate').textContent = pct(summary.scanOnlyRate ?? 0);
  document.getElementById('bounceRate').textContent = pct(summary.bounceRate ?? 0);
  document.getElementById('avgScanTime').textContent = ms(summary.avgScanTimeMs ?? 0);
  document.getElementById('avgFieldsScanned').textContent = (summary.avgFieldsScannedBeforeFill ?? 0).toFixed(1);

  if (prev) {
    renderDelta('totalSessionsDelta', summary.totalSessions, prev.totalSessions, 'up-good');
    renderDelta('completionRateDelta', summary.completionRate, prev.completionRate, 'up-good');
    renderDelta('dropOffRateDelta', summary.dropOffRate, prev.dropOffRate, 'down-good');
    renderDelta('returnRateDelta', summary.returnRate, prev.returnRate, 'up-good');
    if (summary.errors && prev.errors) {
      renderDelta('jsErrorsDelta', summary.errors.jsErrors, prev.errors.jsErrors, 'down-good');
      renderDelta('apiErrorsDelta', summary.errors.apiErrors, prev.errors.apiErrors, 'down-good');
    }
  } else {
    clearDeltas();
  }

  const { errors } = summary;
  if (errors) {
    document.getElementById('jsErrors').textContent = errors.jsErrors;
    document.getElementById('apiErrors').textContent = errors.apiErrors;
    document.getElementById('rageClicks').textContent = errors.rageClicks;
    document.getElementById('disabledClicks').textContent = errors.disabledClicks;
    if (errors.topRageClick) {
      document.getElementById('rageClickSub').textContent = `most on: ${errors.topRageClick.label} (${errors.topRageClick.count}×)`;
    }
    document.getElementById('deadClicks').textContent = errors.deadClicks ?? 0;
    document.getElementById('submitErrors').textContent = errors.submitErrors ?? 0;
    if (errors.submitErrorBreakdown && Object.keys(errors.submitErrorBreakdown).length) {
      const parts = Object.entries(errors.submitErrorBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `${type.replace('_', ' ')}: ${count}`);
      document.getElementById('submitErrorSub').textContent = parts.join(' · ');
    } else if (errors.topSubmitError) {
      document.getElementById('submitErrorSub').textContent = `most common: ${errors.topSubmitError.label} (${errors.topSubmitError.count}×)`;
    }
  }
}

function renderApiLatency(summary) {
  const section = document.getElementById('apiLatencySection');
  const grid = document.getElementById('apiLatencyGrid');
  if (!section || !grid) return;
  const { avgLatency } = summary.performance || {};
  if (!avgLatency || !Object.keys(avgLatency).length) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  grid.innerHTML = Object.entries(avgLatency)
    .sort((a, b) => b[1] - a[1])
    .map(([type, ms]) => {
      const level = ms > 2000 ? 'fis-card-danger' : ms > 1000 ? 'fis-card-warn' : '';
      return `<div class="fis-card">
        <span class="fis-card-label">${type.replace(/_/g, ' ')}</span>
        <span class="fis-card-value ${level}">${ms}ms</span>
        <span class="fis-card-sub">${ms > 2000 ? 'high — may cause abandonment' : ms > 1000 ? 'borderline — monitor' : 'ok'}</span>
      </div>`;
    }).join('');
}

function renderCharts(fields) {
  if (!document.getElementById('dropOffChart')) return;
  const labels = fields.map((f) => shortLabel(f.field));
  const chartDefaults = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  };

  if (dropOffChart) dropOffChart.destroy();
  if (timeChart) timeChart.destroy();
  if (errorChart) errorChart.destroy();
  if (timelineChart) { timelineChart.destroy(); timelineChart = null; }

  dropOffChart = new Chart(document.getElementById('dropOffChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: fields.map((f) => (f.dropOffRate * 100).toFixed(1)),
        backgroundColor: '#e53e3e55',
        borderColor: '#e53e3e',
        borderWidth: 1,
      }],
    },
    options: chartDefaults,
  });

  timeChart = new Chart(document.getElementById('timeChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: fields.map((f) => (f.avgTimeSpentMs / 1000).toFixed(1)),
        backgroundColor: '#0070f355',
        borderColor: '#0070f3',
        borderWidth: 1,
      }],
    },
    options: chartDefaults,
  });

  errorChart = new Chart(document.getElementById('errorChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: fields.map((f) => f.avgErrorCount.toFixed(2)),
        backgroundColor: '#dd6b2055',
        borderColor: '#dd6b20',
        borderWidth: 1,
      }],
    },
    options: chartDefaults,
  });
}

function renderStepChart(abandonmentByStep) {
  const section = document.getElementById('stepSection');
  if (!section) return;
  const entries = Object.entries(abandonmentByStep || {});
  if (entries.length < 2) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  if (stepChart) stepChart.destroy();

  const topLastField = (lastFields) => {
    const sorted = Object.entries(lastFields || {}).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? sorted[0][0] : null;
  };

  stepChart = new Chart(document.getElementById('stepChart'), {
    type: 'bar',
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{
        data: entries.map(([, v]) => v.count),
        backgroundColor: '#e53e3e55',
        borderColor: '#e53e3e',
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const [, v] = entries[ctx.dataIndex];
              const field = topLastField(v.lastFields);
              return field ? `Last field: ${field}` : '';
            },
          },
        },
      },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

function renderFieldTable(fields) {
  const container = document.getElementById('fieldTable');
  if (!container) return;
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Field</th>
          <th>Drop-off</th>
          <th>Avg Time</th>
          <th>Avg Idle</th>
          <th>Errors</th>
          <th>Copy-paste</th>
          <th>Autofilled</th>
          <th>Label Copied</th>
          <th>Visibility</th>
          <th>Abandoned At</th>
          <th>Friction</th>
          <th>Diagnosis</th>
          <th>Confidence</th>
          <th>Severity</th>
        </tr>
      </thead>
      <tbody>
        ${fields.map((f) => {
    const sev = severityLabel(f.severityScore);
    return `
          <tr>
            <td title="${f.field}">${shortLabel(f.field)}</td>
            <td>${pct(f.dropOffRate)}</td>
            <td>${ms(f.avgTimeSpentMs)}</td>
            <td>${ms(f.avgIdleTimeMs)}</td>
            <td>${f.avgErrorCount.toFixed(1)}</td>
            <td>${pct(f.copyPasteRate)}</td>
            <td>${pct(f.autofillRate ?? 0)}</td>
            <td>${pct(f.labelCopyRate ?? 0)}</td>
            <td>${pct(f.visibilityRate)}</td>
            <td>${f.abandonCount > 0 ? `${f.abandonCount} journey${f.abandonCount !== 1 ? 's' : ''}` : '—'}</td>
            <td>
              <div class="fis-friction-wrap" title="Friction score: ${f.frictionScore ?? 0}/100">
                <div class="fis-friction-bar"><div class="fis-friction-fill fis-friction-${f.frictionLevel ?? 'low'}" style="width:${f.frictionScore ?? 0}%"></div></div>
                <span class="fis-friction-pct">${f.frictionScore ?? 0}</span>
              </div>
            </td>
            <td>${f.diagnosis?.label ?? f.possibleReason}</td>
            <td>
              <div class="fis-confidence-wrap fis-confidence-inline">
                <div class="fis-confidence-bar"><div class="fis-confidence-fill" style="width:${f.diagnosis?.confidence ?? 0}%"></div></div>
                <span class="fis-confidence-pct">${f.diagnosis?.confidence ?? 0}%</span>
              </div>
            </td>
            <td class="fis-severity-${sev}">${sev.toUpperCase()}</td>
          </tr>`;
  }).join('')}
      </tbody>
    </table>
  `;
}

// ── Funnel ────────────────────────────────────────────────────────────────

function cleanFunnelLabel(raw) {
  return raw
    .replace(/^radiobutton-[a-z0-9]+_/i, '')
    .replace(/^card-choice-group-[a-z0-9]+_/i, '')
    .replace(/^[a-z0-9]+-[a-z0-9]+_/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20) || raw.slice(0, 20);
}

async function renderFunnel(formId, sinceTs, untilTs) {
  const q = buildQueryStr(sinceTs, untilTs);
  const res = await fetch(`${API}/funnel/${encodeURIComponent(formId)}?${q}`).catch(() => null);
  if (!res) return;
  const steps = await res.json();
  const container = document.getElementById('funnelChart');
  if (!steps.length) { container.innerHTML = '<p style="color:#aaa;font-size:13px">Not enough step data yet.</p>'; return; }

  const max = steps[0].count || 1;
  container.innerHTML = steps.map((step, i) => {
    step = { ...step, label: cleanFunnelLabel(step.label) };
    const pctVal = ((step.count / max) * 100).toFixed(0);
    const rawDrop = i > 0 ? (((steps[i - 1].count - step.count) / (steps[i - 1].count || 1)) * 100) : null;
    const dropPct = rawDrop !== null ? Math.max(0, rawDrop).toFixed(0) : null;
    const isLast = i === steps.length - 1;
    return `
      <div class="fis-funnel-row">
        <div class="fis-funnel-label">${step.label}</div>
        <div class="fis-funnel-bar-wrap">
          <div class="fis-funnel-bar ${isLast ? 'fis-funnel-bar--complete' : ''}" style="width:${pctVal}%">
            <span class="fis-funnel-count">${step.count}</span>
          </div>
        </div>
        ${dropPct !== null ? `<div class="fis-funnel-drop">↓ ${dropPct}% dropped</div>` : '<div class="fis-funnel-drop"></div>'}
      </div>`;
  }).join('');
}

// ── Flow comparison: completers vs abandoners ─────────────────────────────

async function renderFlowComparison(formId, sinceTs, untilTs) {
  const section = document.getElementById('flowSection');
  const container = document.getElementById('flowComparison');
  if (!section || !container) return;

  const q = buildQueryStr(sinceTs, untilTs);
  const res = await fetch(`${API}/flow/${encodeURIComponent(formId)}?${q}`).catch(() => null);
  if (!res) { section.classList.add('hidden'); return; }
  const data = await res.json();

  if (!data.ready) {
    section.classList.remove('hidden');
    container.innerHTML = `<p class="fis-flow-empty">${data.message || 'Not enough data to compare yet.'}</p>`;
    return;
  }
  section.classList.remove('hidden');

  const pctNum = (r) => `${Math.round(r * 100)}%`;
  const displayName = (n) => (n === 'Start' ? 'left at the very start' : n);
  const ppl = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const insightsHtml = data.insights.map((t) => `<div class="fis-flow-insight">💡 ${t}</div>`).join('');

  const started = data.completedCount + data.abandonedCount;
  const dropoffs = data.dropoffs || [];
  const dropByStep = new Map(dropoffs.map((d) => [d.step, d]));
  const topDropStep = dropoffs[0]?.step;

  // Walk the steps in order. The green spine = the journey that worked (everyone
  // still on track flows down to Submitted). At each step, abandoned journeys
  // branch off to the right with their count + their own reason.
  let stillOnTrack = started;
  const nodes = data.steps.map((s) => {
    const reachedHere = stillOnTrack;
    const drop = dropByStep.get(s.name);
    stillOnTrack -= (drop?.count || 0);
    const isBreak = drop && s.name === topDropStep;
    const reason = drop
      ? (drop.reason
        ? `<strong>${drop.reason}</strong>${drop.reasonCount > 1 ? ` <span class="fis-jrny-rcount">(${drop.reasonCount} hit this)</span>` : ''}`
        : 'left without an error — likely lost interest or the form felt too long')
      : '';
    const range = drop && drop.ciHi != null
      ? ` <span class="fis-jrny-ci" title="95% confidence range for this share, given the sample size">${pctNum(drop.pct)} of quitters · range ${pctNum(drop.ciLo)}–${pctNum(drop.ciHi)}</span>`
      : '';
    const branch = drop
      ? `<div class="fis-jrny-branch ${isBreak ? 'fis-jrny-branch--top' : ''}">
           <span class="fis-jrny-branch-x">✗ ${ppl(drop.count)} left here</span>${range}
           <span class="fis-jrny-branch-reason">${reason}</span>
         </div>`
      : '<div class="fis-jrny-allok">✓ everyone continued</div>';
    return `
      <div class="fis-jrny-node">
        <div class="fis-jrny-rail"><span class="fis-jrny-dot"></span></div>
        <div class="fis-jrny-body">
          <div class="fis-jrny-step">${displayName(s.name)}</div>
          <div class="fis-jrny-reached">${reachedHere} of ${started} reached this step</div>
          ${branch}
        </div>
      </div>`;
  }).join('');

  // Issues completers faced but pushed through
  const completerIssues = (data.errorComparison || [])
    .filter((e) => e.completedRate > 0)
    .slice(0, 3);
  const frictionHtml = completerIssues.length
    ? `<div class="fis-jrny-friction">
        <span class="fis-jrny-friction-label">Issues they faced but pushed through:</span>
        ${completerIssues.map((e) => {
          const count = Math.round(e.completedRate * data.completedCount);
          return `<span class="fis-jrny-friction-item">${e.error} <em>(${count} of ${data.completedCount})</em></span>`;
        }).join('')}
       </div>`
    : '<div class="fis-jrny-friction fis-jrny-friction--clean">No errors recorded on the happy path.</div>';

  // Avoidance completions — users who refreshed past an error and succeeded by not triggering it again
  const av = data.avoidance;
  const stepIcon = { step: '→', error: '✗', friction: '⚠', end: '🚪', success: '✓' };
  const renderAttempt = (a) => {
    const stepsHtml = a.steps.map((st) => `<li class="fis-av-step fis-av-step--${st.kind}">${stepIcon[st.kind] || '·'} ${esc(st.text)}</li>`).join('');
    const badge = a.outcome === 'completed'
      ? '<span class="fis-av-badge fis-av-badge--done">completed</span>'
      : '<span class="fis-av-badge fis-av-badge--quit">abandoned, then refreshed</span>';
    return `<div class="fis-av-attempt">
        <div class="fis-av-attempt-head">Attempt ${a.attempt} ${badge}</div>
        <ol class="fis-av-steps">${stepsHtml}</ol>
      </div>`;
  };
  const avoidanceHtml = av
    ? `<div class="fis-jrny-avoidance">
        <span class="fis-jrny-avoidance-label">⚠ ${av.count} of ${data.completedCount} completed only after refreshing past an error</span>
        <span class="fis-jrny-avoidance-note">They didn't fix the issue — they avoided it. The problem is still there for real users.</span>
        ${av.journeys.map((j) => `<div class="fis-av-journey">${j.attempts.map(renderAttempt).join('<div class="fis-av-refresh">↻ refreshed the page</div>')}</div>`).join('')}
       </div>`
    : '';

  // What happened & what to do — recommendations to turn abandons into the happy flow
  const recs = data.recommendations || [];
  const recsHtml = recs.length
    ? `<div class="fis-flow-recs">
        <div class="fis-flow-recs-title">What happened &amp; what to do</div>
        ${recs.map((r) => `<div class="fis-flow-rec">
            <div class="fis-flow-rec-problem">${esc(r.problem)}</div>
            <div class="fis-flow-rec-action">→ ${esc(r.action)}</div>
          </div>`).join('')}
       </div>`
    : '';

  // success endpoint — the path that worked
  const successNode = `
    <div class="fis-jrny-node fis-jrny-node--success">
      <div class="fis-jrny-rail"><span class="fis-jrny-dot fis-jrny-dot--success">✓</span></div>
      <div class="fis-jrny-body">
        <div class="fis-jrny-step">Submitted</div>
        <div class="fis-jrny-success-msg"><strong>${ppl(data.completedCount)} completed the form</strong> — this is the path that worked.</div>
        ${avoidanceHtml}
        ${frictionHtml}
      </div>
    </div>`;

  const conf = data.confidence || { level: 'low', note: '' };
  const confLabel = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }[conf.level];
  const confBanner = `
    <div class="fis-jrny-conf fis-jrny-conf--${conf.level}">
      <span class="fis-jrny-conf-badge">${confLabel}</span>
      <span class="fis-jrny-conf-note">${conf.note}</span>
    </div>`;

  container.innerHTML = `
    <div class="fis-flow-insights">${insightsHtml}</div>
    ${confBanner}
    <div class="fis-jrny-legend">
      <span class="fis-jrny-legend-item"><span class="fis-jrny-swatch fis-jrny-swatch--done"></span> ${ppl(data.completedCount)} completed</span>
      <span class="fis-jrny-legend-item"><span class="fis-jrny-swatch fis-jrny-swatch--quit"></span> ${ppl(data.abandonedCount)} abandoned</span>
    </div>
    <div class="fis-jrny">${nodes}${successNode}</div>
    ${recsHtml}`;
}


// ── Heatmap ───────────────────────────────────────────────────────────────

function renderHeatmap(fields) {
  const container = document.getElementById('heatmapGrid');
  if (!fields.length) { container.innerHTML = ''; return; }

  function severityMeta(drop) {
    if (drop > 0.3) return { cls: 'critical', label: 'CRITICAL' };
    if (drop > 0.15) return { cls: 'high', label: 'HIGH' };
    if (drop > 0.05) return { cls: 'medium', label: 'MEDIUM' };
    return { cls: 'low', label: 'LOW' };
  }

  container.innerHTML = fields.map((f) => {
    const drop = f.dropOffRate;
    const { cls, label } = severityMeta(drop);
    const diag = f.diagnosis || { label: 'No data', confidence: 0, evidence: [] };
    const evidenceHtml = diag.evidence.length
      ? `<ul class="fis-heat-evidence">${diag.evidence.map((e) => `<li>${e}</li>`).join('')}</ul>`
      : '';
    return `
      <div class="fis-heat-card ${cls}">
        <div class="fis-heat-card-top">
          <span class="fis-heat-card-name" title="${f.field}">${f.field}</span>
          <span class="fis-heat-card-badge">${label}</span>
        </div>
        <div class="fis-heat-card-pct">${pct(drop)}</div>
        <div class="fis-heat-card-label">drop-off</div>
        <div class="fis-heat-diagnosis">
          <div class="fis-heat-diag-label">${diag.label}</div>
          <div class="fis-confidence-wrap">
            <div class="fis-confidence-bar"><div class="fis-confidence-fill" style="width:${diag.confidence}%"></div></div>
            <span class="fis-confidence-pct">${diag.confidence}%</span>
          </div>
          ${evidenceHtml}
        </div>
      </div>`;
  }).join('');
}


// ── Baseline snapshot (localStorage) ─────────────────────────────────────

const SNAPSHOT_KEY = 'fis_snapshots';

function saveSnapshot(formId, fields) {
  const all = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '{}');
  all[formId] = { fields, savedAt: Date.now() };
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(all));
}

function getSnapshot(formId) {
  const all = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '{}');
  return all[formId] || null;
}

function clearSnapshot(formId) {
  const all = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '{}');
  delete all[formId];
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(all));
}

// ── Progress comparison (before vs after fixes) ───────────────────────────


async function renderInsights(formId, forceRefresh = false) {
  const container = document.getElementById('insightsContainer');
  const status = document.getElementById('insightsStatus');
  const divider = document.getElementById('sidebarDivider');

  const { sinceTs, untilTs } = getActiveWindow(formId, currentRange);

  // return cached result instantly if same form + range — no network call needed
  const cached = !forceRefresh && getInsightsFromCache(formId, currentRange, sinceTs, untilTs);
  if (cached) {
    renderInsightsData(formId, cached, container, status, divider);
    return;
  }

  container.innerHTML = '<p class="fis-insights-loading">Generating insights...</p>';
  status.textContent = 'Loading...';

  const q = buildQueryStr(sinceTs, untilTs);
  const res = await fetch(`${API}/insights/${encodeURIComponent(formId)}?${q}`);
  const data = await res.json();
  if (data.ready) setInsightsCache(formId, currentRange, sinceTs, untilTs, data);
  renderInsightsData(formId, data, container, status, divider);
}

// Append the complete resolved-fix history for a form — including items that are no
// longer generated as insights (truly fixed), which the generation-matched Resolved
// section can't show. Pulled from /fixes/:formId so it's a permanent audit trail.
async function renderResolvedFixesHistory(formId, resolvedInsights) {
  const container = document.getElementById('insightsContainer');
  if (!container || formId !== currentFormId) return;

  let fixes;
  try {
    const res = await fetch(`${API}/fixes/${encodeURIComponent(formId)}`);
    fixes = await res.json();
  } catch { return; }
  if (!Array.isArray(fixes) || !fixes.length || formId !== currentFormId) return;

  // keys already shown as rich resolved cards — don't duplicate them
  const shown = new Set();
  (resolvedInsights || []).forEach((i) => {
    const key = i.fields?.length
      ? i.fields.slice().sort().join(',')
      : `__session__${(i.fix || '').slice(0, 60)}`;
    shown.add(key);
    if (i.errorSignature) shown.add(i.errorSignature);
  });

  const extra = fixes
    .filter((f) => !shown.has(f.field) && !(f.errorSignature && shown.has(f.errorSignature)))
    .sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0));
  if (!extra.length) return;

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const labelOf = (f) => {
    if (f.errorSignature) return f.errorSignature.replace(/^api:/, 'HTTP ').replace(/:/g, ' ');
    if (f.field && !f.field.startsWith('__session__')) return f.field;
    return (f.fix || 'Resolved issue').slice(0, 50);
  };
  const rowsHtml = extra.map((f) => {
    const applied = f.actualFix
      ? esc(f.actualFix)
      : `<span class="fis-rfx-suggested">used suggested: ${esc(f.fix || '')}</span>`;
    const when = f.resolvedAt ? timeAgo(f.resolvedAt) : '';
    const issueHtml = f.insightText
      ? `<div class="fis-rfx-issue">${esc(f.insightText)}</div>`
      : '';
    return `<div class="fis-rfx-row">
        <div class="fis-rfx-head">
          <span class="fis-rfx-check">✓</span>
          <span class="fis-rfx-label" title="${esc(f.field || '')}">${esc(labelOf(f))}</span>
          <span class="fis-rfx-time">${when}</span>
        </div>
        ${issueHtml}
        <div class="fis-rfx-applied"><strong>Fix:</strong> ${applied}</div>
      </div>`;
  }).join('');

  // find or create the resolved section, then append the history block
  let section = container.querySelector('.fis-resolved-section');
  if (!section) {
    section = document.createElement('div');
    section.className = 'fis-resolved-section';
    section.innerHTML = '<div class="fis-resolved-divider">Resolved</div>';
    container.appendChild(section);
  }
  section.classList.remove('hidden');
  section.insertAdjacentHTML('beforeend', `<div class="fis-rfx-history">${rowsHtml}</div>`);

  const divider = section.querySelector('.fis-resolved-divider');
  if (divider) {
    const cardCount = section.querySelectorAll('.fis-insight-card').length;
    divider.textContent = `Resolved (${cardCount + extra.length})`;
  }
}

function renderInsightsData(formId, data, container, status, divider) {
  if (!data.ready) {
    container.innerHTML = `<p class="fis-insights-empty">${data.message}</p>`;
    status.textContent = '';
    return;
  }

  // save snapshot — to active cycle if one is selected, else legacy
  if (data.analysis?.fields) {
    const snap = { fields: data.analysis.fields, savedAt: Date.now() };
    if (activeCycleId) {
      updateCycleSnapshot(formId, activeCycleId, snap);
      updateCyclesUI(formId);
    } else {
      saveSnapshot(formId, data.analysis.fields);
    }
    lastLoadedFields = data.analysis.fields;
  }

  // show the divider toggle and open the sidebar
  divider.classList.remove('hidden');
  const dashboard = document.getElementById('dashboard');
  dashboard.classList.add('sidebar-open');
  document.querySelector('.fis-sidebar').style.width = `${sidebarWidth}px`;
  updateToggleBtn(true);

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function buildCard(insight, isResolved) {
    const isRegression = !isResolved && !!insight.isRegression;
    const extraClass = isRegression ? ' fis-card-regression' : (isResolved ? ' fis-card-resolved' : '');
    const fieldsHtml = insight.fieldDetails.map((d) => `
      <span class="fis-field-chip fis-field-chip--${d.priority}" title="${esc(d.field)}">
        ${shortLabel(d.field)} <em>${esc(d.stat)}</em>
      </span>`).join('');
    const badge = isRegression
      ? '<span class="fis-card-regression-badge">⚠ Regression</span>'
      : isResolved
        ? '<span class="fis-card-resolved-badge">✓ Fixed</span>'
        : `<span class="fis-insight-priority">${esc(insight.priority)}</span>`;
    const regressionHtml = isRegression && insight.regressionDetail
      ? `<div class="fis-card-regression-detail">
           Was ${fmtMetric(insight.regressionDetail.metric, insight.regressionDetail.snapshotValue)} when resolved —
           now ${fmtMetric(insight.regressionDetail.metric, insight.regressionDetail.currentValue)}
           (threshold: ${fmtMetric(insight.regressionDetail.metric, insight.regressionDetail.threshold)})
         </div>`
      : '';
    // proven fix recommended from a past incident on another form
    const pr = insight.priorResolution;
    const priorHtml = !isResolved && pr
      ? `<div class="fis-kb-prior">
           <div class="fis-kb-prior-head">🧠 Solved before${pr.formName ? ` on <strong>${esc(pr.formName)}</strong>` : ''}${pr.timesApplied > 1 ? ` · applied ${pr.timesApplied}×` : ''}</div>
           <div class="fis-kb-prior-fix">What worked: ${esc(pr.fix)}</div>
         </div>`
      : '';
    const sig = insight.errorSignature ? ` data-sig="${esc(insight.errorSignature)}" data-siglabel="${esc(insight.errorLabel || '')}"` : '';
    // Confidence badge, pinned to the top-right corner of the card
    const confHtml = (!isResolved && !isRegression && insight.confidence != null)
      ? `<span class="fis-insight-conf" title="${esc(insight.confidenceReason || '')}">${insight.confidence}% confidence</span>`
      : '';
    return `
      <div class="fis-insight-card ${insight.priority}${extraClass}" data-fields='${JSON.stringify(insight.fields)}'>
        ${badge}
        ${confHtml}
        <div class="fis-insight-chips">${fieldsHtml}</div>
        <div class="fis-insight-text">${esc(insight.insight)}</div>
        ${isResolved && insight.appliedFix
    ? `<div class="fis-insight-fix"><strong>Fix applied:</strong> ${esc(insight.appliedFix)}</div>
           <div class="fis-insight-suggested"><em>Suggested was:</em> ${esc(insight.fix)}</div>`
    : `<div class="fis-insight-fix"><strong>${isResolved ? 'Fix applied (used suggested)' : 'Fix'}:</strong> ${esc(insight.fix)}</div>`}
        <div class="fis-insight-why"><em>${isResolved ? 'Why it mattered' : 'Why'}:</em> ${esc(insight.why)}</div>
        ${priorHtml}
        ${regressionHtml}
        ${!isResolved ? `<button class="fis-resolve-btn" data-fix="${esc(insight.fix)}"${sig}>Mark Resolved</button>` : ''}
      </div>`;
  }

  function fmtMetric(metric, value) {
    if (!metric || value == null) return '—';
    if (metric.includes('Ms')) return `${(value / 1000).toFixed(1)}s`;
    return `${(value * 100).toFixed(0)}%`;
  }

  // server already splits into active and resolved — use directly
  const activeInsights = data.insights || [];
  const allResolvedInsights = data.resolvedInsights || [];

  // when a cycle is active, only show what was resolved in that specific cycle
  const resolvedInsights = activeCycleId
    ? allResolvedInsights.filter((i) => i.cycleId === activeCycleId)
    : allResolvedInsights;

  const resolvedTitle = activeCycleId
    ? `Resolved in "${getCycles(currentFormId).find((c) => c.id === activeCycleId)?.name || 'this cycle'}" (${resolvedInsights.length})`
    : `Resolved (${resolvedInsights.length})`;

  const regressionCount = activeInsights.filter((i) => i.isRegression).length;
  const freshCount = activeInsights.length - regressionCount;
  const sourceLabel = { skill: 'Claude Skill', 'claude-api': 'Claude API', rules: 'Rules' }[data.source] || data.source;
  const parts = [];
  if (freshCount) parts.push(`${freshCount} issue${freshCount !== 1 ? 's' : ''}`);
  if (regressionCount) parts.push(`${regressionCount} regression${regressionCount !== 1 ? 's' : ''}`);
  status.textContent = `${parts.join(' · ')} · via ${sourceLabel}`;

  let html = activeInsights.map((i) => buildCard(i, false)).join('');

  if (resolvedInsights.length) {
    html += `
      <div class="fis-resolved-section">
        <div class="fis-resolved-divider">${resolvedTitle}</div>
        ${resolvedInsights.map((i) => buildCard(i, true)).join('')}
      </div>`;
  } else {
    html += `<div class="fis-resolved-section hidden" id="resolvedSection">
      <div class="fis-resolved-divider">${resolvedTitle}</div>
    </div>`;
  }

  container.innerHTML = html;

  // append the COMPLETE resolved-fix history (items no longer generated as insights)
  renderResolvedFixesHistory(formId, resolvedInsights);

  // resolve handlers — save to server, remove button, move card to resolved section
  container.querySelectorAll('.fis-resolve-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.fis-insight-card');
      const fields = JSON.parse(card.dataset.fields);
      const key = fields.length > 0
        ? fields.slice().sort().join(',')
        : `__session__${btn.dataset.fix.slice(0, 60)}`;
      // build a per-field metrics snapshot so regression detection has a baseline
      const snapshot = {};
      fields.forEach((fieldName) => {
        const stats = (data.analysis?.fields || []).find((f) => f.field === fieldName);
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

      const sig = btn.dataset.sig || null;
      // capture the issue description so it's still visible in the resolved history
      // even after the issue is fully fixed and no longer generated as an insight
      const insightText = card.querySelector('.fis-insight-text')?.textContent?.trim() || null;

      async function doResolve(actualFix, usedSuggested) {
        await fetch(`${API}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formId,
            field: key,
            fix: btn.dataset.fix,
            snapshot,
            cycleId: activeCycleId || null,
            errorSignature: sig,
            errorLabel: btn.dataset.siglabel || null,
            actualFix,
            usedSuggested,
            insightText,
            formName: (formId.split('/').filter(Boolean).pop() || formId),
          }),
        });

        btn.remove();
        card.classList.remove('fis-card-regression');
        card.classList.add('fis-card-resolved');

        let resolvedSection = container.querySelector('.fis-resolved-section');
        if (!resolvedSection) {
          resolvedSection = document.createElement('div');
          resolvedSection.className = 'fis-resolved-section';
          const newDividerTitle = activeCycleId
            ? `Resolved in "${getCycles(currentFormId).find((c) => c.id === activeCycleId)?.name || 'this cycle'}"`
            : 'Resolved';
          resolvedSection.innerHTML = `<div class="fis-resolved-divider">${newDividerTitle}</div>`;
          const copyAll = container.querySelector('.fis-copy-all');
          if (copyAll) container.insertBefore(resolvedSection, copyAll);
          else container.appendChild(resolvedSection);
        }
        resolvedSection.classList.remove('hidden');

        const divider = resolvedSection.querySelector('.fis-resolved-divider');
        const currentCount = resolvedSection.querySelectorAll('.fis-insight-card').length + 1;
        if (divider) {
          const cycleName = activeCycleId
            ? getCycles(currentFormId).find((c) => c.id === activeCycleId)?.name
            : null;
          divider.textContent = cycleName
            ? `Resolved in "${cycleName}" (${currentCount})`
            : `Resolved (${currentCount})`;
        }

        resolvedSection.appendChild(card);
      }

      // show inline Yes/No confirmation below the button for every insight
      if (card.querySelector('.fis-resolve-confirm')) return; // already open
      btn.classList.add('hidden');
      const confirmEl = document.createElement('div');
      confirmEl.className = 'fis-resolve-confirm';
      confirmEl.innerHTML = `
        <p class="fis-resolve-confirm-q">Did the suggested fix work?</p>
        <div class="fis-resolve-confirm-btns">
          <button class="fis-resolve-yes-btn">Yes</button>
          <button class="fis-resolve-no-btn">No</button>
        </div>
        <div class="fis-resolve-alt hidden">
          <input class="fis-resolve-alt-input" type="text"
            placeholder="Suggest a fix for next time this issue appears" />
          <button class="fis-resolve-submit-btn">Submit</button>
        </div>`;
      btn.insertAdjacentElement('afterend', confirmEl);

      confirmEl.querySelector('.fis-resolve-yes-btn').addEventListener('click', async () => {
        await doResolve(null, true);
      });

      confirmEl.querySelector('.fis-resolve-no-btn').addEventListener('click', () => {
        confirmEl.querySelector('.fis-resolve-confirm-btns').classList.add('hidden');
        confirmEl.querySelector('.fis-resolve-alt').classList.remove('hidden');
      });

      confirmEl.querySelector('.fis-resolve-submit-btn').addEventListener('click', async () => {
        const actualFix = confirmEl.querySelector('.fis-resolve-alt-input').value.trim() || null;
        await doResolve(actualFix, false);
      });
    });
  });
}

function updateToggleBtn(open) {
  const btn = document.getElementById('sidebarToggle');
  if (!btn) return;
  btn.textContent = open ? '›' : '‹';
  btn.title = open ? 'Hide Insights' : 'Show Insights';
}

function renderDeviceBreakdown(summary) {
  const section = document.getElementById('deviceSection');
  const db = summary.deviceBreakdown;
  if (!db || !Object.keys(db).length) { section.classList.add('hidden'); return; }

  const deviceLabels = { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet' };
  section.classList.remove('hidden');
  document.getElementById('deviceCards').innerHTML = Object.entries(db)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([device, d]) => {
      const completionRate = d.total ? d.completed / d.total : 0;
      const cls = completionRate < 0.3 ? 'fis-card-danger' : completionRate < 0.6 ? 'fis-card-warn' : '';
      return `
        <div class="fis-card">
          <span class="fis-card-label">${deviceLabels[device] || device}</span>
          <span class="fis-card-value ${cls}">${pct(completionRate)}</span>
          <span class="fis-card-sub">${d.total} journey${d.total !== 1 ? 's' : ''} · ${d.completed} completed</span>
        </div>`;
    }).join('');
}

function renderPlatformBreakdown(summary) {
  const section = document.getElementById('platformSection');
  if (!section) return;
  const os = summary.osBreakdown || {};
  const browser = summary.browserBreakdown || {};
  if (!Object.keys(os).length && !Object.keys(browser).length) {
    section.classList.add('hidden');
    return;
  }

  // Build cards highlighting platforms where errors are concentrated. A platform
  // is flagged danger if a high share of its sessions hit an error.
  const cardsFor = (map) => Object.entries(map)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, d]) => {
      const completionRate = d.total ? d.completed / d.total : 0;
      const errorRate = d.total ? d.withError / d.total : 0;
      const cls = errorRate >= 0.4 ? 'fis-card-danger' : errorRate >= 0.2 ? 'fis-card-warn' : '';
      return `
        <div class="fis-card">
          <span class="fis-card-label">${name}</span>
          <span class="fis-card-value ${cls}">${pct(errorRate)} <span style="font-size:11px;font-weight:400;color:#888">errors</span></span>
          <span class="fis-card-sub">${d.total} journey${d.total !== 1 ? 's' : ''} · ${pct(completionRate)} completed · ${d.withError} w/ error</span>
        </div>`;
    }).join('');

  document.getElementById('osCards').innerHTML = cardsFor(os) || '<p style="color:#888;padding:8px">No OS data yet.</p>';
  document.getElementById('browserCards').innerHTML = cardsFor(browser) || '<p style="color:#888;padding:8px">No browser data yet.</p>';
  section.classList.remove('hidden');
}

function renderRuleActivity(summary) {
  const section = document.getElementById('ruleSection');
  const ra = summary.ruleActivity;
  if (!ra || (!ra.sessionsWithTriggers && !ra.sessionsWithFailures)) { section.classList.add('hidden'); return; }

  document.getElementById('ruleTriggersCount').textContent = ra.sessionsWithTriggers;
  document.getElementById('ruleFailuresCount').textContent = ra.sessionsWithFailures;

  const rows = Object.entries(ra.triggersByField || {})
    .sort((a, b) => (b[1].shown + b[1].hidden) - (a[1].shown + a[1].hidden));

  if (rows.length) {
    document.getElementById('ruleTable').innerHTML = `
      <table>
        <thead><tr><th>Field / Panel</th><th>Times Shown</th><th>Times Hidden</th></tr></thead>
        <tbody>${rows.map(([field, counts]) => `
          <tr><td>${field}</td><td>${counts.shown}</td><td>${counts.hidden}</td></tr>
        `).join('')}</tbody>
      </table>`;
  }

  section.classList.remove('hidden');
}

async function renderErrorPanel(formId, sinceTs, untilTs) {
  const container = document.getElementById('errorPanelBody');
  if (!container) return;
  container.innerHTML = '<p style="color:#aaa;padding:16px">Loading errors...</p>';

  const q = buildQueryStr(sinceTs, untilTs);
  const res = await fetch(`${API}/errors/${encodeURIComponent(formId)}?${q}`).catch(() => null);
  if (!res || !res.ok) {
    container.innerHTML = '<p style="color:#aaa;padding:16px">Could not load error data.</p>';
    return;
  }
  const { errors } = await res.json();

  if (!errors.length) {
    container.innerHTML = '<p style="color:#aaa;padding:16px">No errors recorded in this period.</p>';
    return;
  }

  const severityColor = { critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#6b7280' };
  const typeBadge = {
    js_error: '<span class="fis-error-badge fis-badge-js">JS</span>',
    console_error: '<span class="fis-error-badge fis-badge-console">Console</span>',
    form_error: (err) => {
      const s = err.status || err.statusCode;
      if (s >= 500) return `<span class="fis-error-badge fis-badge-server">API ${s}</span>`;
      if (s >= 400) return `<span class="fis-error-badge fis-badge-client">API ${s}</span>`;
      return '<span class="fis-error-badge fis-badge-api">API</span>';
    },
    api_error: (err) => {
      const s = err.status || err.statusCode;
      if (!s || s === 0) return '<span class="fis-error-badge fis-badge-net">Network</span>';
      if (s >= 500) return `<span class="fis-error-badge fis-badge-server">Server ${s}</span>`;
      if (s >= 400) return `<span class="fis-error-badge fis-badge-client">HTTP ${s}</span>`;
      return '<span class="fis-error-badge fis-badge-net">Network</span>';
    },
  };
  const getBadge = (type, err) => (typeof typeBadge[type] === 'function' ? typeBadge[type](err) : (typeBadge[type] || `<span class="fis-error-badge">${esc(type)}</span>`));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  container.innerHTML = errors.map((err) => {
    const sev = err.diagnosis?.severity || 'medium';
    const pct = `${(err.sessionRate * 100).toFixed(0)}%`;
    const badge = getBadge(err.type, err);
    const msgPreview = esc((err.message || err.statusText || '').slice(0, 100));
    const freqHtml = err.avgPerSession > 1
      ? `<div class="fis-error-freq">Fired <strong>${err.avgPerSession}×</strong> per journey on avg${err.maxPerSession > err.avgPerSession ? ` (up to ${err.maxPerSession}×)` : ''}</div>`
      : '';
    const patternHtml = err.pattern
      ? `<div class="fis-error-pattern"><span class="fis-pattern-icon">⚠</span> ${esc(err.pattern)}</div>`
      : '';
    const diagHtml = err.diagnosis
      ? `<div class="fis-error-diag">
           <div class="fis-error-cause">${esc(err.diagnosis.cause)}</div>
           <div class="fis-error-fix">Fix: ${esc(err.diagnosis.fix)}</div>
         </div>`
      : '';
    const deviceStr = Object.entries(err.devices || {}).map(([d, n]) => `${d}: ${n}`).join(', ');
    return `
      <div class="fis-error-row fis-severity-${sev}" style="border-left-color:${severityColor[sev] || '#6b7280'}">
        <div class="fis-error-row-header">
          ${badge}
          <span class="fis-error-msg">${msgPreview || (err.status ? `HTTP ${err.status}` : 'No message')}</span>
          <span class="fis-error-sessions">${err.sessionCount} session${err.sessionCount !== 1 ? 's' : ''} (${pct})</span>
        </div>
        ${freqHtml}
        ${patternHtml}
        ${diagHtml}
        ${deviceStr ? `<div class="fis-error-meta">Devices: ${esc(deviceStr)}</div>` : ''}
      </div>`;
  }).join('');
}

// ── Error insights ────────────────────────────────────────────────────────────

function generateErrorInsights(errors, totalSessions) {
  if (!errors.length || !totalSessions) return [];
  const insights = [];

  const sessionUnion = (list) => new Set(list.flatMap((e) => e.sessionIds || [])).size;

  // most impactful single error
  const top = [...errors].sort((a, b) => b.sessionRate - a.sessionRate)[0];
  if (top.sessionRate > 0.25 && top.diagnosis) {
    insights.push({
      priority: top.diagnosis.severity === 'critical' ? 'critical' : 'high',
      impact: `${(top.sessionRate * 100).toFixed(0)}% of journeys`,
      insight: top.diagnosis.cause,
      fix: top.diagnosis.fix,
      why: `Affects ${top.sessionCount} of ${totalSessions} journeys — highest-priority fix.`,
    });
  }

  // CORS
  const corsErrors = errors.filter((e) => /cors/i.test(e.errorClass || '') || /cors/i.test(e.message || ''));
  if (corsErrors.length) {
    insights.push({
      priority: 'critical',
      impact: `${sessionUnion(corsErrors)} journey${sessionUnion(corsErrors) !== 1 ? 's' : ''}`,
      insight: 'CORS policy is blocking API calls — form features fail silently when the browser rejects cross-origin requests.',
      fix: 'Add Access-Control-Allow-Origin headers to all API endpoints. Configure the Cross-Origin Resource Sharing policy on the server.',
      why: 'CORS errors are invisible to users but silently break validation, prefill, and submission.',
    });
  }

  // rule engine
  const ruleErrors = errors.filter((e) => /rule.?engine|afb.?runtime|guideBridge/i.test(e.message || '') || e.errorClass === 'rule_engine');
  if (ruleErrors.length) {
    const affected = ruleErrors.reduce((s, e) => s + e.sessionCount, 0);
    insights.push({
      priority: 'critical',
      impact: `${affected} journey${affected !== 1 ? 's' : ''}`,
      insight: 'afb-runtime is crashing — form rules (show/hide, calculated fields, validation) stop working for affected users.',
      fix: 'Check for circular rule dependencies. Run `npm run update:core` to get the latest runtime. Test each rule individually in authoring.',
      why: 'Rule engine crashes are silent from the user\'s side — the form loads but conditional logic is dead, causing confusion and abandonment.',
    });
  }

  // submit / server failures
  const submitFails = errors.filter((e) => e.type === 'form_error' && (e.status === 0 || e.status >= 500));
  if (submitFails.length) {
    const affected = sessionUnion(submitFails);
    insights.push({
      priority: 'critical',
      impact: `${((affected / totalSessions) * 100).toFixed(0)}% of journeys`,
      insight: 'Form submission is failing with server or network errors — users who complete the form cannot submit it.',
      fix: submitFails[0].diagnosis?.fix || 'Check server logs for the stack trace. Verify the submission endpoint is deployed and reachable.',
      why: 'Submission failures are the worst outcome — users did the work but their data was never received.',
    });
  }

  // high error volume = systemic instability
  if (errors.length >= 5) {
    const affected = sessionUnion(errors);
    insights.push({
      priority: 'high',
      impact: `${((affected / totalSessions) * 100).toFixed(0)}% of journeys`,
      insight: `${errors.length} distinct error types detected — this volume points to systemic instability rather than isolated bugs.`,
      fix: 'Fix critical errors first. Audit recent deploys and dependency changes that coincide with when errors started appearing.',
      why: 'Many different errors appearing together usually share a common root cause: a bad deploy, a missing dependency, or a config change.',
    });
  }

  // deduplicate by insight text prefix
  const seen = new Set();
  return insights.filter((ins) => {
    const key = ins.insight.slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

// ── Errors tab ────────────────────────────────────────────────────────────────

async function updateErrorsBadge(formId, sinceTs, untilTs) {
  const q = buildQueryStr(sinceTs, untilTs);
  const res = await fetch(`${API}/errors/${encodeURIComponent(formId)}?${q}`).catch(() => null);
  if (!res || !res.ok) return;
  const { errors } = await res.json();
  const badge = document.getElementById('errTabBadge');
  if (!badge) return;
  badge.textContent = errors.length;
  badge.classList.toggle('hidden', errors.length === 0);
}

async function renderErrorsTab(formId, sinceTs, untilTs) {
  const container = document.getElementById('errorsView');
  if (!container) return;
  container.innerHTML = '<p class="fis-errors-loading">Loading errors…</p>';

  const q = buildQueryStr(sinceTs, untilTs);
  const res = await fetch(`${API}/errors/${encodeURIComponent(formId)}?${q}`).catch(() => null);
  if (!res || !res.ok) {
    container.innerHTML = '<p class="fis-errors-empty">Could not load error data — make sure the server is running.</p>';
    return;
  }
  const { errors, totalSessions } = await res.json();

  const badge = document.getElementById('errTabBadge');
  if (badge) {
    badge.textContent = errors.length;
    badge.classList.toggle('hidden', errors.length === 0);
  }

  if (!errors.length) {
    container.innerHTML = `
      <div class="fis-errors-clean">
        <div class="fis-errors-clean-icon">✓</div>
        <div class="fis-errors-clean-msg">No errors recorded across ${totalSessions} journey${totalSessions !== 1 ? 's' : ''}</div>
        <div class="fis-errors-clean-sub">Your form is error-free in this time range</div>
      </div>`;
    return;
  }

  const critCount = errors.filter((e) => e.diagnosis?.severity === 'critical').length;
  const highCount = errors.filter((e) => e.diagnosis?.severity === 'high').length;
  const medCount = errors.filter((e) => e.diagnosis?.severity === 'medium').length;
  const unknownCount = errors.filter((e) => !e.diagnosis).length;

  const sevColor = { critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#6b7280' };
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function getErrLayer(err) {
    const s = err.status || err.statusCode;
    if (err.type === 'form_error') {
      if (err.callType === 'ui_message') {
        return { cls: 'server', label: 'Service Error', desc: "The form's error handler fired and showed an error screen to the user. This is triggered by the backend service failing or returning an unexpected response — the form itself rendered correctly, but the service it depends on did not." };
      }
      const layer = err.layer || (s >= 500 ? 'backend' : s === 0 ? 'network' : s >= 400 ? 'client' : null);
      const map = {
        backend:    { cls: 'server', label: `Server Error (${s || '5xx'})`, desc: `The server returned HTTP ${s || '5xx'} while processing the form submission — it crashed or hit an unhandled exception. This is a backend bug, not a user input problem.` },
        auth:       { cls: 'client', label: s === 401 ? 'Session Expired (401)' : 'Access Denied (403)', desc: s === 401 ? 'The server rejected the request because the user session is missing or expired (HTTP 401). The user needs to log in again.' : 'The server rejected the request because the user does not have permission, or a security token (CSRF) is missing or expired (HTTP 403).' },
        config:     { cls: 'client', label: 'API Not Found (404)', desc: `The form is calling an API endpoint that does not exist on the server (HTTP 404). The URL "${esc(err.url || '')}" is wrong, the service is not deployed, or the route is misconfigured.` },
        payload:    { cls: 'client', label: 'Data Too Large (413)', desc: "The form submitted more data than the server allows (HTTP 413). A file upload or text field likely exceeds the server's size limit." },
        validation: { cls: 'client', label: `Rejected by Server (${s})`, desc: `The server rejected the submitted data (HTTP ${s}) — a field value failed backend validation. The data format or content doesn't match what the server expects.` },
        rate_limit: { cls: 'client', label: 'Too Many Requests (429)', desc: "The user has hit the server's rate limit (HTTP 429) — too many requests in a short window. They are temporarily blocked." },
        network:    { cls: 'net',    label: 'No Response (Network)', desc: 'The request never reached the server. The user is likely offline, or the request was blocked by a CORS/CSP policy before it could be sent (status 0).' },
        client:     { cls: 'client', label: `Request Rejected (${s})`, desc: `The server returned HTTP ${s} — the request was rejected, likely due to invalid or missing data in the form submission.` },
      };
      return map[layer] || { cls: 'api', label: `Form API Error${s ? ` (${s})` : ''}`, desc: `A form API call${err.url ? ` to ${esc(err.url)}` : ''} failed with no recognized error class.` };
    }
    if (err.type === 'api_error') {
      const cls = err.errorClass;
      const urlStr = err.url ? `"${esc(err.url)}"` : 'the API';
      const map = {
        cors:         { cls: 'net',    label: 'CORS Blocked',           desc: `The browser blocked the call to ${urlStr} because the server did not include the required CORS headers. This is a server configuration issue — the server needs to allow cross-origin requests from this page's origin.` },
        network_down: { cls: 'net',    label: 'Server Unreachable',     desc: `The call to ${urlStr} failed before getting any response. The user may be offline, the server may be down, or DNS resolution failed.` },
        timeout:      { cls: 'net',    label: 'Request Timed Out',      desc: `The call to ${urlStr} got no response within the allowed time. The server is overloaded or too slow.` },
        auth:         { cls: 'client', label: `Auth Rejected (${s || '401'})`, desc: `The call to ${urlStr} was rejected because the user's session is missing or expired (HTTP ${s || '401/403'}). The user needs to re-authenticate.` },
        not_found:    { cls: 'client', label: 'Endpoint Missing (404)', desc: `The endpoint ${urlStr} does not exist (HTTP 404). It is either not deployed, the URL is wrong, or the service was removed.` },
        rate_limited: { cls: 'client', label: 'Rate Limited (429)',     desc: `Too many calls to ${urlStr} in a short time (HTTP 429). The server is throttling this user or IP temporarily.` },
        server_error: { cls: 'server', label: `Server Crashed (${s || '5xx'})`, desc: `The server returned HTTP ${s || '5xx'} for the call to ${urlStr} — it crashed or threw an unhandled exception. This is a backend bug.` },
        client_error: { cls: 'client', label: `Bad Request (${s || '4xx'})`,    desc: `The call to ${urlStr} was rejected with HTTP ${s || '4xx'} — the request contains invalid or missing data.` },
      };
      return map[cls] || (s >= 500
        ? { cls: 'server', label: `Server Error (${s})`,  desc: `The server returned HTTP ${s} for the call to ${urlStr}. This is a backend failure.` }
        : s >= 400
          ? { cls: 'client', label: `Client Error (${s})`, desc: `The call to ${urlStr} was rejected with HTTP ${s}.` }
          : { cls: 'net',    label: 'Network Error',        desc: `The call to ${urlStr} failed — no response was received.` });
    }
    if (err.type === 'js_error') {
      const errType = err.errorType || 'Error';
      return { cls: 'js', label: `JS ${errType}`, desc: `An uncaught ${errType} was thrown by the form's JavaScript. This can freeze parts of the form, break button clicks, or block step navigation.` };
    }
    if (err.type === 'console_error') {
      const classMap = {
        missing_resource: `A background service call returned 404 — the endpoint "${esc(err.url || 'unknown')}" does not exist. The service is not deployed or the URL is wrong.`,
        cors:             "A background script was blocked by CORS — the server does not allow requests from this page's origin.",
        network_down:     'A background network request failed with no response — the user may be offline or the server is unreachable.',
      };
      return { cls: 'console', label: 'Console Error', desc: classMap[err.errorClass] || 'A script logged an error to the browser console. This may indicate a missing service, a failed background request, or a non-critical script failure.' };
    }
    return null;
  }

  const TYPE_BADGE = {
    js_error:      (err) => { const l = getErrLayer(err); return `<span class="fis-err-badge fis-err-badge-js">${l.label}</span>`; },
    console_error: (err) => { const l = getErrLayer(err); return `<span class="fis-err-badge fis-err-badge-console">${l.label}</span>`; },
    form_error:    (err) => { const l = getErrLayer(err); return `<span class="fis-err-badge fis-err-badge-${l.cls}">${l.label}</span>`; },
    api_error:     (err) => { const l = getErrLayer(err); return `<span class="fis-err-badge fis-err-badge-${l.cls}">${l.label}</span>`; },
  };
  const getErrBadge = (type, err) => (typeof TYPE_BADGE[type] === 'function' ? TYPE_BADGE[type](err) : (TYPE_BADGE[type] || `<span class="fis-err-badge">${esc(type)}</span>`));

  function buildErrCards(list) {
    return list.map((err) => {
      const sev = err.diagnosis?.severity || 'medium';
      const pct = `${(err.sessionRate * 100).toFixed(0)}%`;
      const typeBadge = getErrBadge(err.type, err);
      const msgFull = esc((err.message || err.statusText || '') || (err.status ? `HTTP ${err.status}` : 'Unknown error'));
      const statusBit = err.status ? `<span class="fis-err-status">HTTP ${err.status}</span>` : '';
      const urlBit = err.url ? `<div class="fis-err-url">${esc(err.url)}</div>` : '';
      const atButton = err.topTriggeredBy || null;
      const atField = !atButton ? (err.topNearestField || err.topElement || null) : null;
      const atStep = err.topStepName || null;
      const atOrigin = atButton
        ? `Button: <span class="fis-err-at-button">${esc(atButton)}</span>`
        : atField ? `<span class="fis-err-at-field">${esc(atField)}</span>` : null;
      const atParts = [atOrigin, atStep && `Step: <span class="fis-err-at-step">${esc(atStep)}</span>`].filter(Boolean);
      const atHtml = atParts.length ? `<div class="fis-err-at">At: ${atParts.join(' · ')}</div>` : '';
      const layer = getErrLayer(err);
      const descHtml = layer?.desc ? `<div class="fis-err-desc"><span class="fis-err-desc-label">What</span>${layer.desc}</div>` : '';
      const causeHtml = err.diagnosis?.cause ? `<div class="fis-err-cause">${esc(err.diagnosis.cause)}</div>` : '';
      function ssTriggerText(ss) {
        const at = ss.stepName ? ` at step "${esc(ss.stepName)}"` : '';
        if (ss.triggeredByLabel) {
          const verb = ss.triggeredByKind === 'field' ? 'Focused' : 'Clicked';
          return `User ${verb.toLowerCase()} "${esc(ss.triggeredByLabel)}"${at} before this error`;
        }
        if (ss.nearestField) return `Occurred near field "${esc(ss.nearestField)}"${at}`;
        if (ss.stepName) return `At step "${esc(ss.stepName)}"`;
        return null;
      }
      const ssHtml = (err.sampleScreenshots || []).length ? `
        <div class="fis-err-screenshots"><div class="fis-err-ss-strip">
          ${(err.sampleScreenshots || []).map((ss, i) => {
            const trigger = ssTriggerText(ss);
            return `
            <div class="fis-err-ss-sample">
              ${trigger ? `<div class="fis-err-ss-trigger">${trigger}</div>` : ''}
              <div class="fis-err-ss-pair">
                ${ss.before ? `
                  <div class="fis-err-ss-item">
                    <span class="fis-err-ss-tag">Before error</span>
                    <img class="fis-err-ss-thumb" src="${ss.before}" alt="Before error ${i + 1}" title="Click to enlarge" />
                  </div>` : `
                  <div class="fis-err-ss-item">
                    <span class="fis-err-ss-tag">Error screen</span>
                  <img class="fis-err-ss-thumb" src="${ss.after}" alt="Screenshot ${i + 1}" title="Click to enlarge" />
                  </div>`}
              </div>
            </div>`;
          }).join('')}
        </div></div>` : '';
      const freqHtml = err.avgPerSession > 1
        ? `<div class="fis-err-freq">Fired <strong>${err.avgPerSession}×</strong> per journey on avg · max <strong>${err.maxPerSession}×</strong> in one journey</div>`
        : '';
      const blockedHtml = err.blockedRate >= 50
        ? `<div class="fis-err-blocked"><span class="fis-err-blocked-icon">🚫</span> Blocked <strong>${err.blockedRate}%</strong> of affected users — they abandoned immediately after this error</div>`
        : '';
      const patternHtml = err.pattern
        ? `<div class="fis-err-pattern-card"><span class="fis-pattern-icon">⚠</span> ${esc(err.pattern)}</div>`
        : '';
      const deviceStr = Object.entries(err.devices || {}).map(([d, n]) => `${d}: ${n}`).join(' · ');
      const sessionChips = (err.sessionIds || []).map((id) => `<button class="fis-err-session-chip" data-sid="${id}" title="Open timeline for session ${id.slice(-8)}">#${id.slice(-8)}</button>`).join('');
      const firstSeen = err.firstSeen ? ageLabel(err.firstSeen) : null;
      const lastSeen = err.lastSeen ? ageLabel(err.lastSeen) : null;
      const timeStr = firstSeen && lastSeen && firstSeen !== lastSeen
        ? `First seen ${firstSeen} · Last seen ${lastSeen}`
        : firstSeen ? `First seen ${firstSeen}` : '';
      const footerParts = [
        sessionChips ? `<div class="fis-err-sessions-row"><span class="fis-err-sessions-label">Journeys:</span>${sessionChips}</div>` : '',
        (timeStr || deviceStr) ? `<div class="fis-err-meta">${[timeStr, deviceStr].filter(Boolean).join(' · ')}</div>` : '',
      ].filter(Boolean).join('');
      return `
        <div class="fis-err-card fis-err-sev-${sev}" style="--sev-color:${sevColor[sev] || '#6b7280'}">
          <div class="fis-err-card-left"></div>
          <div class="fis-err-card-body">
            <div class="fis-err-card-header">
              <div class="fis-err-card-header-left">${typeBadge}${statusBit}<span class="fis-err-sev-pill fis-err-sev-pill-${sev}">${sev}</span></div>
              <span class="fis-err-count">${err.sessionCount} journey${err.sessionCount !== 1 ? 's' : ''} <span class="fis-err-pct">${pct}</span></span>
            </div>
            <div class="fis-err-msg-full">${msgFull}</div>
            ${descHtml}
            ${urlBit}${atHtml}
            ${blockedHtml}${freqHtml}${patternHtml}${causeHtml}${ssHtml}
            ${footerParts ? `<div class="fis-err-footer">${footerParts}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  const errorInsights = generateErrorInsights(errors, totalSessions);

  const summaryHtml = `
    <div class="fis-errors-section-header">
      <span class="fis-errors-section-title">Error Overview</span>
      <span class="fis-errors-section-sub">${errors.length} unique error${errors.length !== 1 ? 's' : ''} across ${totalSessions} journey${totalSessions !== 1 ? 's' : ''}</span>
    </div>
    <div class="fis-errors-summary">
      <div class="fis-err-stat fis-err-stat-total"><span class="fis-err-stat-n">${errors.length}</span><span class="fis-err-stat-lbl">Total</span></div>
      ${critCount ? `<div class="fis-err-stat fis-err-stat-critical"><span class="fis-err-stat-n">${critCount}</span><span class="fis-err-stat-lbl">Critical</span></div>` : ''}
      ${highCount ? `<div class="fis-err-stat fis-err-stat-high"><span class="fis-err-stat-n">${highCount}</span><span class="fis-err-stat-lbl">High</span></div>` : ''}
      ${medCount ? `<div class="fis-err-stat fis-err-stat-medium"><span class="fis-err-stat-n">${medCount}</span><span class="fis-err-stat-lbl">Medium</span></div>` : ''}
      ${unknownCount ? `<div class="fis-err-stat fis-err-stat-unknown"><span class="fis-err-stat-n">${unknownCount}</span><span class="fis-err-stat-lbl">Unknown</span></div>` : ''}
      <div class="fis-err-stat"><span class="fis-err-stat-n">${totalSessions}</span><span class="fis-err-stat-lbl">Journeys</span></div>
    </div>`;

  const cardsHtml = buildErrCards(errors);

  // insights section — hidden until button clicked, placed after cards
  const insightsBlockHtml = errorInsights.length ? `
    <div class="fis-err-insights" style="margin-top:20px;">
      <button class="fis-err-insights-toggle" aria-expanded="false">
        Fix Suggestions &amp; Insights <span class="fis-err-insights-count">(${errorInsights.length})</span>
        <span class="fis-err-insights-chevron">▼</span>
      </button>
      <div class="fis-err-insights-body" hidden>
        ${errorInsights.map((ins) => `
          <div class="fis-insight-card ${esc(ins.priority)}">
            <span class="fis-insight-priority">${esc(ins.priority)}</span>
            <span class="fis-err-insight-impact">${esc(ins.impact)}</span>
            <div class="fis-insight-text">${esc(ins.insight)}</div>
            <div class="fis-insight-fix"><strong>Fix:</strong> ${esc(ins.fix)}</div>
            <div class="fis-insight-why"><em>Why:</em> ${esc(ins.why)}</div>
          </div>`).join('')}
      </div>
    </div>` : '';

  // error-type filter chips — one per type present, toggle to show/hide that type
  const ERR_TYPE_LABELS = {
    js_error: 'JS Errors', form_error: 'API Errors', api_error: 'API / Network',
    console_error: 'Console', rage_click: 'Rage Clicks', dead_click: 'Dead Clicks',
    disabled_click: 'Disabled Clicks', suspected_crash: 'Crashes', storage_quota: 'Storage',
  };
  const typeCounts = {};
  errors.forEach((e) => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });
  const presentTypes = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a]);

  // dropdown to pick which error type to view (compact vs a long list of everything)
  const typeFilterHtml = presentTypes.length > 1 ? `
    <select class="fis-sort-select" id="errTypeFilter">
      <option value="all">All error types (${errors.length})</option>
      ${presentTypes.map((t) => `<option value="${t}">${ERR_TYPE_LABELS[t] || t} (${typeCounts[t]})</option>`).join('')}
    </select>` : '';

  const errToolbarHtml = `
    <div class="fis-errors-toolbar">
      <span class="fis-errors-toolbar-label">Filter</span>
      ${typeFilterHtml}
      <span class="fis-errors-toolbar-sep"></span>
      <span class="fis-errors-toolbar-label">Sort</span>
      <select class="fis-sort-select" id="errorSort">
        <option value="sessions">Most journeys affected</option>
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="severity">Severity</option>
      </select>
    </div>`;

  container.innerHTML = summaryHtml + errToolbarHtml + `<div class="fis-err-cards" id="errCards">${cardsHtml}</div>` + insightsBlockHtml;

  // error sort + type-filter — both re-render the already-fetched errors client-side
  const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  const errSortFns = {
    sessions: (a, b) => b.sessionCount - a.sessionCount,
    newest: (a, b) => (b.lastSeen || 0) - (a.lastSeen || 0),
    oldest: (a, b) => (a.firstSeen || 0) - (b.firstSeen || 0),
    severity: (a, b) => (SEV_ORDER[a.diagnosis?.severity] ?? 4) - (SEV_ORDER[b.diagnosis?.severity] ?? 4),
  };
  function applyErrFilters() {
    const sortVal = container.querySelector('#errorSort')?.value || 'sessions';
    const typeVal = container.querySelector('#errTypeFilter')?.value || 'all';
    const list = errors
      .filter((e) => typeVal === 'all' || e.type === typeVal)
      .sort(errSortFns[sortVal] || errSortFns.sessions);
    document.getElementById('errCards').innerHTML = list.length
      ? buildErrCards(list)
      : '<p class="fis-errors-empty">No errors of the selected type.</p>';
    wireErrSessionChips();
  }
  container.querySelector('#errorSort')?.addEventListener('change', applyErrFilters);
  container.querySelector('#errTypeFilter')?.addEventListener('change', applyErrFilters);

  // insights toggle
  const insightsToggle = container.querySelector('.fis-err-insights-toggle');
  if (insightsToggle) {
    insightsToggle.addEventListener('click', () => {
      const body = container.querySelector('.fis-err-insights-body');
      const open = insightsToggle.getAttribute('aria-expanded') === 'true';
      insightsToggle.setAttribute('aria-expanded', String(!open));
      insightsToggle.querySelector('.fis-err-insights-chevron').textContent = open ? '▼' : '▲';
      if (open) body.setAttribute('hidden', '');
      else body.removeAttribute('hidden');
    });
  }

  // No-op kept so applyErrFilters' call site stays valid; clicks are handled by the
  // delegated listener below, which survives card re-renders (filter/sort).
  function wireErrSessionChips() { /* handled via delegation */ }

  // Single delegated click handler on the stable container — works for the initial
  // cards AND every re-render (sort / type-filter), so screenshots and session chips
  // always open. Previously listeners were bound per-element and lost on re-render.
  container.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.fis-err-session-chip');
    if (chip && container.contains(chip)) {
      showTimeline(chip.dataset.sid);
      return;
    }
    const thumb = ev.target.closest('.fis-err-ss-thumb');
    if (thumb && container.contains(thumb)) {
      let lb = document.getElementById('fis-ss-lightbox');
      if (!lb) {
        lb = document.createElement('div');
        lb.id = 'fis-ss-lightbox';
        lb.className = 'fis-screenshot-lightbox hidden';
        lb.innerHTML = '<div class="fis-ss-lb-inner"><button class="fis-ss-lb-close">✕</button><img class="fis-ss-lb-img" src="" alt="Screenshot" /></div>';
        document.body.appendChild(lb);
        lb.querySelector('.fis-ss-lb-close').addEventListener('click', () => lb.classList.add('hidden'));
        lb.addEventListener('click', (e) => { if (e.target === lb) lb.classList.add('hidden'); });
      }
      lb.querySelector('.fis-ss-lb-img').src = thumb.src;
      lb.classList.remove('hidden');
    }
  });
}

async function loadAnalytics(formId, range = currentRange) {
  // invalidate insights cache whenever form or date range changes
  // so Generate Insights always reflects the latest sessions
  if (formId !== currentFormId || range !== currentRange) clearInsightsCache();
  currentFormId = formId;
  currentRange = range;
  syncCyclesFromServer(formId);
  const headerEl = document.getElementById('headerFormId');
  headerEl.title = formId;
  const parts = formId.replace(/^\//, '').split('/').filter(Boolean);
  if (parts.length > 1) {
    const parent = document.createElement('span');
    parent.className = 'fis-header-form-parent';
    parent.textContent = `/${parts.slice(0, -1).join('/')}/`;
    const name = document.createElement('span');
    name.className = 'fis-header-form-name';
    name.textContent = parts[parts.length - 1];
    headerEl.textContent = '';
    headerEl.appendChild(parent);
    headerEl.appendChild(name);
  } else {
    headerEl.textContent = formId;
  }
  renderProjectList();
  updateCyclesUI(formId);

  const { sinceTs, untilTs } = getActiveWindow(formId, range);
  const queryStr = buildQueryStr(sinceTs, untilTs);

  const dashboard = document.getElementById('dashboard');
  const notReady = document.getElementById('notReady');
  const insightsBtn = document.getElementById('generateInsightsBtn');

  let data;
  try {
    const compareParam = compareMode && sinceTs ? '&compare=true' : '';
    const res = await fetch(`${API}/analysis/${encodeURIComponent(formId)}?${queryStr}${compareParam}`);
    data = await res.json();
  } catch {
    dashboard.classList.add('hidden');
    notReady.classList.remove('hidden');
    document.getElementById('notReadyMsg').textContent = 'Could not reach the analytics server. Make sure it is running on port 3000.';
    return;
  }

  if (!data.ready) {
    dashboard.classList.add('hidden');
    notReady.classList.remove('hidden');
    document.getElementById('notReadyMsg').textContent = data.message;
    return;
  }

  notReady.classList.add('hidden');
  dashboard.classList.remove('hidden');
  insightsBtn.disabled = false;

  // reset sidebar state on new load
  dashboard.classList.remove('sidebar-open');
  document.querySelector('.fis-sidebar').style.width = '0';
  sidebarWidth = 340;
  document.getElementById('sidebarDivider').classList.add('hidden');
  document.getElementById('insightsContainer').innerHTML = '<p class="fis-insights-empty">Click "Generate Insights" to get AI-powered fix suggestions.</p>';
  document.getElementById('insightsStatus').textContent = '';

  lastLoadedFields = data.fields;
  renderOverview(data.summary, compareMode ? data.prev : null);
  renderApiLatency(data.summary);
  renderDeviceBreakdown(data.summary);
  renderPlatformBreakdown(data.summary);
  renderStepChart(data.summary.abandonmentByStep);
  renderCharts(data.fields);
  renderFieldTable(data.fields);
  renderThrashing(data.fields);
  renderFunnel(formId, sinceTs, untilTs);
  renderFlowComparison(formId, sinceTs, untilTs);
  renderTimeline(formId, sinceTs, untilTs);

  // update errors tab badge in background (non-blocking)
  updateErrorsBadge(formId, sinceTs, untilTs);

  // pre-load journeys in background so the Journeys tab shows data immediately on click
  loadJourneys(formId, range);
}

function extractFormId(raw) {
  try {
    const url = new URL(raw);
    return url.pathname;
  } catch {
    return raw.trim();
  }
}

document.getElementById('loadBtn').addEventListener('click', () => {
  const input = document.getElementById('formIdInput');
  const formId = extractFormId(input.value);
  if (!formId) {
    input.style.outline = '2px solid #e53e3e';
    input.focus();
    return;
  }
  input.style.outline = '';
  loadAnalytics(formId, currentRange);
});

document.getElementById('formIdInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('loadBtn').click();
});

document.getElementById('generateInsightsBtn').addEventListener('click', () => {
  if (currentFormId) {
    clearInsightsCache(); // always fetch fresh on explicit button click
    renderInsights(currentFormId);
  }
});

function openCompareView() {
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('sessionsView').classList.add('hidden');
  document.getElementById('errorsView').classList.add('hidden');
  document.getElementById('notReady').classList.add('hidden');
  document.getElementById('compareView').classList.remove('hidden');
  document.getElementById('compareBtn').classList.add('fis-btn-compare-active');
  if (!currentFormId) document.getElementById('compareNoForm').classList.remove('hidden');
}

function closeCompareView() {
  document.getElementById('compareView').classList.add('hidden');
  document.getElementById('compareBtn').classList.remove('fis-btn-compare-active');
  // restore whichever view was active
  const tab = currentTab || 'analytics';
  if (tab === 'sessions') {
    document.getElementById('sessionsView').classList.remove('hidden');
  } else if (tab === 'errors') {
    document.getElementById('errorsView').classList.remove('hidden');
  } else {
    const nr = document.getElementById('notReady');
    const db = document.getElementById('dashboard');
    if (!nr.classList.contains('hidden') || db.classList.contains('hidden')) {
      // nothing loaded
    } else {
      db.classList.remove('hidden');
    }
  }
}

document.getElementById('compareBtn')?.addEventListener('click', openCompareView);
document.getElementById('closeCompareBtn')?.addEventListener('click', closeCompareView);

// ── Date range dropdown ───────────────────────────────────────────────────

const rangeTrigger = document.getElementById('rangeTrigger');
const rangeMenu = document.getElementById('rangeMenu');

function closeRangeMenu() {
  rangeMenu.classList.add('hidden');
  rangeTrigger.classList.remove('open');
}

function setRangeActive(optEl) {
  document.querySelectorAll('.fis-range-option').forEach((o) => o.classList.remove('fis-range-option--active'));
  document.getElementById('rangeInlast').classList.remove('fis-inlast--active');
  if (optEl) optEl.classList.add('fis-range-option--active');
}

rangeTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  rangeMenu.classList.toggle('hidden');
  rangeTrigger.classList.toggle('open');
});

// close only when clicking outside the entire dropdown widget
document.addEventListener('click', (e) => {
  if (document.getElementById('rangeDropdown').contains(e.target)) return;
  closeRangeMenu();
});

document.querySelectorAll('.fis-range-option').forEach((opt) => {
  opt.addEventListener('click', () => {
    setRangeActive(opt);
    currentRange = opt.dataset.range;
    currentSince = null;
    currentUntil = null;
    document.getElementById('rangeLabel').textContent = opt.dataset.label;
    closeRangeMenu();
    if (currentFormId) {
      if (currentTab === 'sessions') loadJourneys(currentFormId, currentRange);
      else loadAnalytics(currentFormId, currentRange);
    }
  });
});

// ── "In the last" stepper ─────────────────────────────────────────────────

let inlastN = 3;

function applyInLast() {
  const unit = document.getElementById('inlastUnit').value;
  const n = inlastN;
  const now = Date.now();
  const d = new Date();
  let since;
  switch (unit) {
    case 'weeks': since = now - n * 7 * 86400000; break;
    case 'months': since = new Date(d.getFullYear(), d.getMonth() - n, d.getDate()).getTime(); break;
    case 'years': since = new Date(d.getFullYear() - n, d.getMonth(), d.getDate()).getTime(); break;
    default: since = now - n * 86400000;
  }
  setRangeActive(null);
  document.getElementById('rangeInlast').classList.add('fis-inlast--active');
  currentSince = since;
  currentUntil = null;
  document.getElementById('rangeLabel').textContent = `In the last ${n} ${unit}`;
  closeRangeMenu();
  if (currentFormId) {
    if (currentTab === 'sessions') loadJourneys(currentFormId, currentRange);
    else loadAnalytics(currentFormId, currentRange);
  }
}

document.getElementById('inlastDec').addEventListener('click', (e) => {
  e.stopPropagation();
  if (inlastN > 1) { inlastN -= 1; document.getElementById('inlastNum').textContent = inlastN; }
});

document.getElementById('inlastInc').addEventListener('click', (e) => {
  e.stopPropagation();
  inlastN += 1;
  document.getElementById('inlastNum').textContent = inlastN;
});

document.getElementById('inlastUnit').addEventListener('change', (e) => {
  e.stopPropagation();
});

document.getElementById('inlastApply').addEventListener('click', (e) => {
  e.stopPropagation();
  applyInLast();
});

// ── Custom date inputs ────────────────────────────────────────────────────

document.getElementById('fromCustomBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('fromCustomArea').classList.toggle('hidden');
  document.getElementById('fixedRangeArea').classList.add('hidden');
});

document.getElementById('fixedRangeBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('fixedRangeArea').classList.toggle('hidden');
  document.getElementById('fromCustomArea').classList.add('hidden');
});

document.getElementById('fromCustomApply').addEventListener('click', (e) => {
  e.stopPropagation();
  const val = document.getElementById('fromCustomDate').value;
  if (!val) return;
  const since = new Date(val).getTime();
  setRangeActive(null);
  currentSince = since;
  currentUntil = null;
  document.getElementById('rangeLabel').textContent = `From ${val}`;
  closeRangeMenu();
  if (currentFormId) {
    if (currentTab === 'sessions') loadJourneys(currentFormId, currentRange);
    else loadAnalytics(currentFormId, currentRange);
  }
});

document.getElementById('fixedRangeApply').addEventListener('click', (e) => {
  e.stopPropagation();
  const start = document.getElementById('fixedStart').value;
  const end = document.getElementById('fixedEnd').value;
  if (!start || !end) return;
  const sinceTs = new Date(start).getTime();
  const untilTs = new Date(end).getTime() + 86399999; // end of day
  setRangeActive(null);
  currentSince = sinceTs;
  currentUntil = untilTs;
  document.getElementById('rangeLabel').textContent = `${start} – ${end}`;
  closeRangeMenu();
  if (currentFormId) {
    if (currentTab === 'sessions') loadJourneys(currentFormId, currentRange);
    else loadAnalytics(currentFormId, currentRange);
  }
});

// ── Deploy cycles panel ───────────────────────────────────────────────────

document.getElementById('cyclesTrigger').addEventListener('click', (e) => {
  e.stopPropagation();
  const panel = document.getElementById('cyclesPanel');
  const isOpen = !panel.classList.contains('hidden');
  if (isOpen) {
    closeCyclesPanel();
  } else {
    panel.classList.remove('hidden');
    document.getElementById('cyclesTrigger').classList.add('open');
    if (currentFormId) renderCyclesList(currentFormId);
  }
});

document.addEventListener('click', (e) => {
  const area = document.getElementById('cyclesArea');
  if (area && !area.contains(e.target)) closeCyclesPanel();
});

document.getElementById('newCycleBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const addRow = document.getElementById('cycleAddRow');
  addRow.classList.toggle('hidden');
  if (!addRow.classList.contains('hidden')) document.getElementById('cycleNameInp').focus();
});

function confirmNewCycle() {
  if (!currentFormId) return;
  const inp = document.getElementById('cycleNameInp');
  const name = inp.value.trim() || `Cycle ${getCycles(currentFormId).length + 1}`;
  const cycleId = `c_${Date.now()}`;
  const timestamp = Date.now();

  saveCycle(currentFormId, { id: cycleId, name, timestamp, snapshot: null });
  inp.value = '';
  document.getElementById('cycleAddRow').classList.add('hidden');
  updateCyclesUI(currentFormId);
  closeCyclesPanel();

  // auto-activate the new cycle so the data window starts from this timestamp
  activeCycleId = cycleId;
  updateCyclesUI(currentFormId);
  if (currentTab === 'sessions') loadJourneys(currentFormId, currentRange);
  else loadAnalytics(currentFormId, currentRange);
}

document.getElementById('cycleConfirmBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  confirmNewCycle();
});

document.getElementById('cycleCancelBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('cycleAddRow').classList.add('hidden');
  document.getElementById('cycleNameInp').value = '';
});

document.getElementById('cycleNameInp').addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') confirmNewCycle();
  if (e.key === 'Escape') document.getElementById('cycleCancelBtn').click();
});

document.getElementById('viewAllBtn').addEventListener('click', () => {
  activeCycleId = null;
  closeCyclesPanel();
  if (currentFormId) loadAnalytics(currentFormId, currentRange);
});


document.getElementById('sidebarToggle').addEventListener('click', () => {
  const dashboard = document.getElementById('dashboard');
  const sidebar = document.querySelector('.fis-sidebar');
  const isOpen = dashboard.classList.contains('sidebar-open');
  if (isOpen) {
    dashboard.classList.remove('sidebar-open');
    sidebar.style.width = '0';
  } else {
    dashboard.classList.add('sidebar-open');
    sidebar.style.width = `${sidebarWidth}px`;
  }
  updateToggleBtn(!isOpen);
});

document.getElementById('insightsCloseBtn').addEventListener('click', () => {
  const dashboard = document.getElementById('dashboard');
  dashboard.classList.remove('sidebar-open');
  document.querySelector('.fis-sidebar').style.width = '0';
  updateToggleBtn(false);
});

// Drag-to-resize the insights panel
(function initResize() {
  const dividerEl = document.getElementById('sidebarDivider');
  const sidebar = document.querySelector('.fis-sidebar');
  const dashboard = document.getElementById('dashboard');
  let dragging = false;

  dividerEl.addEventListener('mousedown', (e) => {
    if (e.target.id === 'sidebarToggle') return;
    dragging = true;
    dividerEl.classList.add('dragging');
    sidebar.style.transition = 'none';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = dashboard.getBoundingClientRect();
    const newWidth = Math.max(200, Math.min(rect.width * 0.65, rect.right - e.clientX));
    sidebarWidth = newWidth;
    sidebar.style.width = `${newWidth}px`;
    if (!dashboard.classList.contains('sidebar-open')) {
      dashboard.classList.add('sidebar-open');
      updateToggleBtn(true);
    }
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    dividerEl.classList.remove('dragging');
    sidebar.style.transition = '';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}());

initProjects();

// ── Nav collapse / expand ─────────────────────────────────────────────────

document.getElementById('navToggle').addEventListener('click', () => {
  const nav = document.getElementById('projectNav');
  nav.classList.toggle('collapsed');
});

// ── Validation Thrashing ──────────────────────────────────────────────────

function renderThrashing(fields) {
  const section = document.getElementById('thrashSection');
  const thrashFields = fields.filter((f) => (f.thrashRate ?? 0) > 0);
  if (!thrashFields.length) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');

  document.getElementById('thrashList').innerHTML = thrashFields.slice(0, 8).map((f) => {
    const sev = f.thrashRate > 0.3 ? 'critical' : f.thrashRate > 0.15 ? 'high' : 'medium';
    return `
      <div class="fis-thrash-item fis-thrash-${sev}">
        <div class="fis-thrash-field" title="${f.field}">${f.field}</div>
        <div class="fis-thrash-rate">${pct(f.thrashRate)}</div>
        <div class="fis-thrash-desc">stuck in error loops</div>
        <div class="fis-thrash-hint">${f.diagnosis?.label ?? f.possibleReason}</div>
      </div>`;
  }).join('');
}

// ── Sessions list ─────────────────────────────────────────────────────────

let allSessionsCache = [];
let currentCategory = 'all';
let currentTab = 'analytics';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function durLabel(ms$) {
  if (!ms$ || ms$ < 0) return '—';
  const m = Math.floor(ms$ / 60000);
  const s = Math.floor((ms$ % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Journeys (sessions grouped by journeyId) ─────────────────────────────────
let allJourneysCache = [];

const JOURNEY_CAT_META = {
  successful: { cls: 'success', icon: '✓' },
  abandoned: { cls: 'abandoned', icon: '✗' },
  submit_error: { cls: 'submiterr', icon: '!' },
  bounced: { cls: 'bounced', icon: '↩' },
  'scan-only': { cls: 'scan', icon: '👁' },
  'in-progress': { cls: 'inprogress', icon: '…' },
};

// trim a URL path for compact display in breadcrumbs/labels
function shortPath(p) {
  if (!p) return '';
  const s = String(p);
  return s.length > 28 ? `…${s.slice(-26)}` : s;
}

// map a whole journey to one of the existing session category buckets so the
// filter pills keep working. completion wins; otherwise the furthest page decides.
function mapJourneyCategory(journey) {
  if (journey.completed) return 'successful';
  const pages = [...(journey.pages || [])].sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0));
  const last = pages[pages.length - 1];
  if (pages.some((p) => p.category === 'submit_error')) return 'submit_error';
  const lastCat = last?.category;
  if (lastCat === 'bounced') return 'bounced';
  if (lastCat === 'scan-only') return 'scan-only';
  if (journey.droppedAtPage || lastCat === 'abandoned') return 'abandoned';
  return 'in-progress';
}

function journeyStatusLabel(journey, category) {
  if (category === 'successful') return 'Completed';
  if (category === 'submit_error') return 'Submission failed';
  if (category === 'abandoned') {
    return journey.droppedAtPage ? `Abandoned at ${shortPath(journey.droppedAtPage)}` : 'Abandoned';
  }
  if (category === 'bounced') return 'Bounced (left quickly)';
  if (category === 'scan-only') return 'Viewed only';
  return 'In progress';
}

function renderJourneys(journeys, category) {
  currentCategory = category;
  const query = (document.getElementById('journeySearch')?.value || '').trim().toLowerCase();
  let filtered = category === 'all'
    ? journeys
    : journeys.filter((j) => mapJourneyCategory(j) === category);
  // free-text search: match error types, statuses, messages, fields, page paths
  if (query) {
    filtered = filtered.filter((j) => (j.searchBlob || '').includes(query)
      || (j.errorTypes || []).some((t) => t.includes(query)));
  }

  const sumDur = (j) => (j.pages || []).reduce((t, p) => t + (p.durationMs || 0), 0);
  const sumErr = (j) => (j.pages || []).reduce((t, p) => t + (p.errorCount || 0), 0);
  const sortVal = document.getElementById('sessionSort')?.value || 'newest';
  const sortFns = {
    // lastActivityTime falls back to startTime for a journey that never resumed
    // (single page, or data predating this field) — "newest" means most recent
    // activity, not first-start time, so a returned-to journey doesn't sink to
    // the bottom forever just because it began hours earlier.
    newest: (a, b) => (b.lastActivityTime || b.startTime || 0) - (a.lastActivityTime || a.startTime || 0),
    oldest: (a, b) => (a.startTime || 0) - (b.startTime || 0),
    longest: (a, b) => sumDur(b) - sumDur(a),
    'most-errors': (a, b) => sumErr(b) - sumErr(a),
  };
  filtered.sort(sortFns[sortVal] || sortFns.newest);

  document.getElementById('sessionsCount').textContent = `${filtered.length} journey${filtered.length !== 1 ? 's' : ''}`;

  const container = document.getElementById('sessionsList');
  if (!filtered.length) {
    container.innerHTML = '<p class="fis-sessions-empty">No journeys in this category.</p>';
    return;
  }

  container.innerHTML = filtered.map((j) => {
    const cat = mapJourneyCategory(j);
    const meta = JOURNEY_CAT_META[cat] || { cls: '', icon: '?' };
    const pages = [...(j.pages || [])].sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0));
    const single = pages.length <= 1;
    const totalErr = sumErr(j);

    // Deduplicate breadcrumb: collapse same-URL crumbs into one with a ×N badge
    const crumbMap = new Map();
    pages.forEach((p) => {
      const key2 = p.pagePath;
      if (!crumbMap.has(key2)) crumbMap.set(key2, { pages: [], hasError: false });
      const entry = crumbMap.get(key2);
      entry.pages.push(p);
      if (p.errorCount > 0) entry.hasError = true;
    });
    const crumbs = [...crumbMap.entries()].map(([path, entry]) => {
      const lastCat = entry.pages[entry.pages.length - 1].category;
      const pc = lastCat;
      const dotCls = (JOURNEY_CAT_META[pc] || {}).cls || 'inprogress';
      const errRing = entry.hasError ? ' fis-jc-haserror' : '';
      const badge = entry.pages.length > 1 ? ` ×${entry.pages.length}` : '';
      return `<li class="fis-journey-crumb fis-jc-${dotCls}${errRing}" title="${path}">
          <span class="fis-jc-dot"></span><span class="fis-jc-path">${shortPath(path)}${badge}</span>
        </li>`;
    }).join('');

    // Page rows: group same-URL visits — show URL once, list visits beneath
    const pageRowsHtml = [...crumbMap.entries()].map(([path, entry]) => {
      if (entry.pages.length === 1) {
        const p = entry.pages[0];
        const pc = p.category;
        const rowCls = (JOURNEY_CAT_META[pc] || {}).cls || 'inprogress';
        return `<div class="fis-journey-page-row fis-session-${rowCls}">
            <span class="fis-jpr-path" title="${p.pagePath}">${shortPath(p.pagePath)}</span>
            <span class="fis-jpr-cat">${pc || 'in-progress'}</span>
            <span class="fis-jpr-meta">${durLabel(p.durationMs)} · ${p.errorCount || 0} err</span>
            <button class="fis-session-replay-btn" data-id="${p.sessionId}">View Timeline</button>
          </div>`;
      }
      // Multiple visits to same URL
      const totalVisitDur = entry.pages.reduce((t, p) => t + (p.durationMs || 0), 0);
      const totalVisitErr = entry.pages.reduce((t, p) => t + (p.errorCount || 0), 0);
      const lastCat = entry.pages[entry.pages.length - 1].category;
      const pc = lastCat;
      const rowCls = (JOURNEY_CAT_META[pc] || {}).cls || 'inprogress';
      const visitRows = entry.pages.map((p, vi) => {
        const vc = p.category || 'in-progress';
        return `<div class="fis-journey-visit-sub">
            <span class="fis-jpr-cat">visit ${vi + 1} · ${vc} · ${durLabel(p.durationMs)}${p.errorCount > 0 ? ` · ${p.errorCount} err` : ''}</span>
          </div>`;
      }).join('');
      return `<div class="fis-journey-page-row fis-session-${rowCls}">
          <span class="fis-jpr-path" title="${path}">${shortPath(path)}</span>
          <span class="fis-jpr-cat">${entry.pages.length} visits · ${durLabel(totalVisitDur)} · ${totalVisitErr} err</span>
          <div class="fis-journey-visits">${visitRows}</div>
          <button class="fis-session-replay-btn" data-id="${entry.pages[0].sessionId}">View Timeline</button>
        </div>`;
    }).join('');

    const uniquePathCount = crumbMap.size;
    const visitWord = uniquePathCount < pages.length ? 'visit' : 'page';

    return `
      <div class="fis-journey-card fis-session-${meta.cls}${single ? ' single-page' : ''}" data-jid="${j.journeyId}">
        <div class="fis-journey-header">
          <span class="fis-journey-chevron">▸</span>
          <div class="fis-session-status">
            <span class="fis-session-icon">${meta.icon}</span>
            <span class="fis-session-label">${journeyStatusLabel(j, cat)}</span>
          </div>
          <ol class="fis-journey-breadcrumb">${crumbs}</ol>
          <div class="fis-session-meta">
            <span>${pages.length} ${visitWord}${pages.length !== 1 ? 's' : ''}</span>
            <span>${totalErr} error${totalErr !== 1 ? 's' : ''}</span>
            <span>${timeAgo(j.startTime)}</span>
          </div>
        </div>
        <div class="fis-journey-pages">${pageRowsHtml}</div>
      </div>`;
  }).join('');

  container.querySelectorAll('.fis-journey-card').forEach((card) => {
    const single = card.classList.contains('single-page');
    const header = card.querySelector('.fis-journey-header');
    const firstId = card.querySelector('.fis-session-replay-btn')?.dataset.id;
    header.addEventListener('click', (e) => {
      if (e.target.closest('.fis-session-replay-btn')) return;
      if (single && firstId) { showTimeline(firstId); return; }
      card.classList.toggle('expanded');
    });
  });
  container.querySelectorAll('.fis-session-replay-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); showTimeline(btn.dataset.id); });
  });
}

async function loadJourneys(formId, range) {
  const list = document.getElementById('sessionsList');
  const count = document.getElementById('sessionsCount');
  list.innerHTML = '<p class="fis-sessions-empty fis-sessions-loading">Loading journeys…</p>';
  count.textContent = '';

  const { sinceTs, untilTs } = getActiveWindow(formId, range);
  const q = buildQueryStr(sinceTs, untilTs);

  let journeys;
  try {
    const res = await fetch(`${API}/form-journeys/${encodeURIComponent(formId)}?${q}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    journeys = await res.json();
  } catch (err) {
    list.innerHTML = `<p class="fis-sessions-empty">Could not load journeys — ${err.message}.<br>Make sure the server is running and restart it if you just deployed new code.</p>`;
    count.textContent = '';
    return;
  }

  if (!Array.isArray(journeys)) {
    list.innerHTML = '<p class="fis-sessions-empty">Unexpected response from server.</p>';
    return;
  }

  allJourneysCache = journeys;
  // flatten pages into the session cache so showTimeline's subtitle lookup keeps working
  allSessionsCache = journeys.flatMap((j) => (j.pages || []).map((p) => ({ ...p, timestamp: p.startTime })));
  renderJourneys(allJourneysCache, currentCategory);
}

// ── Client-side error pattern matching (mirrors server/error-patterns.js) ─────

function isFinalSubmissionFailureEvent(event = {}) {
  if (event.type === 'form_submit' && event.failed && event.source === 'final_ui_failure') return true;
  const text = [
    event.statusText,
    event.message,
    event.reason,
    event.responseBody,
  ].filter(Boolean).join(' ').toLowerCase();

  return /personal loan request could not be submitted|request could not be submitted|could not be submitted|application number\s*not generated|not generated|there seems to be an error in the application|contact nearest branch|try later/.test(text);
}

function diagnoseEventClient(event) {
  const msg = event.message || event.reason || event.statusText || '';
  const src = event.source || '';

  if (event.type === 'js_error' || event.type === 'console_error') {
    if (/guideBridge.*not defined|guideBridge is not|guideBridge.*null/i.test(msg)) {
      return { cause: 'guideBridge API not ready — a form rule ran before the bridge was initialized', fix: 'Wrap any guideBridge calls in: if (typeof window.guideBridge !== "undefined" && window.guideBridge.isConnected()) { ... }', severity: 'critical' };
    }
    if (/access.*blocked.*cors|cors.*block|has been blocked by cors/i.test(msg)) {
      return { cause: 'CORS policy blocked — the form is calling an API from a different origin without the correct CORS headers', fix: 'Add "Access-Control-Allow-Origin" headers to the API server. Or proxy requests through the same origin.', severity: 'critical' };
    }
    if (/afb-runtime|rule.?engine/i.test(msg + src)) {
      return { cause: 'Rule engine crash — an error inside afb-runtime broke the entire rule evaluation pipeline for this session', fix: 'Test each adaptive form rule individually in authoring. Update afb-runtime to the latest version.', severity: 'critical' };
    }
    if (/maximum call stack|stack overflow/i.test(msg)) {
      return { cause: 'Infinite recursion — a rule calls itself endlessly, crashing the JavaScript engine', fix: 'Check for circular rule dependencies. Add a guard condition to break the cycle.', severity: 'critical' };
    }
    if (/cannot read prop|cannot read properties of null|undefined is not an object/i.test(msg)) {
      return { cause: 'Null reference — a rule or function accessed a field or object that does not exist yet', fix: 'Add null checks before accessing field values. Verify all field names in rules match actual form field names.', severity: 'high' };
    }
    if (/is not a function/i.test(msg)) {
      return { cause: 'Function not found — a custom function name is misspelled or was not registered', fix: 'Check that the function name in the rule editor exactly matches what is exported from functions.js and registered in functionRegistration.js.', severity: 'high' };
    }
    if (/content security policy|csp/i.test(msg)) {
      return { cause: "Content Security Policy violation — a resource was blocked by the page's CSP header", fix: 'Update the Content-Security-Policy header to allow the blocked resource (script-src, connect-src, etc.).', severity: 'high' };
    }
    if (/net::err_connection_refused|err_name_not_resolved|failed to load resource/i.test(msg)) {
      return { cause: 'Resource load failure — an API endpoint, script, or asset URL returned no response', fix: "Verify all API endpoints are deployed and accessible from the form's origin. Check browser Network tab.", severity: 'high' };
    }
    if (/script error/i.test(msg)) {
      return { cause: 'Cross-origin script error — browser security hides details from scripts on different domains', fix: 'Add crossorigin="anonymous" to external script tags and ensure the script server sends CORS headers.', severity: 'medium' };
    }
  }

  if (event.type === 'form_error') {
    const statusMap = {
      0:   { cause: 'Network failure — request never reached the server', fix: 'Check CORS configuration and server availability. User may have gone offline.' },
      400: { cause: 'Bad request — form data did not match server expectations', fix: 'Check field names match the server schema. Log the request payload to diagnose.' },
      401: { cause: 'Unauthorized — user session has expired', fix: 'Add session refresh logic. Show a "session expired" message with re-login link.' },
      403: { cause: 'Forbidden — CSRF token is missing, expired, or invalid', fix: 'Refresh the CSRF token before submission. Check token lifetime for long sessions.' },
      404: { cause: 'Endpoint not found — the API URL is wrong or the service is not deployed', fix: 'Verify the submission URL. Check environment-specific path configuration.' },
      409: { cause: 'Conflict — duplicate submission detected or data integrity check failed', fix: 'Add idempotency to the submission handler. Show "already submitted" if user submits twice.' },
      413: { cause: 'Payload too large — form data or file exceeds the server body size limit', fix: 'Increase server body-size limit or add client-side file size validation.' },
      422: { cause: 'Unprocessable entity — server-side validation rejected the data', fix: 'Display server validation errors inline. Align client-side and server-side validation rules.' },
      429: { cause: 'Rate limited — too many submission attempts', fix: 'Debounce the submit button. Show "too many attempts — wait X seconds" with a countdown.' },
      500: { cause: 'Internal server error — the backend crashed processing the form data', fix: 'Check server error logs for the stack trace. Add try-catch on form submission handlers.' },
      502: { cause: 'Bad gateway — upstream server is down or unreachable', fix: 'Check if the API service is running. Implement retry with exponential backoff.' },
      503: { cause: 'Service unavailable — server is overloaded or in maintenance', fix: 'Show maintenance message with expected return time. Save form progress.' },
      504: { cause: 'Gateway timeout — request took too long and was cut off', fix: 'Optimise the slow server endpoint. Show a loading state so users know the form did not freeze.' },
    };
    const match = statusMap[event.status];
    if (match) return { ...match, severity: event.status >= 500 ? 'critical' : 'high' };
    if (event.status >= 500) return { cause: 'Server error — backend crashed processing the form data', fix: 'Check server logs for the stack trace.', severity: 'critical' };
    if (event.status >= 400) return { cause: `Client error (${event.status}) — form data was rejected`, fix: 'Review server validation rules.', severity: 'high' };
  }

  if (event.type === 'api_error') {
    const classMap = {
      cors:         { cause: 'CORS block — an API call was rejected by CORS policy', fix: 'Add CORS headers to all API endpoints the form calls.', severity: 'critical' },
      network_down: { cause: 'Network failure — fetch failed before reaching the server', fix: 'Add offline detection and a retry button.', severity: 'high' },
      timeout:      { cause: 'Request timed out — server took too long', fix: 'Show loading state after 3s. Add retry logic.', severity: 'high' },
      auth:         { cause: 'Authentication failure — session expired or token missing', fix: 'Add session refresh. Show re-login prompt.', severity: 'high' },
      not_found:    { cause: 'API endpoint not found', fix: 'Verify the endpoint URL and deployment configuration.', severity: 'high' },
      rate_limited: { cause: 'Rate limited (429) — too many requests in a short window', fix: 'Add debounce to the triggering button. Show a wait message before retrying.', severity: 'high' },
      server_error: { cause: 'Server error (5xx) — backend crashed or unavailable', fix: 'Check server logs at the time of error. Add a retry button with a friendly message.', severity: 'critical' },
      client_error: { cause: 'Client error (4xx) — request rejected, likely invalid data or missing parameter', fix: 'Check what data is sent with this request against the server validation schema.', severity: 'high' },
    };
    return classMap[event.errorClass] || null;
  }

  return null;
}

// ── Session timeline modal ────────────────────────────────────────────────

function explainAbandonment(session) {
  const { events } = session;
  const lastStep = [...events].reverse().find((e) => e.type === 'step_change');
  const fieldErrors = events.filter((e) => e.type === 'field_error');
  const thrash = events.filter((e) => e.type === 'validation_thrash');
  const disabledClicks = events.filter((e) => e.type === 'disabled_click');
  const rageClicks = events.filter((e) => e.type === 'rage_click');
  const jsErrors = events.filter((e) => e.type === 'js_error' || e.type === 'console_error');
  const apiErrors = events.filter((e) => e.type === 'form_error' || e.type === 'api_error');
  const fieldsInteracted = [...new Set(events.filter((e) => e.type === 'field_focus').map((e) => e.field).filter(Boolean))];
  // last abandon = the final exit point, not wherever they first stepped away from
  const abandon = [...events].reverse().find((e) => e.type === 'form_abandon');
  const hasFinalSubmitFailure = events.some((e) => isFinalSubmissionFailureEvent(e));
  const submitEvents = events.filter((e) => e.type === 'form_submit');
  const lastSubmit = submitEvents[submitEvents.length - 1];
  const isSuccess = !!lastSubmit && !lastSubmit.failed && !hasFinalSubmitFailure;
  const isSubmitFail = hasFinalSubmitFailure || events.some((e) => e.type === 'form_submit' && e.failed);
  const hasSessionReturned = events.some((e) => e.type === 'session_returned');

  // Detect brief exits: form_abandon followed by field_focus in the same session
  const focusTimestamps = events.filter((e) => e.type === 'field_focus').map((e) => e.timestamp);
  const abandonEvents = events.filter((e) => e.type === 'form_abandon');
  const hadBriefExit = abandonEvents.some((ab) => focusTimestamps.some((ts) => ts > ab.timestamp));

  // Build a factual list of what happened
  const facts = [];


  if (isSuccess) facts.push('Form was submitted successfully');
  else if (isSubmitFail) facts.push('Form submission failed');
  else if (abandon) facts.push(`Session ended at: ${abandon.stepName || lastStep?.stepName || 'unknown step'}`);
  else if (lastStep) facts.push(`Last step reached: ${lastStep.stepName || `Step ${(lastStep.step ?? 0) + 1}`}`);
  else if (fieldsInteracted.length > 0) facts.push('User interacted with fields but did not navigate steps');
  else facts.push('User did not interact with the form');

  if (hadBriefExit) facts.push('Left briefly mid-session and returned');

  if (session.durationMs) facts.push(`Time spent: ${Math.round(session.durationMs / 1000)}s`);
  if (fieldsInteracted.length > 0) facts.push(`Fields touched: ${fieldsInteracted.join(', ')}`);

  if (fieldErrors.length > 0) {
    const errorFields = [...new Set(fieldErrors.map((e) => e.field).filter(Boolean))];
    facts.push(`${fieldErrors.length} validation error${fieldErrors.length !== 1 ? 's' : ''} on: ${errorFields.join(', ')}`);
  }
  if (thrash.length > 0) {
    const thrashFields = [...new Set(thrash.map((e) => e.field).filter(Boolean))];
    facts.push(`Repeated errors (thrashing) on: ${thrashFields.join(', ')}`);
  }
  if (disabledClicks.length > 0) {
    const els = [...new Set(disabledClicks.map((e) => e.element).filter(Boolean))];
    facts.push(`Clicked disabled element${disabledClicks.length > 1 ? ` ${disabledClicks.length} times` : ''}: ${els.join(', ')}`);
  }
  if (rageClicks.length > 0) {
    facts.push(`Rage clicked: ${rageClicks.map((e) => e.element).filter(Boolean).join(', ')}`);
  }
  if (jsErrors.length > 0) facts.push(`${jsErrors.length} JS error${jsErrors.length !== 1 ? 's' : ''} occurred`);
  if (apiErrors.length > 0) {
    const top = apiErrors[apiErrors.length - 1];
    facts.push(`API error: ${top.callType || 'request'} failed${top.status ? ` (${top.status})` : ''}`);
  }

  let what;
  if (isSuccess) what = 'Completed';
  else if (isSubmitFail) what = 'Submit Failed';
  else if (abandon && hasSessionReturned) what = 'Returned & Abandoned';
  else if (abandon) what = 'Abandoned';
  else what = 'In Progress';

  return {
    title: 'SESSION SUMMARY',
    cause: what,
    confidence: null,
    evidence: facts,
    fix: null,
  };
}

function eventWhy(e, session) {
  const { events } = session;
  switch (e.type) {
    case 'disabled_click': {
      if (e.invalidFields?.length) {
        return `Submit was disabled because these fields were incomplete: <strong>${e.invalidFields.join(', ')}</strong>`;
      }
      return 'Submit button was disabled — user could not identify which fields were blocking submission';
    }
    case 'form_abandon': {
      if (e.blockedByDisabledButton) return 'User gave up after clicking a disabled button — could not identify what was blocking submission';
      if (e.blockedByError) return `User was blocked by a <strong>${e.blockedByError}</strong> error${e.lastField ? ` on field <strong>"${e.lastField}"</strong>` : ''} — could not proceed past this point`;
      if (e.lastField) return `User was last active on <strong>"${e.lastField}"</strong> — stopped here without completing`;
      if ((e.pageTimeMs || 0) < 15000 && (e.maxScrollDepth || 100) < 25) return 'Bounced quickly — left within 15 seconds having barely scrolled, likely arrived by mistake';
      return 'User exited without submitting';
    }
    case 'field_error': {
      const total = events.filter((ev) => ev.type === 'field_error' && ev.field === e.field).length;
      if (total >= 3) return `Triggered ${total} errors total on this field — validation constraint was not communicated upfront`;
      return 'Hit a validation error — format requirement was not visible before input';
    }
    case 'validation_thrash':
      return `User triggered errors ${e.thrashCount}+ times on the same field — could not figure out the required format`;
    case 'rage_click': {
      const nearby = events.filter((ev) => ev.type === 'perf_timing' && Math.abs((ev.timestamp || 0) - (e.timestamp || 0)) < 3000);
      const slow = nearby.find((ev) => ev.latencyMs > 1500);
      if (slow) return `UI appeared frozen — an API call was taking ${(slow.latencyMs / 1000).toFixed(1)}s at this moment`;
      return `"${e.element}" gave no visual feedback — user kept clicking thinking it was not registering`;
    }
    case 'js_error': {
      const diag = diagnoseEventClient(e);
      if (diag) {
        const stackInfo = e.stack ? `<br><small style="font-family:monospace;color:#666">${e.stack.slice(0, 150)}</small>` : '';
        return `<strong>${diag.cause}</strong>${stackInfo}<br><em style="color:#2563eb">Fix: ${diag.fix}</em>`;
      }
      return `JavaScript ${e.errorType || 'error'} in <strong>${e.source || 'form scripts'}</strong>${e.line ? ` at line ${e.line}` : ''}`;
    }
    case 'console_error': {
      const diag = diagnoseEventClient(e);
      if (diag) return `<strong>${diag.cause}</strong><br><em style="color:#2563eb">Fix: ${diag.fix}</em>`;
      return `Console error (${e.errorClass || 'unknown type'}): <code style="font-size:11px">${(e.message || '').slice(0, 120)}</code>`;
    }
    case 'form_error': {
      if (e.callType === 'file_too_large') return 'File exceeds the upload size limit — the limit was not shown to the user before they tried';
      if (e.callType === 'file_type_not_allowed') return 'File type not allowed — accepted formats were not shown before the upload';
      const diag = diagnoseEventClient(e);
      const bodySnippet = e.responseBody ? `<br><small style="font-family:monospace;color:#666">Server: ${e.responseBody.slice(0, 100)}</small>` : '';
      const urlInfo = e.url ? `<br><small style="color:#888">Endpoint: ${e.url}</small>` : '';
      if (diag) return `<strong>${diag.cause}</strong>${bodySnippet}${urlInfo}<br><em style="color:#2563eb">Fix: ${diag.fix}</em>`;
      return `${e.callType || 'API'} call failed with status ${e.status}${bodySnippet}${urlInfo}`;
    }
    case 'api_error': {
      const diag = diagnoseEventClient(e);
      if (diag) return `<strong>${diag.cause}</strong><br><em style="color:#2563eb">Fix: ${diag.fix}</em>`;
      return `Unhandled network error (${e.errorClass || 'unknown'}): ${(e.reason || '').slice(0, 100)}`;
    }
    case 'label_copied':
      return 'User copied the field label to search for its meaning — the label was not self-explanatory';
    default:
      return null;
  }
}

function timelineEsc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function showTimeline(sessionId) {
  const res = await fetch(`${API}/session/${sessionId}`).catch(() => null);
  if (!res || !res.ok) return;
  const session = await res.json();

  // ── Multi-page journey stitching ────────────────────────────────────────
  // If this session belongs to a journey, fetch all pages and stitch together.
  // A journey can span multiple forms (e.g. landing page → the actual form); when the
  // requested sessionId is really a journeyId (see /session/:sessionId fallback), the
  // server picks an arbitrary representative page, which may belong to a different
  // form than the one currently loaded. /form-journeys/:formId is scoped per-form, so
  // prefer the form the dashboard actually has open — that's the context the chip was
  // clicked from — falling back to the fetched session's own formId otherwise.
  let journeyPages = null; // array of { session, pageIndex, pagePath }
  const journeyFormId = currentFormId || session.formId;
  if (session.journeyId && journeyFormId) {
    const journeyRes = await fetch(`${API}/form-journeys/${encodeURIComponent(journeyFormId)}`).catch(() => null);
    if (journeyRes && journeyRes.ok) {
      const journeys = await journeyRes.json();
      // sessionId may itself be a journeyId (see /session/:sessionId fallback) rather
      // than an individual page's sessionId, so match on either.
      const journey = Array.isArray(journeys)
        ? journeys.find((j) => j.journeyId === sessionId
          || (j.pages && j.pages.some((p) => p.sessionId === sessionId)))
        : null;
      if (journey && journey.pages && journey.pages.length > 1) {
        // Fetch each page's full session data in parallel
        const pageResults = await Promise.all(
          journey.pages.map(async (p) => {
            const r = await fetch(`${API}/session/${p.sessionId}`).catch(() => null);
            if (!r || !r.ok) return null;
            const s = await r.json();
            return { session: s, pageIndex: p.pageIndex ?? journey.pages.indexOf(p), pagePath: p.pagePath || '' };
          }),
        );
        journeyPages = pageResults
          .filter(Boolean)
          .sort((a, b) => a.pageIndex - b.pageIndex);
      }
    }
  }

  const isJourney = journeyPages && journeyPages.length > 1;
  const modal = document.getElementById('timelineModal');
  if (isJourney) {
    document.getElementById('timelineTitle').textContent = 'Journey';
  } else {
    document.getElementById('timelineTitle').textContent = 'Session';
  }
  const summary = allSessionsCache.find((s) => s.sessionId === sessionId || s.journeyId === sessionId);
  const timelineId = session.journeyId || sessionId;
  const idLabel = session.journeyId ? 'Journey ID' : 'Session ID';
  document.getElementById('timelineSubtitle').textContent = summary
    ? `${summary.category} · ${summary.errorCount} error${summary.errorCount !== 1 ? 's' : ''} · ${timeAgo(summary.timestamp)} · ${idLabel}: ${timelineId}`
    : `${idLabel}: ${timelineId}`;

  const importantTypes = new Set([
    'form_start', 'form_submit', 'form_abandon', 'field_focus', 'field_error',
    'validation_thrash', 'rage_click', 'step_change', 'js_error', 'console_error',
    'form_error', 'api_error', 'disabled_click', 'dead_click', 'label_copied', 'returned',
    'session_returned', 'step_thrash', 'page_refreshed', 'url_change', 'button_click',
  ]);

  const eventMeta = {
    form_start: { icon: '▶', cls: 'start', label: () => 'Form started' },
    form_submit: { icon: (e) => (e.failed ? '!' : '✓'), cls: (e) => (e.failed ? 'submit-fail' : 'submit'), label: (e) => (e.failed ? `Submission failed (${e.status || 'error'})` : 'Form submitted') },
    form_abandon: {
      icon: (e) => {
        if (e.switched || e.leftBriefly) return '⇢';
        return '✗';
      },
      cls: (e) => {
        if (e.switched || e.leftBriefly) return 'switched';
        return 'abandon';
      },
      label: (e) => {
        if (e.switched) return `Switched away${e.stepName ? ` at ${e.stepName}` : ''}`;
        if (e.leftBriefly) return `Left briefly (came back)${e.stepName ? ` at ${e.stepName}` : ''}`;
        return `Abandoned${e.stepName ? ` at ${e.stepName}` : ''}`;
      },
    },
    field_focus: { icon: '→', cls: 'focus', label: (e) => `Focused ${e.field}` },
    field_error: { icon: '⚡', cls: 'error', label: (e) => `Error on ${e.field} (#${e.errorCount})` },
    validation_thrash: { icon: '🔥', cls: 'thrash', label: (e) => `THRASHING on ${e.field} — ${e.thrashCount}+ errors` },
    rage_click: { icon: '💢', cls: 'rage', label: (e) => `Rage clicked "${e.element}"` },
    step_change: { icon: '⇒', cls: 'step', label: (e) => `${e.direction === 'next' ? 'Next' : 'Back'}: ${e.stepName || `Step ${(e.step ?? 0) + 1}`}` },
    js_error: { icon: '🐛', cls: 'jserr', label: (e) => `JS error: ${e.message}` },
    console_error: { icon: '⚠', cls: 'jserr', label: (e) => `Console error: ${(e.message || '').slice(0, 60)}` },
    form_error: { icon: '🚫', cls: 'formerr', label: (e) => `${e.callType} error: ${e.statusText}` },
    api_error: { icon: '🌐', cls: 'formerr', label: (e) => `Network error: ${(e.reason || '').slice(0, 50)}` },
    disabled_click: { icon: '🚷', cls: 'disabled', label: (e) => `Clicked disabled "${e.element}"` },
    dead_click: { icon: '×', cls: 'dead', label: (e) => `Dead click on "${e.element}" (no response)` },
    button_click: { icon: '•', cls: 'click', label: (e) => `Clicked "${e.element}"` },
    label_copied: { icon: '📋', cls: 'copy', label: (e) => `Copied label: ${e.field}` },
    returned: { icon: '↩', cls: 'return', label: (e) => `Returned (${e.choice})` },
    session_returned: { icon: '↩', cls: 'return', label: () => 'Returned to continue' },
    step_thrash: { icon: '⇄', cls: 'thrash', label: (e) => `Back-and-forth on steps ${e.stepA + 1}↔${e.stepB + 1} (${e.bounceCount}\xd7)` },
    page_refreshed: { icon: '↺', cls: 'info', label: () => 'Page refreshed' },
    url_change: { icon: '↪', cls: 'info', label: (e) => `URL changed to ${(e.to || '').split('/').pop() || e.to}` },
  };

  const { startTime } = session;
  // For a journey, judge the outcome from ALL pages' events, not just the one that
  // was clicked — a "session_returned" or later completion lives on a LATER page's
  // session object, so looking at only the clicked page would miss it and wrongly
  // call a mid-journey exit a plain "Abandoned".
  const analysisSession = isJourney
    ? { ...session, events: journeyPages.flatMap((p) => p.session.events || []) }
    : session;
  const analysis = explainAbandonment(analysisSession);

  // build analysis header HTML
  const analysisHtml = analysis ? `
    <div class="fis-tl-analysis">
      <div class="fis-tl-analysis-top">
        <span class="fis-tl-analysis-title">${analysis.title || 'SESSION SUMMARY'}</span>
        ${analysis.confidence !== null ? `<span class="fis-tl-conf">${analysis.confidence}% confidence</span>` : ''}
      </div>
      <div class="fis-tl-analysis-cause">${analysis.cause}</div>
      <ul class="fis-tl-analysis-evidence">
        ${analysis.evidence.map((ev) => `<li>${ev}</li>`).join('')}
      </ul>
      ${analysis.fix ? `<div class="fis-tl-analysis-fix">\u{1f4a1} ${analysis.fix}</div>` : ''}
    </div>` : '';

  const ERROR_TYPES = new Set(['js_error', 'form_error', 'api_error', 'console_error']);
  const MAIN_SCREENSHOT_ERROR_TYPES = new Set(['js_error', 'form_error', 'api_error']);
  const INLINE_SCREENSHOT_TYPES = new Set(['rage_click', 'dead_click']);
  // Returns { cls, label, source } describing WHERE the error came from.
  function getErrorLayer(e) {
    if (e.type === 'form_error') {
      if (e.callType === 'ui_message') {
        return { cls: 'server', label: 'Service Error', source: "The form's error handler fired and showed an error screen to the user. This is triggered by the backend service failing or returning an unexpected response — the form itself rendered correctly, but the service it depends on did not." };
      }
      const layer = e.layer || (e.status >= 500 ? 'backend' : e.status === 0 ? 'network' : e.status >= 400 ? 'client' : null);
      const map = {
        backend:    { cls: 'server', label: `Server Error (${e.status || '5xx'})`, source: `The server returned HTTP ${e.status || '5xx'} while processing the form submission — it crashed or hit an unhandled exception. This is a backend bug, not a user input problem.` },
        auth:       { cls: 'client', label: e.status === 401 ? 'Session Expired (401)' : 'Access Denied (403)', source: e.status === 401 ? 'The server rejected the request because the user session is missing or expired (HTTP 401). The user needs to log in again.' : 'The server rejected the request because the user does not have permission, or a security token (CSRF) is missing or expired (HTTP 403).' },
        config:     { cls: 'client', label: 'API Not Found (404)', source: `The form is calling an API endpoint that does not exist on the server (HTTP 404). The URL "${e.url || ''}" is wrong, the service is not deployed, or the route is misconfigured.` },
        payload:    { cls: 'client', label: 'Data Too Large (413)', source: 'The form submitted more data than the server allows (HTTP 413). A file upload or text field likely exceeds the server\'s size limit.' },
        validation: { cls: 'client', label: `Rejected by Server (${e.status})`, source: `The server rejected the submitted data (HTTP ${e.status}) — a field value failed backend validation. The data format or content doesn't match what the server expects.` },
        rate_limit: { cls: 'client', label: 'Too Many Requests (429)', source: 'The user has hit the server\'s rate limit (HTTP 429) — too many requests in a short window. They are temporarily blocked.' },
        network:    { cls: 'net',    label: 'No Response (Network)', source: 'The request never reached the server. The user is likely offline, or the request was blocked by a CORS/CSP policy before it could be sent (status 0).' },
        client:     { cls: 'client', label: `Request Rejected (${e.status})`, source: `The server returned HTTP ${e.status} — the request was rejected, likely due to invalid or missing data in the form submission.` },
      };
      return map[layer] || { cls: 'api', label: `Form API Error${e.status ? ` (${e.status})` : ''}`, source: `A form API call${e.url ? ` to ${e.url}` : ''} failed with no recognized error class.` };
    }
    if (e.type === 'api_error') {
      const cls = e.errorClass;
      const s = e.status;
      const urlStr = e.url ? `"${e.url}"` : 'the API';
      const map = {
        cors:         { cls: 'net',    label: 'CORS Blocked',          source: `The browser blocked the call to ${urlStr} because the server did not include the required CORS headers. This is a server configuration issue — the server needs to allow cross-origin requests from this page's origin.` },
        network_down: { cls: 'net',    label: 'Server Unreachable',    source: `The call to ${urlStr} failed before getting any response. The user may be offline, the server may be down, or DNS resolution failed.` },
        timeout:      { cls: 'net',    label: 'Request Timed Out',     source: `The call to ${urlStr} got no response within the allowed time. The server is overloaded or too slow.` },
        auth:         { cls: 'client', label: `Auth Rejected (${s || '401'})`, source: `The call to ${urlStr} was rejected because the user's session is missing or expired (HTTP ${s || '401/403'}). The user needs to re-authenticate.` },
        not_found:    { cls: 'client', label: 'Endpoint Missing (404)', source: `The endpoint ${urlStr} does not exist (HTTP 404). It is either not deployed, the URL is wrong, or the service was removed.` },
        rate_limited: { cls: 'client', label: 'Rate Limited (429)',    source: `Too many calls to ${urlStr} in a short time (HTTP 429). The server is throttling this user or IP temporarily.` },
        server_error: { cls: 'server', label: `Server Crashed (${s || '5xx'})`, source: `The server returned HTTP ${s || '5xx'} for the call to ${urlStr} — it crashed or threw an unhandled exception. This is a backend bug.` },
        client_error: { cls: 'client', label: `Bad Request (${s || '4xx'})`,    source: `The call to ${urlStr} was rejected with HTTP ${s || '4xx'} — the request contains invalid or missing data.` },
      };
      return map[cls] || (s >= 500
        ? { cls: 'server', label: `Server Error (${s})`,  source: `The server returned HTTP ${s} for the call to ${urlStr}. This is a backend failure.` }
        : s >= 400
          ? { cls: 'client', label: `Client Error (${s})`, source: `The call to ${urlStr} was rejected with HTTP ${s}.` }
          : { cls: 'net',    label: 'Network Error',        source: `The call to ${urlStr} failed — no response was received.` });
    }
    if (e.type === 'js_error') {
      const errType = e.errorType || 'Error';
      const loc = e.source ? ` in ${e.source.split('/').pop()}${e.line ? ` line ${e.line}` : ''}` : '';
      return { cls: 'js', label: `JS ${errType}`, source: `An uncaught ${errType} was thrown by the form's JavaScript${loc}. This can freeze parts of the form, break button clicks, or block step navigation.` };
    }
    if (e.type === 'console_error') {
      const classDescriptions = {
        missing_resource: `A background service call returned 404 — the endpoint "${e.url || 'unknown'}" does not exist. The service is not deployed or the URL is wrong.`,
        cors:             'A background script was blocked by CORS — the server does not allow requests from this page\'s origin.',
        network_down:     'A background network request failed with no response — the user may be offline or the server is unreachable.',
      };
      return { cls: 'console', label: 'Console Error', source: classDescriptions[e.errorClass] || 'A script logged an error to the browser console. This may indicate a missing service, a failed background request, or a non-critical script failure.' };
    }
    return null;
  }

  const ERROR_BADGE = {
    js_error: (e) => {
      const layer = getErrorLayer(e);
      return `<span class="fis-tl-err-badge fis-tl-err-badge-js">${layer.label}</span>`;
    },
    console_error: (e) => {
      const layer = getErrorLayer(e);
      return `<span class="fis-tl-err-badge fis-tl-err-badge-console">${layer.label}</span>`;
    },
    form_error: (e) => {
      const layer = getErrorLayer(e);
      return `<span class="fis-tl-err-badge fis-tl-err-badge-${layer.cls}">${layer.label}</span>`;
    },
    api_error: (e) => {
      const layer = getErrorLayer(e);
      return `<span class="fis-tl-err-badge fis-tl-err-badge-${layer.cls}">${layer.label}</span>`;
    },
  };

  // ── Helper: collapse + annotate events for one session ─────────────────
  // hasNextPage: true when this page's abandon was followed by a LATER page in the
  // same journey — i.e. the user came back (possibly minutes later, on a new
  // session), so this was never a true drop-off and should read as "switched away".
  function collapseSessionEvents(sess, hasNextPage = false) {
    const filtered = sess.events.filter((e) => importantTypes.has(e.type));
    const COLLAPSIBLE = new Set([...ERROR_TYPES, 'disabled_click', 'rage_click', 'dead_click']);
    const collapsed = [];
    const seenTypes = new Map();
    const collapseKey = (e) => {
      if (e.type === 'button_click' || e.type === 'dead_click' || e.type === 'disabled_click' || e.type === 'rage_click') {
        return `${e.type}:${e.element || e.selector || ''}`;
      }
      if (e.type === 'form_error') {
        return `${e.type}:${e.callType || ''}:${e.status || ''}:${(e.statusText || e.message || '').slice(0, 80)}`;
      }
      return e.type;
    };

    // collapse same-type collapsible events
    filtered.forEach((e) => {
      if (COLLAPSIBLE.has(e.type)) {
        const key = collapseKey(e);
        if (seenTypes.has(key)) {
          const existing = seenTypes.get(key);
          existing._count += 1;
          if (!existing.screenshot && e.screenshot) {
            existing.screenshot = e.screenshot;
          }
          if (!existing.screenshotBefore && e.screenshotBefore) {
            existing.screenshotBefore = e.screenshotBefore;
          }
          if (!existing.triggeredByLabel && e.triggeredByLabel) {
            existing.triggeredByLabel = e.triggeredByLabel;
          }
          if (!existing.triggeredByKind && e.triggeredByKind) {
            existing.triggeredByKind = e.triggeredByKind;
          }
        } else {
          const entry = { ...e, _count: 1 };
          seenTypes.set(key, entry);
          collapsed.push(entry);
        }
      } else {
        collapsed.push(e);
      }
    });

    // dedup form_abandon — keep only the LAST one (most accurate state)
    const lastAbandonIdx = collapsed.map((e) => e.type).lastIndexOf('form_abandon');
    const deduped = collapsed.filter((e, i) => e.type !== 'form_abandon' || i === lastAbandonIdx);

    // mark abandon: switched if followed by submit in same session
    const submitTs = sess.events.filter((ev) => ev.type === 'form_submit').map((ev) => ev.timestamp);
    // mark abandon: leftBriefly if followed by field_focus in same session
    const focusTs = sess.events.filter((ev) => ev.type === 'field_focus').map((ev) => ev.timestamp);
    deduped.forEach((ev) => {
      if (ev.type === 'form_abandon') {
        ev.switched = hasNextPage || submitTs.some((ts) => ts > ev.timestamp);
        if (!ev.switched) {
          ev.leftBriefly = focusTs.some((ts) => ts > ev.timestamp);
        }
        if (ev.switched || ev.leftBriefly) {
          delete ev.screenshot;
          delete ev.screenshotBefore;
        }
      }
    });

    return deduped.filter((ev) => {
      if (ev.type !== 'form_error' || !isFinalSubmissionFailureEvent(ev)) return true;
      return !deduped.some((other) => other.type === 'form_submit'
        && other.failed
        && Math.abs((other.timestamp || 0) - (ev.timestamp || 0)) < 10000);
    });
  }

  // ── Build ordered list of render segments (events or page-dividers) ────
  function buildRenderSegments() {
    if (!isJourney) {
      return collapseSessionEvents(session).map((e) => ({ kind: 'event', event: e, session }));
    }
    const segments = [];
    journeyPages.forEach((page, idx) => {
      if (idx > 0) {
        const prevPage = journeyPages[idx - 1];
        const prevEnd = prevPage.session.endTime || prevPage.session.startTime;
        const thisStart = page.session.startTime;
        const gapMs = thisStart - prevEnd;
        const gapStr = gapMs > 0 ? ` · returned after ${gapMs >= 60000 ? `${Math.round(gapMs / 60000)}m` : `${Math.round(gapMs / 1000)}s`}` : '';
        const dividerPath = (page.pagePath || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 50) || `page ${page.pageIndex + 1}`;
        segments.push({
          kind: 'divider', pageNum: page.pageIndex + 1, pagePath: dividerPath, gapStr,
        });
      }
      // On pages 2+, suppress form_start and form_fields — session_returned
      // already marks the re-entry, so these are redundant duplicates.
      const suppressOnReturn = idx > 0 ? new Set(['form_start', 'form_fields']) : new Set();
      const hasNextPage = idx < journeyPages.length - 1;
      collapseSessionEvents(page.session, hasNextPage).forEach((e) => {
        if (suppressOnReturn.has(e.type)) return;
        segments.push({ kind: 'event', event: e, session: page.session });
      });
    });
    return segments;
  }

  const renderSegments = buildRenderSegments();

  function fallbackBeforeScreenshot(segIdx, currentSession) {
    for (let i = segIdx - 1; i >= 0; i -= 1) {
      const seg = renderSegments[i];
      if (!seg || seg.kind !== 'event') continue;
      // Prefer screenshots from the same page/session. In stitched journeys, allow
      // the previous page only if nothing exists on the current page.
      if (seg.session !== currentSession && currentSession) continue;
      const ev = seg.event;
      if (ev?.screenshot) return ev.screenshot;
      if (ev?.screenshotBefore) return ev.screenshotBefore;
    }
    if (!currentSession) return null;
    for (let i = segIdx - 1; i >= 0; i -= 1) {
      const seg = renderSegments[i];
      if (!seg || seg.kind !== 'event') continue;
      const ev = seg.event;
      if (ev?.screenshot) return ev.screenshot;
      if (ev?.screenshotBefore) return ev.screenshotBefore;
    }
    return null;
  }

  function pairedFinalSubmitScreenshot(e, currentSession) {
    if (e.type !== 'form_submit' || !e.failed) return null;
    const finalError = (currentSession?.events || []).find((ev) => ev.type === 'form_error'
      && ev.screenshot
      && isFinalSubmissionFailureEvent(ev)
      && Math.abs((ev.timestamp || 0) - (e.timestamp || 0)) < 10000);
    if (!finalError) return null;
    const message = (finalError.statusText || finalError.message || finalError.reason || '').slice(0, 240);
    return {
      after: finalError.screenshot,
      before: finalError.screenshotBefore || null,
      message,
      triggeredByKind: finalError.triggeredByKind || null,
      triggeredByLabel: finalError.triggeredByLabel || null,
    };
  }

  function isDropoffCausingError(e, sess) {
    if (e.screenshotBefore) return true;
    const idx = (sess.events || []).findIndex((ev) => ev.type === e.type
      && ev.timestamp === e.timestamp
      && (ev.message || ev.reason || ev.statusText || '') === (e.message || e.reason || e.statusText || ''));
    if (idx < 0) return false;
    const eventsAfter = (sess.events || []).slice(idx + 1);
    const abandonAfter = eventsAfter.find((ev) => ev.type === 'form_abandon');
    if (!abandonAfter) return false;
    const fieldAfter = eventsAfter.find((ev) => ev.type === 'field_focus' || ev.type === 'field_change' || ev.type === 'field_blur');
    return !fieldAfter && (abandonAfter.timestamp - e.timestamp) < 60000;
  }

  function isSeparateErrorScreen(e) {
    if (!e || e.type !== 'form_error') return false;
    const text = [
      e.callType,
      e.statusText,
      e.message,
      e.reason,
      e.responseBody,
      e.url,
    ].filter(Boolean).join(' ').toLowerCase();

    // Only use the two-panel "where + error" view when the user was moved into
    // a full error state/screen. Inline validation already shows cause + location
    // in one screenshot, so a separate before-shot adds noise.
    return /screenfragmenterrorscreen|error screen|ln\d+|service error|we are sorry|something went wrong|start again|could not be submitted|request could not be submitted|personal loan request|contact nearest branch|try later/.test(text);
  }

  // For multi-page journeys, anchor all event times to the first page's startTime
  // so the timeline is one continuous clock rather than resetting to 0:00 per page.
  const journeyStartTime = isJourney
    ? (journeyPages[0].session.startTime || startTime)
    : startTime;

  // build event rows
  const eventsHtml = renderSegments.length ? renderSegments.map((seg, segIdx) => {
    if (seg.kind === 'divider') {
      const dividerId = session.journeyId ? ` · ${session.journeyId}` : '';
      return `
        <div class="fis-tl-page-divider">
          <span class="fis-tl-page-sep">${seg.gapStr ? `↩ continued${seg.gapStr}${dividerId}` : `↩ continued${dividerId}`}</span>
        </div>`;
    }
    const { event: e, session: evSession } = seg;
    const meta = eventMeta[e.type] || { icon: '·', cls: 'other', label: () => e.type };
    const evStartTime = journeyStartTime;
    const offset = Math.max(0, (e.timestamp || 0) - evStartTime);
    const timeStr = `${Math.floor(offset / 60000)}:${String(Math.floor((offset % 60000) / 1000)).padStart(2, '0')}`;
    const firedBadge = e._count > 1 ? `<span class="fis-tl-count-badge">×${e._count}</span>` : '';

    if (ERROR_TYPES.has(e.type)) {
      const diag = diagnoseEventClient(e);
      const badge = (typeof ERROR_BADGE[e.type] === 'function' ? ERROR_BADGE[e.type](e) : ERROR_BADGE[e.type]) || '';
      const rawMsg = (e.message || e.reason || e.statusText || '').slice(0, 160);
      const separateErrorScreen = isSeparateErrorScreen(e);
      const beforeScreenshot = separateErrorScreen
        ? (e.screenshotBefore || fallbackBeforeScreenshot(segIdx, evSession))
        : null;
      const showScreenshot = e.screenshot
        && MAIN_SCREENSHOT_ERROR_TYPES.has(e.type)
        && (isDropoffCausingError(e, evSession) || separateErrorScreen);
      const viewBtn = showScreenshot
        ? `<button class="fis-tl-view-btn" data-ss="${e.screenshot}"${beforeScreenshot ? ` data-before="${beforeScreenshot}"` : ''}>${beforeScreenshot ? 'View Before + Error' : 'View Error Screen'}</button>`
        : '';
      const causeHtml = diag
        ? `<div class="fis-tl-err-cause">${diag.cause}</div>
           <div class="fis-tl-err-fix"><span class="fis-tl-fix-label">Fix</span>${diag.fix}</div>`
        : '';
      const layerInfo = getErrorLayer(e);
      const sourceHtml = layerInfo?.source
        ? `<div class="fis-tl-err-source"><span class="fis-tl-source-label">What</span>${layerInfo.source}</div>`
        : '';
      const extraHtml = e.type === 'form_error' && e.responseBody
        ? `<div class="fis-tl-err-server">Server response: <code>${e.responseBody.slice(0, 120)}</code></div>`
        : '';
      const stackHtml = e.stack
        ? `<div class="fis-tl-err-stack">${e.stack.slice(0, 200)}</div>`
        : '';
      return `
        <div class="fis-tl-error-card">
          <div class="fis-tl-err-header">
            <div class="fis-tl-err-header-left">
              ${badge}
              <span class="fis-tl-err-time">${timeStr}</span>
              ${firedBadge}
            </div>
            ${viewBtn}
          </div>
          <div class="fis-tl-err-msg">${rawMsg || `HTTP ${e.status}`}</div>
          ${sourceHtml}
          ${causeHtml}
          ${extraHtml}
          ${stackHtml}
        </div>`;
    }

    // disabled_click — expanded card with blocking fields + screenshot
    if (e.type === 'disabled_click') {
      const viewBtn = e.screenshot
        ? `<button class="fis-tl-view-btn" data-ss="${e.screenshot}">View Screenshot</button>`
        : '';
      const fieldsHtml = e.invalidFields?.length
        ? `<div class="fis-tl-disabled-fields">Blocking fields: <strong>${e.invalidFields.join(', ')}</strong></div>`
        : `<div class="fis-tl-disabled-fields">All fields appear filled — button may be gated by a non-field condition (e.g. checkbox, T&amp;C agreement)</div>`;
      return `
        <div class="fis-tl-error-card fis-tl-disabled-card">
          <div class="fis-tl-err-header">
            <div class="fis-tl-err-header-left">
              <span class="fis-tl-err-badge fis-tl-err-badge-disabled">Blocked</span>
              <span class="fis-tl-err-time">${timeStr}</span>
              ${firedBadge}
            </div>
            ${viewBtn}
          </div>
          <div class="fis-tl-err-msg">🚷 Clicked disabled "${e.element || 'button'}"</div>
          ${fieldsHtml}
        </div>`;
    }

    const submitFailureScreenshot = pairedFinalSubmitScreenshot(e, evSession);
    if (e.type === 'form_submit' && e.failed && submitFailureScreenshot) {
      const triggerVerb = submitFailureScreenshot.triggeredByKind === 'field' ? 'focused' : 'clicked';
      const triggerLabel = submitFailureScreenshot.triggeredByLabel || 'the last action';
      const triggerText = submitFailureScreenshot.triggeredByLabel
        ? `User ${triggerVerb} "${timelineEsc(triggerLabel)}" before this error`
        : 'After the last recorded action';
      const viewBtn = `<button class="fis-tl-view-btn" data-ss="${submitFailureScreenshot.after}"${submitFailureScreenshot.before ? ` data-before="${submitFailureScreenshot.before}"` : ''}>${submitFailureScreenshot.before ? 'View Before + Error' : 'View Error Screen'}</button>`;
      return `
        <div class="fis-tl-error-card fis-tl-submit-fail-card">
          <div class="fis-tl-err-header">
            <div class="fis-tl-err-header-left">
              <span class="fis-tl-err-badge fis-tl-err-badge-server">Submission failed</span>
              <span class="fis-tl-err-time">${timeStr}</span>
              ${firedBadge}
            </div>
            ${viewBtn}
          </div>
          <div class="fis-tl-err-msg">${timelineEsc(submitFailureScreenshot.message || 'The form showed a final submission failure screen.')}</div>
          <div class="fis-tl-err-source"><span class="fis-tl-source-label">Before</span>${triggerText}</div>
        </div>`;
    }

    // regular event — compact row
    const label = meta.label(e);
    const why = eventWhy(e, evSession);
    const evCls = typeof meta.cls === 'function' ? meta.cls(e) : meta.cls;
    const evIcon = typeof meta.icon === 'function' ? meta.icon(e) : meta.icon;
    let ssBtn = '';
    const showInlineScreenshot = e.screenshot
      && ((e.type === 'form_abandon' && !e.switched && !e.leftBriefly)
        || INLINE_SCREENSHOT_TYPES.has(e.type));
    if (showInlineScreenshot) {
      ssBtn = `<button class="fis-tl-view-btn fis-tl-view-btn-inline" data-ss="${e.screenshot}"${e.screenshotBefore ? ` data-before="${e.screenshotBefore}"` : ''}>${e.screenshotBefore ? 'Before + Error' : 'Screenshot'}</button>`;
    } else if (submitFailureScreenshot) {
      ssBtn = `<button class="fis-tl-view-btn fis-tl-view-btn-inline" data-ss="${submitFailureScreenshot.after}"${submitFailureScreenshot.before ? ` data-before="${submitFailureScreenshot.before}"` : ''}>${submitFailureScreenshot.before ? 'Before + Error' : 'Error Screen'}</button>`;
    } else if (e.screenshotDeduped) {
      ssBtn = '<span class="fis-tl-repeated-badge">Repeated error</span>';
    }
    return `
      <div class="fis-timeline-event fis-tl-${evCls}">
        <div class="fis-tl-time">${timeStr}</div>
        <div class="fis-tl-dot">${evIcon}</div>
        <div class="fis-tl-content">
          <div class="fis-tl-label">${label}${ssBtn}</div>
          ${why ? `<div class="fis-tl-why">${why}</div>` : ''}
        </div>
      </div>`;
  }).join('') : '<p style="color:#aaa;text-align:center;padding:32px">No tracked events in this session.</p>';

  document.getElementById('timelineBody').innerHTML = analysisHtml + eventsHtml;

  // screenshot lightbox
  let lightbox = document.getElementById('fis-ss-lightbox');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'fis-ss-lightbox';
    lightbox.className = 'fis-screenshot-lightbox hidden';
    lightbox.innerHTML = `
      <div class="fis-ss-lb-inner">
        <button class="fis-ss-lb-close">✕</button>
        <div class="fis-ss-lb-pair">
          <div class="fis-ss-lb-item fis-ss-lb-before">
            <div class="fis-ss-lb-label">Before Error</div>
            <img class="fis-ss-lb-img fis-ss-lb-before-img" src="" alt="Before error" />
          </div>
          <div class="fis-ss-lb-item">
            <div class="fis-ss-lb-label fis-ss-lb-after-label">Error Screen</div>
            <img class="fis-ss-lb-img fis-ss-lb-after-img" src="" alt="Screenshot" />
          </div>
        </div>
      </div>`;
    document.body.appendChild(lightbox);
    lightbox.querySelector('.fis-ss-lb-close').addEventListener('click', () => lightbox.classList.add('hidden'));
    lightbox.addEventListener('click', (ev) => { if (ev.target === lightbox) lightbox.classList.add('hidden'); });
  }

  document.getElementById('timelineBody').addEventListener('click', (ev) => {
    const thumb = ev.target.closest('.fis-tl-screenshot-thumb');
    const viewBtn = ev.target.closest('.fis-tl-view-btn');
    const showLightbox = ({ after, before = '' }) => {
      const beforeItem = lightbox.querySelector('.fis-ss-lb-before');
      const beforeImg = lightbox.querySelector('.fis-ss-lb-before-img');
      const afterImg = lightbox.querySelector('.fis-ss-lb-after-img');
      const afterLabel = lightbox.querySelector('.fis-ss-lb-after-label');
      // No "before" screenshot means one wasn't captured for this event — show
      // the error screen alone rather than a placeholder for the missing pane.
      if (before) {
        beforeItem.classList.remove('hidden');
        beforeImg.src = before;
      } else {
        beforeItem.classList.add('hidden');
        beforeImg.removeAttribute('src');
      }
      afterLabel.textContent = 'Error Screen';
      afterImg.src = after;
      lightbox.classList.remove('hidden');
    };
    if (thumb) {
      showLightbox({ after: thumb.src });
    } else if (viewBtn) {
      showLightbox({ after: viewBtn.dataset.ss, before: viewBtn.dataset.before });
    }
  });

  modal.classList.remove('hidden');
}

document.getElementById('closeTimeline').addEventListener('click', () => {
  document.getElementById('timelineModal').classList.add('hidden');
});

// close the AI Insights panel — slides the whole panel away
document.getElementById('insightsCloseBtn')?.addEventListener('click', () => {
  document.getElementById('dashboard').classList.remove('sidebar-open');
  document.querySelector('.fis-sidebar').style.width = '0';
  updateToggleBtn(false);
});
document.getElementById('timelineModal').addEventListener('click', (e) => {
  if (e.target.classList.contains('fis-modal-backdrop')) {
    document.getElementById('timelineModal').classList.add('hidden');
  }
});

// ── Tab switching ─────────────────────────────────────────────────────────

document.querySelectorAll('.fis-tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fis-tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    // close compare view if open
    document.getElementById('compareView').classList.add('hidden');
    document.getElementById('compareBtn').classList.remove('fis-btn-compare-active');

    const dashboard = document.getElementById('dashboard');
    const sessionsView = document.getElementById('sessionsView');
    const notReady = document.getElementById('notReady');

    const errorsView = document.getElementById('errorsView');

    if (currentTab === 'analytics') {
      sessionsView.classList.add('hidden');
      errorsView.classList.add('hidden');
      document.getElementById('compareView').classList.add('hidden');
      if (currentFormId) {
        loadAnalytics(currentFormId, currentRange);
      } else if (!notReady.classList.contains('hidden') || dashboard.classList.contains('hidden')) {
        // nothing loaded yet — leave not-ready message visible
      } else {
        dashboard.classList.remove('hidden');
      }
    } else if (currentTab === 'errors') {
      dashboard.classList.add('hidden');
      notReady.classList.add('hidden');
      sessionsView.classList.add('hidden');
      document.getElementById('compareView').classList.add('hidden');
      errorsView.classList.remove('hidden');
      if (currentFormId) {
        const { sinceTs, untilTs } = getActiveWindow(currentFormId, currentRange);
        renderErrorsTab(currentFormId, sinceTs, untilTs);
      } else {
        errorsView.innerHTML = '<p class="fis-errors-empty">Load a form first using the input in the top right.</p>';
      }
    } else if (currentTab === 'compare') {
      dashboard.classList.add('hidden');
      notReady.classList.add('hidden');
      errorsView.classList.add('hidden');
      sessionsView.classList.add('hidden');
      document.getElementById('compareView').classList.remove('hidden');
      if (!currentFormId) {
        document.getElementById('compareNoForm').classList.remove('hidden');
      }
    } else {
      dashboard.classList.add('hidden');
      notReady.classList.add('hidden');
      errorsView.classList.add('hidden');
      document.getElementById('compareView').classList.add('hidden');
      sessionsView.classList.remove('hidden');
      if (currentFormId) {
        loadJourneys(currentFormId, currentRange);
      } else {
        document.getElementById('sessionsList').innerHTML = '<p class="fis-sessions-empty">Load a form first using the input in the top right.</p>';
        document.getElementById('sessionsCount').textContent = '';
      }
    }
  });
});

// ── Compare tab logic ─────────────────────────────────────────────────────────

function dateToTs(dateStr, isEnd = false) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isEnd) d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function fmtDateRange(start, end) {
  const fmt = (ts) => ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '?';
  return `${fmt(start)} – ${fmt(end)}`;
}

function cmpDelta(a, b, direction) {
  if (a == null || b == null) return { text: '—', cls: 'fis-cmp-neutral' };
  const diff = b - a;
  if (diff === 0) return { text: 'No change', cls: 'fis-cmp-neutral' };
  // Percentage change is undefined when the baseline (Period A) is zero —
  // a jump from 0 to anything is an infinite increase. Show a clear label
  // instead of "Infinity%".
  if (a === 0) {
    const good = direction === 'up-good';
    return { text: '▲ New', cls: good ? 'fis-cmp-good' : 'fis-cmp-bad' };
  }
  // Likewise, dropping to zero is a clean −100% — label it plainly.
  if (b === 0) {
    const good = direction === 'down-good';
    return { text: '▼ −100%', cls: good ? 'fis-cmp-good' : 'fis-cmp-bad' };
  }
  const pctDiff = Math.abs((diff / a) * 100);
  if (pctDiff < 0.5) return { text: 'No change', cls: 'fis-cmp-neutral' };
  const arrow = diff > 0 ? '▲' : '▼';
  const good = (direction === 'up-good' && diff > 0) || (direction === 'down-good' && diff < 0);
  return { text: `${arrow} ${pctDiff.toFixed(1)}%`, cls: good ? 'fis-cmp-good' : 'fis-cmp-bad' };
}

function buildCompareRow(label, aVal, bVal, direction, fmt = (v) => v) {
  const delta = cmpDelta(aVal, bVal, direction);

  // Mark which period is better with a subtle dot, but keep the value text
  // neutral — the single source of good/bad colour is the Change pill, so the
  // table reads cleanly instead of being a wall of red and green.
  let aMark = '';
  let bMark = '';
  if (aVal != null && bVal != null && Math.abs(aVal - bVal) > 0) {
    const aWins = (direction === 'up-good' && aVal > bVal) || (direction === 'down-good' && aVal < bVal);
    if (aWins) aMark = ' <span class="fis-cmp-win" title="Better period">●</span>';
    else bMark = ' <span class="fis-cmp-win" title="Better period">●</span>';
  }

  const aDisplay = aVal != null ? fmt(aVal) : '—';
  const bDisplay = bVal != null ? fmt(bVal) : '—';

  return `<tr>
    <td class="fis-cmp-metric">${label}</td>
    <td class="fis-cmp-num">${aDisplay}${aMark}</td>
    <td class="fis-cmp-num">${bDisplay}${bMark}</td>
    <td class="fis-cmp-change"><span class="fis-cmp-pill ${delta.cls}">${delta.text}</span></td>
  </tr>`;
}

async function runComparison() {
  if (!currentFormId) {
    document.getElementById('compareNoForm').classList.remove('hidden');
    return;
  }
  document.getElementById('compareNoForm').classList.add('hidden');

  const aStart = dateToTs(document.getElementById('cmpAStart').value);
  const aEnd = dateToTs(document.getElementById('cmpAEnd').value, true);
  const bStart = dateToTs(document.getElementById('cmpBStart').value);
  const bEnd = dateToTs(document.getElementById('cmpBEnd').value, true);

  if (!aStart || !aEnd || !bStart || !bEnd) {
    document.getElementById('compareError').textContent = 'Please fill in all four dates.';
    document.getElementById('compareError').classList.remove('hidden');
    return;
  }

  document.getElementById('compareError').classList.add('hidden');
  document.getElementById('compareResults').classList.add('hidden');
  document.getElementById('compareLoading').classList.remove('hidden');

  try {
    const [resA, resB, tlA, tlB] = await Promise.all([
      fetch(`${API}/analysis/${encodeURIComponent(currentFormId)}?since=${aStart}&until=${aEnd}`).then((r) => r.json()),
      fetch(`${API}/analysis/${encodeURIComponent(currentFormId)}?since=${bStart}&until=${bEnd}`).then((r) => r.json()),
      fetch(`${API}/timeline/${encodeURIComponent(currentFormId)}?since=${aStart}&until=${aEnd}`).then((r) => r.json()),
      fetch(`${API}/timeline/${encodeURIComponent(currentFormId)}?since=${bStart}&until=${bEnd}`).then((r) => r.json()),
    ]);

    document.getElementById('compareLoading').classList.add('hidden');

    if (!resA.ready && !resB.ready) {
      document.getElementById('compareError').textContent = 'No session data found for either period.';
      document.getElementById('compareError').classList.remove('hidden');
      return;
    }

    const a = resA.ready ? resA.summary : null;
    const b = resB.ready ? resB.summary : null;

    document.getElementById('cmpLabelA').textContent = fmtDateRange(aStart, aEnd);
    document.getElementById('cmpLabelB').textContent = fmtDateRange(bStart, bEnd);

    const p = (v) => (v != null ? `${(v * 100).toFixed(1)}%` : '—');
    const n = (v) => (v != null ? v : '—');

    const rows = [
      buildCompareRow('Total Journeys', a?.totalSessions, b?.totalSessions, 'up-good', n),
      buildCompareRow('Completion Rate', a?.completionRate, b?.completionRate, 'up-good', p),
      buildCompareRow('Drop-off Rate', a?.dropOffRate, b?.dropOffRate, 'down-good', p),
      buildCompareRow('Bounce Rate', a?.bounceRate, b?.bounceRate, 'down-good', p),
      buildCompareRow('Return Rate', a?.returnRate, b?.returnRate, 'up-good', p),
      buildCompareRow('Deep Abandon Rate', a?.deepAbandonRate, b?.deepAbandonRate, 'down-good', p),
      buildCompareRow('JS Errors', a?.errors?.jsErrors, b?.errors?.jsErrors, 'down-good', n),
      buildCompareRow('API Errors', a?.errors?.apiErrors, b?.errors?.apiErrors, 'down-good', n),
      buildCompareRow('Rage Clicks', a?.errors?.rageClicks, b?.errors?.rageClicks, 'down-good', n),
      buildCompareRow('Disabled Clicks', a?.errors?.disabledClicks, b?.errors?.disabledClicks, 'down-good', n),
    ];

    document.getElementById('compareTableBody').innerHTML = rows.join('');

    // Abandonment by step
    const stepsA = a?.abandonmentByStep || {};
    const stepsB = b?.abandonmentByStep || {};
    const allSteps = [...new Set([...Object.keys(stepsA), ...Object.keys(stepsB)])];
    if (allSteps.length) {
      const stepRows = allSteps.map((step) => {
        const cA = stepsA[step]?.count ?? 0;
        const cB = stepsB[step]?.count ?? 0;
        return buildCompareRow(step, cA, cB, 'down-good', n);
      });
      document.getElementById('compareStepsBody').innerHTML = stepRows.join('');
      document.getElementById('compareSteps').classList.remove('hidden');
    } else {
      document.getElementById('compareSteps').classList.add('hidden');
    }

    // Trend overlay chart
    const bkA = tlA?.buckets || [];
    const bkB = tlB?.buckets || [];
    const maxLen = Math.max(bkA.length, bkB.length);
    const chartLabels = Array.from({ length: maxLen }, (_, i) => `Day ${i + 1}`);

    if (compareChart) { compareChart.destroy(); compareChart = null; }
    const cCanvas = document.getElementById('compareChart');
    if (cCanvas && maxLen > 0) {
      const cds = (label, data, color, dashed = false) => ({
        label,
        data,
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 2,
        pointRadius: maxLen > 30 ? 0 : 3,
        tension: 0.3,
        fill: false,
        borderDash: dashed ? [5, 4] : [],
      });
      compareChart = new Chart(cCanvas, {
        type: 'line',
        data: {
          labels: chartLabels,
          datasets: [
            cds('Journeys A',     bkA.map((b) => b.sessions),     '#2563eb'),
            cds('Journeys B',     bkB.map((b) => b.sessions),     '#2563eb', true),
            cds('Completions A',  bkA.map((b) => b.completions),  '#16a34a'),
            cds('Completions B',  bkB.map((b) => b.completions),  '#16a34a', true),
            cds('Drop-offs A',    bkA.map((b) => b.dropoffs),     '#dc2626'),
            cds('Drop-offs B',    bkB.map((b) => b.dropoffs),     '#dc2626', true),
            cds('Errors A',       bkA.map((b) => b.totalErrors),  '#ca8a04'),
            cds('Errors B',       bkB.map((b) => b.totalErrors),  '#ca8a04', true),
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: true, position: 'top', align: 'start', labels: { boxWidth: 12, font: { size: 11 } } },
          },
          scales: {
            x: { grid: { color: '#f0f1f5' }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: '#f0f1f5' }, ticks: { stepSize: 1, font: { size: 11 } } },
          },
        },
      });
    }

    document.getElementById('compareResults').classList.remove('hidden');
  } catch {
    document.getElementById('compareLoading').classList.add('hidden');
    document.getElementById('compareError').textContent = 'Failed to fetch data. Make sure the analytics server is running.';
    document.getElementById('compareError').classList.remove('hidden');
  }
}

document.getElementById('runCompareBtn').addEventListener('click', runComparison);

// category filter pills
document.querySelectorAll('.fis-filter-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fis-filter-pill').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderJourneys(allJourneysCache, btn.dataset.cat);
  });
});

// journey sort dropdown
document.getElementById('sessionSort')?.addEventListener('change', () => {
  renderJourneys(allJourneysCache, currentCategory);
});

// journey error search
document.getElementById('journeySearch')?.addEventListener('input', () => {
  renderJourneys(allJourneysCache, currentCategory);
});

// ── Timeline trend chart ──────────────────────────────────────────────────────

async function renderTimeline(formId, sinceTs, untilTs) {
  const section = document.getElementById('timelineSection');
  const canvas = document.getElementById('timelineChart');
  const empty = document.getElementById('timelineEmpty');
  if (!section || !canvas) return;

  canvas.classList.add('hidden');
  empty.classList.add('hidden');

  let data;
  try {
    const res = await fetch(`${API}/timeline/${encodeURIComponent(formId)}?${buildQueryStr(sinceTs, untilTs)}`);
    data = await res.json();
  } catch {
    empty.textContent = 'Could not load trend data.';
    empty.classList.remove('hidden');
    return;
  }

  if (!data.buckets || data.buckets.length < 2) {
    empty.classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  if (timelineChart) { timelineChart.destroy(); timelineChart = null; }

  const { buckets } = data;
  const labels = buckets.map((b) => b.label);
  const pts = buckets.length > 30 ? 0 : 3;

  // Size the inner scroll div so each bucket gets a fixed width.
  // The canvas (responsive:true) fills the inner div; the wrap scrolls.
  const wrap = document.querySelector('.fis-timeline-chart-wrap');
  const inner = document.getElementById('timelineInner');
  const wrapW = wrap.clientWidth || 800;
  // Fit as many buckets as possible in view; allow a little overflow but not excessive scrolling.
  const minPx = Math.max(8, Math.floor(wrapW / buckets.length));
  const PX_PER_BUCKET = Math.min(minPx, buckets.length <= 14 ? 80 : buckets.length <= 31 ? 50 : 22);
  const totalWidth = Math.max(wrapW, buckets.length * PX_PER_BUCKET);
  inner.style.width = `${totalWidth}px`;

  const ds = (label, prop, color, hidden = false, dashed = false) => ({
    label,
    data: buckets.map((b) => b[prop]),
    borderColor: color,
    backgroundColor: color + '18',
    borderWidth: hidden ? 1.5 : 2,
    pointRadius: pts,
    pointHoverRadius: pts + 2,
    tension: 0.3,
    fill: false,
    hidden,
    borderDash: dashed ? [4, 3] : [],
  });

  timelineChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        ds('Journeys',              'sessions',      '#2563eb'),
        ds('Completions',           'completions',   '#16a34a'),
        ds('Drop-offs',             'dropoffs',      '#dc2626'),
        ds('Total Errors',          'totalErrors',   '#ca8a04'),
        ds('Error → Drop-off',      'errorDropoffs', '#c026d3'),  // sessions with error AND abandon
        ds('JS Errors',             'jsErrors',      '#0891b2', true, true),
        ds('Rage Clicks',           'rageClicks',    '#7c3aed', true, true),
        ds('API Failures',          'apiErrors',     '#ea580c', true, true),
        ds('Disabled Clicks',       'disabledClicks','#6b7280', true, true),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'start',
          labels: { boxWidth: 12, font: { size: 12 } },
        },
        tooltip: {
          callbacks: {
            title(items) {
              const idx = items[0]?.dataIndex;
              if (idx == null) return '';
              const b = buckets[idx];
              if (!b) return items[0]?.label ?? '';
              if (data.granularity === 'day') {
                const d = new Date(`${b.key}T00:00:00`);
                return d.toLocaleDateString('en', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                });
              }
              if (data.granularity === 'week') {
                const d = new Date(`${b.key}T00:00:00`);
                const end = new Date(d.getTime() + 6 * 86400000);
                const fmt = (x) => x.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
                return `${fmt(d)} – ${fmt(end)}`;
              }
              if (data.granularity === 'hour') {
                const d = new Date(`${b.key}:00:00`);
                return d.toLocaleString('en', {
                  weekday: 'short', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                });
              }
              return b.label;
            },
            footer(items) {
              const errDrop = items.find((i) => i.dataset.label === 'Error → Drop-off');
              const drop = items.find((i) => i.dataset.label === 'Drop-offs');
              if (errDrop && drop && drop.raw > 0) {
                const pct = Math.round((errDrop.raw / drop.raw) * 100);
                return errDrop.raw > 0
                  ? `↳ ${errDrop.raw} of ${drop.raw} drop-off${drop.raw !== 1 ? 's' : ''} were error-influenced (${pct}%)`
                  : `↳ none of the ${drop.raw} drop-off${drop.raw !== 1 ? 's' : ''} had errors`;
              }
              return undefined;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#f0f1f5' },
          ticks: {
            autoSkip: true,
            maxTicksLimit: 15,
            maxRotation: 45,
            minRotation: 0,
            font: { size: 11 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f0f1f5' },
          ticks: { precision: 0, font: { size: 11 } },
        },
      },
    },
  });

  // Scroll to the rightmost position so today is immediately visible.
  requestAnimationFrame(() => { wrap.scrollLeft = wrap.scrollWidth; });

  // Mouse drag-to-scroll (click and drag left to see older dates).
  if (!wrap._dragBound) {
    wrap._dragBound = true;
    wrap.style.userSelect = 'none';
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    wrap.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.pageX;
      startScroll = wrap.scrollLeft;
      wrap.style.cursor = 'grabbing';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      wrap.scrollLeft = startScroll - (e.pageX - startX);
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
      wrap.style.cursor = 'grab';
    });
  }

}
