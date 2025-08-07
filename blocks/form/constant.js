export const fileAttachmentText = 'Attach';
export const dragDropText = 'Drag and Drop To Upload';

export const DEFAULT_THANK_YOU_MESSAGE = 'Thank you for your submission.';

// Logging Configuration
// Enable verbose logging via URL parameter: ?afdebug=true
export const getLogLevelFromURL = (urlString = null) => {
  try {
    let searchParams = '';

    if (urlString) {
      // For worker context - use passed URL string
      const url = new URL(urlString);
      searchParams = url.search;
    } else if (typeof window !== 'undefined' && window.location) {
      // For main thread context - use window.location
      searchParams = window.location.search;
    }

    if (searchParams) {
      const urlParams = new URLSearchParams(searchParams);
      const afdebug = urlParams.get('afdebug');
      if (afdebug === 'true') {
        return 'debug'; // Debug for verbose logging
      }
    }
  } catch (error) {
    // Fallback to default if URL parsing fails
  }
  return 'error'; // Normal logging (default)
};
// Logging Configuration
// To set log level, modify this constant:
export const LOG_LEVEL = getLogLevelFromURL(); // Available options: 'off', 'debug', 'info', 'warn', 'error'

export const defaultErrorMessages = {
  accept: 'The specified file type not supported.',
  maxFileSize: 'File too large. Reduce size and try again.',
  maxItems: 'Specify a number of items equal to or less than $0.',
  minItems: 'Specify a number of items equal to or greater than $0.',
  pattern: 'Specify the value in allowed format : $0.',
  minLength: 'Please lengthen this text to $0 characters or more.',
  maxLength: 'Please shorten this text to $0 characters or less.',
  maximum: 'Value must be less than or equal to $0.',
  minimum: 'Value must be greater than or equal to $0.',
  required: 'Please fill in this field.',
};

// eslint-disable-next-line no-useless-escape
export const emailPattern = '([A-Za-z0-9][._]?)+[A-Za-z0-9]@[A-Za-z0-9]+(\.?[A-Za-z0-9]){2}\.([A-Za-z0-9]{2,4})?';

let submitBaseUrl = '';

export const SUBMISSION_SERVICE = 'https://forms.adobe.com/adobe/forms/af/submit/';

export function setSubmitBaseUrl(url) {
  submitBaseUrl = url;
}

export function getSubmitBaseUrl() {
  return submitBaseUrl;
}
