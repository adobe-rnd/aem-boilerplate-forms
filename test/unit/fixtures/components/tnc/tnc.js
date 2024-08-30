// eslint-disable-next-line import/prefer-default-export
export const fieldDef = {
  items: [{
    id: 'termsandconditions-f1575937cc',
    fieldType: 'panel',
    name: 'termsandconditions1723610810590',
    visible: true,
    enabled: true,
    properties: {
      'fd:dor': {
        dorExclusion: false,
        dorExcludeTitle: false,
        dorExcludeDescription: false,
      },
      'fd:path': '/content/ue-new-features/index/jcr:content/root/section_2/form/termsandconditions',
    },
    columnCount: 12,
    gridClassNames: 'aem-Grid aem-Grid--12 aem-Grid--default--12',
    columnClassNames: {
      approvalcheckbox: 'aem-GridColumn aem-GridColumn--default--12',
      link: 'aem-GridColumn aem-GridColumn--default--12',
      text: 'aem-GridColumn aem-GridColumn--default--12',
    },
    label: {
      value: 'Terms and conditions',
    },
    events: {
      'custom:setProperty': [
        '$event.payload',
      ],
    },
    ':itemsOrder': [
      'text',
      'approvalcheckbox',
    ],
    ':type': 'tnc',
    items: [{
      id: 'text-425a128e2b',
      dataRef: null,
      fieldType: 'plain-text',
      name: 'text1723610810624',
      value: 'Text related to the terms and conditions come here.',
      richText: true,
      events: {
        'custom:setProperty': [
          '$event.payload',
        ],
      },
      properties: {
        'fd:dor': {
          dorExclusion: false,
        },
        'fd:path': '/content/ue-new-features/index/jcr:content/root/section_2/form/termsandconditions/text',
      },
      ':type': 'core/fd/components/form/text/v1/text',
    }, {
      id: 'checkbox-52d78b0a25',
      fieldType: 'checkbox',
      name: 'approvalcheckbox',
      type: 'string',
      required: true,
      enabled: false,
      enforceEnum: true,
      label: {
        value: 'I agree to the terms & conditions.',
      },
      events: {
        'custom:setProperty': [
          '$event.payload',
        ],
      },
      properties: {
        'fd:dor': {
          dorExclusion: false,
        },
        'fd:path': '/content/ue-new-features/index/jcr:content/root/section_2/form/termsandconditions/approvalcheckbox',
      },
      ':type': 'core/fd/components/form/checkbox/v1/checkbox',
    }],
    allowedComponents: {
      applicable: false,
      components: [],
    },
  }],
};
