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
    global.window.dispatchEvent(new Event('pagehide'));
    delete global.window.adaptiveFormsWebMcpAdditionalTools;
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

  it('adds domain-specific tools from the page additionalTools factory', async () => {
    const registered = [];
    global.navigator.modelContext = {
      registerTool: (tool) => { registered.push(tool); return { unregister() {} }; },
    };
    global.window.adaptiveFormsWebMcpAdditionalTools = (form) => [{
      name: 'prepare_travel',
      description: 'Prepare this travel form.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => ({ success: true, form: form.id }),
    }];
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = formId;
    const optedIn = { ...minimalFormState, properties: { 'fd:webMcpEnabled': true } };

    await loadRuleEngine(optedIn, htmlForm, null, Sinon.stub(), null);

    const customTool = registered.find((tool) => tool.name === 'prepare_travel');
    assert.ok(customTool, 'domain-specific tool should be registered');
    assert.deepStrictEqual(
      await customTool.execute({}),
      { success: true, form: formId },
    );
  });

  it('shares one catalog across multiple opted-in forms and routes with form_id', async () => {
    const registered = new Map();
    const registerTool = Sinon.spy((tool) => {
      registered.set(tool.name, tool);
      return { unregister: () => registered.delete(tool.name) };
    });
    global.navigator.modelContext = { registerTool };
    const firstElement = document.createElement('form');
    firstElement.dataset.id = 'travel-form';
    const secondElement = document.createElement('form');
    secondElement.dataset.id = 'traveller-form';
    const first = { ...minimalFormState, id: 'travel-form', properties: { 'fd:webMcpEnabled': true } };
    const second = { ...minimalFormState, id: 'traveller-form', properties: { 'fd:webMcpEnabled': true } };

    await loadRuleEngine(first, firstElement, null, Sinon.stub(), null);
    const catalogSize = registerTool.callCount;
    await loadRuleEngine(second, secondElement, null, Sinon.stub(), null);

    assert.ok(registered.has('list_forms'));
    assert.strictEqual(registerTool.callCount, catalogSize);
    assert.deepStrictEqual(
      (await registered.get('list_forms').execute()).forms,
      [
        { id: 'travel-form', title: 'travel-form' },
        { id: 'traveller-form', title: 'traveller-form' },
      ],
    );
    assert.match(
      (await registered.get('get_form_summary').execute({})).error,
      /specify form_id/,
    );
    assert.strictEqual(
      (await registered.get('get_form_summary').execute({ form_id: 'travel-form' })).success,
      true,
    );
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
