/* eslint-disable no-unused-vars */
import { subscribe } from '../../rules/index.js';

/**
 * OthersCheckboxComponent - A class-based implementation of a others-checkbox component
 * extending Checkbox Group. This class encapsulates all the functionality for managing
 * a form field's state, view updates, and event handling.
 */
class OthersCheckboxComponent {
  /**
   * Creates an instance of OthersCheckboxComponent
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
    this.propertyChanges = ['value'];
    this.customEvent = '';
  }

  /**
   * This method is where you can update the fieldModel based on view changes.
   */
  updateModel() {
    // Listen for changes on the others text input
    const othersTextInput = this.fieldDiv.querySelector('.others-text-input');
    if (othersTextInput) {
      othersTextInput.addEventListener('input', (e) => {
        e.stopPropagation();
        this.updateFieldValue();
      });
    }
  }

  /**
   * Updates the form field HTML based on current state
   */
  updateView(state) {
    if (state) {
      this.addOthersTextInput();
      this.updateOthersTextInputVisibility();
    }
  }

  /**
   * Adds the "Others" text input to the field
   */
  addOthersTextInput() {
    // Check if others text input already exists
    if (this.fieldDiv.querySelector('.others-text-input')) {
      return;
    }

    const othersCheckboxWrapper = this.fieldDiv.querySelector('input[value="others"]')?.closest('.checkbox-wrapper');
    if (!othersCheckboxWrapper) {
      return;
    }

    // Create text input container
    const textInputContainer = document.createElement('div');
    textInputContainer.className = 'others-text-input-container';
    textInputContainer.style.display = 'none';

    // Create text input
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'others-text-input';
    textInput.placeholder = this.fieldJson.properties?.othersPlaceholder || 'Please specify...';
    textInput.name = `${this.fieldJson.name}_others_text`;

    // Add text input to container
    textInputContainer.appendChild(textInput);

    // Insert after the others checkbox wrapper
    othersCheckboxWrapper.parentNode.insertBefore(
      textInputContainer,
      othersCheckboxWrapper.nextSibling,
    );

    // Add event listener for others checkbox change
    const othersCheckbox = othersCheckboxWrapper.querySelector('input[value="others"]');
    if (othersCheckbox) {
      othersCheckbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.updateOthersTextInputVisibility();
        this.updateFieldValue();
      });
    }
  }

  /**
   * Updates the visibility of the others text input based on checkbox state
   */
  updateOthersTextInputVisibility() {
    const othersCheckbox = this.fieldDiv.querySelector('input[value="others"]');
    const textInputContainer = this.fieldDiv.querySelector('.others-text-input-container');

    if (othersCheckbox && textInputContainer) {
      if (othersCheckbox.checked) {
        textInputContainer.style.display = 'block';
      } else {
        textInputContainer.style.display = 'none';
        // Clear the text input when others is unchecked
        const textInput = textInputContainer.querySelector('.others-text-input');
        if (textInput) {
          textInput.value = '';
        }
      }
    }
  }

  /**
   * Updates the field value to include others text when others is checked
   */
  updateFieldValue() {
    if (!this.fieldModel) {
      return;
    }

    // Get all checked values except 'others'
    const checkedValues = [];
    const checkboxes = this.fieldDiv.querySelectorAll('input[type="checkbox"]:checked');

    checkboxes.forEach((checkbox) => {
      if (checkbox.value !== 'others') {
        checkedValues.push(checkbox.value);
      }
    });

    // If others is checked, add the text input value
    const othersCheckbox = this.fieldDiv.querySelector('input[value="others"]');
    const othersTextInput = this.fieldDiv.querySelector('.others-text-input');

    if (othersCheckbox && othersCheckbox.checked && othersTextInput
        && othersTextInput.value.trim()) {
      checkedValues.push(`others:${othersTextInput.value.trim()}`);
    }

    // Update the field model value
    this.fieldModel.value = checkedValues;
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
      this.updateModel();
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
  const field = new OthersCheckboxComponent(fieldDiv, fieldJson, parentElement, formId);
  await field.initialize();
}
