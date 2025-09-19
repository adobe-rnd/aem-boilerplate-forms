/* eslint-disable no-unused-vars */
import { subscribe } from '../../rules/index.js';

/**
 * PanInputComponent - A class-based implementation of a pan-input component extending Text Input
 * This class encapsulates all the functionality for managing a form field's state,
 * view updates, and event handling with PAN-specific validation.
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
    this.propertyChanges = ['value', 'valid'];
    this.customEvent = '';

    // PAN validation configuration
    this.fourthCharacter = fieldJson?.fourthCharacter || 'P';
    this.maxLength = 10;
    
    // Error messages
    this.errorMessages = {
      invalidFormat: fieldJson?.invalidFormatMessage || 'Please enter a valid PAN number (5 letters, 4 numbers, 1 letter)',
      invalidFourthChar: fieldJson?.invalidFourthCharMessage || 'Fourth character must be {fourthCharacter}',
      invalidLetters: fieldJson?.invalidLettersMessage || 'First 5 characters must be letters',
      invalidNumbers: fieldJson?.invalidNumbersMessage || 'Characters 6-9 must be numbers',
      invalidLastChar: fieldJson?.invalidLastCharMessage || 'Last character must be a letter'
    };
  }

  /**
   * Validates PAN format and returns validation result
   * @param {string} value - The PAN value to validate
   * @returns {Object} - Validation result with isValid and errorMessage
   */
  validatePAN(value) {
    if (!value || value.length === 0) {
      return { isValid: true, errorMessage: '' };
    }

    // Convert to uppercase for validation
    const upperValue = value.toUpperCase();
    
    // Check length
    if (upperValue.length !== this.maxLength) {
      return { isValid: false, errorMessage: this.errorMessages.invalidFormat };
    }

    // Check first 5 characters (letters)
    const firstFive = upperValue.substring(0, 5);
    if (!/^[A-Z]{5}$/.test(firstFive)) {
      return { isValid: false, errorMessage: this.errorMessages.invalidLetters };
    }

    // Check 4th character specifically
    if (upperValue.charAt(3) !== this.fourthCharacter.toUpperCase()) {
      const errorMsg = this.errorMessages.invalidFourthChar.replace('{fourthCharacter}', this.fourthCharacter);
      return { isValid: false, errorMessage: errorMsg };
    }

    // Check characters 6-9 (numbers)
    const middleFour = upperValue.substring(5, 9);
    if (!/^[0-9]{4}$/.test(middleFour)) {
      return { isValid: false, errorMessage: this.errorMessages.invalidNumbers };
    }

    // Check last character (letter)
    const lastChar = upperValue.charAt(9);
    if (!/^[A-Z]$/.test(lastChar)) {
      return { isValid: false, errorMessage: this.errorMessages.invalidLastChar };
    }

    return { isValid: true, errorMessage: '' };
  }

  /**
   * Formats input value with automatic uppercase conversion
   * @param {string} value - The input value
   * @returns {string} - Formatted value
   */
  formatInput(value) {
    if (!value) return '';
    
    // Convert to uppercase and limit length
    let formatted = value.toUpperCase().substring(0, this.maxLength);
    
    // Remove any non-alphanumeric characters
    formatted = formatted.replace(/[^A-Z0-9]/g, '');
    
    return formatted;
  }

  /**
   * This method is where you can update the fieldModel based on view changes.
   */
  updateModel() {
    const input = this.fieldDiv.querySelector('input');
    if (input) {
      // Override the default change listener to prevent conflicts
      input.addEventListener('input', (e) => {
        e.stopPropagation();
        
        const formattedValue = this.formatInput(e.target.value);
        e.target.value = formattedValue;
        
        // Update field model value
        if (this.fieldModel) {
          this.fieldModel.value = formattedValue;
          
          // Validate and update validation state
          const validation = this.validatePAN(formattedValue);
          if (!validation.isValid) {
            this.fieldModel.markAsInvalid(validation.errorMessage);
          } else {
            // Clear any existing validation errors
            this.fieldModel.valid = true;
          }
        }
      });

      // Handle paste events
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const formattedValue = this.formatInput(pastedText);
        input.value = formattedValue;
        
        if (this.fieldModel) {
          this.fieldModel.value = formattedValue;
          const validation = this.validatePAN(formattedValue);
          if (!validation.isValid) {
            this.fieldModel.markAsInvalid(validation.errorMessage);
          } else {
            this.fieldModel.valid = true;
          }
        }
      });
    }
  }

  /**
   * Updates the form field HTML based on current state
   */
  updateView(state) {
    if (state) {
      const input = this.fieldDiv.querySelector('input');
      if (input) {
        // Set maxlength attribute
        input.setAttribute('maxlength', this.maxLength);
        
        // Add placeholder if not already set
        if (!input.getAttribute('placeholder')) {
          const placeholder = `ABCD${this.fourthCharacter}1234E`;
          input.setAttribute('placeholder', placeholder);
        }
        
        // Add pattern attribute for basic HTML5 validation
        input.setAttribute('pattern', `[A-Z]{3}${this.fourthCharacter}[A-Z][0-9]{4}[A-Z]`);
        
        // Add title attribute for tooltip
        input.setAttribute('title', `PAN format: 5 letters (4th: ${this.fourthCharacter}), 4 numbers, 1 letter`);
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
  const field = new PanInputComponent(fieldDiv, fieldJson, parentElement, formId);
  await field.initialize();
}
