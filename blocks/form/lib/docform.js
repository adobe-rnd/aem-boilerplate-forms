import DocBasedFormToAF from './transform.js';
import { createForm } from './forms-common.js';
import { submitSuccess, submitFailure } from '../submit.js';
import { getId } from './util.js';

async function fetchForm(path) {
  const resp = await fetch(path);
  if (resp?.headers?.get('Content-Type')?.includes('application/json')) {
    return resp.json();
  }
  return null;
}

function generateUnique() {
  return new Date().valueOf() + Math.random();
}

function getFieldValue(fe, payload) {
  if (fe.type === 'radio') {
    return fe.form.elements[fe.name].value;
  } if (fe.type === 'checkbox') {
    if (fe.checked) {
      if (payload[fe.name]) {
        return `${payload[fe.name]},${fe.value}`;
      }
      return fe.value;
    }
  } else if (fe.type !== 'file') {
    return fe.value;
  }
  return null;
}

function constructPayload(form) {
  const payload = { __id__: generateUnique() };
  [...form.elements].forEach((fe) => {
    if (fe.name && !fe.matches('button') && !fe.disabled && fe.tagName !== 'FIELDSET') {
      const value = getFieldValue(fe, payload);
      if (fe.closest('.repeat-wrapper')) {
        payload[fe.name] = payload[fe.name] ? `${payload[fe.name]},${fe.value}` : value;
      } else {
        payload[fe.name] = value;
      }
    }
  });
  return { payload };
}

async function prepareRequest(form) {
  const { payload } = constructPayload(form);
  const headers = {
    'Content-Type': 'application/json',
  };
  const body = { data: payload };
  const url = form.dataset.submit || form.dataset.action;
  return { headers, body, url };
}

async function submitForm(form, captcha) {
  try {
    const { headers, body, url } = await prepareRequest(form, captcha);
    let token = null;
    if (captcha) {
      token = await captcha.getToken();
      body.data['g-recaptcha-response'] = token;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (response.ok) {
      submitSuccess(
        {
          payload: {
            body: {
              thankYouMessage: form.dataset.thankYouMsg,
              redirectUrl: form.dataset.redirectUrl,
            },
          },
        },
        form,
      );
    } else {
      submitFailure({
        payload: response,
      }, form);
    }
  } catch (error) {
    submitFailure({
      payload: error,
    }, form);
  }
}

export async function extractFormDefinition(block) {
  const container = block.querySelector('a[href]');
  if (container) {
    const path = container.href;
    if (path.endsWith('.json')) {
      const { pathname } = new URL(path);
      const definition = await fetchForm(path);
      if (definition && definition[':type'] === 'sheet') {
        const transformer = new DocBasedFormToAF();
        const formDef = transformer.transform(definition, pathname);
        formDef.properties = { ...formDef.properties, source: 'sheet' };
        return { container, formDef };
      }
    }
  }
  return {};
}

export async function renderForm(formDef) {
  if (formDef) {
    const form = await createForm(formDef, undefined, {
      submitHandler({ formEl, captcha }) {
        submitForm(formEl, captcha);
      },
    });
    try {
      const applyRuleEngine = (await import('./rules-doc/index.js')).default;
      applyRuleEngine(formDef, form);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('unable to apply rules ', e);
    }
    form.dataset.source = 'sheet';
    form.dataset.id = formDef.id || getId('form');
    return form;
  }
  return null;
}

export async function decorate(block, submitAction) {
  const container = block.querySelector('a[href]');
  const formDef = await extractFormDefinition(block);
  const form = renderForm(formDef, submitAction);
  if (form) {
    container.replaceWith(form);
  }
}
