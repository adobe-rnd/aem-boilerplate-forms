// eslint-disable-next-line import/prefer-default-export
export const fieldDef = {
  items: [{
    id: 'numberinput-c9a02f4cd1',
    fieldType: 'number-input',
    name: 'numberinput_13917802541727686782114',
    visible: true,
    type: 'number',
    required: false,
    enabled: true,
    readOnly: false,
    label: {
      visible: true,
      value: 'Rating',
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
    },
    ':type': 'rating',
  },
  ],
};
