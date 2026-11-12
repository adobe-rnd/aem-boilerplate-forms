/* eslint-env mocha */
/**
 * Unit tests for loadRuleEngine in blocks/form/rules/index.js.
 * Covers restoring form state (worker restore flow).
 */
import assert from 'assert';
import Sinon from 'sinon';
import { loadRuleEngine, fieldChanged } from '../../blocks/form/rules/index.js';

describe('Rule engine', () => {
  const formId = 'test-form-id';

  beforeEach(() => {
    global.window = global.window || {};
    global.window.myForm = null;
  });

  describe('loadRuleEngine', () => {
    const minimalFormState = {
      id: formId,
      action: '/submit',
      ':itemsOrder': [],
      metadata: {},
      adaptiveform: '0.10.0',
    };

    it('restores form state and sets window.myForm', async () => {
      const htmlForm = document.createElement('form');
      htmlForm.dataset.id = formId;
      const genFormRendition = Sinon.stub();

      await loadRuleEngine(minimalFormState, htmlForm, null, genFormRendition, null);

      assert.ok(global.window.myForm, 'window.myForm should be set after loadRuleEngine');
    });

    it('restores form state with no prefill data', async () => {
      const htmlForm = document.createElement('form');
      htmlForm.dataset.id = formId;

      await loadRuleEngine(minimalFormState, htmlForm, null, Sinon.stub(), null);

      assert.ok(global.window.myForm);
    });
  });

  describe('fieldChanged display/edit value handling', () => {
    const buildForm = (inputType) => {
      const form = document.createElement('form');
      form.innerHTML = '<div class="field-wrapper"><input id="dob" name="dob"></div>';
      const input = form.querySelector('input');
      input.type = inputType;
      document.body.append(form);
      return { form, input };
    };
    const payload = {
      field: {
        id: 'dob',
        name: 'dob',
        fieldType: 'date-input',
        type: 'string',
        displayFormat: 'dd MMMM, yyyy',
        displayValue: '23 October, 2026',
      },
      changes: [{ propertyName: 'value', currentValue: '2026-10-23', prevValue: '2026-10-22' }],
    };

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should write the display value when the input is in text (display) mode', async () => {
      const { form, input } = buildForm('text');
      await fieldChanged(payload, form, Sinon.stub());
      assert.strictEqual(input.value, '23 October, 2026');
    });

    it('should never write the readable display value into a native date input', async () => {
      const { form, input } = buildForm('date');
      await fieldChanged(payload, form, Sinon.stub());
      assert.strictEqual(input.value, '2026-10-23');
    });

    it('should not touch the value of the focused field', async () => {
      const { form, input } = buildForm('date');
      input.value = '2026-10-22';
      input.focus();
      await fieldChanged(payload, form, Sinon.stub());
      assert.strictEqual(input.value, '2026-10-22');
    });
  });
});
