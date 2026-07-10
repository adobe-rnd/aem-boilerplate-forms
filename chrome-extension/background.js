// Background service worker — relays fetch calls from injected content scripts.
// Injected scripts run in the page's context and are blocked by the page's CSP.
// Background workers have no such restriction and can reach localhost freely.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FIS_CAPTURE_VISIBLE_TAB') {
    const windowId = sender.tab?.windowId;
    chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 85 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true, dataUrl });
    });
    return true;
  }

  if (message.type !== 'FIS_FETCH') return false;

  const { url, body } = message;
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body,
  })
    .then((res) => sendResponse({ ok: res.ok, status: res.status }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));

  return true; // keep the message channel open for the async response
});
