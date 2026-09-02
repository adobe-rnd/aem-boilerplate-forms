import assert from 'assert';

export const fieldDef = {
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

// Helper to wait for model validation to complete
function waitForValidation() {
  return new Promise((resolve) => {
    queueMicrotask(() => {
      queueMicrotask(resolve);
    });
  });
}

export function op(block) {
  // Trigger modal visibility via model
  const form = block.querySelector('form');
  const formModel = form.getModel?.();
  if (formModel) {
    const modalField = formModel.getElement('modal');
    if (modalField) {
      modalField.visible = true;
    }
  }
}

export async function expect(block) {
  await waitForValidation();

  // Check that modal dialog was created and shown
  const dialog = block.querySelector('dialog');
  assert.ok(dialog, 'Dialog element should be created');

  // Check that dialog has modal content
  const modalContent = dialog.querySelector('.modal-content');
  assert.ok(modalContent, 'Modal content should exist');

  // Check that close button was created
  const closeButton = dialog.querySelector('.close-button');
  assert.ok(closeButton, 'Close button should exist');

  // Check that dialog is open
  assert.ok(dialog.open, 'Dialog should be open after visibility change');

  // Check that body has modal-open class
  assert.ok(document.body.classList.contains('modal-open'), 'Body should have modal-open class');

  // Test closing via close button
  closeButton.click();
  await waitForValidation();

  // Check that dialog was closed and removed
  assert.equal(document.body.classList.contains('modal-open'), false, 'modal-open class should be removed');

  // Test opening modal again (tests recreation path)
  const form = block.querySelector('form');
  const formModel = form.getModel?.();
  if (formModel) {
    const modalField = formModel.getElement('modal');
    if (modalField) {
      modalField.visible = true;
    }
  }
  await waitForValidation();

  const dialog2 = block.querySelector('dialog');
  assert.ok(dialog2, 'Dialog should be recreated');
  assert.ok(dialog2.open, 'Recreated dialog should be open');

  // Test closing by clicking outside dialog (simulate clicking outside)
  const clickOutsideEvent = new MouseEvent('click', {
    clientX: 0,
    clientY: 0,
    bubbles: true,
  });
  dialog2.dispatchEvent(clickOutsideEvent);
  await waitForValidation();
}
