/**
 * Adaptive Form submission outcome observer.
 *
 * Observes native submit outcomes without intercepting submission or owning its request.
 * Framework-free JS port of the web agent's `sdk/adaptive-form/submission.ts`.
 *
 * @typedef {import("./forms-contract.js").FormProviderEvent} FormProviderEvent
 *
 * @typedef {Object} AdaptiveFormSubmissionObserver
 * @property {(event: object) => void} success
 * @property {(event: object) => void} failure
 * @property {() => void} destroy
 */

/**
 * @param {HTMLElement} root
 * @param {object} input Validated Adaptive Form definition.
 * @param {{ emit: (event: FormProviderEvent) => void, report: (code: string) => void }} callbacks
 * @returns {AdaptiveFormSubmissionObserver}
 */
export function createAdaptiveFormSubmissionObserver(root, input, callbacks) {
  const feedback = document.createElement('p');
  feedback.setAttribute('role', 'alert');
  feedback.hidden = true;
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  root.append(feedback, cancel);
  let stopped = false;

  const finish = (type, message) => {
    if (stopped) return;
    stopped = true;
    const outcome = document.createElement('p');
    outcome.setAttribute('role', 'status');
    outcome.textContent = message;
    root.replaceChildren(outcome);
    callbacks.emit({ type });
  };
  const onCancel = () => finish('cancelled', 'Form closed. Any submission already sent may still complete.');
  cancel.addEventListener('click', onCancel);

  return {
    success(event) {
      if (stopped) return;
      const { payload } = event;
      const body = typeof payload === 'object' && payload !== null && 'body' in payload ? payload.body : undefined;
      const message = typeof body === 'object' && body !== null && 'thankYouMessage' in body ? body.thankYouMessage : undefined;
      finish('completed', input.thankYouMsg?.trim()
        || (typeof message === 'string' && message.trim() ? message : 'Thank you for your submission.'));
    },
    failure(event) {
      if (stopped) return;
      feedback.hidden = false;
      feedback.textContent = "We couldn't submit this form. Please review your answers and try again.";
      callbacks.report(event.type === 'submitError' ? 'ADAPTIVE_FORM_NATIVE_SUBMIT_ERROR' : 'ADAPTIVE_FORM_NATIVE_SUBMIT_FAILURE');
      callbacks.emit({ type: 'in-progress', phase: 'submission-failed' });
    },
    destroy() {
      stopped = true;
      cancel.removeEventListener('click', onCancel);
    },
  };
}
