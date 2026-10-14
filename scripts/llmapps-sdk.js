/* eslint-disable no-underscore-dangle, max-classes-per-file, class-methods-use-this, object-curly-newline */
/**
 * LLMApps SDK — Lightweight connector for the LLM Apps protocol.
 *
 * Implements the ui/* JSON-RPC 2.0 over postMessage channel between
 * a widget (iframe) and its host (ChatGPT, Claude, VS Code, etc.).
 *
 * Zero dependencies. Works in any browser context.
 *
 * Spec:  https://modelcontextprotocol.github.io/ext-apps
 * Ref:   https://developers.openai.com/apps-sdk/reference
 *
 * ── Standard protocol ──────────────────────────────────────────
 *   ui/initialize                       → app.connect()
 *   ui/notifications/initialized        → (automatic after connect)
 *   ui/notifications/tool-result        → app.toolResult   (Promise)
 *   ui/notifications/tool-input         → app.toolInput    (Promise)
 *   ui/notifications/tool-cancelled     → app.toolCancelled (Promise)
 *   ui/notifications/tool-input-partial → app.onToolInputPartial(cb)
 *   ui/notifications/host-context-changed → app.onContextChange(cb)
 *   ui/resource-teardown                → auto-respond + destroy
 *   tools/call                          → app.callTool(name, args)
 *   resources/read                      → app.readResource(uri)
 *   notifications/message               → app.log(level, message)
 *   ui/message                          → app.sendMessage(text)
 *   ui/update-model-context             → app.updateModelContext(text)
 *   ui/open-link                        → app.openLink(url)
 *   ui/request-display-mode             → app.requestDisplayMode(mode)
 *   ui/notifications/size-changed       → app.reportSize(w, h)
 *                                         app.autoResize(target?)
 *
 * ── Host context (from ui/initialize result) ───────────────────
 *   app.hostContext          → theme, styles, locale, displayMode, ...
 *   app.hostCapabilities     → openLinks, serverTools, logging, ...
 *   app.hostInfo             → { name, version }
 *   app.applyHostStyles()    → inject CSS variables + fonts
 *   app.applyContainerDimensions() → apply sizing CSS
 *
 * ── Vendor extensions (auto-detected) ──────────────────────────
 *   app.chatgpt              → ChatGPT-only APIs (or null)
 *     .widgetState / .setWidgetState(state)
 *     .uploadFile(file) / .getFileDownloadUrl({ fileId })
 *     .requestModal(opts) / .requestClose() / .requestCheckout(opts)
 *     .setOpenInAppUrl(opts) / .view
 *     .requestConnectSheet(opts) — undocumented, ChatGPT-only
 *
 * @example
 *   import { LLMApp } from './llmapps-sdk.js';
 *
 *   const app = new LLMApp({
 *     appInfo: { name: 'ProductShowcase', version: '1.0.0' },
 *     appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
 *   });
 *   await app.connect();
 *
 *   // Host context (standard — works everywhere)
 *   console.log(app.hostContext.theme);   // 'dark'
 *   console.log(app.hostContext.locale);  // 'en-US'
 *   app.applyHostStyles();               // inject CSS variables
 *
 *   // React to context changes (standard)
 *   app.onContextChange(ctx => {
 *     document.body.dataset.theme = ctx.theme;
 *   });
 *
 *   // Tool data
 *   const result = await app.toolResult;
 *   renderUI(result.structuredContent);
 */

const PROTOCOL_VERSION = '2026-01-26';
const LOG_PREFIX = '[LLMApps]';

/**
 * Build the tool-result shape for the ChatGPT-refresh fallback path.
 * window.openai.toolResponseMetadata is NOT the same shape as _meta directly —
 * it's { call_tool_result: { content, structuredContent, isError, _meta, meta } }.
 * Confirmed against a live ChatGPT connector — do not
 * assume toolResponseMetadata IS _meta without unwrapping call_tool_result.
 */
export function _reconnectToolResult (openai) {
  if (!openai?.toolOutput) return null;
  return {
    structuredContent: openai.toolOutput,
    _meta: openai.toolResponseMetadata?.call_tool_result?._meta
  };
}

export function _extractAdobeHandles (toolResult) {
  const handles = toolResult?._meta?.adobe?.handles;
  return Array.isArray(handles) && handles.length > 0 ? handles : null;
}

export function _extractAdobeIdentityMap (toolResult) {
  return toolResult?._meta?.adobe?.identityMap ?? null;
}

export function _extractAdobeOrgId (toolResult) {
  return toolResult?._meta?.adobe?.orgId ?? null;
}

let _alloyLoadPromise = null;

function _isAlloyReady () {
  if (typeof window === 'undefined' || typeof window.alloy !== 'function') {
    return false;
  }
  const queue = window.alloy.q;
  // Standalone Alloy retains the stub queue but replaces its native push
  // method with the command executor before draining queued calls.
  return !Array.isArray(queue) || queue.push !== Array.prototype.push;
}

// Adobe Web SDK (Alloy) inlined at build time by scripts/build-alloy.cjs so this
// file is fully self-contained. This is what makes Edge work even when it's
// enabled AFTER the widget was generated: codegen always ships llmapps-sdk.js,
// so carrying Alloy inside it means there's never a separate alloy-*.min.js that
// could be missing. Empty in source; the fetch fallback below keeps an unbuilt
// checkout (dev/tests) working. Do not edit the two lines between the markers by
// hand — the build regenerates them.
/* __ALLOY_BASE_INLINE__ */
const ALLOY_BASE_INLINE = '';
/* __ALLOY_STANDALONE_INLINE__ */
const ALLOY_STANDALONE_INLINE = '';

/**
 * Lazily loads the vendored Adobe Web SDK (base-code stub + standalone bundle).
 * Prefers the build-inlined copy (self-contained, always present); falls back to
 * fetching the sibling alloy-*.min.js files when the inline is empty (unbuilt
 * checkout). Idempotent — safe to call from every widget render.
 */
export function _loadAlloyScripts ({
  baseInline = ALLOY_BASE_INLINE,
  standaloneInline = ALLOY_STANDALONE_INLINE
} = {}) {
  if (_isAlloyReady()) {
    return Promise.resolve();
  }
  if (_alloyLoadPromise) return _alloyLoadPromise;

  const loadExternalScript = (filename) => new Promise((resolve, reject) => {
    const urls = [
      new URL(`./${filename}`, import.meta.url),
      new URL(`../dist/${filename}`, import.meta.url)
    ];
    const load = (index) => {
      const script = document.createElement('script');
      script.src = urls[index].href;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        if (index + 1 < urls.length) {
          load(index + 1);
          return;
        }
        reject(new Error(`${LOG_PREFIX} failed to load ${filename}`));
      };
      document.head.appendChild(script);
    };
    load(0);
  });

  const loadExternalAlloy = () => {
    const baseReady = typeof window !== 'undefined' && typeof window.alloy === 'function';
    const loadBase = baseReady ? Promise.resolve() : loadExternalScript('alloy-base.min.js');
    return loadBase
      .then(() => loadExternalScript('alloy-standalone.min.js'))
      .then(() => {
        if (!_isAlloyReady()) {
          throw new Error(`${LOG_PREFIX} Alloy failed to initialize`);
        }
      });
  };

  let loadPromise;
  if (baseInline && standaloneInline) {
    loadPromise = Promise.resolve().then(() => {
      try {
        const base = document.createElement('script');
        base.textContent = baseInline;
        document.head.appendChild(base);
        const standalone = document.createElement('script');
        standalone.textContent = standaloneInline;
        document.head.appendChild(standalone);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`${LOG_PREFIX} inline Alloy load failed; trying external assets:`, err);
      }
      return _isAlloyReady() ? undefined : loadExternalAlloy();
    });
  } else {
    loadPromise = loadExternalAlloy();
  }

  const trackedPromise = loadPromise.finally(() => {
    if (_alloyLoadPromise === trackedPromise) {
      _alloyLoadPromise = null;
    }
  });
  _alloyLoadPromise = trackedPromise;
  return _alloyLoadPromise;
}

/**
 * Resolves the inline widget edge globals (window.LLM_APPS_EDGE_ENABLED /
 * _DATASTREAM_ID / _ORG_ID) into an `applyAdobeHandles` config, or null when
 * edge is not fully configured. Pure (no window access) so it stays
 * unit-testable; the caller reads the globals and passes them in.
 *
 * @param {{edgeEnabled?: boolean, datastreamId?: string, orgId?: string}} [source]
 * @returns {{datastreamId: string, orgId: string}|null}
 */
export function _resolveEdgeConfig (source) {
  const { edgeEnabled, datastreamId, orgId } = source || {};
  // Strict === true, not truthy: the global is emitted as a boolean, so a
  // stringified "false" (a producer regression) must not read as enabled.
  if (edgeEnabled !== true || !datastreamId || !orgId) return null;
  return { datastreamId, orgId };
}

/**
 * Builds the XDM for a single widget interaction. `web.webInteraction`
 * (linkClicks = 1) is required for the event to register as an Adobe
 * Analytics hit, not just land in the AEP dataset. Pure (takes an
 * element-like {dataset, textContent}) so it's unit-testable.
 *
 * @param {{dataset?: {analytics?: string}, textContent?: string}} el
 * @returns {object} XDM
 */
export function _buildInteractionXdm (el) {
  const raw =
    (el && el.dataset && el.dataset.analytics) ||
    (el && typeof el.textContent === 'string' ? el.textContent.trim() : '') ||
    'widget-interaction';
  const label = raw.slice(0, 100); // cap every source, not just textContent
  return {
    eventType: 'web.webinteraction.linkClicks',
    web: { webInteraction: { name: label, linkClicks: { value: 1 }, type: 'other' } }
  };
}

/**
 * Applies Adobe personalization/identity handles from the MCP tool result
 * (`_meta.adobe.handles`) via the Adobe Web SDK. Loads and configures the SDK
 * whenever `datastreamId`/`orgId` are supplied — even with no handles — so a
 * later `sendAdobeEvent` has a configured alloy to send through; only the
 * `applyResponse` step is skipped when handles are absent. No-ops when
 * `datastreamId`/`orgId` are missing — never throws into the widget's render path.
 *
 * `orgId` here is only ever the app's own imsOrgId (baked into actions.json at
 * deploy time), never verified against the datastream it's actually configured
 * to use. `_meta.adobe.orgId`, when present, is that same datastream's REAL
 * owning org, read server-side from THIS tool call's own Edge response
 * (loader.js's wrapHandlerWithEdge) -- ground truth, for free, already
 * available by the time this runs (toolResult is awaited below before
 * configure() fires). Preferred over the passed-in orgId whenever present.
 *
 * @param {LLMApp} bridge
 * @param {{ datastreamId: string, orgId: string }} config
 * @returns {Promise<object|null>}
 */
export async function applyAdobeHandles (bridge, { datastreamId, orgId } = {}) {
  if (!datastreamId || !orgId) return null;
  const result = await bridge.toolResult;
  const handles = _extractAdobeHandles(result);
  const resolvedOrgId = _extractAdobeOrgId(result) || orgId;
  try {
    await _loadAlloyScripts();
    await window.alloy('configure', { datastreamId, orgId: resolvedOrgId });
    if (!handles) return null;
    const responseBody = { handle: handles };
    const response = await window.alloy('applyResponse', { responseBody, renderDecisions: true });
    return response;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`${LOG_PREFIX} applyAdobeHandles failed:`, err);
    return null;
  }
}

/**
 * Sends a client-side analytics event to Adobe Edge Network, reusing the
 * SAME identityMap the server used (`_meta.adobe.identityMap`)
 * so client- and server-side events stitch to one identity. Never call
 * this for the widget's OWN initial tool invocation — the server already
 * sent that event; this is for POST-render interactions only.
 *
 * @param {LLMApp} bridge
 * @param {object} xdm - caller-supplied XDM fields (eventType, etc.)
 * @returns {Promise<object|null>}
 */
export async function sendAdobeEvent (bridge, xdm) {
  const result = await bridge.toolResult;
  const identityMap = _extractAdobeIdentityMap(result);
  if (!identityMap || typeof window === 'undefined' || typeof window.alloy !== 'function') return null;
  try {
    const sentXdm = { ...xdm, identityMap };
    const response = await window.alloy('sendEvent', { xdm: sentXdm });
    return response;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`${LOG_PREFIX} sendAdobeEvent failed:`, err);
    return null;
  }
}

// ---------------------------------------------------------------
// Vendor Extensions — ChatGPT  (window.openai)
//
// Only truly ChatGPT-specific APIs that have NO standard equivalent.
// ---------------------------------------------------------------

/**
 * Thin wrapper around ChatGPT's `window.openai` runtime.
 * Only exposes capabilities with no standard equivalent.
 *
 * @private — accessed via `app.chatgpt`, never instantiated directly.
 */
class ChatGPTExtensions {
  /** @param {object} api — reference to `window.openai` */
  constructor(api) {
    this._api = api;
  }

  // --- State persistence (ChatGPT-only) -----------------------

  /** Persisted UI state snapshot. */
  get widgetState() { return this._api.widgetState ?? null; }

  /** Persist a new UI state snapshot (synchronous, host persists async). */
  setWidgetState(state) { this._api.setWidgetState?.(state); }

  // --- File APIs (ChatGPT-only) -------------------------------

  /**
   * Upload a file and receive a `fileId`.
   * Supports image/png, image/jpeg, image/webp.
   * @param {File} file
   * @returns {Promise<{ fileId: string }>}
   */
  uploadFile(file) { return this._call('uploadFile', file); }

  /**
   * Get a temporary download URL for a file.
   * @param {{ fileId: string }} opts
   * @returns {Promise<{ downloadUrl: string }>}
   */
  getFileDownloadUrl(opts) { return this._call('getFileDownloadUrl', opts); }

  // --- UI Control (ChatGPT-only) ------------------------------

  /**
   * Open a host-controlled modal, optionally targeting another
   * registered template URI.
   * @param {{ template?: string, params?: object }} [opts]
   * @returns {Promise<void>}
   */
  requestModal(opts) { return this._call('requestModal', opts); }

  /** Close this widget. */
  requestClose() { this._api.requestClose?.(); }

  /**
   * Open Instant Checkout (when enabled).
   * @param {object} opts — checkout payload
   * @returns {Promise<void>}
   */
  requestCheckout(opts) { return this._call('requestCheckout', opts); }

  /**
   * Set the "Open in <App>" URL shown in fullscreen mode.
   * @param {{ href: string }} opts
   */
  setOpenInAppUrl(opts) { this._api.setOpenInAppUrl?.(opts); }

  /** Current view identifier. @returns {string|null} */
  get view() { return this._api.view ?? null; }

  /**
   * Open ChatGPT's native account-linking sheet. Undocumented (not in the
   * official Apps SDK reference) — works around a ChatGPT bug where
   * window.openai.callTool to an oauth2-scheme tool 400s.
   *
   * Don't trust the resolved value — didConnect can be true even when the
   * user declined. Re-fetch your data and read auth state from that result.
   *
   * @param {object} [opts]
   * @returns {Promise<{ didConnect?: boolean, linkId?: string }>}
   */
  requestConnectSheet(opts) { return this._call('requestConnectSheet', opts); }

  /** Whether the host actually implements requestConnectSheet (not just this wrapper method). */
  get supportsConnectSheet() { return typeof this._api.requestConnectSheet === 'function'; }

  // --- Internal -----------------------------------------------

  /** @private */
  _call(method, ...args) {
    const fn = this._api[method];
    if (!fn) {
      return Promise.reject(new Error(`chatgpt.${method} is not available`));
    }
    return fn.apply(this._api, args);
  }
}

// ---------------------------------------------------------------
// LLMApp
// ---------------------------------------------------------------
export class LLMApp {
  /**
   * @param {object} options
   * @param {{ name: string, version: string }} options.appInfo
   *   Identity sent to the host during ui/initialize.
   *
   * @param {object} [options.appCapabilities]
   *   Capabilities declared to the host during ui/initialize.
   *   @param {Array<'inline'|'fullscreen'|'pip'>} [options.appCapabilities.availableDisplayModes]
   *   @param {{ listChanged?: boolean }} [options.appCapabilities.tools]
   *   @param {object} [options.appCapabilities.experimental]
   *
   * @example
   *   const app = new LLMApp({
   *     appInfo: { name: 'ProductShowcase', version: '1.0.0' },
   *     appCapabilities: {
   *       availableDisplayModes: ['inline', 'fullscreen'],
   *     },
   *   });
   */
  constructor(options) {
    if (!options?.appInfo?.name || !options?.appInfo?.version) {
      throw new Error(`${LOG_PREFIX} appInfo.name and appInfo.version are required`);
    }
    const { appInfo, appCapabilities } = options;
    this._appInfo = { name: appInfo.name, version: appInfo.version };
    this._capabilities = appCapabilities ?? {};
    this._target = typeof window !== 'undefined' ? window.parent : null;
    this._targetOrigin = '*';

    // State
    this._rpcId = 0;
    this._pendingRequests = new Map();
    this._connected = false;
    this._destroyed = false;
    this._messageHandler = null;

    // Host data from ui/initialize result (McpUiInitializeResult)
    this._hostContext = {};
    this._hostCapabilities = {};
    this._hostInfo = {};

    // Context change observers
    this._contextChangeCallbacks = [];

    // Tool input partial streaming callbacks
    this._toolInputPartialCallbacks = [];

    // Repeat tool-result callbacks (fire on every tool-result, not just the first)
    this._toolResultCallbacks = [];

    // Auto-resize observer
    this._resizeObserver = null;
    this._resizeDebounceTimer = null;

    // One-shot promises — one per widget lifecycle
    this._toolResultResolve = null;
    /** Promise that resolves with the `ui/notifications/tool-result` params. */
    this.toolResult = new Promise((resolve) => {
      this._toolResultResolve = resolve;
    });

    this._toolInputResolve = null;
    /** Promise that resolves with the `ui/notifications/tool-input` params. */
    this.toolInput = new Promise((resolve) => {
      this._toolInputResolve = resolve;
    });

    this._toolCancelledResolve = null;
    /** Promise that resolves with `{ reason }` if the tool is cancelled. */
    this.toolCancelled = new Promise((resolve) => {
      this._toolCancelledResolve = resolve;
    });

    // Vendor extensions (lazy-initialised on first access)
    this._chatgpt = undefined;
  }

  // ---------------------------------------------------------------
  // Properties
  // ---------------------------------------------------------------

  /** Whether this code is running inside an iframe. */
  get isEmbedded() {
    return typeof window !== 'undefined' && window.parent !== window;
  }

  /** Whether the ui/initialize handshake has completed. */
  get isConnected() {
    return this._connected;
  }

  /**
   * Detected host name. Prefers hostInfo.name from the handshake,
   * falls back to environment sniffing.
   * @returns {'chatgpt'|'claude'|string|'unknown'|null}
   */
  get host() {
    if (typeof window === 'undefined') return null;
    if (this._hostInfo?.name) return this._hostInfo.name;
    if (window.openai) return 'chatgpt';
    try {
      if (window.location.origin.includes('claudemcpcontent.com')) return 'claude';
    } catch { /* cross-origin access may throw */ }
    return 'unknown';
  }

  /**
   * Host context from the ui/initialize result.
   * Contains theme, styles, locale, timeZone, displayMode,
   * availableDisplayModes, containerDimensions, platform,
   * deviceCapabilities, safeAreaInsets, userAgent, toolInfo.
   *
   * Updated live when `ui/notifications/host-context-changed` arrives.
   *
   * @returns {object}
   */
  get hostContext() {
    return this._hostContext;
  }

  /**
   * Host capabilities from the ui/initialize result.
   * Contains openLinks, serverTools, serverResources, logging, sandbox.
   * Use for feature detection before calling methods.
   *
   * @returns {object}
   */
  get hostCapabilities() {
    return this._hostCapabilities;
  }

  /**
   * Host identity from the ui/initialize result.
   * @returns {{ name?: string, version?: string }}
   */
  get hostInfo() {
    return this._hostInfo;
  }

  /**
   * ChatGPT vendor extensions (via `window.openai`).
   * Returns `null` when not running inside ChatGPT.
   * Only exposes ChatGPT-specific APIs with no standard equivalent.
   *
   * @returns {ChatGPTExtensions|null}
   */
  get chatgpt() {
    if (this._chatgpt === undefined) {
      const api = typeof window !== 'undefined' ? window.openai : null;
      this._chatgpt = api ? new ChatGPTExtensions(api) : null;
    }
    return this._chatgpt;
  }

  // ---------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------

  /**
   * Connect to the host — starts listening and performs the ui/initialize
   * handshake. Parses the McpUiInitializeResult into hostContext,
   * hostCapabilities, and hostInfo.
   *
   * Safe to call when not embedded (returns immediately, isConnected = false).
   *
   * @returns {Promise<LLMApp>} this instance (for chaining)
   */
  async connect() {
    if (this._destroyed) throw new Error(`${LOG_PREFIX} SDK instance is destroyed`);

    this._startListening();

    if (!this.isEmbedded) {
      // eslint-disable-next-line no-console
      console.log(`${LOG_PREFIX} Not in iframe — running in standalone mode`);
      return this;
    }

    try {
      const result = await this.request('ui/initialize', {
        appInfo: this._appInfo,
        appCapabilities: this._capabilities,
        protocolVersion: PROTOCOL_VERSION,
      });

      // Parse McpUiInitializeResult
      this._hostContext = result?.hostContext ?? {};
      this._hostCapabilities = result?.hostCapabilities ?? {};
      this._hostInfo = result?.hostInfo ?? {};

      this.notify('ui/notifications/initialized', {});
      this._connected = true;
      // eslint-disable-next-line no-console
      console.log(`${LOG_PREFIX} Connected (host: ${this.host})`);

      // ChatGPT: on page refresh, tool-result notification is not re-sent,
      // but data is available synchronously on window.openai.toolOutput.
      // Resolve toolResult immediately if the promise is still pending.
      if (this._toolResultResolve && typeof window !== 'undefined' && window.openai?.toolOutput) {
        // eslint-disable-next-line no-console
        console.log(`${LOG_PREFIX} Resolving toolResult from window.openai.toolOutput`);
        this._toolResultResolve(_reconnectToolResult(window.openai));
        this._toolResultResolve = null;
      }
      if (typeof window !== 'undefined' && window.openai?.toolOutput) {
        this._toolResultCallbacks.forEach((fn) => {
          try { fn({ structuredContent: window.openai.toolOutput }); } catch { /* consumer error */ }
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`${LOG_PREFIX} Handshake failed:`, err);
    }

    return this;
  }

  /** Stop listening and clean up (including vendor extensions). */
  destroy() {
    this._destroyed = true;
    this._connected = false;
    this._contextChangeCallbacks = [];
    this._toolInputPartialCallbacks = [];
    this._toolResultCallbacks = [];
    clearTimeout(this._resizeDebounceTimer);
    this._resizeDebounceTimer = null;
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._messageHandler && typeof window !== 'undefined') {
      window.removeEventListener('message', this._messageHandler);
      this._messageHandler = null;
    }
    this._pendingRequests.forEach(({ reject }) => reject(new Error('SDK instance destroyed')));
    this._pendingRequests.clear();
  }

  // ---------------------------------------------------------------
  // Actions — sending to host (standard protocol)
  // ---------------------------------------------------------------

  /**
   * Call a tool from the UI.
   * @param {string} name - Tool name
   * @param {Object} [args] - Tool arguments
   * @returns {Promise<Object>} Tool result { content, structuredContent }
   */
  async callTool(name, args = {}) {
    return this.request('tools/call', { name, arguments: args });
  }

  /**
   * Post a follow-up message in the conversation.
   * Note: spec shows content as a single ContentBlock, but hosts
   * (ChatGPT) validate it as an array. Using array for compatibility.
   * @param {string} text - Message text
   * @returns {Promise<Object>} Host response
   */
  async sendMessage(text) {
    return this.request('ui/message', {
      role: 'user',
      content: [{ type: 'text', text }],
    });
  }

  /**
   * Update model-visible context from the UI.
   * @param {string} text - Context description
   * @returns {Promise<Object>} Host response
   */
  async updateModelContext(text) {
    return this.request('ui/update-model-context', {
      content: [{ type: 'text', text }],
    });
  }

  /**
   * Open an external link via the host. The host may show a confirmation.
   *
   * @param {string} url - URL to open
   * @returns {Promise<Object>} Host response
   */
  async openLink(url) {
    return this.request('ui/open-link', { url });
  }

  /**
   * Request a display mode change (inline, fullscreen, pip).
   *
   * @param {'inline'|'fullscreen'|'pip'} mode
   * @returns {Promise<{ mode: string }>} Actual mode set by the host
   */
  async requestDisplayMode(mode) {
    return this.request('ui/request-display-mode', { mode });
  }

  /**
   * Report the widget's current size to the host.
   *
   * @param {number} width - Viewport width in pixels
   * @param {number} height - Viewport height in pixels
   */
  reportSize(width, height) {
    this.notify('ui/notifications/size-changed', { width, height });
    // ChatGPT-specific: also call the vendor API directly
    if (typeof window !== 'undefined') {
      try { window.openai?.notifyIntrinsicHeight?.(height); } catch (_) { /* gated in dev mode */ }
    }
  }

  /**
   * Read a resource from the MCP server (proxied through the host).
   *
   * @param {string} uri - Resource URI (e.g. 'ui://my-server/config')
   * @returns {Promise<Object>} Resource contents { contents: [...] }
   */
  async readResource(uri) {
    return this.request('resources/read', { uri });
  }

  /**
   * Send a log message to the host.
   * Requires `app.hostCapabilities.logging` to be present.
   *
   * @param {'debug'|'info'|'warning'|'error'} level - Log level
   * @param {string} message - Log message
   */
  log(level, message) {
    this.notify('notifications/message', {
      level,
      data: message,
    });
  }

  /**
   * Start automatic size reporting via ResizeObserver.
   * Observes the target element and sends `ui/notifications/size-changed`
   * whenever its dimensions change (debounced to 150ms).
   *
   * @param {HTMLElement} [target=document.body] - Element to observe
   * @returns {function} stop - call to disconnect the observer
   */
  autoResize(target) {
    if (typeof ResizeObserver === 'undefined') return () => {};

    const el = target || (typeof document !== 'undefined' ? document.body : null);
    if (!el) return () => {};

    // Disconnect any previous observer
    clearTimeout(this._resizeDebounceTimer);
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }

    let lastW = 0;
    let lastH = 0;

    this._resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      clearTimeout(this._resizeDebounceTimer);
      this._resizeDebounceTimer = setTimeout(() => {
        if (!this._destroyed) this.reportSize(w, h);
      }, 150);
    });

    this._resizeObserver.observe(el);

    return () => {
      clearTimeout(this._resizeDebounceTimer);
      this._resizeDebounceTimer = null;
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }
    };
  }

  // ---------------------------------------------------------------
  // Context observation
  // ---------------------------------------------------------------

  /**
   * Register a callback for host context changes (theme, displayMode,
   * locale, containerDimensions, etc.). Fires when the host sends
   * `ui/notifications/host-context-changed`.
   *
   * The callback receives the merged (full) hostContext after the update.
   *
   * @param {function} callback — receives the updated hostContext
   * @returns {function} unsubscribe — call it to stop listening
   *
   * @example
   *   const stop = app.onContextChange(ctx => {
   *     document.body.dataset.theme = ctx.theme;
   *     if (ctx.displayMode === 'fullscreen') showExpandedLayout();
   *   });
   *   // later: stop();
   */
  onContextChange(callback) {
    this._contextChangeCallbacks.push(callback);
    return () => {
      this._contextChangeCallbacks = this._contextChangeCallbacks
        .filter((fn) => fn !== callback);
    };
  }

  /**
   * Register a callback for streaming tool input arguments.
   * Fires on each `ui/notifications/tool-input-partial` notification
   * sent by the host while the agent is still streaming arguments.
   *
   * The callback receives the best-effort recovered arguments object.
   * Returns an unsubscribe function.
   *
   * @param {function} callback — receives partial { arguments } params
   * @returns {function} unsubscribe
   *
   * @example
   *   const stop = app.onToolInputPartial((params) => {
   *     if (params.arguments?.title) showTitle(params.arguments.title);
   *   });
   */
  onToolInputPartial(callback) {
    this._toolInputPartialCallbacks.push(callback);
    return () => {
      this._toolInputPartialCallbacks = this._toolInputPartialCallbacks
        .filter((fn) => fn !== callback);
    };
  }

  /**
   * Register a callback for every `ui/notifications/tool-result` the host
   * sends for this widget instance, not just the first. Use this instead of
   * the one-shot `toolResult` Promise for a widget that stays mounted across
   * multiple tool calls (e.g. pinned in `pip`) and needs to re-render each
   * time fresh structuredContent arrives, per
   * https://developers.openai.com/apps-sdk/build/state-management.
   *
   * @param {function} callback — receives the `ui/notifications/tool-result` params
   * @returns {function} unsubscribe
   *
   * @example
   *   const stop = app.onToolResult((result) => renderCart(block, result.structuredContent, app));
   */
  onToolResult(callback) {
    this._toolResultCallbacks.push(callback);
    return () => {
      this._toolResultCallbacks = this._toolResultCallbacks
        .filter((fn) => fn !== callback);
    };
  }

  // ---------------------------------------------------------------
  // Host style helpers
  // ---------------------------------------------------------------

  /**
   * Apply host-provided CSS variables and fonts to the document.
   * Reads `hostContext.styles.variables` and sets each as a CSS
   * custom property. Also injects font CSS and sets `color-scheme`.
   *
   * @param {HTMLElement} [target=document.documentElement] — element
   *   to apply CSS variables to
   */
  applyHostStyles(target) {
    const el = target || (typeof document !== 'undefined' ? document.documentElement : null);
    if (!el) return;

    const { styles, theme } = this._hostContext;

    // Apply CSS variables
    if (styles?.variables) {
      Object.entries(styles.variables).forEach(([key, value]) => {
        if (value != null) el.style.setProperty(key, value);
      });
    }

    // Set color-scheme for light-dark() CSS function support
    if (theme) {
      el.style.setProperty('color-scheme', theme === 'dark' ? 'dark' : 'light');
    }

    // Inject font CSS
    if (styles?.css?.fonts && typeof document !== 'undefined') {
      const existing = document.getElementById('llmapps-host-fonts');
      if (!existing) {
        const style = document.createElement('style');
        style.id = 'llmapps-host-fonts';
        style.textContent = styles.css.fonts;
        document.head.appendChild(style);
      }
    }
  }

  /**
   * Apply host-provided container dimensions as CSS on the target element.
   * Handles fixed vs flexible sizing per the spec.
   *
   * @param {HTMLElement} [target=document.documentElement]
   */
  applyContainerDimensions(target) {
    const el = target || (typeof document !== 'undefined' ? document.documentElement : null);
    if (!el) return;

    const dims = this._hostContext.containerDimensions;
    if (!dims) return;

    // Height: fixed or flexible
    if ('height' in dims) {
      el.style.height = '100vh';
    } else if ('maxHeight' in dims && dims.maxHeight) {
      el.style.maxHeight = `${dims.maxHeight}px`;
    }

    // Width: fixed or flexible
    if ('width' in dims) {
      el.style.width = '100vw';
    } else if ('maxWidth' in dims && dims.maxWidth) {
      el.style.maxWidth = `${dims.maxWidth}px`;
    }
  }

  // ---------------------------------------------------------------
  // Low-level JSON-RPC
  // ---------------------------------------------------------------

  /**
   * Send a JSON-RPC request (has id, expects response).
   * @param {string} method
   * @param {Object} [params]
   * @returns {Promise<any>} result
   */
  request(method, params, { timeout = 30000 } = {}) {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line no-plusplus
      const id = ++this._rpcId;

      let timer = null;
      if (timeout > 0) {
        timer = setTimeout(() => {
          this._pendingRequests.delete(id);
          reject(new Error(`${LOG_PREFIX} Request timed out: ${method} (${timeout}ms)`));
        }, timeout);
      }

      this._pendingRequests.set(id, {
        resolve: (result) => { clearTimeout(timer); resolve(result); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });
      this._send({ jsonrpc: '2.0', id, method, params });
    });
  }

  /**
   * Send a JSON-RPC notification (no id, fire-and-forget).
   * @param {string} method
   * @param {Object} [params]
   */
  notify(method, params) {
    this._send({ jsonrpc: '2.0', method, params });
  }

  // ---------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------

  _send(message) {
    if (!this._target) return;
    this._target.postMessage(message, this._targetOrigin);
  }

  _startListening() {
    if (this._messageHandler || typeof window === 'undefined') return;

    this._messageHandler = (event) => {
      if (this._target && event.source !== this._target) return;

      const msg = event.data;
      if (!msg || msg.jsonrpc !== '2.0') return;

      // --- JSON-RPC responses (to our requests) ---
      if (typeof msg.id === 'number' || typeof msg.id === 'string') {
        // Check if this is a request FROM the host (has method + id)
        if (typeof msg.method === 'string') {
          this._handleHostRequest(msg);
          return;
        }
        const pending = this._pendingRequests.get(msg.id);
        if (!pending) return;
        this._pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(msg.error);
        } else {
          pending.resolve(msg.result);
        }
        return;
      }

      // --- JSON-RPC notifications from the host ---
      if (typeof msg.method !== 'string') return;

      if (msg.method === 'ui/notifications/tool-result') {
        // eslint-disable-next-line no-console
        console.log(`${LOG_PREFIX} tool-result received`);
        if (this._toolResultResolve) {
          this._toolResultResolve(msg.params);
          this._toolResultResolve = null;
        }
        this._toolResultCallbacks.forEach((fn) => {
          try { fn(msg.params); } catch { /* consumer error */ }
        });
      }

      if (msg.method === 'ui/notifications/tool-input') {
        // eslint-disable-next-line no-console
        console.log(`${LOG_PREFIX} tool-input received`);
        if (this._toolInputResolve) {
          this._toolInputResolve(msg.params);
          this._toolInputResolve = null;
        }
      }

      if (msg.method === 'ui/notifications/tool-input-partial') {
        this._toolInputPartialCallbacks.forEach((fn) => {
          try { fn(msg.params); } catch { /* consumer error */ }
        });
      }

      if (msg.method === 'ui/notifications/tool-cancelled') {
        // eslint-disable-next-line no-console
        console.log(`${LOG_PREFIX} tool-cancelled received`);
        if (this._toolCancelledResolve) {
          this._toolCancelledResolve(msg.params);
          this._toolCancelledResolve = null;
        }
      }

      if (msg.method === 'ui/notifications/host-context-changed') {
        if (msg.params && typeof msg.params === 'object') {
          // Skip if the incoming context is identical to what we already have
          const dominated = Object.keys(msg.params).every(
            (k) => JSON.stringify(this._hostContext[k]) === JSON.stringify(msg.params[k]),
          );
          if (dominated) return;

          // eslint-disable-next-line no-console
          console.log(`${LOG_PREFIX} host-context-changed received`);
          Object.assign(this._hostContext, msg.params);
        }
        this._contextChangeCallbacks.forEach((fn) => {
          try { fn(this._hostContext); } catch { /* consumer error */ }
        });
      }
    };

    window.addEventListener('message', this._messageHandler, { passive: true });
  }

  /**
   * Handle JSON-RPC requests FROM the host (messages with both id and method).
   * @private
   */
  _handleHostRequest(msg) {
    // ui/resource-teardown — host is about to destroy this widget
    if (msg.method === 'ui/resource-teardown') {
      // eslint-disable-next-line no-console
      console.log(`${LOG_PREFIX} resource-teardown received (reason: ${msg.params?.reason})`);
      // Respond to acknowledge
      this._send({ jsonrpc: '2.0', id: msg.id, result: {} });
      // Clean up
      this.destroy();
    }
  }
}

// ---------------------------------------------------------------
// Factory (convenience for one-liner setup)
// ---------------------------------------------------------------

/**
 * Create and connect an app in one call.
 *
 * @param {object} options — same options as `new LLMApp(options)`
 *
 * @example
 *   const app = await createApp({
 *     appInfo: { name: 'MyApp', version: '1.0.0' },
 *     appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
 *   });
 *   const result = await app.toolResult;
 *
 * @returns {Promise<LLMApp>}
 */
export async function createApp(options) {
  const app = new LLMApp(options);
  await app.connect();
  return app;
}

export default LLMApp;
