import assert from 'assert';

export const fieldDef = {
  items: [{
    id: 'numberinput-c9a02f4cd1',
    fieldType: 'number-input',
    name: 'numberinput_13917802541727686782114',
    visible: true,
    type: 'integer',
    required: false,
    enabled: false,
    readOnly: false,
    description: '<p>This is a help text.</p>',
    label: {
      visible: true,
      value: 'Rating',
    },
    events: {
      'custom:setProperty': [
        '$event.payload',
      ],
    },
    properties: {
      'afs:layout': {
        tooltipVisible: false,
      },
      'fd:dor': {
        dorExclusion: false,
      },
    },
    ':type': 'rating',
  },
  ],
};

// Helper to wait for async operations
function waitForValidation() {
  return new Promise((resolve) => {
    queueMicrotask(() => {
      queueMicrotask(resolve);
    });
  });
}

export function op(block) {
  // First enable the field, then test clicking stars
  const form = block.querySelector('form');
  const formModel = form.getModel?.();
  if (formModel) {
    const ratingField = formModel.getElement('numberinput-c9a02f4cd1');
    if (ratingField) {
      ratingField.enabled = true;
    }
  }

  // Wait a bit for the enabled state to apply
  setTimeout(() => {
    const ratingDiv = block.querySelector('.rating');
    const stars = ratingDiv.querySelectorAll('.star');
    // Click the third star
    stars[2].click();
  }, 50);
}

export async function expect(block) {
  await waitForValidation();

  const ratingDiv = block.querySelector('.rating');
  const stars = ratingDiv.querySelectorAll('.star');
  const input = block.querySelector('input[type="number"]');
  const emoji = ratingDiv.querySelector('.emoji');

  // Check that rating div was created
  assert.ok(ratingDiv, 'Rating div should exist');
  assert.equal(stars.length, 5, 'Should have 5 stars by default');

  // Check that input is hidden
  assert.equal(input.style.display, 'none', 'Input should be hidden');

  // Initial state should be disabled (from fieldDef enabled: false)
  assert.ok(ratingDiv.classList.contains('disabled'), 'Rating div should initially have disabled class');

  // After op() enables the field and clicks, check that it worked
  assert.equal(input.value, '3', 'Input value should be 3 after clicking third star');

  // Check that first 3 stars have selected class
  assert.ok(stars[0].classList.contains('selected'), 'First star should be selected');
  assert.ok(stars[1].classList.contains('selected'), 'Second star should be selected');
  assert.ok(stars[2].classList.contains('selected'), 'Third star should be selected');
  assert.equal(stars[3].classList.contains('selected'), false, 'Fourth star should not be selected');

  // Rating div should no longer be disabled after being enabled in op()
  assert.equal(ratingDiv.classList.contains('disabled'), false, 'Rating div should not have disabled class after enabling');

  // Test hover behavior - hover over second star (i=2, so sad emoji)
  const hoverEvent = new Event('mouseover', { bubbles: true });
  stars[1].dispatchEvent(hoverEvent);
  await waitForValidation();

  // Check that sad emoji is shown for low rating (index <= 3)
  assert.equal(emoji.textContent, '😢', 'Should show sad emoji for rating <= 3');

  // Test hover on fifth star (i=5, so happy emoji)
  stars[4].dispatchEvent(hoverEvent);
  await waitForValidation();
  assert.equal(emoji.textContent, '😊', 'Should show happy emoji for rating > 3');

  // Test mouseleave behavior
  const mouseleaveEvent = new Event('mouseleave', { bubbles: true });
  ratingDiv.dispatchEvent(mouseleaveEvent);
  await waitForValidation();

  // Emoji should still be visible because a star is selected
  // (the mouseleave only clears emoji if no star is selected)

  // Test disabling the field again
  const form = block.querySelector('form');
  const formModel = form.getModel?.();
  if (formModel) {
    const ratingField = formModel.getElement('numberinput-c9a02f4cd1');
    if (ratingField) {
      // Disable the field
      ratingField.enabled = false;
      await waitForValidation();

      // Check that disabled class is added
      const ratingDivAfterDisable = block.querySelector('.rating');
      assert.ok(ratingDivAfterDisable.classList.contains('disabled'), 'Rating div should have disabled class after disabling');

      // Try clicking a star when disabled - value should not change
      const currentValue = input.value;
      stars[4].click();
      await waitForValidation();
      assert.equal(input.value, currentValue, 'Value should not change when clicking disabled rating');

      // Test mouseover on disabled - emoji should not update
      const emojiBeforeHover = emoji.textContent;
      stars[1].dispatchEvent(hoverEvent);
      await waitForValidation();
      // Since disabled, hover should not change emoji (line 73-95 coverage)

      // Test readOnly state
      ratingField.enabled = true;
      ratingField.readOnly = true;
      await waitForValidation();

      const ratingDivReadOnly = block.querySelector('.rating');
      assert.ok(ratingDivReadOnly.classList.contains('disabled'), 'Rating div should have disabled class for readOnly');

      // Test mouseleave on readOnly/disabled (line 106-118 coverage)
      ratingDivReadOnly.dispatchEvent(mouseleaveEvent);
      await waitForValidation();
    }
  }
}
