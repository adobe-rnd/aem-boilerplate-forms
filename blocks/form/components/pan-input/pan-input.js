import { updateOrCreateInvalidMsg } from '../../util.js';

export default function decorate(element, fd) {
  const input = element.querySelector('input');
  if (!input) return;

  // Get configurable properties
  const {
    fourthCharacter = 'P',
    invalidFourthCharacterErrorMessage = 'The 4th character must be \'{fourthCharacter}\'',
    invalidLettersErrorMessage = 'First 5 characters must be letters',
    invalidNumbersErrorMessage = 'Characters 6-9 must be numbers',
    invalidLastCharacterErrorMessage = 'Last character must be a letter',
    lengthErrorMessage = 'PAN must be exactly 10 characters long',
  } = fd?.properties || {};

  // Add custom class for styling
  element.classList.add('pan-input-wrapper');
  input.classList.add('pan-input');

  // Set maxlength to 10 characters
  input.setAttribute('maxlength', '10');
  input.setAttribute('pattern', `[A-Z]{3}[${fourthCharacter.toUpperCase()}][A-Z][0-9]{4}[A-Z]`);

  // Function to validate PAN format
  function validatePAN(value) {
    if (!value) return { isValid: true };

    const upperValue = value.toUpperCase();

    // Check length
    if (upperValue.length !== 10) {
      return { isValid: false, message: lengthErrorMessage };
    }

    // Check first 5 characters are letters
    const firstFive = upperValue.substring(0, 5);
    if (!/^[A-Z]{5}$/.test(firstFive)) {
      return { isValid: false, message: invalidLettersErrorMessage };
    }

    // Check 4th character is as configured
    if (upperValue.charAt(3) !== fourthCharacter.toUpperCase()) {
      return {
        isValid: false,
        message: invalidFourthCharacterErrorMessage.replace('{fourthCharacter}', fourthCharacter.toUpperCase()),
      };
    }

    // Check next 4 characters are numbers
    const middleFour = upperValue.substring(5, 9);
    if (!/^[0-9]{4}$/.test(middleFour)) {
      return { isValid: false, message: invalidNumbersErrorMessage };
    }

    // Check last character is a letter
    const lastChar = upperValue.charAt(9);
    if (!/^[A-Z]$/.test(lastChar)) {
      return { isValid: false, message: invalidLastCharacterErrorMessage };
    }

    return { isValid: true };
  }

  // Function to format input (uppercase conversion)
  function formatInput(value) {
    return value.toUpperCase();
  }

  // Handle input events
  input.addEventListener('input', (e) => {
    e.stopPropagation(); // Override OOTB input change handler

    const { value } = e.target;

    // Convert to uppercase
    const formattedValue = formatInput(value);

    // Update the input value if it changed
    if (formattedValue !== value) {
      e.target.value = formattedValue;
    }

    // Validate the input
    const validation = validatePAN(formattedValue);

    if (!validation.isValid) {
      updateOrCreateInvalidMsg(element, validation.message);
      element.classList.add('field-invalid');
    } else {
      // Remove error state if valid
      const errorElement = element.querySelector('.field-invalid-msg');
      if (errorElement) {
        errorElement.remove();
      }
      element.classList.remove('field-invalid');
    }
  });

  // Handle paste events
  input.addEventListener('paste', (e) => {
    e.stopPropagation();

    // Allow the paste to complete, then format
    setTimeout(() => {
      const { value } = e.target;
      const formattedValue = formatInput(value);

      if (formattedValue !== value) {
        e.target.value = formattedValue;
      }

      // Validate after paste
      const validation = validatePAN(formattedValue);
      if (!validation.isValid) {
        updateOrCreateInvalidMsg(element, validation.message);
        element.classList.add('field-invalid');
      } else {
        const errorElement = element.querySelector('.field-invalid-msg');
        if (errorElement) {
          errorElement.remove();
        }
        element.classList.remove('field-invalid');
      }
    }, 0);
  });

  // Handle blur event for final validation
  input.addEventListener('blur', (e) => {
    e.stopPropagation();

    const { value } = e.target;
    const validation = validatePAN(value);

    if (!validation.isValid) {
      updateOrCreateInvalidMsg(element, validation.message);
      element.classList.add('field-invalid');
    } else {
      const errorElement = element.querySelector('.field-invalid-msg');
      if (errorElement) {
        errorElement.remove();
      }
      element.classList.remove('field-invalid');
    }
  });

  // Set initial value if provided
  if (fd.value) {
    input.value = formatInput(fd.value);
  }
}
