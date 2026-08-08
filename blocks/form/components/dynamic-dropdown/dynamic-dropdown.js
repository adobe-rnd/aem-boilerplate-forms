import { subscribe } from '../../rules/index.js';


const getEnumName = (value, model) => {
  if (!model?.enum || !Array.isArray(model.enum)) {
    return undefined;
  }
  const index = model.enum.indexOf(value);
  if (index !== -1 && model.enumNames?.[index] !== undefined) {
    return model.enumNames[index];
  }
  return undefined;
};

/**
 * Creates an editable dropdown that allows both selection from options and custom text input
 * @param {HTMLElement} fieldDiv - Container for the field
 * @param {Object} fieldJson - Field configuration data
 * @param {HTMLElement} container - Parent container
 * @param {string} formId - ID of the form
 */
export default function decorate(fieldDiv, fieldJson, container, formId) {
  // Get the existing select element
  const select = fieldDiv.querySelector('select');

  if (!select) {
    return fieldDiv;
  }

  // Create a wrapper to hold both the input and custom dropdown
  const wrapper = document.createElement('div');
  wrapper.className = 'dynamic-dropdown-wrapper';

  // Create text input for user entry
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'dynamic-dropdown-input';
  input.placeholder = fieldJson.placeholder || '';

  // Create custom dropdown container
  const dropdownList = document.createElement('div');
  dropdownList.className = 'dynamic-dropdown-list';

  // Add elements to wrapper
  wrapper.appendChild(input);
  wrapper.appendChild(dropdownList);

  // Hide the original select
  select.style.display = 'none';

  // Add the wrapper to fieldDiv
  fieldDiv.appendChild(wrapper);

  // Function to populate dropdown options
  const populateDropdown = (filterText = '') => {
    dropdownList.innerHTML = '';
    // filter out placeholder option (which is disabled)
    const options = Array.from(select.options).filter((opt) => !opt.disabled);
    const filteredOptions = filterText
      ? options.filter((opt) => opt.text.toLowerCase().includes(filterText.toLowerCase()))
      : options;

    if (filteredOptions.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'dropdown-no-results';
      noResults.textContent = 'No matching options';
      dropdownList.appendChild(noResults);
    } else {
      filteredOptions.forEach((option) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'dropdown-option';
        optionElement.textContent = option.text;

        // Select option on click
        optionElement.addEventListener('mousedown', (e) => {
          e.preventDefault(); // Prevent input from losing focus
          input.value = option.text;
          select.value = option.value;

          // Trigger change event on select
          select.dispatchEvent(new Event('change', { bubbles: true }));

          // Hide dropdown
          dropdownList.style.display = 'none';
        });

        dropdownList.appendChild(optionElement);
      });
    }
  };

  // Function to clear dropdown options
  const clearDropdown = () => {
    dropdownList.innerHTML = '';
    dropdownList.style.display = 'none';
  };

  // Sync input with select's selected option
  const syncInputWithSelect = () => {
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) {
      if (selectedOption.disabled) {
        input.placeholder = selectedOption.text;
      } else {
        input.value = selectedOption.text;
      }
    }
  };

  // Initial sync
  syncInputWithSelect();
  let model = null;
  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel) => {
    model = fieldModel;
    // setting inital value if prefill is already done.
    if (model?.value && model?.enumNames) {
      const enumName = getEnumName(model.value, model);
      if (enumName !== undefined) {
        input.value = enumName;
      }
    }
    fieldModel.subscribe((e) => {
      const { payload } = e;
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'enumNames') {
          populateDropdown();
        } else if (change?.propertyName === 'value') {
          // Skip processing if model.enum is not available (temporary state during updates)
          if (!model || !model.enum || !Array.isArray(model.enum)) {
            return;
          }
          
          const index = model.enum.indexOf(change.currentValue);
          if (index !== -1 && model.enumNames && model.enumNames[index] !== undefined) {
            input.value = model.enumNames[index];
          }
        }
      });
    }, 'change');
  });

  // Helper to make the dropdown and input reset when field is empty
  const showEnterMoreMsg = () => {
    model.enumNames = [""];
    model.enum = [""];
    model.value = '';
    populateDropdown();
  };

  // Event listeners
  input.addEventListener('focus', () => {
    if (!input.value) return;
    populateDropdown(input.value);
    dropdownList.style.display = 'block';
  });

  input.addEventListener('input', (e) => {
    e.stopPropagation();
    if (!input.value) {
      clearDropdown();
      input.value = '';
      select.selectedIndex = 0;
      if (model) showEnterMoreMsg();
      return;
    }
    populateDropdown(input.value);
    dropdownList.style.display = 'block';
    model.value = input.value;
    // update the selected value
  });

  input.addEventListener('blur', () => {
    // Small delay to allow option clicks to register
    setTimeout(() => {
      dropdownList.style.display = 'none';
      if (!input.value) {
        clearDropdown();
        input.value = '';
        select.selectedIndex = 0;
        if (model) showEnterMoreMsg();
      }
    }, 150);
  });

  // When select changes programmatically, update the input
  select.addEventListener('change', () => {
    syncInputWithSelect();
  });

  // When user clicks outside, close dropdown
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      dropdownList.style.display = 'none';
    }
  });

  input.addEventListener('change', (e) => {
    e.stopPropagation(); // this need not be propagated to the form
  });

  return fieldDiv;
}