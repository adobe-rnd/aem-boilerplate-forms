/* eslint-env mocha */
/**
 * Unit tests for loadRuleEngine in blocks/form/rules/index.js.
 * Covers restoring form state (worker restore flow).
 */
import assert from 'assert';
import Sinon from 'sinon';
import { loadRuleEngine, subscribe } from '../../blocks/form/rules/index.js';

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

  describe('subscribe listenChanges — forwards the LIVE field model, not a getState() snapshot', () => {
    // A form with one text field so we can subscribe to it and drive a change.
    const fieldId = 'field-1';
    const formWithField = {
      id: formId,
      action: '/submit',
      metadata: {},
      adaptiveform: '0.10.0',
      items: [
        {
          id: fieldId, name: 'field1', fieldType: 'text-input', type: 'string',
        },
      ],
    };

    it('the change callback receives the live model (has methods/getters), not e.payload.field', async () => {
      const htmlForm = document.createElement('form');
      htmlForm.dataset.id = formId;
      // The DOM wrapper the component would register; its dataset.id must match the field id.
      const fieldDiv = document.createElement('div');
      fieldDiv.dataset.id = fieldId;
      htmlForm.appendChild(fieldDiv);

      await loadRuleEngine(formWithField, htmlForm, null, Sinon.stub(), null);
      const form = global.window.myForm;
      const liveField = form.getElement(fieldId);

      const changeArgs = [];
      subscribe(fieldDiv, formId, (el, model, eventType, payload) => {
        if (eventType === 'change') { changeArgs.push({ model, payload }); }
      }, { listenChanges: true });

      // Drive a real value change → fieldChanged fires and the subscription callback runs.
      liveField.value = 'hello';

      assert.strictEqual(changeArgs.length > 0, true, 'change callback should have fired');
      const { model } = changeArgs[changeArgs.length - 1];
      // The live model is the SAME object af-core holds, exposing methods a getState() snapshot lacks.
      assert.strictEqual(model, liveField, 'callback should receive the live field model');
      assert.strictEqual(typeof model.getState, 'function', 'live model exposes getState()');
      assert.strictEqual(model.value, 'hello', 'live model reflects the current value');
    });
  });
});
