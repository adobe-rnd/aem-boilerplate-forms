const API = 'http://localhost:3000';
let currentFormId = null;
let dropOffChart = null;
let timeChart = null;
let errorChart = null;

function pct(val) {
  return `${(val * 100).toFixed(1)}%`;
}

function ms(val) {
  return `${(val / 1000).toFixed(1)}s`;
}

function severityLabel(score) {
  if (score > 1.5) return 'high';
  if (score > 0.5) return 'medium';
  return 'low';
}

function renderOverview(summary) {
  document.getElementById('totalSessions').textContent = summary.totalSessions;
  document.getElementById('completionRate').textContent = pct(summary.completionRate);
  document.getElementById('dropOffRate').textContent = pct(summary.dropOffRate);
  document.getElementById('returnRate').textContent = pct(summary.returnRate);
}

function renderCharts(fields) {
  const labels = fields.map((f) => f.field);
  const chartDefaults = {
    responsive: true,
    plugins: { legend: { display: false } },
  };

  if (dropOffChart) dropOffChart.destroy();
  if (timeChart) timeChart.destroy();
  if (errorChart) errorChart.destroy();

  dropOffChart = new Chart(document.getElementById('dropOffChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: fields.map((f) => (f.dropOffRate * 100).toFixed(1)),
        backgroundColor: '#e53e3e88',
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
        backgroundColor: '#0070f388',
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
        backgroundColor: '#dd6b2088',
        borderColor: '#dd6b20',
        borderWidth: 1,
      }],
    },
    options: chartDefaults,
  });
}

function renderFieldTable(fields) {
  const container = document.getElementById('fieldTable');
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Field</th>
          <th>Drop-off Rate</th>
          <th>Avg Time</th>
          <th>Avg Idle</th>
          <th>Avg Errors</th>
          <th>Copy-paste Rate</th>
          <th>Visibility</th>
          <th>Possible Reason</th>
          <th>Severity</th>
        </tr>
      </thead>
      <tbody>
        ${fields.map((f) => {
    const sev = severityLabel(f.severityScore);
    return `
          <tr>
            <td>${f.field}</td>
            <td>${pct(f.dropOffRate)}</td>
            <td>${ms(f.avgTimeSpentMs)}</td>
            <td>${ms(f.avgIdleTimeMs)}</td>
            <td>${f.avgErrorCount.toFixed(1)}</td>
            <td>${pct(f.copyPasteRate)}</td>
            <td>${pct(f.visibilityRate)}</td>
            <td>${f.possibleReason}</td>
            <td class="fis-severity-${sev}">${sev.toUpperCase()}</td>
          </tr>`;
  }).join('')}
      </tbody>
    </table>
  `;
}

async function renderInsights(formId) {
  const container = document.getElementById('insightsContainer');
  container.innerHTML = '<p>Generating insights from Claude...</p>';

  const res = await fetch(`${API}/insights/${encodeURIComponent(formId)}`);
  const data = await res.json();

  if (!data.ready) {
    container.innerHTML = `<p>${data.message}</p>`;
    return;
  }

  const fixes = await fetch(`${API}/fixes/${encodeURIComponent(formId)}`).then((r) => r.json());
  const resolvedFields = new Set(fixes.map((f) => f.field));

  container.innerHTML = data.insights.map((insight) => {
    const isResolved = resolvedFields.has(insight.field);
    return `
      <div class="fis-insight-card ${insight.priority}">
        <div class="fis-insight-field">${insight.field}</div>
        <div class="fis-insight-text">${insight.insight}</div>
        <div class="fis-insight-fix"><strong>Suggested fix:</strong> ${insight.fix}</div>
        <div class="fis-insight-why"><em>Why this helps:</em> ${insight.why}</div>
        <button
          class="fis-resolve-btn ${isResolved ? 'resolved' : ''}"
          data-field="${insight.field}"
          data-fix="${insight.fix}"
          ${isResolved ? 'disabled' : ''}>
          ${isResolved ? 'Resolved' : 'Resolve'}
        </button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.fis-resolve-btn:not(.resolved)').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`${API}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId, field: btn.dataset.field, fix: btn.dataset.fix }),
      });
      btn.textContent = 'Resolved';
      btn.classList.add('resolved');
      btn.disabled = true;
    });
  });
}

async function loadAnalytics(formId) {
  currentFormId = formId;
  const res = await fetch(`${API}/analysis/${encodeURIComponent(formId)}`);
  const data = await res.json();

  const dashboard = document.getElementById('dashboard');
  const notReady = document.getElementById('notReady');

  if (!data.ready) {
    dashboard.classList.add('hidden');
    notReady.classList.remove('hidden');
    document.getElementById('notReadyMsg').textContent = data.message;
    return;
  }

  notReady.classList.add('hidden');
  dashboard.classList.remove('hidden');

  renderOverview(data.summary);
  renderCharts(data.fields);
  renderFieldTable(data.fields);
}

document.getElementById('loadBtn').addEventListener('click', () => {
  const formId = document.getElementById('formIdInput').value.trim();
  if (formId) loadAnalytics(formId);
});

document.getElementById('generateInsightsBtn').addEventListener('click', () => {
  if (currentFormId) renderInsights(currentFormId);
});

// auto-load if formId is in URL
const params = new URLSearchParams(window.location.search);
if (params.get('formId')) {
  document.getElementById('formIdInput').value = params.get('formId');
  loadAnalytics(params.get('formId'));
}
