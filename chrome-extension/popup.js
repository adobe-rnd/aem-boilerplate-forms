const btn = document.getElementById('btn');
const pinBtn = document.getElementById('pin-btn');
const status = document.getElementById('status');
const serverStatus = document.getElementById('server-status');
const serverInput = document.getElementById('server-input');
const saveBtn = document.getElementById('save-btn');
const saveFeedback = document.getElementById('save-feedback');
const pinnedList = document.getElementById('pinned-list');

const DEFAULT_SERVER = 'http://localhost:3000';
let currentServer = DEFAULT_SERVER;

async function loadServerUrl() {
  const result = await chrome.storage.local.get('serverUrl');
  currentServer = result.serverUrl || DEFAULT_SERVER;
  serverInput.value = currentServer;
}

async function checkServer() {
  serverStatus.textContent = 'Checking server…';
  serverStatus.className = 'checking';
  btn.disabled = true;

  try {
    const res = await fetch(`${currentServer}/health`, {
      method: 'GET',
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const display = currentServer.replace(/^https?:\/\//, '');
      serverStatus.textContent = `● Server online — ${display}`;
      serverStatus.className = 'online';
      btn.disabled = false;
      pinBtn.disabled = false;
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch {
    serverStatus.textContent = `● Server offline — is it running at ${currentServer}?`;
    serverStatus.className = 'offline';
    btn.disabled = true;
  }
}

saveBtn.addEventListener('click', async () => {
  const val = serverInput.value.trim().replace(/\/$/, '');
  if (!val.startsWith('http')) {
    saveFeedback.textContent = 'Must start with http:// or https://';
    saveFeedback.style.color = '#c0392b';
    return;
  }
  await chrome.storage.local.set({ serverUrl: val });
  currentServer = val;
  saveFeedback.textContent = 'Saved!';
  saveFeedback.style.color = '#1a7f4b';
  setTimeout(() => { saveFeedback.textContent = ''; }, 2000);
  checkServer();
});

btn.addEventListener('click', async () => {
  btn.disabled = true;
  status.textContent = 'Injecting tracker…';
  status.className = '';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['html2canvas.min.js'],
    });

    // Inject the server URL + force flag so tracker-content.js starts even if
    // this form isn't pinned (manual start always wins over the pin filter).
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (serverBase) => { window.__FIS_SERVER = serverBase; window.__FIS_FORCE = true; },
      args: [currentServer],
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['tracker-content.js'],
    });

    const display = currentServer.replace(/^https?:\/\//, '');
    status.textContent = `Tracking active. Open ${display} to see events.`;
    status.className = 'ok';
    btn.textContent = 'Tracking active ✓';
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    status.className = 'err';
    btn.disabled = false;
  }
});

async function renderPinnedList() {
  const { pinnedUrls = [] } = await chrome.storage.local.get('pinnedUrls');
  if (!pinnedUrls.length) { pinnedList.innerHTML = ''; return; }
  pinnedList.innerHTML = '<strong>Auto-tracked forms:</strong><br>'
    + pinnedUrls.map((u, i) => `${u} <a href="#" data-i="${i}" style="color:#c0392b;text-decoration:none;">✕</a>`).join('<br>');
  pinnedList.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const { pinnedUrls: list = [] } = await chrome.storage.local.get('pinnedUrls');
      list.splice(Number(a.dataset.i), 1);
      await chrome.storage.local.set({ pinnedUrls: list });
      renderPinnedList();
    });
  });
}

async function checkTrackerStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => !!window.__FIS_TRACKING_STARTED,
    });
    if (result.result) {
      status.textContent = 'Auto-tracking active on this page ✓';
      status.className = 'ok';
      btn.textContent = 'Re-inject tracker';
    }
  } catch {
    // tab not injectable (e.g. chrome:// pages) — leave status empty
  }
}

pinBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { host } = new URL(tab.url);
  const { pinnedUrls = [] } = await chrome.storage.local.get('pinnedUrls');
  if (!pinnedUrls.includes(host)) {
    pinnedUrls.push(host);
    await chrome.storage.local.set({ pinnedUrls });
    status.textContent = `Auto-tracking enabled for ${host} ✓`;
  } else {
    status.textContent = `Already tracking ${host}`;
  }
  status.className = 'ok';
  renderPinnedList();
});

loadServerUrl().then(() => { checkServer(); checkTrackerStatus(); renderPinnedList(); });
