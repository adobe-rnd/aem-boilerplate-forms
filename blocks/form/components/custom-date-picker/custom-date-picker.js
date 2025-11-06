/* eslint-disable no-unused-vars */
import { subscribe } from '../../rules/index.js';

/**
 * CustomDatePickerComponent - A class-based implementation of a
 * custom-date-picker component extending Date Input.
 * This component replaces the native date picker with three separate
 * keyboard inputs for day, month, and year to provide a better mobile experience.
 */
class CustomDatePickerComponent {
  /**
   * Creates an instance of CustomDatePickerComponent
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
    this.propertyChanges = ['value', 'enabled', 'readOnly', 'visible'];
    this.customEvent = '';

    // Store references to the input elements
    this.dayInput = null;
    this.monthInput = null;
    this.yearInput = null;
    this.hiddenInput = null;
    this.calendarButton = null;
    this.pickerInput = null;
  }

  /**
   * Creates the keyboard date picker inputs
   */
  createKeyboardInputs() {
    // Find the native date input
    const nativeDateInput = this.fieldDiv.querySelector('input');
    if (!nativeDateInput) return;

    // Get the field ID and name
    const fieldId = nativeDateInput.id;
    const fieldName = nativeDateInput.name;

    // Create container for the three inputs
    const inputContainer = document.createElement('div');
    inputContainer.className = 'custom-date-inputs';

    // Create day input
    this.dayInput = document.createElement('input');
    this.dayInput.type = 'tel';
    this.dayInput.inputMode = 'numeric';
    this.dayInput.pattern = '[0-9]*';
    this.dayInput.maxLength = 2;
    this.dayInput.placeholder = 'DD';
    this.dayInput.setAttribute('aria-label', 'Day');
    this.dayInput.className = 'date-input day-input';

    // Create month input
    this.monthInput = document.createElement('input');
    this.monthInput.type = 'tel';
    this.monthInput.inputMode = 'numeric';
    this.monthInput.pattern = '[0-9]*';
    this.monthInput.maxLength = 2;
    this.monthInput.placeholder = 'MM';
    this.monthInput.setAttribute('aria-label', 'Month');
    this.monthInput.className = 'date-input month-input';

    // Create year input
    this.yearInput = document.createElement('input');
    this.yearInput.type = 'tel';
    this.yearInput.inputMode = 'numeric';
    this.yearInput.pattern = '[0-9]*';
    this.yearInput.maxLength = 4;
    this.yearInput.placeholder = 'YYYY';
    this.yearInput.setAttribute('aria-label', 'Year');
    this.yearInput.className = 'date-input year-input';

    // Create separators
    const separator1 = document.createElement('span');
    separator1.className = 'date-separator';
    separator1.textContent = '/';

    const separator2 = document.createElement('span');
    separator2.className = 'date-separator';
    separator2.textContent = '/';

    // Append inputs and separators
    inputContainer.appendChild(this.dayInput);
    inputContainer.appendChild(separator1);
    inputContainer.appendChild(this.monthInput);
    inputContainer.appendChild(separator2);
    inputContainer.appendChild(this.yearInput);

    // Create calendar icon button (decorative, actual interaction is on pickerInput)
    const calendarButton = document.createElement('button');
    calendarButton.type = 'button';
    calendarButton.className = 'calendar-icon-btn';
    // Hide from screen readers since the actual input above it is accessible
    calendarButton.setAttribute('aria-hidden', 'true');
    calendarButton.setAttribute('tabindex', '-1');
    calendarButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    `;

    // Store reference to calendar button
    this.calendarButton = calendarButton;

    // Add calendar button to the container
    inputContainer.appendChild(calendarButton);

    // Create a separate date input specifically for the picker
    const pickerInput = document.createElement('input');
    pickerInput.type = 'date';
    pickerInput.className = 'date-picker-input';
    // Accessible label for screen readers
    pickerInput.setAttribute('aria-label', 'Select date from calendar');
    // Keep in normal tab order for keyboard accessibility
    pickerInput.setAttribute('tabindex', '0');

    // Position the picker input directly over the calendar button
    // This allows native clicks to work on mobile Safari without showPicker()
    pickerInput.style.position = 'absolute';
    pickerInput.style.right = '4px';
    pickerInput.style.top = '50%';
    pickerInput.style.transform = 'translateY(-50%)';
    pickerInput.style.width = '32px'; // Cover the button area
    pickerInput.style.height = '32px'; // Cover the button area
    pickerInput.style.opacity = '0.01'; // Nearly invisible but not 0 (iOS requirement)
    pickerInput.style.cursor = 'pointer';
    pickerInput.style.border = 'none';
    pickerInput.style.padding = '0';
    pickerInput.style.margin = '0';
    pickerInput.style.zIndex = '2'; // Above the calendar button

    // Store reference
    this.pickerInput = pickerInput;

    // Add picker input to the container
    inputContainer.appendChild(pickerInput);

    // Hide the original native input (used for form submission only)
    nativeDateInput.style.position = 'absolute';
    nativeDateInput.style.left = '-9999px';
    nativeDateInput.style.width = '1px';
    nativeDateInput.style.height = '1px';
    nativeDateInput.style.opacity = '0';
    nativeDateInput.setAttribute('tabindex', '-1');
    this.hiddenInput = nativeDateInput;

    // Handle focus on the picker input
    pickerInput.addEventListener('focus', (e) => {
      // On mobile Safari, focus may trigger the picker automatically
      // For other browsers, we'll handle it in the click event
    });

    // Handle clicks on the picker input to open the calendar
    pickerInput.addEventListener('click', (e) => {
      e.stopPropagation();

      // Ensure input is focused first (important for mobile)
      if (document.activeElement !== pickerInput) {
        pickerInput.focus();
      }

      // Try showPicker for desktop browsers
      if (pickerInput.showPicker) {
        try {
          pickerInput.showPicker();
        } catch (error) {
          // showPicker not supported or failed
          // Mobile Safari should open naturally on click/focus
        }
      }
    });

    // Handle keyboard interaction (Enter/Space) on the picker input
    pickerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (pickerInput.showPicker) {
          try {
            pickerInput.showPicker();
          } catch (error) {
            // Fallback to click
            pickerInput.click();
          }
        } else {
          pickerInput.click();
        }
      }
    });

    // Handle clicks on the decorative button - delegate to pickerInput
    calendarButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Trigger click on the picker input
      pickerInput.click();
      pickerInput.focus();
    });

    // Listen to changes on the picker input (from calendar selection)
    pickerInput.addEventListener('change', () => {
      const { value } = pickerInput;
      if (value) {
        // Update the visible keyboard inputs
        this.updateInputsFromValue(value);

        // Update the hidden form submission input
        if (this.hiddenInput) {
          this.hiddenInput.value = value;
          this.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Update the field model
        if (this.fieldModel) {
          this.fieldModel.value = value;
        }
      }
    });

    // Insert the keyboard inputs before the native input
    nativeDateInput.parentNode.insertBefore(inputContainer, nativeDateInput);

    // Set up event listeners for the inputs
    this.setupInputEventListeners();
  }

  /**
   * Sets up event listeners for the keyboard inputs
   */
  setupInputEventListeners() {
    // Auto-advance to next field on valid input
    this.dayInput.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '');
      e.target.value = value;
      if (value.length === 2) {
        // Pad before moving to next field
        e.target.value = value.padStart(2, '0');
        this.monthInput.focus();
      }
      this.updateModelValue();
    });

    this.monthInput.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '');
      e.target.value = value;
      if (value.length === 2) {
        // Pad before moving to next field
        e.target.value = value.padStart(2, '0');
        this.yearInput.focus();
      }
      this.updateModelValue();
    });

    this.yearInput.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '');
      e.target.value = value;
      this.updateModelValue();
    });

    // Handle backspace navigation
    this.monthInput.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && e.target.value === '') {
        this.dayInput.focus();
        // Select all text in day input for easy editing
        setTimeout(() => this.dayInput.select(), 0);
      }
    });

    this.yearInput.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && e.target.value === '') {
        this.monthInput.focus();
        // Select all text in month input for easy editing
        setTimeout(() => this.monthInput.select(), 0);
      }
    });

    // Validate and format only on blur (when leaving the entire component)
    [this.dayInput, this.monthInput, this.yearInput].forEach((input) => {
      input.addEventListener('blur', () => {
        // Only format if the user has finished with this field
        // Don't format if they're just moving between fields within the component
        setTimeout(() => {
          // Check if focus moved outside the date input component
          if (!this.fieldDiv.contains(document.activeElement)) {
            this.validateAndFormat();
          }
        }, 0);
      });
    });
  }

  /**
   * Validates and formats the input values
   */
  validateAndFormat() {
    // Pad day and month with leading zeros if needed
    if (this.dayInput.value && this.dayInput.value.length === 1) {
      this.dayInput.value = this.dayInput.value.padStart(2, '0');
    }
    if (this.monthInput.value && this.monthInput.value.length === 1) {
      this.monthInput.value = this.monthInput.value.padStart(2, '0');
    }

    // Validate day (1-31)
    const day = parseInt(this.dayInput.value, 10);
    if (day && (day < 1 || day > 31)) {
      this.dayInput.value = '';
    }

    // Validate month (1-12)
    const month = parseInt(this.monthInput.value, 10);
    if (month && (month < 1 || month > 12)) {
      this.monthInput.value = '';
    }

    // Validate year (reasonable range)
    const year = parseInt(this.yearInput.value, 10);
    if (year && year < 1000) {
      // Allow partial year entry
    }

    this.updateModelValue();
  }

  /**
   * Updates the model value based on the keyboard inputs
   */
  updateModelValue() {
    const day = this.dayInput.value.padStart(2, '0');
    const month = this.monthInput.value.padStart(2, '0');
    const year = this.yearInput.value;

    // Only update if all fields have values
    if (day && month && year && year.length === 4) {
      const dateString = `${year}-${month}-${day}`;

      // Validate the date is real
      const date = new Date(dateString);
      if (!Number.isNaN(date.getTime())) {
        // Update the hidden input
        if (this.hiddenInput) {
          this.hiddenInput.value = dateString;
          // Trigger change event so the form model is updated
          this.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Update the field model if available
        if (this.fieldModel) {
          this.fieldModel.value = dateString;
        }
      }
    } else {
      // Clear the value if incomplete
      if (this.hiddenInput) {
        this.hiddenInput.value = '';
      }
      if (this.fieldModel && this.fieldModel.value) {
        this.fieldModel.value = '';
      }
    }
  }

  /**
   * Updates the keyboard inputs based on the model value
   */
  updateInputsFromValue(value) {
    if (!value || !this.dayInput || !this.monthInput || !this.yearInput) {
      return;
    }

    // Parse the date value (expected format: YYYY-MM-DD)
    const dateParts = value.split('-');
    if (dateParts.length === 3) {
      const [year, month, day] = dateParts;
      this.yearInput.value = year;
      this.monthInput.value = month;
      this.dayInput.value = day;
    }
  }

  /**
   * Updates the form field HTML based on current state
   */
  updateView(state) {
    if (!state) return;

    // Update inputs from value
    if (state.value) {
      this.updateInputsFromValue(state.value);
    }

    // Handle enabled state
    if (state.enabled !== undefined) {
      const disabled = !state.enabled;
      if (this.dayInput) this.dayInput.disabled = disabled;
      if (this.monthInput) this.monthInput.disabled = disabled;
      if (this.yearInput) this.yearInput.disabled = disabled;
      // Disable picker input (calendar button is decorative)
      if (this.pickerInput) this.pickerInput.disabled = disabled;
    }

    // Handle readOnly state
    if (state.readOnly !== undefined) {
      if (this.dayInput) this.dayInput.readOnly = state.readOnly;
      if (this.monthInput) this.monthInput.readOnly = state.readOnly;
      if (this.yearInput) this.yearInput.readOnly = state.readOnly;
      // Disable picker input when in readOnly mode (calendar button is decorative)
      if (this.pickerInput) this.pickerInput.disabled = state.readOnly;
    }

    // Handle visibility
    if (state.visible !== undefined && this.fieldDiv) {
      this.fieldDiv.style.display = state.visible ? '' : 'none';
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
    // Create the keyboard inputs
    this.createKeyboardInputs();

    // Update the view with initial data
    this.updateView(this.fieldJson);

    // Subscribe to form model changes
    subscribe(this.fieldDiv, this.formId, (element, model) => {
      this.fieldModel = model;
      this.attachEventListeners();
      // Update view with current model state
      this.updateView(model.getState());
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
  const field = new CustomDatePickerComponent(fieldDiv, fieldJson, parentElement, formId);
  await field.initialize();
}
