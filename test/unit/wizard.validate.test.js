/* eslint-env mocha */
import assert from 'assert';
import { WizardLayout } from '../../blocks/form/components/wizard/wizard.js';

function makeContainer(id, { required = false, hidden = false } = {}) {
  const container = document.createElement('fieldset');
  container.id = id;
  container.dataset.id = id;
  const wrapper = document.createElement('div');
  wrapper.className = 'field-wrapper';
  if (hidden) wrapper.dataset.visible = 'false';
  const input = document.createElement('input');
  input.type = 'text';
  if (required) input.required = true;
  input.value = '';
  wrapper.appendChild(input);
  container.appendChild(wrapper);
  return container;
}

describe('WizardLayout.validateContainer — model bridge', () => {
  let wizard;

  beforeEach(() => {
    wizard = new WizardLayout();
  });

  it('calls _fieldModel.validate() when DOM checkValidity() fails', () => {
    const container = makeContainer('step1', { required: true });
    let validateCalled = false;
    container._fieldModel = { validate: () => { validateCalled = true; return Promise.resolve([]); } };

    const result = wizard.validateContainer(container);

    assert.strictEqual(result, false, 'should return false when DOM invalid');
    assert.strictEqual(validateCalled, true, 'should call _fieldModel.validate()');
  });

  it('does not call _fieldModel.validate() when all visible fields are valid', () => {
    const container = makeContainer('step1');
    // input has no required attr — checkValidity() returns true
    let validateCalled = false;
    container._fieldModel = { validate: () => { validateCalled = true; return Promise.resolve([]); } };

    const result = wizard.validateContainer(container);

    assert.strictEqual(result, true, 'should return true when DOM valid');
    assert.strictEqual(validateCalled, false, 'should not call validate() when fields pass');
  });

  it('does not crash when _fieldModel is undefined (doc-based forms)', () => {
    const container = makeContainer('step1', { required: true });
    // _fieldModel is intentionally not set — simulates doc-based form path

    assert.doesNotThrow(() => {
      const result = wizard.validateContainer(container);
      assert.strictEqual(result, false, 'should still return false from DOM validation');
    });
  });

  it('skips model validation when only hidden required fields are invalid', () => {
    const container = makeContainer('step1', { required: true, hidden: true });
    let validateCalled = false;
    container._fieldModel = { validate: () => { validateCalled = true; return Promise.resolve([]); } };

    const result = wizard.validateContainer(container);

    assert.strictEqual(result, true, 'hidden required fields should not block navigation');
    assert.strictEqual(validateCalled, false, 'should not call validate() when only hidden fields fail');
  });
});
