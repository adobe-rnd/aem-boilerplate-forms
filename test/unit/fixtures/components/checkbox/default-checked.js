import assert from 'assert';

export const fieldDef = {
  submitHeaders: {
    'Content-Type': 'application/json',
    'x-adobe-routing': 'tier=undefined,bucket=undefined--undefined--undefined'
  },
  items: [{
    id: 'checkbox-7b8a92de4e',
    fieldType: 'checkbox',
    name: 'subscribe',
    type: 'string',
    label: {
      value: 'Do you like to subscribe to activity?',
    },
    enum: [
      'on',
      'off',
    ],
    default: 'on',
  },
  ],
};

export const extraChecks = [
  (html) => {
    assert.equal(html.querySelector('#checkbox-7b8a92de4e').checked, true);
  },
];
