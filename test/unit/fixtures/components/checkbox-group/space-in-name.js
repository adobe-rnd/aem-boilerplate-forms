// eslint-disable-next-line import/prefer-default-export
export const fieldDef = {
  submitHeaders: {
    'Content-Type': 'application/json',
    'x-adobe-routing': 'tier=undefined,bucket=undefined--undefined--undefined'
  },
  items: [{
    id: 'wl-id',
    fieldType: 'checkbox-group',
    name: 'wl checkbox',
    type: 'number[]',
    enumNames: [
      'Item 1',
      'Item 2',
    ],
    enum: [
      0,
      1,
    ],
  }],
};
