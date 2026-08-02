import assert from 'assert';

export const fieldDef = {
  action: '/adobe/forms/af/form1.json',
  items: [{
    id: 'textinput-4e4f61cad9',
    fieldType: 'text-input',
    name: 'lastName',
    visible: true,
    type: 'string',
    required: true,
    enabled: true,
    readOnly: false,
    autoComplete: 'family-name',
    default: 'Tan',
    label: {
      visible: true,
      value: 'Last Name',
    },
    events: {
      'custom:setProperty': [
        '$event.payload',
      ],
    },
    properties: {
      'fd:dor': {
        dorExclusion: false,
      },
      'fd:path': '/content/forms/af/all-in-one/jcr:content/guideContainer/textinput_1442950437',
    },
    ':type': 'forms-components-examples/components/form/textinput',
  },
  ],
};

export const extraChecks = [
  (html) => {
    const input = html.querySelector('#textinput-4e4f61cad9');
    assert.equal(input.value, 'Tan');
    assert.equal(input.getAttribute('autocomplete'), 'family-name');
  },
];

export const formPath = 'http://localhost:3000/adobe/forms/af/form1.json';
