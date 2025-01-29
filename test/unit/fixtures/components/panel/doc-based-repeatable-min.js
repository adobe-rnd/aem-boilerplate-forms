// eslint-disable-next-line import/prefer-default-export
export const fieldDef = {
  submitHeaders: {
    'Content-Type': 'application/json',
    'x-adobe-routing': 'tier=undefined,bucket=undefined--undefined--undefined'
  },
  total: 12,
  offset: 0,
  limit: 12,
  data: [{
    Name: 'doc-traveler', Type: 'fieldset', Description: '', Placeholder: '', Label: 'Traveler Info', 'Read Only': '', Mandatory: '', Pattern: '', Step: '', Min: '2', Max: '3', Value: '', Options: '', OptionNames: '', Fieldset: '', Repeatable: 'true',
  }, {
    Name: 'doc-name', Type: 'text', Description: '', Placeholder: '', Label: 'Name', 'Read Only': '', Mandatory: '', Pattern: '', Step: '', Min: '', Max: '', Value: '', Options: '', OptionNames: '', Fieldset: 'doc-traveler', Repeatable: '',
  }, {
    Name: 'doc-age', Type: 'number', Description: '', Placeholder: '', Label: 'Age', 'Read Only': '', Mandatory: '', Pattern: '', Step: '', Min: '', Max: '', Value: '', Options: '', OptionNames: '', Fieldset: 'doc-traveler', Repeatable: '',
  }],
  ':type': 'sheet',
};
