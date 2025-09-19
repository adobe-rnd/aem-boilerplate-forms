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
    this.maxLength = 10;
  }

  /**
   * Validates PAN format
   * @param {string} value - The PAN value to validate
   * @returns {Object} - Validation result with isValid and errorMessage
   */
  validatePAN(value) {
    if (!value) {
      return { isValid: true, errorMessage: '' };
    }

    const pan = value.toUpperCase();

    // Check length
    if (pan.length !== this.maxLength) {
      return {
        isValid: false,
        errorMessage: `PAN must be exactly ${this.maxLength} characters long`,
      };
    }

    // Check first 5 characters (letters with 4th being configurable)
    const firstFive = pan.substring(0, 5);
    for (let i = 0; i < 5; i += 1) {
      if (i === 3) {
        // 4th character should be the configured character
        if (firstFive[i] !== this.fourthCharacter.toUpperCase()) {
          return {
            isValid: false,
            errorMessage: `4th character must be '${this.fourthCharacter.toUpperCase()}'`,
          };
        }
      } else if (!/[A-Z]/.test(firstFive[i])) {
        // Other positions should be letters
        return {
          isValid: false,
          errorMessage: `Position ${i + 1} must be a letter`,
        };
      }
    }

    // Check next 4 characters (numbers)
    const middleFour = pan.substring(5, 9);
    if (!/^\d{4}$/.test(middleFour)) {
      return {
        isValid: false,
        errorMessage: 'Characters 6-9 must be numbers',
      };
    }

    // Check last character (letter)
    const lastChar = pan.substring(9, 10);
    if (!/[A-Z]/.test(lastChar)) {
      return {
        isValid: false,
        errorMessage: 'Last character must be a letter',
      };
    }

    return { isValid: true, errorMessage: '' };
  }

  /**
   * Formats input value to uppercase and applies PAN formatting
   * @param {string} value - The input value
   * @returns {string} - Formatted value
   */
  formatPANInput(value) {
    if (!value) return '';

    // Convert to uppercase
    let formatted = value.toUpperCase();

    // Remove any non-alphanumeric characters
    formatted = formatted.replace(/[^A-Z0-9]/g, '');

    // Limit to max length
    formatted = formatted.substring(0, this.maxLength);

    return formatted;
  }

  /**
   * This method is where you can update the fieldModel based on view changes.
   */
  updateModel() {
    const input = this.fieldDiv.querySelector('input');
    if (input) {
      // Override the default change listener to prevent duplication
      input.addEventListener('input', (e) => {
        e.stopPropagation();

        const rawValue = e.target.value;
        const formattedValue = this.formatPANInput(rawValue);

        // Update the input value
        e.target.value = formattedValue;

        // Update the field model
        if (this.fieldModel) {
          this.fieldModel.value = formattedValue;

          // Validate the PAN
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
        const pastedData = e.clipboardData.getData('text');
        const formattedValue = this.formatPANInput(pastedData);
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
        // Set max length attribute
        input.setAttribute('maxlength', this.maxLength);

        // Add placeholder if not already set
        if (!input.getAttribute('placeholder')) {
          input.setAttribute('placeholder', `ABCD${this.fourthCharacter.toUpperCase()}1234E`);
        }

        // Add title attribute for better UX
        input.setAttribute('title', `PAN format: 5 letters (4th: ${this.fourthCharacter.toUpperCase()}), 4 numbers, 1 letter`);

        // Add data attribute for styling
        input.setAttribute('data-pan-input', 'true');
        input.setAttribute('data-fourth-char', this.fourthCharacter.toUpperCase());
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

    // Set up model update listeners
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
