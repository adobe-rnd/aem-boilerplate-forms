/* eslint-env mocha */
/**
 * Unit tests for loadRuleEngine in blocks/form/rules/index.js.
 * Covers restoring form state (worker restore flow).
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
});
