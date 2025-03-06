import assert from 'assert';
import { fireEvent } from '@testing-library/dom';

export const sample = {
  items: [
    {
      id: 'remove-error-message-afterfix',
      fieldType: 'text-input',
      name: 'remove-error-message-afterfix',
      visible: true,
      type: 'string',
      required: true,
      constraintMessages: {
        required: 'Value is required',
      },
    },
  ],
};

export function op(block) {
  const input = block.querySelector('#remove-error-message-afterfix');
  fireEvent.submit(input.form);
  assert.equal(input.parentElement.classList.contains('field-invalid'), true, 'field is valid');
  let errorMessage = input.parentElement.querySelector('.field-description');
  assert.equal(errorMessage.textContent, 'Value is required', 'error message is correct');
  input.value = 'abcd';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(input.parentElement.classList.contains('field-invalid'), false, 'field is invalid');
  errorMessage = input.parentElement.querySelector('.field-description');
  assert.equal(errorMessage, null, 'error message is empty');
}

export function expect(block) {

}
