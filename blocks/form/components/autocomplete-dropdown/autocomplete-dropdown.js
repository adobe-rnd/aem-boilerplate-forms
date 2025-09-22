/* eslint-disable no-unused-vars */
import { subscribe } from '../../rules/index.js';

/**
 * AutocompleteDropdownComponent - A class-based implementation of a autocomplete-dropdown
 * component extending Drop Down. This class encapsulates all the functionality for
 * managing a form field's state, view updates, and event handling.
 */
class AutocompleteDropdownComponent {
  /**
   * Creates an instance of AutocompleteDropdownComponent
   * @param {HTMLElement} fieldDiv - The DOM element containing the field wrapper
   * @param {Object} fieldJson - The form json object for the component
   * @param {HTMLElement} parentElement - The parent element of the field
   * @param {string} formId - The unique identifier of the form
   */
  constructor(fieldDiv, fieldJson, parentElement, formId) {
    this.fieldDiv = fieldDiv;
    this.fieldJson = fieldJson;
    this.parentElement = parentElement;
    this.formId = formId;
    this.fieldModel = null;

    // Configuration properties
    this.propertyChanges = ['enum', 'value'];
    this.customEvent = '';

    // Autocomplete specific properties
    this.inputElement = null;
    this.dropdownList = null;
    this.isDropdownOpen = false;
    this.filteredOptions = [];
    this.allOptions = [];
    this.allOptionNames = [];
  }

  /**
   * This method is where you can update the fieldModel based on view changes.
   */
  updateModel() {
    // Handle input changes and update the field model
    if (this.inputElement) {
      const input = this.inputElement.querySelector('input');
      if (input && !input.hasAttribute('data-listeners-attached')) {
        input.addEventListener('input', (e) => {
          e.stopPropagation();
          this.filterOptions(e.target.value);
          this.showDropdown();
        });

        input.addEventListener('focus', (e) => {
          e.stopPropagation();
          this.showDropdown();
        });

        input.addEventListener('blur', (e) => {
          e.stopPropagation();
          // Delay hiding to allow for option selection
          setTimeout(() => {
            this.hideDropdown();
          }, 200);
        });

        input.addEventListener('keydown', (e) => {
          e.stopPropagation();
          this.handleKeydown(e);
        });

        // Mark that listeners have been attached to prevent duplicates
        input.setAttribute('data-listeners-attached', 'true');
      }
    }
  }

  /**
   * Updates the form field HTML based on current state
   */
  updateView(state) {
    if (state) {
      this.createAutocompleteField(state);
      this.updateModel();
    }
  }

  /**
   * Creates the autocomplete field structure
   */
  createAutocompleteField(fieldData) {
    // Clear existing content
    this.fieldDiv.innerHTML = '';

    // Create the autocomplete container
    const autocompleteContainer = document.createElement('div');
    autocompleteContainer.className = 'autocomplete-dropdown-container';

    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'autocomplete-input';
    input.placeholder = fieldData.placeholder || 'Type to search...';
    input.readOnly = fieldData.readOnly || false;
    input.disabled = fieldData.enabled === false;
    input.id = fieldData.id;
    input.name = fieldData.name;
    input.autocomplete = 'off';

    // Set initial value
    if (fieldData.value) {
      const selectedOption = AutocompleteDropdownComponent
        .findOptionByValue(fieldData.value, fieldData);
      input.value = selectedOption ? selectedOption.label : fieldData.value;
    }

    // Create dropdown list container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'autocomplete-dropdown-list';
    dropdownContainer.style.display = 'none';

    // Store references
    this.inputElement = autocompleteContainer;
    this.dropdownList = dropdownContainer;

    // Update options data
    this.updateOptionsData(fieldData);

    // Assemble the structure
    autocompleteContainer.appendChild(input);
    autocompleteContainer.appendChild(dropdownContainer);
    this.fieldDiv.appendChild(autocompleteContainer);

    // Populate initial dropdown
    this.populateDropdown(fieldData);
  }

  /**
   * Updates the options data from field data
   */
  updateOptionsData(fieldData) {
    this.allOptions = fieldData.enum || [];
    this.allOptionNames = fieldData.enumNames || this.allOptions;
    this.filteredOptions = [...this.allOptions];
  }

  /**
   * Populates the dropdown with options
   */
  populateDropdown(fieldData = null) {
    if (!this.dropdownList) return;

    this.dropdownList.innerHTML = '';

    const options = this.filteredOptions || this.allOptions;
    const optionNames = fieldData?.enumNames || this.allOptionNames;

    options.forEach((value, index) => {
      const optionElement = document.createElement('div');
      optionElement.className = 'autocomplete-option';

      // Find the correct option name for this value
      const originalIndex = this.allOptions.indexOf(value);
      const optionName = originalIndex !== -1 ? optionNames[originalIndex] : value;
      optionElement.textContent = optionName || value;
      optionElement.dataset.value = value;

      optionElement.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectOption(value, optionName || value);
      });

      this.dropdownList.appendChild(optionElement);
    });
  }

  /**
   * Filters options based on input text
   */
  filterOptions(searchText) {
    if (!searchText || searchText.trim() === '') {
      this.filteredOptions = [...this.allOptions];
    } else {
      const searchLower = searchText.toLowerCase().trim();

      this.filteredOptions = this.allOptions.filter((value, index) => {
        const optionName = (this.allOptionNames[index] || value).toLowerCase().trim();
        const optionValue = value.toLowerCase().trim();

        // Check if search text is contained in either the display name or the value
        return optionName.includes(searchLower) || optionValue.includes(searchLower);
      });
    }

    // Always update dropdown immediately after filtering
    this.populateDropdown();

    // Show dropdown if there are filtered options
    if (this.filteredOptions.length > 0) {
      this.showDropdown();
    } else {
      this.hideDropdown();
    }
  }

  /**
   * Shows the dropdown list
   */
  showDropdown() {
    if (this.dropdownList && this.filteredOptions.length > 0) {
      this.dropdownList.style.display = 'block';
      this.isDropdownOpen = true;
    }
  }

  /**
   * Hides the dropdown list
   */
  hideDropdown() {
    if (this.dropdownList) {
      this.dropdownList.style.display = 'none';
      this.isDropdownOpen = false;
    }
  }

  /**
   * Handles option selection
   */
  selectOption(value, label) {
    const input = this.inputElement.querySelector('input');
    if (input) {
      input.value = label;
    }

    // Update field model if available
    if (this.fieldModel) {
      this.fieldModel.value = value;
    }

    this.hideDropdown();
  }

  /**
   * Handles keyboard navigation
   */
  handleKeydown(e) {
    if (!this.isDropdownOpen) return;

    const options = this.dropdownList.querySelectorAll('.autocomplete-option');
    const currentActive = this.dropdownList.querySelector('.autocomplete-option.active');
    let activeIndex = -1;

    if (currentActive) {
      activeIndex = Array.from(options).indexOf(currentActive);
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, options.length - 1);
        this.setActiveOption(options[activeIndex]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        this.setActiveOption(options[activeIndex]);
        break;
      case 'Enter':
        e.preventDefault();
        if (currentActive) {
          const { value } = currentActive.dataset;
          const label = currentActive.textContent;
          this.selectOption(value, label);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.hideDropdown();
        break;
      default:
        // No action needed for other keys
        break;
    }
  }

  /**
   * Sets the active option for keyboard navigation
   */
  setActiveOption(option) {
    // Remove previous active class
    const previousActive = this.dropdownList.querySelector('.autocomplete-option.active');
    if (previousActive) {
      previousActive.classList.remove('active');
    }

    // Add active class to current option
    if (option) {
      option.classList.add('active');
    }
  }

  /**
   * Finds option by value
   */
  static findOptionByValue(value, fieldData) {
    const options = fieldData.enum || [];
    const optionNames = fieldData.enumNames || options;
    const index = options.indexOf(value);

    if (index !== -1) {
      return {
        value,
        label: optionNames[index] || value,
      };
    }
    return null;
  }

  /**
   * Attaches event listeners to the form model
   * Listens to property changes and custom events and updates the view accordingly
   */
  attachEventListeners() {
    if (!this.fieldModel) {
      return;
    }

    // Listen for property changes
    this.fieldModel.subscribe((event) => {
      event?.payload?.changes?.forEach((change) => {
        if (this.propertyChanges.includes(change?.propertyName)) {
          this.updateView(this.fieldModel.getState());
        }
      });
    }, 'change');

    // Listen for custom events
    if (this.customEvent) {
      this.fieldModel.subscribe(() => {
        this.updateView(this.fieldModel.getState());
      }, this.customEvent);
    }
  }

  /**
   * Initializes the form field component
   * Sets up the initial view and subscribes to form model changes
   */
  async initialize() {
    // Update the view with initial data
    this.updateView(this.fieldJson);

    // Subscribe to form model changes
    subscribe(this.fieldDiv, this.formId, (element, model) => {
      this.fieldModel = model;
      this.attachEventListeners();
    });
  }
}

/**
 * Decorates a custom form field component
 * @param {HTMLElement} fieldDiv - The DOM element containing the field wrapper
 * @param {Object} fieldJson - The form json object for the component
 * @param {HTMLElement} parentElement - The parent element of the field
 * @param {string} formId - The unique identifier of the form
 */
export default async function decorate(fieldDiv, fieldJson, parentElement, formId) {
  const field = new AutocompleteDropdownComponent(fieldDiv, fieldJson, parentElement, formId);
  await field.initialize();
}
