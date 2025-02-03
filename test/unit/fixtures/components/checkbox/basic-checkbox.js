// eslint-disable-next-line import/prefer-default-export
export const fieldDef = {
  submitHeaders: {
    'Content-Type': 'application/json',
    'x-adobe-routing': 'tier=undefined,bucket=undefined--undefined--undefined'
  },
  items: [{
    id: 'checkbox-7b8a92de4e',
    fieldType: 'checkbox',
    name: 'subscribe',
    visible: true,
    type: 'string',
    enabled: true,
    readOnly: false,
    enforceEnum: true,
    label: {
      visible: true,
      value: 'Do you like to subscribe to activity?',
    },
    events: {
      'custom:setProperty': [
        '$event.payload',
      ],
    },
    properties: {
      'afs:layout': {
        orientation: 'horizontal',
      },
      'fd:dor': {
        dorExclusion: false,
      },
      'fd:path': '/content/forms/af/all-in-one/jcr:content/guideContainer/checkbox',
    },
    enum: [
      'on',
    ],
    ':type': 'forms-components-examples/components/form/checkbox',
  },
  ],
};
