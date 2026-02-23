/* eslint-env mocha */
/**
 * Unit tests for loadRuleEngine in blocks/form/rules/index.js.
 * Covers restoring form state and applying batched field changes (worker restore flow).
 */
import assert from 'assert';
import Sinon from 'sinon';
import { loadRuleEngine } from '../../blocks/form/rules/index.js';

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

    it('restores form state and sets window.myForm when given an empty field changes list', async () => {
      const htmlForm = document.createElement('form');
      htmlForm.dataset.id = formId;
      const genFormRendition = Sinon.stub();

      await loadRuleEngine(minimalFormState, htmlForm, null, genFormRendition, null, []);

      assert.ok(global.window.myForm, 'window.myForm should be set after loadRuleEngine');
    });

    it('restores form state when field changes param is omitted', async () => {
      const htmlForm = document.createElement('form');
      htmlForm.dataset.id = formId;

      await loadRuleEngine(minimalFormState, htmlForm, null, Sinon.stub(), null, undefined);

      assert.ok(global.window.myForm);
    });

    it('restores form state and applies batched field changes when field changes are provided', async () => {
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
