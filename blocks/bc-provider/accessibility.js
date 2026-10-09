/**
 * Accessibility adapters for the rendered Adaptive Form.
 *
 * Preserve rule-driven visibility and surface validation state without changing the form model
 * or its rules. Framework-free JS port of the web agent's `sdk/adaptive-form/accessibility.ts`.
 */

/** Preserve rule-driven visibility without relying on the package's global CSS. */
export function observeAdaptiveFormVisibility(root) {
  const synchronize = () => {
    root.querySelectorAll('[data-visible]').forEach((element) => {
      element.hidden = element.dataset.visible === 'false';
    });
  };
  synchronize();
  const observer = new MutationObserver(synchronize);
  observer.observe(root, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['data-visible'],
  });
  return () => {
    observer.disconnect();
  };
}

/** Adapt package error markers without changing the form model or its rules. */
export function observeAdaptiveFormValidation(root, form) {
  const summary = document.createElement('p');
  summary.className = 'bc-adaptive-form-validation-summary';
  summary.setAttribute('role', 'status');
  summary.setAttribute('aria-live', 'polite');
  summary.setAttribute('aria-atomic', 'true');
  summary.hidden = true;
  root.prepend(summary);
  const descriptions = new Map();
  let active = true;
  let focusTimer;

  const synchronize = () => {
    const invalid = [];
    form.querySelectorAll('input, select, textarea').forEach((control) => {
      const wrapper = control.closest('.field-wrapper');
      if (!wrapper || control.type === 'hidden') return;
      const visible = !control.closest('[hidden]') && !control.disabled;
      const hasError = visible && wrapper.classList.contains('field-invalid');
      control.setAttribute('aria-invalid', String(hasError));
      // Group requiredness is owned by the renderer, not each individual checkbox.
      if (!control.closest('.checkbox-group-wrapper, .radio-group-wrapper')) {
        control.required = wrapper.dataset.required === '' || wrapper.dataset.required === 'true';
      }
      const description = wrapper.querySelector(':scope > .field-description');
      const ids = new Set((control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
      const previous = descriptions.get(control);
      if (previous) ids.delete(previous);
      if (description?.id) {
        ids.add(description.id);
        descriptions.set(control, description.id);
      } else {
        descriptions.delete(control);
      }
      if (ids.size) control.setAttribute('aria-describedby', [...ids].join(' '));
      else control.removeAttribute('aria-describedby');
      if (hasError) invalid.push(control);
    });
    const message = invalid.length ? 'Please correct the highlighted fields before submitting.' : '';
    if (summary.textContent !== message) summary.textContent = message;
    summary.hidden = !invalid.length;
    return invalid;
  };
  const queueFocus = () => {
    if (focusTimer !== undefined) return;
    // Browser microtasks can run between listeners, before model validation.
    focusTimer = setTimeout(() => {
      focusTimer = undefined;
      if (active) synchronize()[0]?.focus();
    }, 0);
  };
  const onSubmitterInteraction = (event) => {
    const path = event.composedPath();
    if ([...form.querySelectorAll('button[type="submit"], input[type="submit"]')].some((button) => path.includes(button))) queueFocus();
  };
  synchronize();
  const observer = new MutationObserver(() => {
    synchronize();
  });
  observer.observe(form, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'data-required', 'data-visible', 'disabled'],
  });
  // Blur errors can shift the button before the click lands.
  form.addEventListener('pointerdown', onSubmitterInteraction, true);
  form.addEventListener('click', onSubmitterInteraction, true);
  form.addEventListener('submit', queueFocus, true);
  return () => {
    active = false;
    clearTimeout(focusTimer);
    observer.disconnect();
    form.removeEventListener('pointerdown', onSubmitterInteraction, true);
    form.removeEventListener('click', onSubmitterInteraction, true);
    form.removeEventListener('submit', queueFocus, true);
    descriptions.clear();
  };
}
