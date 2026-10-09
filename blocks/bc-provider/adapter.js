/**
 * Adaptive Form provider adapter.
 *
 * Implements the generic Form Provider contract on top of the AEM Adaptive Forms block renderer.
 * Framework-free JS port of the web agent's `sdk/adaptive-form/adapter.ts`.
 *
 * Migration notes:
 * - `@aemforms/af-forms-block` → the in-repo built bundle at
 *   `../../packages/aem-forms-block/dist/form.js` (same renderer the npm package wraps).
 * - `@aemforms/af-forms-block/form.css?inline` → fetched at runtime via
 *   `loadScopedAdaptiveFormStyles`.
 * - `../forms/contract` and `../forms/registry` → the sibling `forms-contract.js` /
 *   `forms-registry.js` copies that travel with the provider.
 */

import { renderForm } from '../../packages/aem-forms-block/dist/form.js';

import { isTerminalEvent } from './forms-contract.js';
import { ensureFormProviderRegistry } from './forms-registry.js';

import { observeAdaptiveFormValidation, observeAdaptiveFormVisibility } from './accessibility.js';
import { AdaptiveFormInputError, validateAdaptiveFormInput } from './input.js';
import { loadScopedAdaptiveFormStyles } from './styles.js';
import { createAdaptiveFormSubmissionObserver } from './submission.js';

export const ADAPTIVE_FORM_PROVIDER_ID = 'adaptive-form';
const PROVIDER_CLASS = 'bc-adaptive-form-provider';
const PROVIDER_SCOPE = `.${PROVIDER_CLASS}`;
const UNAVAILABLE_MESSAGE = 'This form is currently unavailable. Please try again later.';

export function createAdaptiveFormProvider() {
  return {
    name: ADAPTIVE_FORM_PROVIDER_ID,
    render(mount, context) {
      const root = document.createElement('div');
      root.className = PROVIDER_CLASS;
      mount.appendChild(root);
      // The package stylesheet is scoped under `main .form …`; inject the provider-scoped
      // copy and recreate the `.form` wrapper so the vendor CSS applies to the rendered form.
      const style = document.createElement('style');
      root.appendChild(style);
      const formHost = document.createElement('div');
      formHost.className = 'form';
      root.appendChild(formHost);
      // Async package rendering stays detached until this instance is still live.
      const staging = document.createElement('div');
      const listeners = new Set();
      const subscriptions = [];
      let latest = { type: 'in-progress', phase: 'initializing' };
      let destroyed = false;
      let settled = false;
      let stopObserving = () => undefined;
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
        if (isTerminalEvent(event)) {
          settled = true;
          root.removeEventListener('input', progress);
          stopObserving();
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
        if (latest.type !== 'submitted') emit({ type: 'in-progress', phase: 'form' });
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
          stopObserving();
          submission?.destroy();
          releaseSubscriptions();
          root.remove();
          staging.replaceChildren();
        },
      };

      const initialize = async () => {
        try {
          const input = validateAdaptiveFormInput(context.input);
          const [scopedStyles, result] = await Promise.all([
            loadScopedAdaptiveFormStyles(PROVIDER_SCOPE),
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
          style.textContent = scopedStyles;
          result.form.lang = context.locale ?? input.lang ?? '';
          if (input.title && !result.form.hasAttribute('aria-label') && !result.form.hasAttribute('aria-labelledby')) {
            result.form.setAttribute('aria-label', input.title);
          }
          formHost.append(...staging.childNodes);
          const stopVisibility = observeAdaptiveFormVisibility(root);
          const stopValidation = observeAdaptiveFormValidation(formHost, result.form);
          stopObserving = () => {
            stopVisibility();
            stopValidation();
          };
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
        } catch (error) {
          if (destroyed) {
            staging.replaceChildren();
            return;
          }
          staging.replaceChildren();
          fail(error instanceof AdaptiveFormInputError ? error.code : 'ADAPTIVE_FORM_INITIALIZATION_FAILED');
        }
      };
      initialize();
      return instance;
    },
  };
}

export function installAdaptiveFormProvider() {
  return ensureFormProviderRegistry(globalThis).register(createAdaptiveFormProvider());
}
