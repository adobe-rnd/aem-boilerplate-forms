/* eslint-env mocha */
/**
 * Unit tests for loadRuleEngine in blocks/form/rules/index.js.
 * Covers restoring form state (worker restore flow).
 */
import assert from 'assert';
import Sinon from 'sinon';
import { loadRuleEngine, initializeRuleEngineWorker } from '../../blocks/form/rules/index.js';

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

  // Regression: the worker posts restoreState then applyFieldChanges back-to-back.
  // restoreState's handler awaits loadRuleEngine (whose dynamic model import spans
  // macrotasks), so applyFieldChanges can arrive before formModels is populated.
  // The batch must be buffered during restore and drained afterwards, not dropped.
  describe('initializeRuleEngineWorker (restore buffering)', () => {
    const minimalFormState = {
      id: formId,
      action: '/submit',
      ':itemsOrder': [],
      metadata: {},
      adaptiveform: '0.10.0',
    };

    const enumPayload = {
      field: {
        id: 'dd1',
        name: 'dd1',
        fieldType: 'drop-down',
        ':type': 'drop-down',
        type: 'string',
        enum: ['Bangkok', 'Chiang Mai', 'Phuket'],
        enumNames: ['Bangkok', 'Chiang Mai', 'Phuket'],
      },
      changes: [{ propertyName: 'enum', currentValue: ['Bangkok', 'Chiang Mai', 'Phuket'] }],
    };

    let originalWorker;
    let htmlForm;
    let select;

    function buildRenderResponse() {
      htmlForm = document.createElement('form');
      htmlForm.dataset.id = formId;
      const wrapper = document.createElement('div');
      wrapper.className = 'field-wrapper';
      wrapper.dataset.id = 'dd1';
      select = document.createElement('select');
      select.id = 'dd1';
      ['Item 1', 'Item 2'].forEach((text) => {
        const opt = document.createElement('option');
        opt.textContent = text;
        select.append(opt);
      });
      wrapper.append(select);
      htmlForm.append(wrapper);
      document.body.append(htmlForm);
      return {
        form: htmlForm,
        captcha: null,
        data: null,
        generateFormRendition: Sinon.stub(),
      };
    }

    beforeEach(() => {
      originalWorker = global.Worker;
      global.window.hlx = { codeBasePath: '' };
      // Mock Worker so the worker code path runs (JSDOM has no Worker). Messages are
      // emitted via microtasks (mirroring async worker delivery), and on 'decorated'
      // the restoreState/applyFieldChanges/sync-complete trio is posted back-to-back
      // to reproduce the restore race.
      class MockWorker {
        constructor() {
          this.listeners = {};
        }

        addEventListener(type, cb) {
          this.listeners[type] = this.listeners[type] || [];
          this.listeners[type].push(cb);
        }

        // eslint-disable-next-line class-methods-use-this
        removeEventListener() {}

        // eslint-disable-next-line class-methods-use-this
        terminate() {}

        emit(data) {
          Promise.resolve().then(() => {
            (this.listeners.message || []).forEach((cb) => cb({ data }));
          });
        }

        postMessage(msg) {
          if (msg.name === 'createFormInstance') {
            this.emit({ name: 'renderForm', payload: minimalFormState });
          } else if (msg.name === 'decorated') {
            this.emit({ name: 'restoreState', payload: { state: minimalFormState } });
            this.emit({ name: 'applyFieldChanges', payload: { fieldChanges: [enumPayload] } });
            this.emit({ name: 'sync-complete' });
          }
        }
      }
      global.Worker = MockWorker;
    });

    afterEach(() => {
      if (originalWorker === undefined) {
        delete global.Worker;
      } else {
        global.Worker = originalWorker;
      }
      if (htmlForm && htmlForm.parentNode) {
        htmlForm.parentNode.removeChild(htmlForm);
      }
    });

    it('buffers field changes that arrive during restore and applies them (does not drop the batch)', async () => {
      const renderHTMLForm = Sinon.stub().callsFake(async () => buildRenderResponse());

      await initializeRuleEngineWorker({ id: formId }, renderHTMLForm);
      // Let renderForm -> decorated -> restoreState -> loadRuleEngine -> drain settle.
      await new Promise((r) => { setTimeout(r, 100); });

      const optionTexts = Array.from(select.options).map((o) => o.textContent);
      assert.deepStrictEqual(
        optionTexts,
        ['Bangkok', 'Chiang Mai', 'Phuket'],
        'dropdown should render the buffered enum options instead of the defaults',
      );
      assert.ok(global.window.myForm, 'window.myForm should be set after restore');
    });
  });
});
