// eslint-disable-next-line import/prefer-default-export
export const ueFormDef = {
  id: '$form',
  fieldType: 'form',
  ':items': {
    textinput: {
      id: 'text-input',
      fieldType: 'text-input',
      label: {
        value: 'Text Input',
      },
      properties: {
        'fd:path': '/content/test2/index/jcr:content/root/section_0/form/textinput',
      },
    },
    panelcontainer: {
      id: 'panelcontainer-084914a499',
      fieldType: 'panel',
      name: 'panelcontainer1716813758388',
      label: {
        value: 'Panel',
      },
      properties: {
        'fd:path': '/content/test2/index/jcr:content/root/section_0/form/panelcontainer',
      },
      ':itemsOrder': [
        'textinput',
      ],
      ':type': 'core/fd/components/form/panelcontainer/v1/panelcontainer',
      ':items': {
        textinput: {
          id: 'textinput-d330c9b8e7',
          fieldType: 'text-input',
          name: 'textinput1716813763576',
          type: 'string',
          label: {
            value: 'Text Input',
          },
          properties: {
            'fd:path': '/content/test2/index/jcr:content/root/section_0/form/panelcontainer/textinput',
          },
        },
      },
    },
    fragment_1198843043: {
      id: 'fragment-1c5674199a',
      fieldType: 'panel',
      name: 'fragment_11988430431717085995616',
      properties: {
        'fd:path': '/content/test2/index/jcr:content/root/section_0/form/fragment_1198843043',
        'fd:fragment': true,
      },
      label: {
        value: 'Fragment new',
      },
      ':items': {
        textinput_360975137: {
          id: 'textinput-105b08b11c',
          fieldType: 'text-input',
          name: 'textinput1716794906685',
          type: 'string',
          label: {
            value: 'street address',
          },
          properties: {
            'fd:path': '/content/test2/formfrag3/jcr:content/root/section/form/textinput',
          },
        },
      },
      ':itemsOrder': [
        'textinput_360975137',
      ],
    },
  },
  ':itemsOrder': ['textinput', 'panelcontainer', 'fragment_1198843043'],
};
