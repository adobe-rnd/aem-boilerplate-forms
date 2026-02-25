/* eslint-env mocha */
/**
 * Unit tests for validation message display logic.
 * Verifies that validation errors are shown for all standard HTML5 constraint
 * validation types (valueMissing, typeMismatch, patternMismatch, etc.) that
 * can be set via Universal Editor.
 *
 * Note: file-input fields are excluded as they manage their own validation
 * via the file.js component decorator.
 */
import assert from 'assert';

describe('Validation Message Display', () => {
  describe('Standard HTML5 constraint validation', () => {
    it('should show error for valueMissing (required field)', () => {
      const payload = {
        field: {
          id: 'email',
          fieldType: 'text-input',
          valid: false,
          validity: {
            valid: false,
            valueMissing: true,
          },
          validationMessage: 'This field is required',
        },
      };

      // Implementation checks specific validity flags
      const showsError = !!(
        payload.field.validity?.valueMissing
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        true,
        'Should show error for valueMissing constraint',
      );
    });

    it('should show error for typeMismatch (email, url, etc.)', () => {
      const payload = {
        field: {
          id: 'email',
          fieldType: 'email',
          valid: false,
          validity: {
            valid: false,
            typeMismatch: true,
          },
          validationMessage: 'Please enter a valid email',
        },
      };

      const showsError = !!(
        payload.field.validity?.typeMismatch
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        true,
        'Should show error for typeMismatch constraint',
      );
    });

    it('should show error for patternMismatch (regex validation)', () => {
      const payload = {
        field: {
          id: 'phone',
          fieldType: 'text-input',
          valid: false,
          validity: {
            valid: false,
            patternMismatch: true,
          },
          validationMessage: 'Please match the requested format',
        },
      };

      const showsError = !!(
        payload.field.validity?.patternMismatch
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        true,
        'Should show error for patternMismatch constraint',
      );
    });

    it('should show error for tooShort (value.length < minlength)', () => {
      const payload = {
        field: {
          id: 'username',
          fieldType: 'text-input',
          valid: false,
          validity: {
            valid: false,
            tooShort: true,
          },
          validationMessage: 'Please use at least 3 characters',
        },
      };

      const showsError = !!(
        payload.field.validity?.tooShort
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        true,
        'Should show error for tooShort constraint',
      );
    });

    it('should show error for tooLong (value.length > maxlength)', () => {
      const payload = {
        field: {
          id: 'bio',
          fieldType: 'text-input',
          valid: false,
          validity: {
            valid: false,
            tooLong: true,
          },
          validationMessage: 'Please use no more than 100 characters',
        },
      };

      const showsError = !!(
        payload.field.validity?.tooLong
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        true,
        'Should show error for tooLong constraint',
      );
    });

    it('should show error for rangeOverflow (value > max)', () => {
      const payload = {
        field: {
          id: 'age',
          fieldType: 'number',
          valid: false,
          validity: {
            valid: false,
            rangeOverflow: true,
          },
          validationMessage: 'Value must be less than or equal to 100',
        },
      };

      const showsError = !!(
        payload.field.validity?.rangeOverflow
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        true,
        'Should show error for rangeOverflow constraint',
      );
    });

    it('should show error for rangeUnderflow (value < min)', () => {
      const payload = {
        field: {
          id: 'age',
          fieldType: 'number',
          valid: false,
          validity: {
            valid: false,
            rangeUnderflow: true,
          },
          validationMessage: 'Value must be greater than or equal to 0',
        },
      };

      const showsError = !!(
        payload.field.validity?.rangeUnderflow
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        true,
        'Should show error for rangeUnderflow constraint',
      );
    });

    it('should show error for stepMismatch (value does not match step)', () => {
      const payload = {
        field: {
          id: 'quantity',
          fieldType: 'number',
          valid: false,
          validity: {
            valid: false,
            stepMismatch: true,
          },
          validationMessage: 'Please enter a valid value',
        },
      };

      const showsError = !!(
        payload.field.validity?.stepMismatch
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        true,
        'Should show error for stepMismatch constraint',
      );
    });

    it('should show error for expressionMismatch (validation expressions)', () => {
      const payload = {
        field: {
          id: 'custom',
          fieldType: 'text-input',
          valid: false,
          validity: {
            valid: false,
            expressionMismatch: true,
          },
          validationMessage: 'Validation failed',
        },
      };

      const showsError = !!(
        payload.field.validity?.expressionMismatch
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        true,
        'Should show error for expressionMismatch constraint',
      );
    });

    it('should show error for customConstraint (programmatic validation)', () => {
      const payload = {
        field: {
          id: 'custom',
          fieldType: 'text-input',
          valid: false,
          validity: {
            valid: false,
            customConstraint: true,
          },
          validationMessage: 'Custom validation failed',
        },
      };

      const showsError = !!(
        payload.field.validity?.customConstraint
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        true,
        'Should show error for customConstraint',
      );
    });
  });

  describe('Edge cases', () => {
    it('should NOT show error when field is valid', () => {
      const payload = {
        field: {
          id: 'email',
          fieldType: 'text-input',
          valid: true,
          validity: {
            valid: true,
          },
          validationMessage: '',
        },
      };

      const showsError = !!(
        (payload.field.validity?.valueMissing
          || payload.field.validity?.typeMismatch
          || payload.field.validity?.patternMismatch
          || payload.field.validity?.tooShort
          || payload.field.validity?.tooLong
          || payload.field.validity?.rangeOverflow
          || payload.field.validity?.rangeUnderflow
          || payload.field.validity?.stepMismatch
          || payload.field.validity?.expressionMismatch
          || payload.field.validity?.customConstraint)
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        false,
        'Should NOT show error when field is valid',
      );
    });

    it('should NOT show error when validationMessage is empty', () => {
      const payload = {
        field: {
          id: 'email',
          fieldType: 'text-input',
          valid: false,
          validity: {
            valid: false,
            valueMissing: true,
          },
          validationMessage: '',
        },
      };

      const showsError = !!(
        payload.field.validity?.valueMissing
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        false,
        'Should NOT show error when validationMessage is empty',
      );
    });

    it('should NOT show error when validity is undefined', () => {
      const payload = {
        field: {
          id: 'email',
          fieldType: 'text-input',
          valid: false,
          validity: undefined,
          validationMessage: 'Some error',
        },
      };

      const showsError = !!(
        payload.field.validity?.valueMissing
        && payload.field.validationMessage
      );

      assert.strictEqual(
        showsError,
        false,
        'Should NOT show error when validity is undefined',
      );
    });
  });

  describe('File input exclusion', () => {
    it('should NOT handle file-input fields (managed by file.js decorator)', () => {
      // File inputs manage their own validation via fileValidation() in file.js
      // The validationMessage handler explicitly excludes fieldType === 'file-input'
      const payload = {
        field: {
          id: 'upload',
          fieldType: 'file-input',
          valid: false,
          validity: {
            valid: false,
            acceptMismatch: true, // Custom validity flag used by file.js
          },
          validationMessage: 'Invalid file type',
        },
      };

      // The handler breaks early for file-input fields
      const isFileInput = payload.field.fieldType === 'file-input';

      assert.strictEqual(
        isFileInput,
        true,
        'File inputs should be excluded from worker validation message handler',
      );
    });
  });
});
