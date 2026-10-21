/**
 * Adaptive Form provider adapter.
 *
 * Implements the Form Provider contract shipped in web agent PR 607
 * (`src/types/FormProvider.ts` / `src/services/formProviderRegistry.ts`) on top of the AEM
 * Adaptive Forms block renderer. Framework-free JS port of the web agent's
 * `sdk/adaptive-form/adapter.ts`.
 *
 * Migration notes:
 * - `@aemforms/af-forms-block` → the in-repo `../form.js` renderer directly, so customer
 *   customizations to the block/components are picked up (not a prebuilt package copy).
 * - `@aemforms/af-forms-block/form.css?inline` → the block's own `form.css` (and component CSS,
 *   loaded lazily by the block's component decorators), scoped with an `.af-embedded` selector
 *   alongside each `main`-scoped rule so styling applies outside the page's `<main>` landmark.
 * - PR 607's `src/types/FormProvider.ts` is the source of truth for the
 *   `FormProviderEvent`/`FormProviderContext`/`FormProviderInstance` shapes this file
 *   implements; it is not copied here. The only runtime value from it this file needs — which
 *   terminal event types settle an instance — is inlined in `TERMINAL_EVENTS` below instead of
 *   keeping a separate hand-copy of the type module. (PR 602's earlier, separate
 *   `sdk/forms/contract.ts`/`sdk/forms/registry.ts` design is superseded by PR 607 and is no
 *   longer relevant here.)
 * - `../forms/registry` → not installed by this provider. PR 607 has the Web Client itself
 *   install `window.adobe.concierge.registerFormProvider`, a single function the provider calls
 *   directly; there is no registry object or queue for this provider to install or duplicate.
 */

import { loadCSS } from '../../../scripts/aem.js';
import { renderForm } from '../form.js';

import { createAdaptiveFormSubmissionObserver } from './brand-concierge-submission.js';

// Mirrors web agent PR 607's `src/types/FormProvider.ts` `FormProviderEvent` union: each of
// these fires at most once, and nothing follows it.
const TERMINAL_EVENTS = ['completed', 'cancelled', 'error'];

export const ADAPTIVE_FORM_PROVIDER_ID = 'adaptive-form';
const ADAPTIVE_FORM_PROVIDER_DESCRIPTION = 'Renders AEM Adaptive Forms inside the Brand Concierge chat.';
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
    id: ADAPTIVE_FORM_PROVIDER_ID,
    description: ADAPTIVE_FORM_PROVIDER_DESCRIPTION,
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
        // PR 607's `FormProviderInstance.onEvent` returns `void` (no per-listener unsubscribe
        // handle, unlike PR 602's earlier shape) — cleanup instead happens via `destroy()`.
        onEvent(listener) {
          if (destroyed) return;
          if (!settled) listeners.add(listener);
          notify(listener, latest);
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
 * Registers the provider with the Web Client via PR 607's `window.adobe.concierge
 * .registerFormProvider` function, which the Web Client itself installs (see `main.js` /
 * `BrandConciergeClient.ts`) — there is no registry object or queue for this provider to touch.
 *
 * Unlike the earlier queue-based design, registration here requires `registerFormProvider` to
 * already exist on `window.adobe.concierge`, i.e. this script must be loaded *after* the web
 * agent's `main.js` (see this module's header comment and PR 607's README). Registration is a
 * no-op (and logged) if that function isn't present yet.
 */
export function installAdaptiveFormProvider() {
  const provider = createAdaptiveFormProvider();
  const registerFormProvider = globalThis.adobe?.concierge?.registerFormProvider;
  if (typeof registerFormProvider !== 'function') {
    console.error('[bc-forms] window.adobe.concierge.registerFormProvider is unavailable; '
      + 'load this script after the web agent\'s main.js');
    return provider;
  }
  registerFormProvider(provider);
  return provider;
}
