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
import { renderForm } from '../../blocks/form/form.js';

describe('WebMCP registration', () => {
  const formId = 'webmcp-form-id';
  const minimalFormState = {
    id: formId,
    action: '/submit',
    ':itemsOrder': [],
    metadata: {},
    adaptiveform: '0.10.0',
  };

  function installHost() {
    const tools = new Map();
    const registerTool = Sinon.spy((tool) => {
      tools.set(tool.name, tool);
      return { unregister: () => tools.delete(tool.name) };
    });
    global.navigator.modelContext = { registerTool };
    return { tools, registerTool };
  }

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

    assert.deepStrictEqual(registered.sort(), [
      'add_repeatable_instance', 'apply_prefill', 'explain_field', 'focus_field',
      'get_field_value', 'get_form_summary', 'list_forms', 'list_repeatable_instances',
      'navigate_to_panel', 'remove_repeatable_instance', 'set_field_value', 'submit_form',
      'validate_form_completeness',
    ]);
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

  [false, true].forEach((enabled) => {
    it(`preserves the authored Boolean ${enabled} through state serialization and restoration`, async () => {
      const { tools } = installHost();
      const model = createFormInstance({
        ...minimalFormState,
        properties: { 'fd:webMcpEnabled': enabled },
      });
      const savedState = JSON.parse(JSON.stringify(model.getState(true)));
      const htmlForm = document.createElement('form');
      htmlForm.dataset.id = formId;

      await loadRuleEngine(savedState, htmlForm, null, Sinon.stub(), null);

      assert.strictEqual(window.myForm.getState().properties['fd:webMcpEnabled'], enabled);
      assert.strictEqual(tools.size, enabled ? 13 : 0);
    });
  });

  it('revokes tools when the saved authoring property is explicitly unchecked', async () => {
    const { tools } = installHost();
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = formId;
    await loadRuleEngine(
      { ...minimalFormState, properties: { 'fd:webMcpEnabled': true } },
      htmlForm,
      null,
      Sinon.stub(),
      null,
    );
    assert.strictEqual(tools.size, 13);

    await loadRuleEngine(
      { ...minimalFormState, properties: { 'fd:webMcpEnabled': false } },
      htmlForm,
      null,
      Sinon.stub(),
      null,
    );

    assert.strictEqual(tools.size, 0);
    assert.strictEqual(window.myForm.webMcpEnabled, false);
  });

  it('replaces an existing form registration without losing the catalog', async () => {
    const { tools } = installHost();
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = formId;
    const optedIn = { ...minimalFormState, properties: { 'fd:webMcpEnabled': true } };
    await loadRuleEngine(optedIn, htmlForm, null, Sinon.stub(), null);
    const previousTool = tools.get('get_form_summary');

    await loadRuleEngine({ ...optedIn, title: 'Replacement' }, htmlForm, null, Sinon.stub(), null);

    assert.strictEqual(tools.size, 13);
    assert.deepStrictEqual((await tools.get('list_forms').execute()).forms, [
      { id: formId, title: 'Replacement' },
    ]);
    assert.strictEqual((await previousTool.execute({})).success, false);
  });

  it('revokes a registration when its replacement opts out', async () => {
    const { tools } = installHost();
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = formId;
    await loadRuleEngine(
      { ...minimalFormState, properties: { 'fd:webMcpEnabled': true } },
      htmlForm, null, Sinon.stub(), null,
    );

    await loadRuleEngine(minimalFormState, htmlForm, null, Sinon.stub(), null);

    assert.strictEqual(tools.size, 0);
  });

  it('restores connected forms after a back-forward cache transition', async () => {
    const { tools, registerTool } = installHost();
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = formId;
    document.body.append(htmlForm);
    try {
      await loadRuleEngine(
        { ...minimalFormState, properties: { 'fd:webMcpEnabled': true } },
        htmlForm, null, Sinon.stub(), null,
      );
      window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true }));
      assert.strictEqual(tools.size, 0);
      window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }));
      window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(tools.size, 13);
      assert.strictEqual(registerTool.callCount, 26);
      assert.strictEqual((await tools.get('get_form_summary').execute({})).success, true);
    } finally {
      htmlForm.remove();
    }
  });

  it('does not restore tools after a non-persisted pagehide', async () => {
    const { tools } = installHost();
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = formId;
    document.body.append(htmlForm);
    try {
      await loadRuleEngine(
        { ...minimalFormState, properties: { 'fd:webMcpEnabled': true } },
        htmlForm, null, Sinon.stub(), null,
      );
      window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: false }));
      assert.strictEqual(tools.size, 13);
      window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: false }));
      assert.strictEqual(tools.size, 0);
      window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(tools.size, 0);
    } finally {
      htmlForm.remove();
    }
  });

  it('ignores a pending adapter import after the registration is replaced', async () => {
    const { tools, registerTool } = installHost();
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = formId;
    const state = { ...minimalFormState, properties: { 'fd:webMcpEnabled': true } };
    await Promise.all([
      loadRuleEngine({ ...state, title: 'Stale' }, htmlForm, null, Sinon.stub(), null),
      loadRuleEngine({ ...state, title: 'Current' }, htmlForm, null, Sinon.stub(), null),
    ]);
    assert.strictEqual(registerTool.callCount, 13);
    assert.deepStrictEqual((await tools.get('list_forms').execute()).forms, [
      { id: formId, title: 'Current' },
    ]);
  });

  it('revokes a removed form without removing another form\'s shared tools', async () => {
    const { tools } = installHost();
    const first = document.createElement('form');
    const second = document.createElement('form');
    document.body.append(first, second);
    try {
      for (const [htmlForm, id] of [[first, 'removed'], [second, 'remaining']]) {
        htmlForm.dataset.id = id;
        await loadRuleEngine(
          { ...minimalFormState, id, properties: { 'fd:webMcpEnabled': true } },
          htmlForm, null, Sinon.stub(), null,
        );
      }
      first.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepStrictEqual((await tools.get('list_forms').execute()).forms, [
        { id: 'remaining', title: 'remaining' },
      ]);
      assert.strictEqual(tools.size, 13);
      second.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(tools.size, 0);
    } finally {
      first.remove();
      second.remove();
    }
  });

  it('keeps form loading functional without a host or after a host registration failure', async () => {
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = formId;
    const optedIn = { ...minimalFormState, properties: { 'fd:webMcpEnabled': true } };
    await loadRuleEngine(optedIn, htmlForm, null, Sinon.stub(), null);
    assert.ok(window.myForm);
    const error = Sinon.stub(console, 'error');
    global.navigator.modelContext = { registerTool: () => { throw new Error('host unavailable'); } };
    try {
      await loadRuleEngine(optedIn, htmlForm, null, Sinon.stub(), null);
      assert.ok(window.myForm);
      assert.ok(error.calledWithMatch('[af-webmcp] failed to register form'));
    } finally {
      error.restore();
    }
  });

  it('vendors read-only completeness, untrusted-content hints and fail-closed approval', async () => {
    const { tools } = installHost();
    const form = createFormInstance({
      id: 'catalog-contract',
      properties: { 'fd:webMcpEnabled': true },
      items: [
        { name: 'city', fieldType: 'text-input', type: 'string', required: true },
        { name: 'disabled', fieldType: 'text-input', type: 'string', required: true, enabled: false },
        { name: 'hidden', fieldType: 'text-input', type: 'string', required: true, visible: false },
      ],
    });
    const approval = Sinon.stub().resolves(false);
    const unregister = registerFormWebMCP(form, { onRequestApproval: approval });
    try {
      for (const name of ['get_form_summary', 'get_field_value', 'explain_field', 'validate_form_completeness']) {
        assert.strictEqual(tools.get(name).annotations.untrustedContentHint, true);
      }
      assert.strictEqual(tools.get('list_forms').annotations.untrustedContentHint, undefined);
      const initialCityValue = form.items[0].value;
      const before = form.getState(true);
      const completeness = await tools.get('validate_form_completeness').execute({});
      assert.strictEqual(completeness.complete, false);
      assert.deepStrictEqual(completeness.issues.map((issue) => issue.field).sort(), ['city', 'disabled']);
      assert.deepStrictEqual(form.getState(true), before);
      assert.strictEqual(approval.callCount, 0);
      assert.deepStrictEqual(
        await tools.get('set_field_value').execute({ field: 'city', value: 'Paris' }),
        { success: false, error: 'user consent required' },
      );
      assert.strictEqual(form.getElement(form.items[0].id).value, initialCityValue);
      approval.resolves(true);
      assert.strictEqual((await tools.get('set_field_value').execute({ field: 'city', value: 'Paris' })).success, true);
    } finally {
      unregister();
    }
  });

  it('initializes a rendered no-worker form once and keeps its tools functional', async () => {
    const { tools, registerTool } = installHost();
    const previousHlx = window.hlx;
    window.hlx = {};
    const container = document.createElement('div');
    document.body.append(container);
    try {
      const { form } = await renderForm({
        id: 'rendered-form',
        action: '/submit',
        properties: { 'fd:webMcpEnabled': true },
        items: [{ id: 'city-id', name: 'city', fieldType: 'text-input', type: 'string' }],
      }, container);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(registerTool.callCount, 13);
      assert.strictEqual((await tools.get('set_field_value').execute({ field: 'city', value: 'Paris' })).success, true);
      assert.strictEqual(form.querySelector('#city-id').value, 'Paris');
    } finally {
      container.remove();
      window.hlx = previousHlx;
    }
  });

  it('reserves rules initialization before yielding to the module import', async () => {
    installHost();
    const model = createFormInstance({
      id: 'reserved-rules',
      properties: { 'fd:webMcpEnabled': true },
      items: [],
    });
    const htmlForm = document.createElement('form');
    htmlForm.dataset.id = model.id;
    document.body.append(htmlForm);
    const loading = loadRuleEngine(model.getState(true), htmlForm);
    try {
      assert.strictEqual(htmlForm.dataset.rules, 'true');
    } finally {
      await loading;
      htmlForm.remove();
    }
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
