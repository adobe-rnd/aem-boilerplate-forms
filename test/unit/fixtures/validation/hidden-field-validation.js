import assert from 'assert';
import { fireEvent } from '@testing-library/dom';
import nock from 'nock';

const scope = nock('http://localhost:3000')
  .post('/submit')
  .reply(200, {
    thankYouMessage: 'Thank you for your submission',
  });

export const sample = {
  action: 'http://localhost:3000/submit',
  items: [
    {
      id: 'hidden-field-validation',
      fieldType: 'text-input',
      name: 'hidden-field-validation',
      visible: false,
      type: 'string',
      required: true,
      constraintMessages: {
        required: 'Value is required',
      },
    },
    {
      fieldType: 'button',
      id: 'button',
      events: {
        click: 'submitForm()',
      },
    },
  ],
};

export function op(block) {
  const btn = block.querySelector('button');
  btn.click();
}

export function expect(block) {
  assert.equal(scope.isDone(), true, 'submit call was made');
}

export const opDelay = 200;
