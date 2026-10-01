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
import { createFormInstance } from '../../blocks/form/rules/model/afb-runtime.min.js';
import { registerFormWebMCP } from '../../blocks/form/rules/model/afb-webmcp.min.js';

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

  it('adds domain-specific tools from the form-bound additionalTools factory', async () => {
    const registered = [];
    global.navigator.modelContext = {
      registerTool: (tool) => { registered.push(tool); return { unregister() {} }; },
    };
    const additionalTools = (form) => [{
      name: 'prepare_travel',
      description: 'Prepare this travel form.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => ({ success: true, form: form.id }),
    }];
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = formId;
    const optedIn = { ...minimalFormState, properties: { 'fd:webMcpEnabled': true } };

    await loadRuleEngine(optedIn, htmlForm, null, Sinon.stub(), null, additionalTools);

    const customTool = registered.find((tool) => tool.name === 'prepare_travel');
    assert.ok(customTool, 'domain-specific tool should be registered');
    assert.deepStrictEqual(
      await customTool.execute({}),
      { success: true, form: formId },
    );
  });

  it('restores DOM focus for an already-active field without tracking an already-focused no-op', async () => {
    const registered = new Map();
    global.navigator.modelContext = {
      registerTool: (tool) => {
        registered.set(tool.name, tool);
        return { unregister: () => registered.delete(tool.name) };
      },
    };
    const sampleRUM = Sinon.spy();
    const previousHlx = window.hlx;
    window.hlx = { sampleRUM };
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = 'focus-form';
    htmlForm.innerHTML = '<div class="field-wrapper"><input id="city-id" name="city"></div>';
    const outside = document.createElement('button');
    document.body.append(htmlForm, outside);
    const model = createFormInstance({
      id: 'focus-form',
      properties: { 'fd:webMcpEnabled': true },
      items: [{ id: 'city-id', name: 'city', fieldType: 'text-input', type: 'string' }],
    });
    try {
      await loadRuleEngine({ ...model.getState(true), id: 'focus-form' }, htmlForm, null, Sinon.stub(), null);
      const input = htmlForm.querySelector('input');
      const focus = registered.get('focus_field');
      assert.ok(focus);
      assert.strictEqual((await focus.execute({ field: 'city' })).changed, true);
      assert.strictEqual(document.activeElement, input);
      outside.focus();
      assert.strictEqual(document.activeElement, outside);
      assert.strictEqual((await focus.execute({ field: 'city' })).changed, true);
      assert.strictEqual(document.activeElement, input);
      assert.strictEqual((await focus.execute({ field: 'city' })).changed, false);
      assert.deepStrictEqual(sampleRUM.args, [
        ['click', { source: 'af-webmcp', target: 'focus_field' }],
        ['click', { source: 'af-webmcp', target: 'focus_field' }],
      ]);
    } finally {
      window.dispatchEvent(new Event('pagehide'));
      htmlForm.remove();
      outside.remove();
      window.hlx = previousHlx;
    }
  });

  it('does not expose one form\'s additional tools on another form', async () => {
    const registered = new Map();
    global.navigator.modelContext = {
      registerTool: (tool) => {
        registered.set(tool.name, tool);
        return { unregister: () => registered.delete(tool.name) };
      },
    };
    const additionalTools = (form) => [{
      name: 'prepare_travel',
      description: 'Prepare this travel form.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => ({ success: true, form: form.id }),
    }];
    for (const id of ['travel', 'other']) {
      const element = document.createElement('form');
      element.dataset.id = id;
      await loadRuleEngine(
        { ...minimalFormState, id, properties: { 'fd:webMcpEnabled': true } },
        element,
        null,
        Sinon.stub(),
        null,
        id === 'travel' ? additionalTools : undefined,
      );
    }
    assert.strictEqual(
      (await registered.get('prepare_travel').execute({ form_id: 'travel' })).success,
      true,
    );
    assert.match(
      (await registered.get('prepare_travel').execute({ form_id: 'other' })).error,
      /unavailable/,
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

  it('the vendored adapter attributes mutations to WebMCP without values or no-ops', async () => {
    const registered = new Map();
    const sampleRUM = Sinon.spy();
    const previousHlx = window.hlx;
    window.hlx = { rum: { sampleRUM } };
    global.navigator.modelContext = {
      registerTool: (tool) => {
        registered.set(tool.name, tool);
        return { unregister: () => registered.delete(tool.name) };
      },
    };
    const form = createFormInstance({
      id: 'rum-form',
      properties: { 'fd:webMcpEnabled': true },
      items: [{ name: 'city', fieldType: 'text-input', type: 'string' }],
    });
    const unregister = registerFormWebMCP(form);
    try {
      await registered.get('get_form_summary').execute();
      await registered.get('set_field_value').execute({ field: 'city', value: 'private' });
      await registered.get('set_field_value').execute({ field: 'city', value: 'private' });
      assert.deepStrictEqual(sampleRUM.args, [
        ['fill', { source: 'af-webmcp', target: 'set_field_value' }],
      ]);
    } finally {
      unregister();
      window.hlx = previousHlx;
    }
  });
});
