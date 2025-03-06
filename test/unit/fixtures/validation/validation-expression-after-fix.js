import assert from 'assert';
import { fireEvent } from '@testing-library/dom';

export const sample = {
  items: [
    {
      id: 'tb1',
      fieldType: 'text-input',
      name: 'tb1',
      visible: true,
      type: 'string',
      validationExpression: "$value != 'test'",
      required: true,
      constraintMessages: {
        validationExpression: 'Value must not be "test"',
        required: 'Value is required',
      },
    },
  ],
};

function testValidation(input, msg) {
  assert.equal(input.parentElement.classList.contains('field-invalid'), msg !== '', 'field is valid');
  const errorMessage = input.parentElement.querySelector('.field-description');
  assert.equal(errorMessage?.textContent, msg === '' ? null : msg, 'error message is correct');
}

/**
 * 1. set value causing validation expression to fail
 * 2. set value causing validation to pass
 * 3. set value causing no validation to fail
 * @param {*} block
 */
export function op(block) {
  const input = block.querySelector('input[name="tb1"]');
  input.value = 'test';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  testValidation(input, 'Value must not be "test"');

  input.value = 'test1';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  testValidation(input, '');

  input.value = 'test2';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  testValidation(input, '');
}

export function expect(block) {

}
