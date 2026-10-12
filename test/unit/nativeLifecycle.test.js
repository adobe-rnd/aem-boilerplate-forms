/* eslint-env mocha */
import assert from 'assert';
import Sinon from 'sinon';
import { createForm, renderForm } from '../../blocks/form/form.js';
import { initAdaptiveForm } from '../../blocks/form/rules/index.js';
import { submitFailure, submitSuccess } from '../../blocks/form/submit.js';
import { DEFAULT_THANK_YOU_MESSAGE } from '../../blocks/form/constant.js';

const settle = () => new Promise((resolve) => {
  setTimeout(resolve, 30);
});

function definition(id = 'native-lifecycle') {
  return {
    id,
    adaptiveform: '0.10.0',
    action: 'https://example.invalid/native-submit',
    items: [
      {
        id: `${id}-name`, name: 'name', fieldType: 'text-input', default: 'Ada',
      },
      {
        id: `${id}-submit`,
        fieldType: 'button',
        events: { click: 'submitForm()' },
      },
    ],
  };
}

describe('Native form lifecycle', () => {
  let container;
  let hlx;

  beforeEach(() => {
    hlx = window.hlx;
    window.hlx = undefined;
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(async () => {
    await settle();
    Sinon.restore();
    container.remove();
    window.hlx = hlx;
  });

  it('keeps the returned model installed after initialization timers settle', async () => {
    const { afbForm } = await renderForm(definition(), container);
    await settle();
    assert.strictEqual(window.myForm, afbForm);
  });

  [
    { status: 200, outcome: 'submitSuccess' },
    { status: 500, outcome: 'submitFailure' },
  ].forEach(({ status, outcome }) => {
    it(`sends one native request and delivers ${outcome} to the returned model`, async () => {
      const request = Sinon.stub(global, 'fetch').resolves({
        ok: status === 200,
        status,
        headers: { get: () => 'application/json', forEach: () => {} },
        json: async () => ({}),
        text: async () => '{}',
      });
      const { form, afbForm } = await renderForm(definition(), container);
      const subscriber = Sinon.spy();
      afbForm.subscribe(subscriber, outcome);
      await settle();
      form.querySelector('button').click();
      await settle();
      assert.strictEqual(request.callCount, 1);
      assert.strictEqual(subscriber.callCount, 1);
    });
  });

  it('delivers native submitError and submitFailure on a network failure', async () => {
    const request = Sinon.stub(global, 'fetch').rejects(new Error('Controlled network failure'));
    const { form, afbForm } = await renderForm(definition(), container);
    const error = Sinon.spy();
    const failure = Sinon.spy();
    afbForm.subscribe(error, 'submitError');
    afbForm.subscribe(failure, 'submitFailure');
    await settle();
    form.querySelector('button').click();
    await settle();
    assert.strictEqual(request.callCount, 1);
    assert.strictEqual(error.callCount, 1);
    assert.strictEqual(failure.callCount, 1);
  });

  it('rejects invalid values and submits corrected values once', async () => {
    const request = Sinon.stub(global, 'fetch').resolves({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json', forEach: () => {} },
      json: async () => ({}),
      text: async () => '{}',
    });
    const input = definition();
    input.items[0].required = true;
    input.items[0].default = '';
    const { form, afbForm } = await renderForm(input, container);
    const success = Sinon.spy();
    afbForm.subscribe(success, 'submitSuccess');
    await settle();
    form.querySelector('button').click();
    await settle();
    assert.strictEqual(request.callCount, 0);
    const control = form.querySelector('input');
    control.value = 'Corrected';
    control.dispatchEvent(new Event('change', { bubbles: true }));
    form.querySelector('button').click();
    await settle();
    assert.strictEqual(request.callCount, 1);
    assert.strictEqual(success.callCount, 1);
  });

  it('retains delayed rule installation for standalone rendering', async () => {
    const { afbForm } = await renderForm(definition(), container);
    const { form } = await createForm(afbForm.getState(true));
    container.append(form);
    await settle();
    assert.notStrictEqual(window.myForm, afbForm);
    assert.strictEqual(window.myForm.getElement('native-lifecycle-name').value, 'Ada');
  });

  it('resets only the triggering form when two forms share an action', async () => {
    const first = await renderForm(definition('first'), container);
    const second = await renderForm(definition('second'), container);
    second.form.reset();
    await settle();
    assert.strictEqual(container.querySelector('form'), first.form);
    assert.strictEqual(container.querySelectorAll('form').length, 2);
    assert.ok(!container.contains(second.form));
    assert.strictEqual(window.myForm.getElement('second-name').value, 'Ada');
  });

  it('does not replace another form when reset finishes after removal', async () => {
    const first = await renderForm(definition('first'), container);
    const second = await renderForm(definition('second'), container);
    second.form.reset();
    second.form.remove();
    await settle();
    assert.strictEqual(container.querySelector('form'), first.form);
    assert.strictEqual(container.querySelectorAll('form').length, 1);
  });

  it('delivers success to external subscribers after the form is removed', async () => {
    const { form, afbForm } = await renderForm(definition(), container);
    const success = Sinon.spy();
    afbForm.subscribe(success, 'submitSuccess');
    form.remove();
    afbForm.dispatch({ type: 'submitSuccess', payload: { body: {} } });
    await settle();
    assert.strictEqual(success.callCount, 1);
    assert.strictEqual(container.querySelector('.success-message'), null);
    assert.strictEqual(form.dataset.submitting, 'false');
  });

  [
    { configured: '<strong>Configured</strong>', server: 'Server', expected: '<strong>Configured</strong>' },
    { configured: '', server: '<em>Server</em>', expected: '<em>Server</em>' },
    { configured: '', server: '', expected: DEFAULT_THANK_YOU_MESSAGE },
  ].forEach(({ configured, server, expected }) => {
    it(`preserves attached-form success HTML: ${expected}`, () => {
      const form = document.createElement('form');
      form.innerHTML = '<button type="submit" disabled>Submit</button>';
      form.dataset.thankYouMsg = configured;
      container.append(form);
      const reset = Sinon.stub(form, 'reset');
      submitSuccess({ payload: { body: { thankYouMessage: server } } }, form);
      assert.strictEqual(container.querySelector('.success-message').innerHTML, expected);
      assert.strictEqual(reset.callCount, 1);
      assert.strictEqual(form.querySelector('button').disabled, false);
    });
  });

  it('allows success and failure handling without a submit button', () => {
    const form = document.createElement('form');
    container.append(form);
    Sinon.stub(form, 'reset');
    assert.doesNotThrow(() => submitSuccess({ payload: {} }, form));
    assert.doesNotThrow(() => submitFailure({ payload: {} }, form));
    assert.ok(form.querySelector('.error-message'));
  });

  it('preserves worker rendering and deferred model restoration', async () => {
    const input = definition('worker');
    const { afbForm } = await renderForm(input, container);
    const state = afbForm.getState(true);
    const previousWorker = global.Worker;
    let worker;
    global.Worker = class {
      constructor() {
        worker = this;
        this.postMessage = Sinon.spy();
      }

      addEventListener(type, listener) {
        this.listener = listener;
      }
    };
    window.hlx = { codeBasePath: '..' };
    try {
      const form = document.createElement('form');
      input.properties = { customFunctionsPath: '/functions.js' };
      form.dataset.id = state.id;
      const renderer = Sinon.stub().resolves({ form });
      const response = initAdaptiveForm(input, renderer);
      await settle();
      assert.strictEqual(worker.postMessage.firstCall.args[0].name, 'createFormInstance');
      await worker.listener({ data: { name: 'renderForm', payload: state } });
      assert.strictEqual((await response).afbForm, null);
      assert.strictEqual(renderer.callCount, 1);
      await worker.listener({ data: { name: 'restoreState', payload: { state } } });
      await settle();
      assert.strictEqual(window.myForm.getElement('worker-name').value, 'Ada');
    } finally {
      if (previousWorker === undefined) delete global.Worker;
      else global.Worker = previousWorker;
    }
  });
});
