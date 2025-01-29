// eslint-disable-next-line import/prefer-default-export
export const fieldDef = {
  submitHeaders: {
    'Content-Type': 'application/json',
    'x-adobe-routing': 'tier=undefined,bucket=undefined--undefined--undefined'
  },
  items: [{
    id: 'plain-text-id',
    fieldType: 'plain-text',
    richText: true,
    value: 'The <b>script</b> should be removed.<script>alert("hello");</script> ',
  }],
};
