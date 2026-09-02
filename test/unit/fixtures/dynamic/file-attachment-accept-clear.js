/* eslint-env mocha */
import assert from 'assert';

export const sample = {
  items: [
    {
      id: 'fileinput-fc4d042b5e',
      fieldType: 'file-input',
      name: 'idProof',
      visible: false,
      description: '<p>You can upload any PDF file which is lessthan 1 MB</p>',
      tooltip: '<p>Please upload any PDF file.</p>',
      type: 'file',
      enabled: true,
      readOnly: false,
      maxFileSize: '1MB',
      accept: [
        'application/pdf',
      ],
      label: {
        visible: false,
        value: 'Identity Proof',
      },
      ':type': 'forms-components-examples/components/form/fileinput',
    },
  ],
};

export function op(block) {
  const input = block.querySelector('input');
  const file1 = new File([new ArrayBuffer(512)], 'file1.png', { type: 'image/png' });
  const event = new Event('change', {
    bubbles: true,
    cancelable: true,
  });
  input.files = [file1];
  input.dispatchEvent(event);

  // Note: Not removing the file in this test to avoid timing issues
  // The test will verify that the invalid file shows an error
  // Separate test for file removal exists in file-attachment-multiple.js
}

export function expect(block) {
  const input = block.querySelector('input');
  const wrapper = input.closest('.field-wrapper');
  // File with wrong type should show validation error
  assert.equal(wrapper.classList.contains('field-invalid'), true, 'should have invalid css');
  assert.equal(input.validity.valid, false, 'should be invalid');
  assert.equal(input.validationMessage, 'The specified file type not supported.', 'should show error for wrong file type');
}

// Allow time for worker validation to complete
export const opDelay = 100;
