/**
 * Adaptive Form provider adapter.
 *
 * Implements the generic Form Provider contract on top of the AEM Adaptive Forms block renderer.
 * Framework-free JS port of the web agent's `sdk/adaptive-form/adapter.ts`.
 *
 * Migration notes:
 * - `@aemforms/af-forms-block` → the in-repo `../form.js` renderer directly, so customer
 *   customizations to the block/components are picked up (not a prebuilt package copy).
 * - `@aemforms/af-forms-block/form.css?inline` → the block's own `form.css` (and component CSS,
 *   loaded lazily by the block's component decorators), scoped with an `.af-embedded` selector
 *   alongside each `main`-scoped rule so styling applies outside the page's `<main>` landmark.
 * - `../forms/contract` (web agent PR 602's `sdk/forms/contract.ts`, spec on the wiki) is the
 *   source of truth for the `FormProviderEvent`/`FormProviderContext`/`FormProviderInstance`
 *   shapes this file implements; it is not copied here. The only runtime value from it this
 *   file needs — which terminal event types settle an instance — is inlined in `TERMINAL_EVENTS`
 *   below instead of keeping a separate hand-copy of the contract module.
 * - `../forms/registry` → not installed by this provider. The Web Client owns the shared
 *   `window.adobe.concierge.formsProviders` registry; this provider only pushes itself onto
 *   `window.adobe.concierge.formsProviderQueue`, which the Web Client drains (in any load order)
 *   at startup. This avoids shipping a second copy of the registry implementation that could
 *   silently drift from the Web Client's.
 */

import { loadCSS } from '../../../scripts/aem.js';
import { renderForm } from '../form.js';

import { createAdaptiveFormSubmissionObserver } from './brand-concierge-submission.js';

// Mirrors web agent PR 602's `sdk/forms/contract.ts` TERMINAL_EVENT_TYPES: each of these fires
// at most once, and nothing follows it.
const TERMINAL_EVENTS = ['completed', 'cancelled', 'error'];

export const ADAPTIVE_FORM_PROVIDER_ID = 'adaptive-form';
const PROVIDER_CLASS = 'bc-adaptive-form-provider';
const EMBEDDED_CLASS = 'af-embedded';
const UNAVAILABLE_MESSAGE = 'This form is currently unavailable. Please try again later.';

/**
 * The host chat page may not run EDS's `scripts/aem.js`, which normally sets
 * `window.hlx.codeBasePath`. The form block, its components, and the rule engine worker all
 * resolve their own asset URLs through that global, so derive and provide it here from this
 * module's own URL — without clobbering a value an actual EDS page may have already set.
 */
function ensureCodeBasePath() {
  globalThis.hlx ??= {};
  globalThis.hlx.codeBasePath ??= new URL('../../..', import.meta.url).href.replace(/\/$/, '');
  return globalThis.hlx.codeBasePath;
}

export function createAdaptiveFormProvider() {
  return {
    name: ADAPTIVE_FORM_PROVIDER_ID,
    render(mount, context) {
      const root = document.createElement('div');
      root.className = `${PROVIDER_CLASS} ${EMBEDDED_CLASS}`;
      if (context.theme) {
        Object.entries(context.theme)
          .forEach(([name, value]) => root.style.setProperty(name, value));
      }
      mount.appendChild(root);
      const formHost = document.createElement('div');
      formHost.className = 'form';
      root.appendChild(formHost);
      // Async rendering stays detached until this instance is still live.
      const staging = document.createElement('div');
      const listeners = new Set();
      const subscriptions = [];
      let latest = { type: 'in-progress', phase: 'initializing' };
      let destroyed = false;
      let settled = false;
      let submission;

      const report = (code) => {
        console.error('[bc-forms] Adaptive Form provider error', { providerId: ADAPTIVE_FORM_PROVIDER_ID, code });
      };
      const releaseSubscriptions = () => {
        subscriptions.splice(0).forEach((subscription) => {
          try {
            subscription.unsubscribe();
          } catch {
            report('ADAPTIVE_FORM_UNSUBSCRIBE_ERROR');
          }
        });
      };
      const notify = (listener, event) => {
        try {
          listener(event);
        } catch {
          report('ADAPTIVE_FORM_LISTENER_ERROR');
        }
      };
      const emit = (event) => {
        if (destroyed || settled) return;
        latest = event;
        if (TERMINAL_EVENTS.includes(event.type)) {
          settled = true;
          root.removeEventListener('input', progress);
          submission?.destroy();
          releaseSubscriptions();
        }
        const snapshot = [...listeners];
        for (let i = 0; i < snapshot.length; i += 1) {
          if (destroyed || latest !== event) break;
          notify(snapshot[i], event);
        }
        if (settled) listeners.clear();
      };
      const progress = () => {
        // Only report a state change, not every keystroke.
        if (latest.type === 'submitted' || (latest.type === 'in-progress' && latest.phase === 'form')) return;
        emit({ type: 'in-progress', phase: 'form' });
      };
      const fail = (code) => {
        if (destroyed || settled) return;
        report(code);
        const message = document.createElement('p');
        message.setAttribute('role', 'alert');
        message.textContent = UNAVAILABLE_MESSAGE;
        formHost.replaceChildren(message);
        emit({ type: 'error', error: { code, message: UNAVAILABLE_MESSAGE, retryable: false } });
      };
      const instance = {
        onEvent(listener) {
          if (destroyed) return () => undefined;
          if (!settled) listeners.add(listener);
          notify(listener, latest);
          return () => {
            listeners.delete(listener);
          };
        },
        destroy() {
          if (destroyed) return;
          destroyed = true;
          listeners.clear();
          root.removeEventListener('input', progress);
          submission?.destroy();
          releaseSubscriptions();
          root.remove();
          staging.replaceChildren();
        },
      };

      const initialize = async () => {
        try {
          const { input } = context;
          const codeBasePath = ensureCodeBasePath();
          const [, result] = await Promise.all([
            loadCSS(`${codeBasePath}/blocks/form/form.css`),
            renderForm(structuredClone(input), staging),
          ]);
          if (destroyed) {
            staging.replaceChildren();
            return;
          }
          const model = result.afbForm;
          if (!model) {
            staging.replaceChildren();
            fail('ADAPTIVE_FORM_MODEL_UNAVAILABLE');
            return;
          }
          const subscribe = (type, listener) => {
            if (destroyed || settled) return;
            const subscription = model.subscribe(listener, type);
            if (destroyed || settled) subscription.unsubscribe();
            else subscriptions.push(subscription);
          };
          result.form.lang = context.locale ?? input.lang ?? '';
          if (input.title && !result.form.hasAttribute('aria-label') && !result.form.hasAttribute('aria-labelledby')) {
            result.form.setAttribute('aria-label', input.title);
          }
          formHost.append(...staging.childNodes);
          root.addEventListener('input', progress);
          submission = createAdaptiveFormSubmissionObserver(formHost, input, { emit, report });
          subscribe('scriptError', () => fail('ADAPTIVE_FORM_RULE_EXECUTION_FAILED'));
          subscribe('submitSuccess', (event) => submission?.success(event));
          subscribe('submitFailure', (event) => submission?.failure(event));
          subscribe('submitError', (event) => submission?.failure(event));
          if (destroyed || settled) {
            staging.replaceChildren();
            return;
          }
          emit({ type: 'activated' });
        } catch {
          if (destroyed) {
            staging.replaceChildren();
            return;
          }
          staging.replaceChildren();
          fail('ADAPTIVE_FORM_INITIALIZATION_FAILED');
        }
      };
      initialize();
      return instance;
    },
  };
}

/**
 * Queues the provider for the Web Client to register, instead of installing a shared registry
 * here. The Web Client owns `window.adobe.concierge.formsProviders`; this adapter is an
 * externally-loaded, deferred script, so registration order with the Web Client bundle isn't
 * guaranteed. Pushing onto a shared queue (drained by the Web Client at startup, in any order)
 * avoids this provider ever installing — and risking the Web Client running — its own copy of
 * the registry.
 */
export function installAdaptiveFormProvider() {
  const provider = createAdaptiveFormProvider();
  globalThis.adobe ??= {};
  globalThis.adobe.concierge ??= {};
  globalThis.adobe.concierge.formsProviderQueue ??= [];
  globalThis.adobe.concierge.formsProviderQueue.push(provider);
  return provider;
}
