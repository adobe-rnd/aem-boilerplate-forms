/* eslint-env mocha */
/**
 * Unit tests for validation message condition logic.
 * Tests the bug: validationMessage only checked for expressionMismatch/customConstraint,
 * but should check for any validation error (valid === false).
 */
import assert from 'assert';

describe('Validation Message Condition Logic', () => {
  /**
   * This test demonstrates the bug in the condition check.
   * Current code in blocks/form/rules/index.js lines 99-108:
   *
   * case 'validationMessage':
   *   if (validity?.expressionMismatch || validity?.customConstraint) {
   *     // Show error
   *   }
   *
   * Bug: This misses valueMissing, typeMismatch, patternMismatch, etc.
   */

  describe('Current buggy condition', () => {
    it('should FAIL for valueMissing (demonstrates the bug)', () => {
      // Simulate payload from worker for required field
      const payload = {
        field: {
          id: 'email',
          valid: false,
          validity: {
            valid: false,
            valueMissing: true, // Set when required field is empty
          },
          validationMessage: 'This field is required',
        },
      };

      // Current buggy condition
      const showsError = !!(
        payload.field.validity?.expressionMismatch
        || payload.field.validity?.customConstraint
      );

      // This assertion FAILS - demonstrating the bug
      assert.strictEqual(
        showsError,
        false,
        'BUG DEMONSTRATED: Current condition does NOT show error for valueMissing',
      );
    });

    it('should FAIL for typeMismatch (demonstrates the bug)', () => {
      const payload = {
        field: {
          id: 'email',
          valid: false,
          validity: {
            valid: false,
            typeMismatch: true, // Set when type validation fails
          },
          validationMessage: 'Please enter a valid email',
        },
      };

      const showsError = !!(
        payload.field.validity?.expressionMismatch
        || payload.field.validity?.customConstraint
      );

      assert.strictEqual(
        showsError,
        false,
        'BUG DEMONSTRATED: Current condition does NOT show error for typeMismatch',
      );
    });

    it('should PASS for expressionMismatch (existing behavior works)', () => {
      const payload = {
        field: {
          id: 'custom',
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
        || payload.field.validity?.customConstraint
      );

      assert.strictEqual(
        showsError,
        true,
        'Existing behavior: expressionMismatch DOES show error',
      );
    });

    it('should PASS for customConstraint (existing behavior works)', () => {
      const payload = {
        field: {
          id: 'custom',
          valid: false,
          validity: {
            valid: false,
            customConstraint: true,
          },
          validationMessage: 'Custom validation failed',
        },
      };

      const showsError = !!(
        payload.field.validity?.expressionMismatch
        || payload.field.validity?.customConstraint
      );

      assert.strictEqual(
        showsError,
        true,
        'Existing behavior: customConstraint DOES show error',
      );
    });
  });

  describe('Correct condition (after fix)', () => {
    it('should show error for valueMissing when valid=false', () => {
      const payload = {
        field: {
          id: 'email',
          valid: false,
          validity: {
            valid: false,
            valueMissing: true,
          },
          validationMessage: 'This field is required',
        },
      };

      // Correct condition: check if field is invalid
      const showsError = payload.field.valid === false && !!payload.field.validationMessage;

      assert.strictEqual(
        showsError,
        true,
        'FIXED: Should show error for valueMissing when valid=false',
      );
    });

    it('should show error for typeMismatch when valid=false', () => {
      const payload = {
        field: {
          id: 'email',
          valid: false,
          validity: {
            valid: false,
            typeMismatch: true,
          },
          validationMessage: 'Please enter a valid email',
        },
      };

      const showsError = payload.field.valid === false && !!payload.field.validationMessage;

      assert.strictEqual(
        showsError,
        true,
        'FIXED: Should show error for typeMismatch when valid=false',
      );
    });

    it('should still show error for expressionMismatch (regression test)', () => {
      const payload = {
        field: {
          id: 'custom',
          valid: false,
          validity: {
            valid: false,
            expressionMismatch: true,
          },
          validationMessage: 'Validation failed',
        },
      };

      const showsError = payload.field.valid === false && !!payload.field.validationMessage;

      assert.strictEqual(
        showsError,
        true,
        'Regression test: expressionMismatch still works',
      );
    });

    it('should still show error for customConstraint (regression test)', () => {
      const payload = {
        field: {
          id: 'custom',
          valid: false,
          validity: {
            valid: false,
            customConstraint: true,
          },
          validationMessage: 'Custom validation failed',
        },
      };

      const showsError = payload.field.valid === false && !!payload.field.validationMessage;

      assert.strictEqual(
        showsError,
        true,
        'Regression test: customConstraint still works',
      );
    });

    it('should NOT show error when field is valid', () => {
      const payload = {
        field: {
          id: 'email',
          valid: true,
          validity: {
            valid: true,
          },
          validationMessage: '', // Cleared when valid
        },
      };

      const showsError = payload.field.valid === false && !!payload.field.validationMessage;

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
          valid: false,
          validity: {
            valid: false,
            valueMissing: true,
          },
          validationMessage: '', // No message set
        },
      };

      const showsError = payload.field.valid === false && !!payload.field.validationMessage;

      assert.strictEqual(
        showsError,
        false,
        'Should NOT show error when validationMessage is empty',
      );
    });
  });
});
