/* eslint-env mocha */
import assert from 'assert';
import sinon from 'sinon';
import {
  renderFormBlock, annotateFormForEditing, applyChanges, attachEventListners,
} from '../../scripts/form-editor-support.js';
import decorate from '../../blocks/form/form.js';
import { renderFormBlockFormDef, renderFormBlockFormDefWithPanel } from './fixtures/ue/renderFormBlock/formDefinition.js';

describe('renderFormBlock Test Cases', () => {
  let fetchStub;
  let consoleWarnStub;
  let consoleErrorStub;
  let originalLocation;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.classList.add('adobe-ue-edit');
    window.hlx = { codeBasePath: '../../' };

    // Store original location
    originalLocation = window.location;

    // Stub console methods
    consoleWarnStub = sinon.stub(console, 'warn');
    consoleErrorStub = sinon.stub(console, 'error');
  });

  afterEach(() => {
    if (fetchStub) {
      fetchStub.restore();
    }
    consoleWarnStub.restore();
    consoleErrorStub.restore();
    document.body.innerHTML = '';
    document.documentElement.classList.remove('adobe-ue-edit');
  });

  /**
   * Helper function to create a form block structure for testing
   */
  function createFormBlockStructure(formDef, options = {}) {
    const { hasEditMode = false, formPath = '/content/test/form' } = options;

    const mainEl = document.createElement('main');
    const formWrapperDiv = document.createElement('div');
    formWrapperDiv.classList.add('form-wrapper');

    const blockDiv = document.createElement('div');
    blockDiv.classList.add('block', 'form');
    blockDiv.dataset.aueResource = `urn:aemconnection:${formDef.properties['fd:path']}`;
    blockDiv.dataset.aueModel = 'form';
    if (hasEditMode) {
      blockDiv.classList.add('edit-mode');
    }

    const containerDiv = document.createElement('div');
    const innerDiv = document.createElement('div');

    const form = document.createElement('form');
    form.dataset.formpath = formPath;
    form.dataset.id = formDef.id;

    innerDiv.appendChild(form);
    containerDiv.appendChild(innerDiv);
    blockDiv.appendChild(containerDiv);
    formWrapperDiv.appendChild(blockDiv);
    mainEl.appendChild(formWrapperDiv);
    document.body.appendChild(mainEl);

    return { form, blockDiv, containerDiv, innerDiv };
  }

  it('should render form block in edit mode with successful fetch', async () => {
    const { form, blockDiv } = createFormBlockStructure(renderFormBlockFormDef);

    // Stub fetch to return form definition
    fetchStub = sinon.stub(global, 'fetch').resolves({
      json: () => Promise.resolve(renderFormBlockFormDef),
    });

    const result = await renderFormBlock(form, true);

    assert.ok(result, 'Result should not be null');
    assert.ok(result.formEl, 'Result should contain formEl');
    assert.ok(result.formDef, 'Result should contain formDef');
    assert.deepStrictEqual(result.formDef, renderFormBlockFormDef, 'formDef should match the fetched definition');
    assert.ok(blockDiv.classList.contains('edit-mode'), 'Block should have edit-mode class');
  });

  it('should return null when already in edit mode and editMode is true', async () => {
    const { form } = createFormBlockStructure(renderFormBlockFormDef, { hasEditMode: true });

    const result = await renderFormBlock(form, true);

    assert.strictEqual(result, null, 'Result should be null when already in edit mode');
  });

  it('should render form block when exiting edit mode (editMode=false)', async () => {
    const { form, blockDiv } = createFormBlockStructure(renderFormBlockFormDef, { hasEditMode: true });

    // Stub fetch to return form definition
    fetchStub = sinon.stub(global, 'fetch').resolves({
      json: () => Promise.resolve(renderFormBlockFormDef),
    });

    const result = await renderFormBlock(form, false);

    assert.ok(result, 'Result should not be null');
    assert.ok(result.formEl, 'Result should contain formEl');
    assert.ok(!blockDiv.classList.contains('edit-mode'), 'Block should not have edit-mode class when editMode is false');
  });

  it('should use fallback fetchForm when primary fetch fails', async () => {
    const { form, blockDiv } = createFormBlockStructure(renderFormBlockFormDef);

    // Stub fetch to fail on first call (model.json) but succeed for fallback
    let callCount = 0;
    fetchStub = sinon.stub(global, 'fetch').callsFake((url) => {
      callCount += 1;
      if (url.endsWith('.model.json')) {
        return Promise.reject(new Error('Fetch failed'));
      }
      // Fallback fetch for fetchForm
      return Promise.resolve({
        headers: {
          get: () => 'application/json',
        },
        json: () => Promise.resolve(renderFormBlockFormDef),
      });
    });

    const result = await renderFormBlock(form, true);

    assert.ok(result, 'Result should not be null after fallback');
    assert.ok(consoleWarnStub.calledOnce, 'console.warn should be called for failed fetch');
    assert.ok(blockDiv.classList.contains('edit-mode'), 'Block should have edit-mode class');
  });

  it('should show a repair warning when the model and fallback cannot be loaded', async () => {
    const { form } = createFormBlockStructure(renderFormBlockFormDef);

    // Stub fetch to always fail
    fetchStub = sinon.stub(global, 'fetch').rejects(new Error('All fetches failed'));

    const result = await renderFormBlock(form, true);

    assert.strictEqual(result.formEl.dataset.authoringRecovery, 'true');
    assert.ok(result.formEl.querySelector('[role="alert"]').textContent.includes('could not be retrieved'));
    assert.ok(consoleWarnStub.called, 'console.warn should be called for failed model.json fetch');
    assert.ok(consoleErrorStub.called, 'console.error should be called for failed fallback fetch');
  });

  it('should show a repair warning when the model has no definition', async () => {
    const { form } = createFormBlockStructure(renderFormBlockFormDef);

    // Stub fetch to return null
    fetchStub = sinon.stub(global, 'fetch').resolves({
      json: () => Promise.resolve(null),
    });

    const result = await renderFormBlock(form, true);

    assert.strictEqual(result.formEl.dataset.authoringRecovery, 'true');
    assert.ok(result.formEl.querySelector('[role="alert"]'));
  });

  it('should create proper DOM structure with pre and code elements', async () => {
    const { form, blockDiv } = createFormBlockStructure(renderFormBlockFormDef);

    fetchStub = sinon.stub(global, 'fetch').resolves({
      json: () => Promise.resolve(renderFormBlockFormDef),
    });

    await renderFormBlock(form, true);

    // After renderFormBlock, the div should have been processed by decorate
    // Check that a form element exists in the block
    const formEl = blockDiv.querySelector('form');
    assert.ok(formEl, 'Form element should exist after decoration');
  });

  it('should handle form with panel structure', async () => {
    const { form, blockDiv } = createFormBlockStructure(renderFormBlockFormDefWithPanel, {
      formPath: '/content/test-panel/form',
    });

    fetchStub = sinon.stub(global, 'fetch').resolves({
      json: () => Promise.resolve(renderFormBlockFormDefWithPanel),
    });

    const result = await renderFormBlock(form, true);

    assert.ok(result, 'Result should not be null');
    assert.ok(result.formDef, 'Result should contain formDef');
    assert.strictEqual(result.formDef.id, 'render-form-block-panel-test', 'formDef id should match');
    assert.ok(blockDiv.classList.contains('edit-mode'), 'Block should have edit-mode class');
  });

  it('should toggle edit-mode class based on editMode parameter', async () => {
    const { form, blockDiv } = createFormBlockStructure(renderFormBlockFormDef);

    fetchStub = sinon.stub(global, 'fetch').resolves({
      json: () => Promise.resolve(renderFormBlockFormDef),
    });

    // First, render in edit mode
    await renderFormBlock(form, true);
    assert.ok(blockDiv.classList.contains('edit-mode'), 'Block should have edit-mode class when editMode is true');

    // Get the new form element after decoration
    const newForm = blockDiv.querySelector('form');
    if (newForm) {
      newForm.dataset.formpath = '/content/test/form';
    }

    // Reset for second test
    blockDiv.classList.remove('edit-mode');

    // Now render without edit mode
    const formAfterRender = blockDiv.querySelector('form');
    if (formAfterRender) {
      formAfterRender.dataset.formpath = '/content/test/form';
      await renderFormBlock(formAfterRender, false);
      assert.ok(!blockDiv.classList.contains('edit-mode'), 'Block should not have edit-mode class when editMode is false');
    }
  });

  it('should use correct formpath from form dataset for fetch', async () => {
    const formPath = '/content/custom/path/form';
    const { form } = createFormBlockStructure(renderFormBlockFormDef, { formPath });

    fetchStub = sinon.stub(global, 'fetch').resolves({
      json: () => Promise.resolve(renderFormBlockFormDef),
    });

    await renderFormBlock(form, true);

    assert.ok(fetchStub.calledWith(`${formPath}.model.json`), 'Fetch should be called with correct model.json path');
  });

  it('should replace children of container div with pre/code elements', async () => {
    const { form, blockDiv } = createFormBlockStructure(renderFormBlockFormDef);
    const containerDiv = form.parentElement;

    // Add some existing children to the container
    const existingChild = document.createElement('span');
    existingChild.textContent = 'existing content';
    containerDiv.appendChild(existingChild);

    fetchStub = sinon.stub(global, 'fetch').resolves({
      json: () => Promise.resolve(renderFormBlockFormDef),
    });

    await renderFormBlock(form, true);

    // After decoration, the structure should be updated
    const formEl = blockDiv.querySelector('form');
    assert.ok(formEl, 'Form element should exist after decoration');
  });

  it('should return formEl that is a form element', async () => {
    const { form } = createFormBlockStructure(renderFormBlockFormDef);

    fetchStub = sinon.stub(global, 'fetch').resolves({
      json: () => Promise.resolve(renderFormBlockFormDef),
    });

    const result = await renderFormBlock(form, true);

    assert.ok(result.formEl, 'formEl should exist');
    assert.strictEqual(result.formEl.tagName, 'FORM', 'formEl should be a form element');
  });
});

describe('Authoring repair view', () => {
  const formPath = '/content/forms/af/test/jcr:content/root/section/form';
  let fetchStub;
  let worker;
  let originalWorker;
  let originalMode;
  let originalModel;
  let raw;
  let models;
  let rootModel;

  function jsonResponse(body, status = 200) {
    return {
      ok: status === 200,
      status,
      headers: { get: () => 'application/json' },
      json: async () => body,
    };
  }

  function componentModel(path, fieldType = 'text-input') {
    return {
      id: path.replace(/[^a-zA-Z0-9]/g, '-'),
      fieldType,
      name: path.split('/').pop(),
      label: { value: fieldType === 'radio-group' ? 'Radio Group' : 'Text Input' },
      properties: { 'fd:path': path },
      ':type': 'core/fd/components/form/textinput/v1/textinput',
    };
  }

  function createBlock(path = formPath) {
    const block = document.createElement('div');
    block.className = 'block form';
    block.dataset.aueResource = `urn:aemconnection:${path}`;
    block.dataset.aueModel = 'form';
    block.innerHTML = '<div><div><pre><code>""</code></pre></div></div>';
    let main = document.querySelector('main');
    if (!main) {
      main = document.createElement('main');
      document.body.append(main);
    }
    main.append(block);
    return block;
  }

  async function openRepairView(block = createBlock()) {
    const result = await decorate(block);
    annotateFormForEditing(result.form, result.formDef);
    return result;
  }

  beforeEach(() => {
    document.body.replaceChildren();
    document.documentElement.classList.add('adobe-ue-edit');
    originalMode = window.currentMode;
    window.currentMode = 'edit';
    window.hlx = { codeBasePath: '../../' };
    originalWorker = global.Worker;
    originalModel = window.myForm;
    worker = sinon.spy();
    global.Worker = worker;
    sinon.stub(console, 'warn');
    sinon.stub(console, 'error');
    raw = {
      fieldType: 'form',
      text_input: {
        fieldType: 'text-input',
        'jcr:title': 'Text Input',
        'sling:resourceType': 'core/fd/components/form/textinput/v1/textinput',
      },
      radio_group: {
        fieldType: 'radio-group',
        'jcr:title': 'Radio Group',
        'sling:resourceType': 'core/fd/components/form/radiobutton/v1/radiobutton',
        enum: ['first', 'second'],
        type: 'number',
      },
    };
    models = { [`${formPath}/text_input`]: componentModel(`${formPath}/text_input`) };
    rootModel = null;
    fetchStub = sinon.stub(global, 'fetch').callsFake(async (url) => {
      if (url === `${formPath}.-1.json`) return jsonResponse(raw);
      if (url === `${formPath}.model.json`) return jsonResponse(rootModel, rootModel ? 200 : 500);
      const model = models[url.replace(/\.model\.json$/, '')];
      return jsonResponse(model, model ? 200 : 500);
    });
  });

  afterEach(() => {
    sinon.restore();
    global.Worker = originalWorker;
    window.currentMode = originalMode;
    document.documentElement.classList.remove('adobe-ue-edit');
    document.body.replaceChildren();
  });

  it('should render healthy fields and selectable errors when the embedded definition is empty', async () => {
    const originalContent = JSON.stringify(raw);
    const { form } = await openRepairView();
    const broken = form.querySelector('.form-authoring-error');
    assert.strictEqual(form.dataset.rules, 'false');
    assert.strictEqual(form.dataset.formpath, formPath);
    assert.strictEqual(form.querySelectorAll('input').length, 1);
    assert.strictEqual(form.querySelector('input').disabled, true);
    assert.strictEqual(broken.dataset.aueResource, `urn:aemconnection:${formPath}/radio_group`);
    assert.strictEqual(broken.dataset.aueModel, 'radio-group');
    assert.strictEqual(broken.dataset.aueLabel, 'Radio Group (needs attention)');
    assert.ok(form.querySelector('[role="alert"]').textContent.includes('before editing other fields'));
    assert.ok(fetchStub.calledWith(`${formPath}.-1.json`));
    assert.strictEqual(JSON.stringify(raw), originalContent);
    assert.strictEqual(worker.callCount, 0);
    assert.strictEqual(window.myForm, originalModel);
    const submit = new window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submit);
    assert.strictEqual(submit.defaultPrevented, true);
  });

  it('should preserve child order and recover fields inside a failed container', async () => {
    raw = {
      panel: {
        ...raw,
        fieldType: 'panel',
        'jcr:title': 'Panel',
        'sling:resourceType': 'core/fd/components/form/panelcontainer/v1/panelcontainer',
      },
    };
    models = {
      [`${formPath}/panel/text_input`]: componentModel(`${formPath}/panel/text_input`),
    };
    const { form } = await openRepairView();
    const panel = form.querySelector('.panel-wrapper');
    assert.strictEqual(panel.dataset.aueType, 'container');
    assert.strictEqual(panel.dataset.aueResource, `urn:aemconnection:${formPath}/panel`);
    assert.deepStrictEqual(
      [...panel.querySelectorAll('.field-wrapper')].map((field) => field.dataset.aueResource),
      [`urn:aemconnection:${formPath}/panel/text_input`, `urn:aemconnection:${formPath}/panel/radio_group`],
    );
    assert.strictEqual(panel.querySelectorAll('input').length, 1);
  });

  it('should highlight invalid or mismatched component models instead of rendering another resource', async () => {
    const invalidModels = [
      {},
      componentModel(`${formPath}_second/radio_group`, 'radio-group'),
    ];
    for (let index = 0; index < invalidModels.length; index += 1) {
      document.body.replaceChildren();
      models[`${formPath}/radio_group`] = invalidModels[index];
      const { form } = await openRepairView();
      const broken = form.querySelector('.form-authoring-error');
      assert.strictEqual(broken.dataset.aueResource, `urn:aemconnection:${formPath}/radio_group`);
      assert.strictEqual(form.querySelectorAll('input').length, 1);
    }
  });

  it('should not recover a different form from the page-level fallback', async () => {
    const block = createBlock();
    const form = document.createElement('form');
    form.dataset.formpath = formPath;
    block.querySelector('pre').replaceWith(form);
    const otherPath = `${formPath}_second`;
    const otherBlock = createBlock(otherPath);
    const otherContent = otherBlock.innerHTML;
    fetchStub.withArgs(document.location.pathname).resolves(jsonResponse({
      ...componentModel(otherPath, 'form'),
      ':itemsOrder': [],
      ':items': {},
    }));
    const result = await renderFormBlock(form, true);
    assert.strictEqual(result.formEl.dataset.formpath, formPath);
    assert.strictEqual(otherBlock.innerHTML, otherContent);
    assert.strictEqual(fetchStub.calledWith(`${otherPath}.-1.json`), false);
    assert.ok(result.formEl.querySelector('.form-authoring-error'));
  });

  it('should keep the repair view when an edit does not fix the complete form', async () => {
    raw.radio_group_second = { ...raw.radio_group };
    const { form } = await openRepairView();
    assert.strictEqual(form.querySelectorAll('.form-authoring-error').length, 2);
    models[`${formPath}/radio_group`] = {
      ...componentModel(`${formPath}/radio_group`, 'radio-group'),
      enum: ['first', 'second'],
      enumNames: ['First', 'Second'],
      type: 'string',
    };
    const applied = await applyChanges({
      detail: { request: { target: { resource: `urn:aemconnection:${formPath}/radio_group` } } },
    });
    assert.strictEqual(applied, true);
    const updated = document.querySelector('form');
    assert.strictEqual(updated.dataset.authoringRecovery, 'true');
    assert.strictEqual(updated.querySelectorAll('.form-authoring-error').length, 1);
    assert.ok(updated.querySelector('[data-aue-label="Radio Group"]'));
    assert.strictEqual(worker.callCount, 0);
  });

  it('should clear the warning and error annotations when the complete form model is repaired', async () => {
    await openRepairView();
    const radio = {
      ...componentModel(`${formPath}/radio_group`, 'radio-group'),
      enum: ['first', 'second'],
      enumNames: ['First', 'Second'],
      type: 'string',
    };
    rootModel = {
      ...componentModel(formPath, 'form'),
      ':itemsOrder': ['text_input', 'radio_group'],
      ':items': { text_input: models[`${formPath}/text_input`], radio_group: radio },
    };
    const infinityRequests = fetchStub.getCalls().filter((call) => call.args[0].endsWith('.-1.json')).length;
    const applied = await applyChanges({
      detail: { request: { target: { resource: `urn:aemconnection:${formPath}/radio_group` } } },
    });
    const form = document.querySelector('form');
    assert.strictEqual(applied, true);
    assert.strictEqual(form.hasAttribute('data-authoring-recovery'), false);
    assert.strictEqual(form.querySelector('.form-authoring-warning'), null);
    assert.strictEqual(form.querySelector('.form-authoring-error'), null);
    assert.strictEqual(form.querySelectorAll('input[type="radio"]').length, 2);
    assert.strictEqual(form.querySelector('[data-aue-model="radio-group"]').dataset.aueLabel, 'Radio Group');
    assert.strictEqual(fetchStub.getCalls().filter((call) => call.args[0].endsWith('.-1.json')).length, infinityRequests);
    assert.strictEqual(worker.callCount, 0);
  });

  it('should enter the repair view if a properties update breaks the embedded definition', async () => {
    const block = createBlock();
    const form = document.createElement('form');
    form.dataset.formpath = formPath;
    const field = document.createElement('div');
    field.dataset.aueResource = `urn:aemconnection:${formPath}/radio_group`;
    form.append(field);
    block.querySelector('pre').replaceWith(form);
    const applied = await applyChanges({
      detail: {
        request: { target: { resource: field.dataset.aueResource } },
        response: {
          updates: [{
            content: `<div data-aue-resource="${block.dataset.aueResource}"><pre><code>""</code></pre></div>`,
          }],
        },
      },
    });
    assert.strictEqual(applied, true);
    assert.ok(block.querySelector('form[data-authoring-recovery="true"]'));
    assert.ok(block.querySelector('[data-aue-label="Radio Group (needs attention)"]'));
  });

  it('should show an explicit diagnostic if infinity JSON is unavailable or has no components', async () => {
    fetchStub.withArgs(`${formPath}.-1.json`).resolves(jsonResponse({}, 403));
    let result = await openRepairView();
    assert.ok(result.form.querySelector('[role="alert"]').textContent.includes('could not be retrieved'));
    assert.strictEqual(result.form.querySelector('input'), null);
    document.body.replaceChildren();
    fetchStub.withArgs(`${formPath}.-1.json`).resolves(jsonResponse({ fieldType: 'form' }));
    result = await openRepairView();
    assert.ok(result.form.querySelector('[role="alert"]').textContent.includes('could not be retrieved'));
  });

  it('should not run a partial definition when switching to preview', async () => {
    const { form } = await openRepairView();
    const requests = fetchStub.callCount;
    assert.strictEqual(await renderFormBlock(form, false), null);
    assert.strictEqual(form.dataset.rules, 'false');
    assert.strictEqual(fetchStub.callCount, requests);
    assert.strictEqual(worker.callCount, 0);
  });

  it('should preserve non-author behavior without fetching recovery content', async () => {
    document.documentElement.classList.remove('adobe-ue-edit');
    window.currentMode = 'preview';
    await assert.rejects(decorate(createBlock()), SyntaxError);
    assert.strictEqual(fetchStub.callCount, 0);
    assert.strictEqual(document.querySelector('.form-authoring-warning'), null);
  });

  it('should recover an unrendered block when Universal Editor enters edit mode later', async () => {
    const block = createBlock();
    document.documentElement.classList.remove('adobe-ue-edit');
    window.currentMode = 'preview';
    attachEventListners(block.closest('main'));
    document.documentElement.classList.add('adobe-ue-edit');
    document.body.dispatchEvent(new window.CustomEvent('aue:ui-edit'));
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    assert.ok(block.querySelector('form[data-authoring-recovery="true"]'));
    assert.ok(block.querySelector('[data-aue-label="Radio Group (needs attention)"]'));
    assert.strictEqual(worker.callCount, 0);
  });
});
