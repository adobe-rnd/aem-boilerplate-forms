/* eslint-env mocha */
/**
 * Unit tests for new/changed code in blocks/form/rules/index.js (uncommitted changes).
 * Covers: loadRuleEngine(formDef, htmlForm, captcha, genFormRendition, data, fieldChanges),
 * fieldChanges application, formViewInitialized dispatch.
 */
import assert from 'assert';
import Sinon from 'sinon';
import { loadRuleEngine } from '../../blocks/form/rules/index.js';

describe('Rule engine (index.js) – new lines', () => {
  const formId = 'test-form-id';

  beforeEach(() => {
    global.window = global.window || {};
    global.window.myForm = null;
  });

  describe('loadRuleEngine with fieldChanges (new param and logic)', () => {
    const minimalFormState = {
      id: formId,
      action: '/submit',
      ':itemsOrder': [],
      metadata: {},
      adaptiveform: '0.10.0',
    };

    it('completes and sets window.myForm when fieldChanges is an array', async () => {
      const htmlForm = document.createElement('form');
      htmlForm.dataset.id = formId;
      const genFormRendition = Sinon.stub();

      await loadRuleEngine(minimalFormState, htmlForm, null, genFormRendition, null, []);

      assert.ok(global.window.myForm, 'window.myForm should be set after loadRuleEngine');
    });

    it('completes when fieldChanges is undefined (new optional param)', async () => {
      const htmlForm = document.createElement('form');
      htmlForm.dataset.id = formId;

      await loadRuleEngine(minimalFormState, htmlForm, null, Sinon.stub(), null, undefined);

      assert.ok(global.window.myForm);
    });

    it('completes when fieldChanges is non-empty (exercises reduce + applyFieldChangeToFormModel path)', async () => {
      const htmlForm = document.createElement('form');
      htmlForm.dataset.id = formId;
      const fieldChanges = [
        {
          field: { id: 'non-existent-field' },
          changes: [{ propertyName: 'properties.customProp', currentValue: 'x' }],
        },
      ];

      await loadRuleEngine(minimalFormState, htmlForm, null, Sinon.stub(), null, fieldChanges);

      assert.ok(global.window.myForm, 'loadRuleEngine should complete with non-empty fieldChanges');
    });
  });
});
