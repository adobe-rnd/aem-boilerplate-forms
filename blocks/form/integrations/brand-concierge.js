/**
 * Brand Concierge Adaptive Form provider — install entry point.
 *
 * This is not an EDS block (it has no `decorate`); it lives next to `recaptcha.js` under
 * `blocks/form/integrations/` so it is versioned together with the customer's form block, not
 * in a standalone top-level block folder.
 *
 * The web agent loads this module to install the provider. On evaluation it registers the
 * Adaptive Form provider (id `"adaptive-form"`) via `window.adobe.concierge
 * .registerFormProvider`, the single function the Web Client installs on that namespace
 * (web agent PR 607). There is no registry/queue for this provider to install or duplicate.
 *
 * Framework-free JS port of the web agent's `sdk/adaptive-form/index.ts`.
 *
 * Registering this provider on a page:
 * Adaptive Forms are opt-in — the web agent does not auto-load this provider. The customer's
 * page (or the EDS block/template that embeds the Brand Concierge chat) must add this script
 * itself, for example:
 *
 *   <script type="module"
 *     src="/blocks/form/integrations/brand-concierge.js"></script>
 *
 * Load order relative to the web agent's `main.js` matters: `registerFormProvider` is only
 * available once the Web Client has run, so this script tag must be placed (or otherwise
 * evaluated) after `main.js`'s script tag, per PR 607's README. If this script runs first,
 * registration is skipped and logged instead of throwing.
 *
 * Since web agent PR 610 the Web Client actively mounts registered providers: it renders this
 * provider when a chat response contains a widget with `"widget-type": "form"` and a top-level
 * `providerId` matching this provider's id (`"adaptive-form"`), passing the AEM form definition
 * as `context.input` (sourced from the widget's `spec.input`). Chat input is re-enabled when the
 * form completes, is cancelled, errors, or fails to load.
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
