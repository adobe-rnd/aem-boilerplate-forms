// eslint-disable-next-line import/prefer-default-export
export const fieldDef = {
  submitHeaders: {
    'Content-Type': 'application/json',
    'x-adobe-routing': 'tier=undefined,bucket=undefined--undefined--undefined'
  },
  items: [{
    id: 'dropdown-c6f396a9b8',
    fieldType: 'drop-down',
    name: 'country',
    visible: false,
    type: 'string',
    enabled: true,
    readOnly: false,
    enforceEnum: true,
    enumNames: [
      'India',
      'United States',
    ],
    label: {
      visible: true,
      value: 'Country',
    },
    enum: [
      'IN',
      'US',
    ],
    ':type': 'forms-components-examples/components/form/dropdown',
  },
  ],
};
