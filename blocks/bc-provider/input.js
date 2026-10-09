/**
 * Adaptive Form input validation.
 *
 * Validates the opaque backend form definition without rendering, requesting resources, or
 * modifying the definition. Framework-free JS port of the web agent's
 * `sdk/adaptive-form/input.ts`.
 *
 * @typedef {Object} AdaptiveFormInputDiagnostic
 * @property {"INVALID_FORM_DEFINITION"|"UNSUPPORTED_FORM_FEATURE"|"INVALID_SUBMISSION_URL"} code
 * @property {string} path
 * @property {string} message
 */

const SUPPORTED_FIELD_TYPES = new Set([
  'form', 'panel', 'text', 'text-input', 'email', 'multiline', 'multiline-input',
  'drop-down', 'checkbox', 'checkbox-group', 'radio', 'radio-group',
  'plain-text', 'heading', 'hidden', 'hidden-input', 'button',
]);
const UNSUPPORTED_PANEL_VARIANTS = new Set(['wizard', 'accordion', 'tabs']);

export class AdaptiveFormInputError extends Error {
  constructor(diagnostics) {
    super(`Adaptive Form input validation failed (${diagnostics.length} issues).`);
    this.name = 'AdaptiveFormInputError';
    this.code = 'ADAPTIVE_FORM_INPUT_INVALID';
    this.diagnostics = diagnostics;
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function diagnose(diagnostics, path, message, code = 'INVALID_FORM_DEFINITION') {
  diagnostics.push({ code, path, message });
}

function validateOptionalProperties(value, path, diagnostics) {
  ['id', 'name', 'type', 'format', 'pattern', 'validationExpression', 'description', 'buttonType', 'title', 'lang', 'redirectUrl', 'thankYouMsg'].forEach((key) => {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      diagnose(diagnostics, `${path}.${key}`, 'Expected a string.');
    }
  });
  ['minLength', 'maxLength'].forEach((key) => {
    if (value[key] !== undefined && (typeof value[key] !== 'number' || !Number.isInteger(value[key]) || value[key] < 0)) {
      diagnose(diagnostics, `${path}.${key}`, 'Expected a nonnegative integer.');
    }
  });
  if (value.constraintMessages !== undefined
      && (!isRecord(value.constraintMessages) || !Object.values(value.constraintMessages).every((message) => typeof message === 'string'))) {
    diagnose(diagnostics, `${path}.constraintMessages`, 'Expected an object containing string messages.');
  }
  ['required', 'visible', 'enabled', 'readOnly'].forEach((key) => {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      diagnose(diagnostics, `${path}.${key}`, 'Expected a boolean.');
    }
  });
  ['enum', 'enumNames'].forEach((key) => {
    if (value[key] !== undefined && !Array.isArray(value[key])) {
      diagnose(diagnostics, `${path}.${key}`, 'Expected an array.');
    }
  });
  if (value.label !== undefined) {
    if (!isRecord(value.label)) {
      diagnose(diagnostics, `${path}.label`, 'Expected a label object.');
    } else {
      ['value', 'visible', 'richText'].forEach((key) => {
        const expectedType = key === 'value' ? 'string' : 'boolean';
        const actualType = typeof value.label[key];
        if (value.label[key] !== undefined && actualType !== expectedType) {
          diagnose(diagnostics, `${path}.label.${key}`, `Expected a ${expectedType}.`);
        }
      });
    }
  }
  ['properties', 'rules', 'events'].forEach((key) => {
    const property = value[key];
    if (property === undefined) return;
    if (!isRecord(property)) {
      diagnose(diagnostics, `${path}.${key}`, 'Expected an object.');
    } else if (key !== 'properties') {
      // Do not include backend-controlled event names or expressions in diagnostics.
      const valid = Object.values(property).every((expression) => typeof expression === 'string'
        || (key === 'events' && Array.isArray(expression) && expression.every((item) => typeof item === 'string')));
      if (!valid) diagnose(diagnostics, `${path}.${key}`, 'Expected rule strings or event strings/string arrays.');
    }
  });
}

function validateItem(value, path, diagnostics, ancestors, ids, root = false) {
  if (!isRecord(value)) {
    diagnose(diagnostics, path, 'Expected a form item object.');
    return;
  }
  if (ancestors.has(value)) {
    diagnose(diagnostics, path, 'Cyclic item hierarchies are not supported.');
    return;
  }
  ancestors.add(value);
  validateOptionalProperties(value, path, diagnostics);
  if (typeof value.fieldType !== 'string' || !value.fieldType.trim()) {
    diagnose(diagnostics, `${path}.fieldType`, 'Expected a nonempty field type.');
  } else if (!SUPPORTED_FIELD_TYPES.has(value.fieldType) || (!root && value.fieldType === 'form')) {
    diagnose(diagnostics, `${path}.fieldType`, 'This field type is not supported by the initial provider boundary.', 'UNSUPPORTED_FORM_FEATURE');
  }
  if (value.fieldType === 'email'
      && ((value.format !== undefined && value.format !== 'email') || (value.type !== undefined && value.type !== 'string'))) {
    diagnose(diagnostics, path, 'Email controls require string values and an omitted or email format for model validation.', 'UNSUPPORTED_FORM_FEATURE');
  }
  if (typeof value.id === 'string') {
    if (!value.id.trim() || ids.has(value.id)) {
      diagnose(diagnostics, `${path}.id`, 'Explicit IDs must be nonempty and unique within the definition.');
    }
    ids.add(value.id);
  }
  if (value.fieldType === 'panel' && isRecord(value.properties)
      && typeof value.properties.variant === 'string' && UNSUPPORTED_PANEL_VARIANTS.has(value.properties.variant)) {
    diagnose(diagnostics, `${path}.properties.variant`, 'This panel requires an unavailable component decorator.', 'UNSUPPORTED_FORM_FEATURE');
  }
  if (value.fieldType === 'drop-down' && Array.isArray(value.enum)
      && !value.enum.every((option) => typeof option === 'string')) {
    diagnose(diagnostics, `${path}.enum`, 'The installed dropdown renderer requires string option values.');
  }
  if (value.fieldType === 'drop-down' && Array.isArray(value.enumNames)
      && !value.enumNames.every((option) => typeof option === 'string' || (isRecord(option) && typeof option.value === 'string'))) {
    diagnose(diagnostics, `${path}.enumNames`, 'Expected strings or objects containing a string value.');
  }
  if (value.fieldType === 'heading' && !(typeof value.value === 'string' && value.value)
      && !(isRecord(value.label) && typeof value.label.value === 'string')) {
    diagnose(diagnostics, path, 'A heading requires a text value or label.');
  }
  if (value.items !== undefined) {
    if (!Array.isArray(value.items)) {
      diagnose(diagnostics, `${path}.items`, 'Expected an array of form items.');
    } else if (!root && value.fieldType !== 'panel') {
      diagnose(diagnostics, `${path}.items`, 'Only panels may contain nested items.', 'UNSUPPORTED_FORM_FEATURE');
    } else {
      value.items.forEach((item, index) => validateItem(item, `${path}.items[${index}]`, diagnostics, ancestors, ids));
    }
  } else if (root || value.fieldType === 'panel') {
    diagnose(diagnostics, `${path}.items`, 'Expected an array of form items.');
  }
  ancestors.delete(value);
}

function hasValidStructure(input, diagnostics) {
  validateItem(input, '$', diagnostics, new WeakSet(), new Set(), true);
  if (!isRecord(input)) return false;
  if (input.fieldType !== 'form') diagnose(diagnostics, '$.fieldType', 'The root field type must be form.');
  if (typeof input.adaptiveform !== 'string' || !input.adaptiveform.trim()) {
    diagnose(diagnostics, '$.adaptiveform', 'Expected a nonempty Adaptive Forms version.');
  }
  if (input[':type'] === 'sheet') {
    diagnose(diagnostics, '$[":type"]', 'Spreadsheet definitions are not supported.', 'UNSUPPORTED_FORM_FEATURE');
  }
  return diagnostics.length === 0;
}

function hasValidSubmissionAction(input, diagnostics) {
  if (typeof input.action !== 'string' || !input.action.trim()) {
    diagnose(diagnostics, '$.action', 'An explicit submission action is required.', 'INVALID_SUBMISSION_URL');
    return false;
  }
  let url;
  try {
    url = new URL(input.action, globalThis.location?.href);
  } catch {
    diagnose(diagnostics, '$.action', 'The submission action is not a valid URL.', 'INVALID_SUBMISSION_URL');
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    diagnose(diagnostics, '$.action', 'Expected an HTTP(S) submission URL without embedded credentials.', 'INVALID_SUBMISSION_URL');
    return false;
  }
  return true;
}

/** Validates without rendering, requesting resources, or modifying the backend definition. */
export function validateAdaptiveFormInput(input) {
  const diagnostics = [];
  if (!hasValidStructure(input, diagnostics) || !hasValidSubmissionAction(input, diagnostics)) {
    throw new AdaptiveFormInputError(diagnostics);
  }
  return input;
}
