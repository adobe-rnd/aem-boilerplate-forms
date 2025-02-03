// eslint-disable-next-line import/prefer-default-export
export const fieldDef = {
  submitHeaders: {
    'Content-Type': 'application/json',
    'x-adobe-routing': 'tier=undefined,bucket=undefined--undefined--undefined'
  },
  items: [
    {
      id: 'modal',
      fieldType: 'panel',
      name: 'modal',
      visible: false,
      enabled: true,
      label: {
        visible: true,
        value: 'Modal',
      },
      items: [{
        id: 'textinput-id',
        fieldType: 'text-input',
        name: 'firstName',
        visible: true,
        type: 'string',
        label: {
          value: 'First Name',
        },
        ':type': 'core/fd/components/form/textinput/v1/textinput',
      },
      ],
      ':type': 'modal',
    },
  ],
};
