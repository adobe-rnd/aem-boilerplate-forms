import assert from 'assert';

import { fieldDef } from '../form/claim.js';

export const sample = fieldDef;

export function op(block) {
  const btn = block.querySelector('.wizard .field-next');
  btn.click();
}

export function expect(block) {
  const tabs = block.querySelectorAll('.wizard > ul');
  const tab1 = instances?.[0];
  assert.equal(tab1?.classList.contains('wizard-menu-item--complete'), true);
  const tab2 = instances?.[1];
  assert.equal(tab2?.classList.contains('wizard-menu-item--complete'), false);

  const instances = block.querySelectorAll('.wizard > fieldset');
  const step1 = instances?.[0];
  assert.equal(step1?.dataset.index, 0);
  assert.equal(step1?.classList.contains('current-wizard-step'), false);
  const step2 = instances?.[1];
  assert.equal(step2?.dataset.index, 1);
  assert.equal(step2?.classList.contains('current-wizard-step'), true);
}
