// eslint-disable-next-line import/prefer-default-export
export const fieldDef = {
  submitHeaders: {
    'Content-Type': 'application/json',
    'x-adobe-routing': 'tier=undefined,bucket=undefined--undefined--undefined'
  },
  items: [{
    id: 'wen-id',
    fieldType: 'checkbox-group',
    name: 'wen',
    type: 'number[]',
    enum: [
      0,
      1,
    ],
  }],
};
