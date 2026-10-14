/*
 * LLM Apps form widget: one block for every form action. Renders the form definition
 * carried by the tool result with this site's own form block (rules, validation,
 * submit). Nothing in here is specific to a form: the action's handler decides which
 * form is shown and passes its definition in `_meta.formDefinition` (widget-only, never
 * sent to the model); per-form styles and functions come from the definition itself.
 *
 * Adapts the form block to the host's sandboxed iframe (via aem-embed):
 * - the rule-engine Worker URL resolves against the iframe's document, so the Worker is
 *   turned off and the form block runs its main-thread rule engine;
 * - styles live in a shadow root.
 */
import { renderForm } from '../form/form.js';

// The block's CSS lives in the aem-embed shadow root, where `:root` matches nothing.
// Loading form.css into the document as well makes its `:root` custom properties
// inherit into the shadow tree.
function loadFormVariables() {
  const href = new URL('../form/form.css', import.meta.url).href;
  if (document.head.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

// The form block resolves its assets (component and theme CSS, rule functions) from window.hlx.codeBasePath,
// which is empty inside the host's sandboxed iframe, so they would load from the sandbox origin. Point it at
// this site. Component CSS is also added with aem.js loadCSS as a `<link>` in document.head, which cannot
// style the aem-embed shadow root the form renders in, so mirror those links into the shadow root. The head
// copy stays: component CSS declares its `:root` variables there.
const SITE = new URL('../../', import.meta.url);
const FORM_STYLES = new URL('blocks/form/', SITE).href;

function useSiteCodeBase() {
  window.hlx = window.hlx || {};
  if (!window.hlx.codeBasePath) window.hlx.codeBasePath = SITE.href.replace(/\/$/, '');
}

function mirrorFormStyles(root) {
  const adopt = (link) => {
    if (link.rel !== 'stylesheet' || !link.href.startsWith(FORM_STYLES)) return;
    if ([...root.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.href === link.href)) return;
    const copy = document.createElement('link');
    copy.rel = 'stylesheet';
    copy.href = link.href;
    root.append(copy);
  };
  document.head.querySelectorAll('link').forEach(adopt);
  new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => {
    if (n.tagName === 'LINK') adopt(n);
  }))).observe(document.head, { childList: true });
}

function message(block, text) {
  const p = document.createElement('p');
  p.className = 'form-widget-message';
  p.textContent = text;
  block.replaceChildren(p);
}

export default async function decorate(block, bridge) {
  block.textContent = '';
  if (!bridge?.isConnected || bridge.hostContext?.preview === true) {
    message(block, 'This form opens when the assistant calls the tool.');
    return;
  }

  const result = await bridge.toolResult;
  const formDefinition = result?._meta?.formDefinition;
  if (!formDefinition) {
    message(block, 'The form is not available right now.');
    return;
  }

  window.Worker = undefined;
  useSiteCodeBase();
  loadFormVariables();
  mirrorFormStyles(block.getRootNode());
  // form.css scopes every rule to `main .form`, the form block's own class.
  block.classList.add('form');
  const { form } = await renderForm(formDefinition, block);

  // The form block shows its thank-you message above the form on success. Hide the
  // form then, and tell the model (silently) so the conversation can follow up.
  new MutationObserver((_, observer) => {
    if (!block.querySelector('.form-message.success-message')) return;
    observer.disconnect();
    form.hidden = true;
    bridge.updateModelContext?.(`The user submitted the ${formDefinition.title || 'form'}.`);
  }).observe(block, { childList: true, subtree: true });

  bridge.autoResize?.(block);
}
