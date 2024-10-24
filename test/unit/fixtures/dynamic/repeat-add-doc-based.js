import assert from 'assert';

import { fieldDef, bUrlMode as urlMode, formPath as fp } from '../form/enquire.js';

export const sample = fieldDef;

export const bUrlMode = urlMode;

export const formPath = fp;

export function op(block) {
  const btn = block.querySelector('.repeat-wrapper > .item-add');
  btn.click();
}

export function expect(block) {
  const instances = block.querySelectorAll('.repeat-wrapper > fieldset');
  assert.equal(instances.length, 2);
}
