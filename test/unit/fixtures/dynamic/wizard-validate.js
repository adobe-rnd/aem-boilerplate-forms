import assert from 'assert';

// A two-step wizard where step 1 has a required text field.
// Clicking Next without filling step 1 should:
//   1. Block navigation — step 1 stays current
//   2. Show error message — .field-invalid + .field-description appear on the required field
export const sample = {
  id: 'wizard-validate-test-form',
  fieldType: 'form',
  title: 'Wizard Validation Test',
  action: '/submit',
  adaptiveform: '0.12.1',
  metadata: { grammar: 'json-formula-1.0.0', version: '1.0.0' },
  events: { 'custom:setProperty': ['$event.payload'] },
  items: [
    {
      id: 'wizard-validate-panel',
      fieldType: 'panel',
      name: 'wizard1',
      ':type': 'formsninja/components/adaptiveForm/wizard',
      events: { 'custom:setProperty': ['$event.payload'] },
      items: [
        {
          id: 'step1-validate-panel',
          fieldType: 'panel',
          name: 'step1',
          label: { value: 'Step 1' },
          events: { 'custom:setProperty': ['$event.payload'] },
          ':type': 'formsninja/components/adaptiveForm/panelcontainer',
          items: [
            {
              id: 'firstname-validate-field',
              fieldType: 'text-input',
              name: 'firstName',
              type: 'string',
              required: true,
              label: { value: 'First Name' },
              events: { 'custom:setProperty': ['$event.payload'] },
              ':type': 'formsninja/components/adaptiveForm/textinput',
            },
          ],
        },
        {
          id: 'step2-validate-panel',
          fieldType: 'panel',
          name: 'step2',
          label: { value: 'Step 2' },
          events: { 'custom:setProperty': ['$event.payload'] },
          ':type': 'formsninja/components/adaptiveForm/panelcontainer',
          items: [],
        },
      ],
    },
  ],
};

// Allow time for async model validation events to propagate through the rule engine
export const opDelay = 100;

export function op(block) {
  const nextBtn = block.querySelector('.wizard .field-next');
  assert.ok(nextBtn, 'Next button should exist');
  nextBtn.click();
}

export function expect(block) {
  // Navigation blocked — step 1 must still be the current step
  const currentStep = block.querySelector('.current-wizard-step');
  assert.ok(currentStep, 'A current step should still be active');
  assert.equal(
    currentStep.id,
    'step1-validate-panel',
    'Step 1 should remain current after clicking Next with an empty required field',
  );

  // Required field wrapper should carry field-invalid class
  const firstNameWrapper = block.querySelector('#firstname-validate-field')?.closest('.field-wrapper');
  assert.ok(firstNameWrapper, 'First name field wrapper should exist');
  assert.ok(
    firstNameWrapper.classList.contains('field-invalid'),
    '.field-wrapper should have field-invalid class after model validation',
  );

  // Error message element must be present with non-empty text
  const errorDesc = firstNameWrapper.querySelector('.field-description');
  assert.ok(errorDesc, '.field-description error element should be rendered');
  assert.ok(errorDesc.textContent.trim().length > 0, 'Error message should not be empty');
}
