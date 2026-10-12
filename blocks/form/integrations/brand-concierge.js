/**
 * Brand Concierge Adaptive Form provider — install entry point.
 *
 * This is not an EDS block (it has no `decorate`); it lives next to `recaptcha.js` under
 * `blocks/form/integrations/` so it is versioned together with the customer's form block, not
 * in a standalone top-level block folder.
 *
 * The web agent loads this module to install the provider. On evaluation it queues the Adaptive
 * Form provider (id `"adaptive-form"`) on `window.adobe.concierge.formsProviderQueue`; the Web
 * Client owns the shared `window.adobe.concierge.formsProviders` registry and drains that queue
 * at startup, independent of load order.
 *
 * Framework-free JS port of the web agent's `sdk/adaptive-form/index.ts`.
 *
 * Registering this provider on a page:
 * Web agent PR 602 auto-loads only its built-in Meeting Booking provider — Adaptive Forms are
 * opt-in. The customer's page (or the EDS block/template that embeds the Brand Concierge chat)
 * must add this script itself, for example:
 *
 *   <script type="module"
 *     src="/blocks/form/integrations/brand-concierge.js"></script>
 *
 * Load order relative to the web agent's `main.js` does not matter: this module only pushes
 * onto `formsProviderQueue` (see above), and the Web Client drains that queue once it starts,
 * regardless of whether this script or `main.js` evaluates first. The only requirement is that
 * this script tag is present somewhere on the page before the chat needs to render an Adaptive
 * Form interaction.
 */

import { installAdaptiveFormProvider } from './brand-concierge-adapter.js';

if (globalThis.window) {
  installAdaptiveFormProvider();
}

export {
  installAdaptiveFormProvider,
  createAdaptiveFormProvider,
  ADAPTIVE_FORM_PROVIDER_ID,
} from './brand-concierge-adapter.js';
