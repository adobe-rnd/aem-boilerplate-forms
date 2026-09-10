/* eslint-env mocha */
/**
 * Unit tests for the WebMCP registration wired into loadRuleEngine
 * (blocks/form/rules/index.js). The adapter itself is covered by af-webmcp's suite;
 * here we assert the EDS runtime hands the main-thread model to the adapter, which
 * registers the catalog when the form opted in via fd:webMcpEnabled, and never
 * breaks form load otherwise.
 */
import assert from 'assert';
import Sinon from 'sinon';
import { loadRuleEngine } from '../../blocks/form/rules/index.js';

describe('WebMCP registration', () => {
  const formId = 'webmcp-form-id';
  const minimalFormState = {
    id: formId,
    action: '/submit',
    ':itemsOrder': [],
    metadata: {},
    adaptiveform: '0.10.0',
  };

  beforeEach(() => {
    global.window = global.window || {};
    global.window.myForm = null;
  });

  afterEach(() => {
    delete global.navigator.modelContext;
  });

  it('registers the WebMCP catalog on modelContext when the form opts in (fd:webMcpEnabled)', async () => {
    const registered = [];
    global.navigator.modelContext = {
      registerTool: (t) => { registered.push(t.name); return { unregister() {} }; },
    };
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = formId;
    const optedIn = { ...minimalFormState, properties: { 'fd:webMcpEnabled': true } };

    await loadRuleEngine(optedIn, htmlForm, null, Sinon.stub(), null);

    assert.ok(registered.includes('get_form_summary'), 'catalog should be registered');
    assert.ok(registered.includes('set_field_value'));
  });

  it('does not register when the form did not opt in', async () => {
    const registered = [];
    global.navigator.modelContext = {
      registerTool: (t) => { registered.push(t.name); return { unregister() {} }; },
    };
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = formId;

    await loadRuleEngine(minimalFormState, htmlForm, null, Sinon.stub(), null);

    assert.strictEqual(registered.length, 0);
    assert.ok(global.window.myForm, 'window.myForm should still be set');
  });
});
