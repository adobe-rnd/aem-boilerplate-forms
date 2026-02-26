/* eslint-env mocha */
/**
 * Unit test for validation message handling in rules/index.js fieldChanged.
 * Tests the actual fieldChanged implementation with a real form DOM.
 */
import assert from 'assert';
import { fieldChanged } from '../../blocks/form/rules/index.js';

function makeFormWithField(fieldId = 'email') {
  const form = document.createElement('form');
  const wrapper = document.createElement('div');
  wrapper.className = 'field-wrapper';
  const input = document.createElement('input');
  input.id = fieldId;
  input.name = fieldId;
  input.type = 'text';
  wrapper.append(input);
  form.append(wrapper);
  return { form, input, wrapper };
}

describe('Validation Message Display', () => {
  it('fieldChanged sets and clears validation message on the field from model payload', async () => {
    const { form, input, wrapper } = makeFormWithField('email');
    const noop = () => {};

    const payloadShow = {
      field: {
        id: 'email',
        fieldType: 'text-input',
        validity: { valid: false, valueMissing: true },
      },
      changes: [
        { propertyName: 'validationMessage', currentValue: 'This field is required' },
      ],
    };

    await fieldChanged(payloadShow, form, noop);

    assert.strictEqual(input.validationMessage, 'This field is required');
    assert.ok(wrapper.classList.contains('field-invalid'));
    const desc = wrapper.querySelector('.field-description');
    assert.ok(desc);
    assert.strictEqual(desc.textContent, 'This field is required');

    const payloadClear = {
      field: {
        id: 'email',
        fieldType: 'text-input',
        validity: { valid: true },
      },
      changes: [
        { propertyName: 'validationMessage', currentValue: '' },
      ],
    };

    await fieldChanged(payloadClear, form, noop);

    assert.strictEqual(input.validationMessage, '');
    assert.ok(!wrapper.classList.contains('field-invalid'));
  });
});
