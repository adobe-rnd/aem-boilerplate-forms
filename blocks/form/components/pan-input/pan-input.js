export default function decorate(element, fd, _container, _formId) {
  const input = element.querySelector('input');
  if (!input) return;

  // Get configurable properties from field definition
  const {
    fourthCharacter = 'P',
    invalidFourthCharacterMessage = 'Fourth character must be \'{fourthCharacter}\'',
    invalidFirstFiveMessage = 'First 5 characters must be letters',
    invalidMiddleFourMessage = 'Characters 6-9 must be numbers',
    invalidLastCharacterMessage = 'Last character must be a letter',
    lengthErrorMessage = 'PAN must be exactly 10 characters long',
  } = fd?.properties || {};

  // Add pan-input class for styling
  element.classList.add('pan-input-wrapper');

  // Function to validate PAN format
  function validatePAN(value) {
    if (!value) return { isValid: true, message: '' };

    // Convert to uppercase for validation
    const upperValue = value.toUpperCase();

    // Check length
    if (upperValue.length !== 10) {
      return { isValid: false, message: lengthErrorMessage };
    }

    // Check first 5 characters are letters
    const firstFive = upperValue.substring(0, 5);
    if (!/^[A-Z]{5}$/.test(firstFive)) {
      return { isValid: false, message: invalidFirstFiveMessage };
    }

    // Check 4th character specifically
    const fourthChar = upperValue.charAt(3);
    if (fourthChar !== fourthCharacter.toUpperCase()) {
      return {
        isValid: false,
        message: invalidFourthCharacterMessage.replace('{fourthCharacter}', fourthCharacter.toUpperCase()),
      };
    }

    // Check middle 4 characters are numbers
    const middleFour = upperValue.substring(5, 9);
    if (!/^[0-9]{4}$/.test(middleFour)) {
      return { isValid: false, message: invalidMiddleFourMessage };
    }

    // Check last character is a letter
    const lastChar = upperValue.charAt(9);
    if (!/^[A-Z]$/.test(lastChar)) {
      return { isValid: false, message: invalidLastCharacterMessage };
    }

    return { isValid: true, message: '' };
  }

  // Function to format PAN input (uppercase conversion)
  function formatPANInput(value) {
    return value.toUpperCase();
  }

  // Function to show validation error
  function showError(message) {
    element.classList.add('field-invalid');
    const descriptionEl = element.querySelector('.field-description');
    if (descriptionEl) {
      descriptionEl.textContent = message;
    }
  }

  // Function to clear validation error
  function clearError() {
    element.classList.remove('field-invalid');
    const descriptionEl = element.querySelector('.field-description');
    if (descriptionEl && descriptionEl.dataset.originalText) {
      descriptionEl.textContent = descriptionEl.dataset.originalText;
    }
  }

  // Store original help text
  const descriptionEl = element.querySelector('.field-description');
  if (descriptionEl && !descriptionEl.dataset.originalText) {
    descriptionEl.dataset.originalText = descriptionEl.textContent || '';
  }

  // Handle input events
  input.addEventListener('input', (e) => {
    e.stopPropagation(); // Prevent default form handling

    let { value } = e.target;

    // Convert to uppercase
    value = formatPANInput(value);

    // Update the input value
    if (e.target.value !== value) {
      e.target.value = value;
    }

    // Validate the PAN
    const validation = validatePAN(value);

    if (!validation.isValid) {
      showError(validation.message);
    } else {
      clearError();
    }
  });

  // Handle blur event for final validation
  input.addEventListener('blur', (e) => {
    e.stopPropagation();

    const { value } = e.target;
    const validation = validatePAN(value);

    if (!validation.isValid) {
      showError(validation.message);
    } else {
      clearError();
    }
  });

  // Handle focus event to clear errors temporarily
  input.addEventListener('focus', (e) => {
    e.stopPropagation();
    // Don't clear errors on focus, let user see what's wrong
  });

  // Set initial value formatting if there's a value
  if (input.value) {
    input.value = formatPANInput(input.value);
  }

  // Set maxlength to 10
  input.setAttribute('maxlength', '10');

  // Add pattern attribute for basic HTML5 validation
  input.setAttribute('pattern', '[A-Z]{5}[0-9]{4}[A-Z]');

  // Set title attribute for tooltip
  input.setAttribute('title', `PAN format: 5 letters (4th must be ${fourthCharacter.toUpperCase()}), 4 numbers, 1 letter`);
}
