/* eslint-disable linebreak-style */
import { subscribe } from '../../rules/index.js';
import { setConstraints, updateOrCreateInvalidMsg } from '../../util.js';

/**
 * Validates input against a regex pattern and prevents invalid characters
 * @param {HTMLElement} input - The input element to validate
 * @param {string} regexPattern - The regex pattern to validate against
 * @param {string} errorMessage - The error message to display when validation fails
 */
function setupRegexValidation(input, regexPattern, errorMessage, init=false) {
  if (!regexPattern) return; // Skip if no regex pattern provided

  // Create a RegExp object from the pattern string
  let regex;
  try {
    regex = new RegExp(regexPattern);
  } catch (e) {
    console.error('Invalid regex pattern:', regexPattern, e);
    return;
  }

  // Track last known-valid value so selection-replace and mid-string edits
  // restore the correct prior state instead of always slicing the last char.
  let lastValidValue = input.value || '';

  // Function to validate the current input value
  const validateInput = () => {
    const isValid = regex.test(input.value);

    // Show/hide error message using the built-in utility.
    // Only clear the error when the field has a value that passes the regex —
    // do NOT clear when empty or invalid, because required/custom validation owns that state.
    if (!isValid && input.value) {
      updateOrCreateInvalidMsg(input, errorMessage);
    } else if (input?.validity?.valid !== false && input.value) {
      updateOrCreateInvalidMsg(input, '');
    }

    return isValid;
  };

  // Intercept paste: trim leading/trailing whitespace first.
  // If the trimmed value passes the regex, insert it (avoids blocking valid names
  // copied with accidental surrounding spaces). If it still fails (e.g. space in
  // the middle, special chars), block the paste and show a persistent error.
  input.addEventListener('paste', (e) => {
    const raw = e.clipboardData?.getData('text') ?? '';
    if (!raw) return;
    const trimmed = raw.trim();
    if (regex.test(trimmed)) {
      e.preventDefault();
      const start = input.selectionStart ?? input.value.length;
      const end   = input.selectionEnd   ?? input.value.length;
      let newValue = input.value.slice(0, start) + trimmed + input.value.slice(end);
      // Dispatching 'change' (not 'input') bypasses the maxLength capper in decorate();
      // truncate explicitly so paste can never exceed the field's configured maxLength.
      if (input.maxLength > 0 && newValue.length > input.maxLength) {
        newValue = newValue.slice(0, input.maxLength);
      }
      input.value = newValue;
      lastValidValue = newValue;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      e.preventDefault();
      updateOrCreateInvalidMsg(input, errorMessage);
    }
  });

  // Handle input events to prevent invalid characters.
  // Restores lastValidValue (not value.slice(0,-1)) so that selection-replace
  // scenarios (where the invalid char lands mid-string) are also blocked.
  input.addEventListener('input', (e) => {
    const { value } = e.target;

    if (value && !regex.test(value)) {
      e.target.value = lastValidValue;
      updateOrCreateInvalidMsg(input, errorMessage);
      setTimeout(() => {
        updateOrCreateInvalidMsg(input, '');
      }, 1500);
    } else {
      lastValidValue = value;
    }
  });

  // Validate on blur for complete validation
  input.addEventListener('blur', validateInput);

  // Initial validation
  if (!init) {
    validateInput();
  }
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  // Get the regex pattern and error message from the field properties
  const { regexPattern, regexErrorMessage } = fieldJson?.properties || {};

  // Find the input element within the field div
  const input = fieldDiv.querySelector('input');

  if (input) {
    // Set up min/max length constraints using the built-in setConstraints utility
    setConstraints(input, fieldJson);

    // The HTML maxlength attribute caps direct keystrokes but is bypassed when a value arrives via
    // paste or the form model, letting an over-length value (e.g. a 20-digit salary account number)
    // survive. Truncate to maxLength on input so the field can never exceed its configured length.
    const maxLen = Number(fieldJson?.maxLength) || 0;
    if (maxLen > 0) {
      input.addEventListener('input', (e) => {
        if (e.target.value.length > maxLen) {
          e.target.value = e.target.value.slice(0, maxLen);
        }
      });
    }

    // Add blur event listener for min/max length validation
    input.addEventListener('blur', () => {
      if (input.validity.tooShort) {
        updateOrCreateInvalidMsg(input, fieldJson.minLengthMessage || `Minimum ${input.minLength} characters required`);
      } else if (input.validity.tooLong) {
        updateOrCreateInvalidMsg(input, fieldJson.maxLengthMessage || `Maximum ${input.maxLength} characters allowed`);
      }
    });

    // Set up regex validation if pattern is provided
    if (regexPattern) {
      setupRegexValidation(input, regexPattern, regexErrorMessage, true);
    }
  }

  // Subscribe to field model changes
  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel) => {
    fieldModel.subscribe((e) => {
      const { payload } = e;
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'properties') {
          const { currentValue: properties } = change;
          if (properties && properties.regexPattern) {
            // Re-setup validation if properties change
            setupRegexValidation(fieldDiv.querySelector('input'), properties.regexPattern, properties.regexErrorMessage);
          }
        }
      });
    }, 'change');
  });
}
