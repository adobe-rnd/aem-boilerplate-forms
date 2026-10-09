/**
 * Brand Concierge Adaptive Form provider — install entry point.
 *
 * The web agent loads this module to install the provider. On evaluation it self-registers the
 * Adaptive Form provider under the id `"adaptive-form"` on the shared
 * `window.adobe.concierge.formsProviders` registry (created on demand, load-order independent).
 *
 * Framework-free JS port of the web agent's `sdk/adaptive-form/index.ts`.
 */

import { installAdaptiveFormProvider } from './adapter.js';

if (globalThis.window) {
  installAdaptiveFormProvider();
}

export { installAdaptiveFormProvider, createAdaptiveFormProvider, ADAPTIVE_FORM_PROVIDER_ID } from './adapter.js';
