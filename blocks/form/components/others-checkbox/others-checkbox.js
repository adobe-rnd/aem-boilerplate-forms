import { subscribe } from '../../rules/index.js';
import { updateOrCreateInvalidMsg } from '../../util.js';

export default function decorate(element, fd, container, formId) {
  // Get configurable properties
  const {
    othersLabel = 'Others',
    othersPlaceholder = 'Please specify',
    othersRequiredMessage = 'Please specify what others means',
  } = fd?.properties || {};

  // Add custom class for styling
  element.classList.add('others-checkbox-wrapper');

  // Find the fieldset and all checkboxes
  // Handle case where element is itself the fieldset or contains a fieldset
  const fieldset = element.tagName === 'FIELDSET' ? element : element.querySelector('fieldset');
  if (!fieldset) return;

  const checkboxes = fieldset.querySelectorAll('input[type="checkbox"]');
  const labels = fieldset.querySelectorAll('label');

  // Find the "others" checkbox (last one by default)
  const othersCheckbox = checkboxes[checkboxes.length - 1];
  const othersLabelElement = labels[labels.length - 1];

  if (!othersCheckbox || !othersLabelElement) return;

  // Update the others label text
  othersLabelElement.textContent = othersLabel;

  // Create the others input field
  const othersInputWrapper = document.createElement('div');
  othersInputWrapper.className = 'others-input-wrapper';
  othersInputWrapper.style.display = 'none'; // Initially hidden

  const othersInput = document.createElement('input');
  othersInput.type = 'text';
  othersInput.placeholder = othersPlaceholder;
  othersInput.className = 'others-text-input';
  othersInput.setAttribute('aria-label', `${othersLabel} specification`);

  othersInputWrapper.appendChild(othersInput);

  // Insert the others input after the fieldset
  // Handle case where fieldset might be the element itself
  fieldset.appendChild(othersInputWrapper);

  // Function to update the field value
  function updateFieldValue() {
    const checkedValues = Array.from(checkboxes)
      .filter((cb) => cb.checked && cb !== othersCheckbox)
      .map((cb) => cb.value);

    let othersValue = '';
    if (othersCheckbox.checked && othersInput.value.trim()) {
      othersValue = othersInput.value.trim();
    }

    // Combine all values
    const allValues = [...checkedValues];
    if (othersValue) {
      allValues.push(othersValue);
    }

    // Update the field model value
    subscribe(element, formId, (_fieldDiv, fieldModel) => {
      fieldModel.value = allValues;
    });
  }

  // Function to validate others input
  function validateOthersInput() {
    if (othersCheckbox.checked && !othersInput.value.trim()) {
      updateOrCreateInvalidMsg(element, othersRequiredMessage);
      element.classList.add('field-invalid');
      return false;
    }
    // Remove error state if valid
    const errorElement = element.querySelector('.field-invalid-msg');
    if (errorElement) {
      errorElement.remove();
    }
    element.classList.remove('field-invalid');
    return true;
  }

  // Handle others checkbox change
  othersCheckbox.addEventListener('change', (e) => {
    e.stopPropagation(); // Override OOTB change handler

    if (othersCheckbox.checked) {
      othersInputWrapper.style.display = 'block';
      othersInput.focus();
    } else {
      othersInputWrapper.style.display = 'none';
      othersInput.value = '';
    }

    updateFieldValue();
    validateOthersInput();
  });

  // Handle others input change
  othersInput.addEventListener('input', (e) => {
    e.stopPropagation(); // Override OOTB input handler
    updateFieldValue();
    validateOthersInput();
  });

  // Handle others input blur for validation
  othersInput.addEventListener('blur', (e) => {
    e.stopPropagation(); // Override OOTB blur handler
    validateOthersInput();
  });

  // Handle regular checkbox changes
  checkboxes.forEach((checkbox) => {
    if (checkbox !== othersCheckbox) {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation(); // Override OOTB change handler
        updateFieldValue();
      });
    }
  });

  // Subscribe to field model changes to handle programmatic updates
  subscribe(element, formId, (_fieldDiv, fieldModel) => {
    fieldModel.subscribe((event) => {
      const { payload } = event;
      const { changes } = payload;
      changes.forEach((change) => {
        if (change.propertyName === 'value') {
          const { currentValue } = change;

          // Handle programmatic value updates
          if (Array.isArray(currentValue)) {
            // Update checkboxes based on new value
            checkboxes.forEach((checkbox) => {
              if (checkbox !== othersCheckbox) {
                checkbox.checked = currentValue.includes(checkbox.value);
              }
            });

            // Check if any value is not in the enum (indicating it's an "others" value)
            const enumValues = fd.enum || [];
            const othersValues = currentValue.filter((val) => !enumValues.includes(val));

            if (othersValues.length > 0) {
              othersCheckbox.checked = true;
              [othersInput.value] = othersValues; // Take the first others value
              othersInputWrapper.style.display = 'block';
            } else {
              othersCheckbox.checked = false;
              othersInput.value = '';
              othersInputWrapper.style.display = 'none';
            }
          }
        }
      });
    }, 'change');
  });
}
