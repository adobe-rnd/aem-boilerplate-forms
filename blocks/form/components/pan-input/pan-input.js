import { subscribe } from '../../rules/index.js';

export default function decorate(element, fd, container, formId) {
  const input = element.querySelector('input');
  if (!input) return;

  // Get configurable properties from field definition
  const {
    fourthCharacter = 'P',
    invalidFormatMessage = 'PAN must be in format: 5 letters, 4 numbers, 1 letter',
    invalidFirstFiveMessage = 'First 5 characters must be letters',
    invalidMiddleFourMessage = 'Characters 6-9 must be numbers',
    invalidLastCharacterMessage = 'Last character must be a letter',
    invalidFourthCharacterMessage = 'Fourth character must be the specified character'
  } = fd?.properties || {};

  // Add PAN-specific classes for styling
  element.classList.add('pan-input-wrapper');
  input.classList.add('pan-input');

  // Set max length to 10 characters
  input.setAttribute('maxlength', '10');

  // Function to validate PAN format
  function validatePAN(value) {
    if (!value || value.length === 0) {
      return { isValid: true, message: '' };
    }

    if (value.length !== 10) {
      return { isValid: false, message: invalidFormatMessage };
    }

    // Check first 5 characters are letters
    const firstFive = value.substring(0, 5);
    if (!/^[A-Z]{5}$/.test(firstFive)) {
      return { isValid: false, message: invalidFirstFiveMessage };
    }

    // Check fourth character matches configured value
    if (value[3] !== fourthCharacter.toUpperCase()) {
      return { isValid: false, message: invalidFourthCharacterMessage };
    }

    // Check middle 4 characters are numbers
    const middleFour = value.substring(5, 9);
    if (!/^[0-9]{4}$/.test(middleFour)) {
      return { isValid: false, message: invalidMiddleFourMessage };
    }

    // Check last character is a letter
    const lastCharacter = value.substring(9, 10);
    if (!/^[A-Z]$/.test(lastCharacter)) {
      return { isValid: false, message: invalidLastCharacterMessage };
    }

    return { isValid: true, message: '' };
  }

  // Function to format input (uppercase conversion)
  function formatInput(value) {
    return value.toUpperCase();
  }

  // Function to show validation error
  function showError(message) {
    element.classList.add('field-invalid');
    const description = element.querySelector('.field-description');
    if (description) {
      description.textContent = message;
    }
  }

  // Function to clear validation error
  function clearError() {
    element.classList.remove('field-invalid');
    const description = element.querySelector('.field-description');
    if (description) {
      // Restore original help text if it exists
      const originalText = fd?.description || '';
      description.textContent = originalText;
    }
  }

  // Input event handler for real-time validation and formatting
  input.addEventListener('input', (e) => {
    e.stopPropagation(); // Override OOTB input change handler
    
    let value = e.target.value;
    
    // Convert to uppercase
    value = formatInput(value);
    e.target.value = value;

    // Validate PAN format
    const validation = validatePAN(value);
    
    if (!validation.isValid) {
      showError(validation.message);
    } else {
      clearError();
    }
  });

  // Blur event handler for final validation
  input.addEventListener('blur', (e) => {
    e.stopPropagation();
    
    const value = e.target.value;
    const validation = validatePAN(value);
    
    if (!validation.isValid) {
      showError(validation.message);
    } else {
      clearError();
    }
  });

  // Subscribe to field model changes for programmatic validation
  subscribe(element, formId, (_fieldDiv, fieldModel) => {
    fieldModel.subscribe((e) => {
      e?.payload?.changes.forEach((change) => {
        const { propertyName, currentValue } = change;
        
        if (propertyName === 'value') {
          // Validate when value changes programmatically
          const validation = validatePAN(currentValue);
          
          if (!validation.isValid) {
            showError(validation.message);
          } else {
            clearError();
          }
        }
      });
    }, 'change');
  });

  // Initial validation if there's already a value
  if (input.value) {
    const validation = validatePAN(input.value);
    if (!validation.isValid) {
      showError(validation.message);
    }
  }
}
