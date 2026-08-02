import assert from 'assert';

import { fieldDef } from '../form/claim.js';

export const sample = fieldDef;

export function op(block) {
  const btn = block.querySelector('.wizard .field-next');
  btn.click();
}

export function expect(block) {
  const instances = block.querySelectorAll('.wizard > fieldset');
  const step1 = instances?.[0];
  assert.equal(step1?.dataset.index, 0);
  assert.equal(step1?.classList.contains('current-wizard-step'), false);
  const step2 = instances?.[1];
  assert.equal(step2?.dataset.index, 1);
  assert.equal(step2?.classList.contains('current-wizard-step'), true);
  const firstFocusableElement = step2?.querySelector('legend') || step2?.querySelector('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]');
  assert.equal(firstFocusableElement.hasFocus(), true);
}
