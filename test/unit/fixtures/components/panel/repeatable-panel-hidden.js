// eslint-disable-next-line import/prefer-default-export
export const fieldDef = {
  items: [
    {
      fieldType: 'panel',
      id: 'panel1',
      name: 'panel1',
      label: {
        value: 'Panel Label',
      },
      repeatable: true,
      minOccur: 1,
      visible: false,
      properties: {
        variant: 'addRemoveButtons',
      },
      items: [
        {
          id: 'tb1',
          fieldType: 'text-input',
          name: 'tb1',
          type: 'string',
          label: {
            value: 'Insured Property Address (Optional)',
          },
        },
        {
          id: 'tb2',
          fieldType: 'text-input',
          name: 'tb2',
          type: 'string',
          label: {
            value: 'City (Optional)',
          },
        },
      ],
    },
  ],
};

export const expectedDiffs = 2;
