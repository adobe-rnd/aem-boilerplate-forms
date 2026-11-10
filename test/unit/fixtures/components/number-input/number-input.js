import assert from 'assert';

// eslint-disable-next-line import/prefer-default-export
export const fieldDef = {
  items: [{
    id: 'numberinput-40db827550',
    fieldType: 'number-input',
    name: 'zipcode',
    visible: true,
    type: 'integer',
    required: false,
    enabled: true,
    readOnly: false,
    autoComplete: 'postal-code',
    placeholder: '50065',
    default: 0,
    label: {
      visible: true,
      value: 'Zip Code',
    },
    events: {
      'custom:setProperty': [
        '$event.payload',
      ],
    },
    properties: {
      'afs:layout': {
        tooltipVisible: false,
      },
      'fd:dor': {
        dorExclusion: false,
      },
      'fd:path': '/content/forms/af/all-in-one/jcr:content/guideContainer/numberinput',
    },
    ':type': 'forms-components-examples/components/form/numberinput',
  },
  ],
};

export const extraChecks = [
  (html) => {
    const input = html.querySelector('#numberinput-40db827550');
    assert.equal(input.getAttribute('autocomplete'), 'postal-code');
  },
];