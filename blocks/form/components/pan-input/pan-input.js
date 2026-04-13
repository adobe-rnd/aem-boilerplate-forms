import { subscribe } from '../../rules/index.js';
import { updateOrCreateInvalidMsg } from '../../util.js';

/**
 * Validates and formats PAN input.
 * @param {HTMLElement} input - The input element
 * @param {string} fourthChar - The required fourth character (default: 'P')
 */
function setupPANValidation(input, fourthChar = 'P') {
  const panRegex = new RegExp(`^[A-Z]{3}${fourthChar}[A-Z]\\d{4}[A-Z]$`);

  const formatPAN = (inputValue) => {
    const cleanValue = inputValue.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const formatted = cleanValue.split('').map((char, index) => {
      if (index < 3) return /[A-Z]/.test(char) ? char : '';
      if (index === 3) return char === fourthChar ? char : '';
      if (index === 4) return /[A-Z]/.test(char) ? char : '';
      if (index >= 5 && index <= 8) return /[0-9]/.test(char) ? char : '';
      if (index === 9) return /[A-Z]/.test(char) ? char : '';
      return '';
    }).join('');
    return formatted.slice(0, 10);
  };

  const handleValidation = (value) => {
    if (value.length === 10) {
      if (!panRegex.test(value)) {
        updateOrCreateInvalidMsg(input, `Invalid PAN format. Fourth character must be ${fourthChar}`);
      } else {
        updateOrCreateInvalidMsg(input, '');
      }
    } else if (value.length > 0) {
      updateOrCreateInvalidMsg(input, 'PAN must be 10 characters long');
    } else {
      updateOrCreateInvalidMsg(input, '');
    }
  };

  input.addEventListener('input', (e) => {
    const formattedValue = formatPAN(e.target.value);
    if (formattedValue !== e.target.value) {
      e.target.value = formattedValue;
    }
    handleValidation(formattedValue);
  });

  input.addEventListener('blur', (e) => {
    const formattedValue = formatPAN(e.target.value);
    e.target.value = formattedValue;
    handleValidation(formattedValue);
  });
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  const { properties: { fourthChar = 'P' } = {} } = fieldJson || {};

  if (input) {
    fieldDiv.classList.add('pan-input-wrapper');
    input.setAttribute('maxlength', '10');
    setupPANValidation(input, fourthChar.toUpperCase());

    subscribe(fieldDiv, formId, (_fieldDiv, fieldModel) => {
      fieldModel?.subscribe(() => {
        _fieldDiv.classList.add('fieldValidated');
      }, 'fieldValidated');

      fieldModel?.subscribe(() => {
        _fieldDiv.classList.remove('fieldValidated');
      }, 'removeFieldValidatedProperty');
    });
  }
}
