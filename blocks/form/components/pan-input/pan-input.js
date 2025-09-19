/* eslint-disable no-unused-vars */
import { subscribe } from '../../rules/index.js';

/**
 * PanInputComponent - A class-based implementation of a pan-input component extending Text Input
 * This class encapsulates all the functionality for managing a form field's state,
 * view updates, and event handling.
 */
class PanInputComponent {
  /**
   * Creates an instance of PanInputComponent
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
    
    // PAN validation configuration
    this.fourthCharacter = fieldJson?.fourthCharacter || 'P';
    this.invalidFormatMessage = fieldJson?.invalidFormatMessage || 'Please enter a valid PAN number (Format: AAAAA9999A)';
    this.invalidFourthCharMessage = fieldJson?.invalidFourthCharMessage || 'Fourth character must be {fourthCharacter}';
    this.invalidLengthMessage = fieldJson?.invalidLengthMessage || 'PAN number must be exactly 10 characters';
  }

  /**
   * Validates PAN format
   * @param {string} value - The PAN value to validate
   * @returns {Object} - Validation result with isValid and message
   */
  validatePAN(value) {
    if (!value) {
      return { isValid: true, message: '' };
    }

    // Convert to uppercase
    const upperValue = value.toUpperCase();
    
    // Check length
    if (upperValue.length !== 10) {
      return { isValid: false, message: this.invalidLengthMessage };
    }

    // Check format: First 5 characters should be letters, 4th being configurable
    for (let i = 0; i < 5; i++) {
      if (!/[A-Z]/.test(upperValue[i])) {
        return { isValid: false, message: this.invalidFormatMessage };
      }
    }

    // Check 4th character specifically
    if (upperValue[3] !== this.fourthCharacter.toUpperCase()) {
      const message = this.invalidFourthCharMessage.replace('{fourthCharacter}', this.fourthCharacter);
      return { isValid: false, message };
    }

    // Check next 4 characters should be numbers
    for (let i = 5; i < 9; i++) {
      if (!/[0-9]/.test(upperValue[i])) {
        return { isValid: false, message: this.invalidFormatMessage };
      }
    }

    // Check last character should be a letter
    if (!/[A-Z]/.test(upperValue[9])) {
      return { isValid: false, message: this.invalidFormatMessage };
    }

    return { isValid: true, message: '' };
  }

  /**
   * This method is where you can update the fieldModel based on view changes.
   */
  updateModel() {
    const inputElement = this.fieldDiv.querySelector('input');
    if (inputElement) {
      // Add input event listener for real-time validation and uppercase conversion
      inputElement.addEventListener('input', (event) => {
        let value = event.target.value;
        
        // Convert to uppercase
        value = value.toUpperCase();
        
        // Update the input value
        if (event.target.value !== value) {
          event.target.value = value;
        }
        
        // Validate PAN format
        const validation = this.validatePAN(value);
        
        if (this.fieldModel) {
          if (validation.isValid) {
            this.fieldModel.markAsValid();
          } else {
            this.fieldModel.markAsInvalid(validation.message, 'pan-format');
          }
        }
      });

      // Add paste event listener
      inputElement.addEventListener('paste', (event) => {
        setTimeout(() => {
          let value = event.target.value;
          value = value.toUpperCase();
          if (event.target.value !== value) {
            event.target.value = value;
          }
          
          const validation = this.validatePAN(value);
          if (this.fieldModel) {
            if (validation.isValid) {
              this.fieldModel.markAsValid();
            } else {
              this.fieldModel.markAsInvalid(validation.message, 'pan-format');
            }
          }
        }, 0);
      });
    }
  }

  /**
   * Updates the form field HTML based on current state
   */
  updateView(state) {
    if (state) {
      const inputElement = this.fieldDiv.querySelector('input');
      if (inputElement && state.value) {
        // Convert to uppercase when updating view
        const upperValue = state.value.toUpperCase();
        if (inputElement.value !== upperValue) {
          inputElement.value = upperValue;
        }
        
        // Validate PAN format
        const validation = this.validatePAN(upperValue);
        if (this.fieldModel) {
          if (validation.isValid) {
            this.fieldModel.markAsValid();
          } else {
            this.fieldModel.markAsInvalid(validation.message, 'pan-format');
          }
        }
      }
    }
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
    
    // Set up input event listeners
    this.updateModel();

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
  const field = new PanInputComponent(fieldDiv, fieldJson, parentElement, formId);
  await field.initialize();
}
