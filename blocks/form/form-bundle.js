import { createOptimizedPicture, loadCSS } from '../../scripts/aem.js';
import { getSubmitBaseUrl, defaultErrorMessages, DEFAULT_THANK_YOU_MESSAGE, LOG_LEVEL, SUBMISSION_SERVICE, emailPattern } from './constant.js';
import { registerFunctions as registerFunctions$1 } from './rules/model/afb-runtime.js';

function externalize(url) {
  const submitBaseUrl = getSubmitBaseUrl();
  if (submitBaseUrl) {
    return `${submitBaseUrl}${url}`;
  }
  return url;
}
function validateURL(url) {
  try {
    const validatedUrl = new URL(url, window.location.href);
    return (validatedUrl.protocol === 'http:' || validatedUrl.protocol === 'https:');
  } catch (err) {
    return false;
  }
}
function toObject(str) {
  if (typeof str === 'string') {
    try {
      return JSON.parse(str);
    } catch (e) {
      return {};
    }
  }
  return str;
}
function navigateTo(destinationURL, destinationType) {
  let param = null;
  const windowParam = window;
  let arg = null;
  switch (destinationType) {
    case '_newwindow':
      param = '_blank';
      arg = 'width=1000,height=800';
      break;
  }
  if (!param) {
    if (destinationType) {
      param = destinationType;
    } else {
      param = '_blank';
    }
  }
  if (validateURL(destinationURL)) {
    windowParam.open(destinationURL, param, arg);
  }
}
function defaultErrorHandler(response, headers, globals) {
  if (response && response.validationErrors) {
    response.validationErrors?.forEach((violation) => {
      if (violation.details) {
        if (violation.fieldName) {
          globals.functions.markFieldAsInvalid(violation.fieldName, violation.details.join('\n'), { useQualifiedName: true });
        } else if (violation.dataRef) {
          globals.functions.markFieldAsInvalid(violation.dataRef, violation.details.join('\n'), { useDataRef: true });
        }
      }
    });
  }
}
function defaultSubmitSuccessHandler(globals) {
  const { event } = globals;
  const submitSuccessResponse = event?.payload?.body;
  const { form } = globals;
  if (submitSuccessResponse) {
    if (submitSuccessResponse.redirectUrl) {
      window.location.href = encodeURI(submitSuccessResponse.redirectUrl);
    } else if (submitSuccessResponse.thankYouMessage) {
      const formContainerElement = document.getElementById(`${form.$id}`);
      const thankYouMessage = document.createElement('div');
      thankYouMessage.setAttribute('class', 'tyMessage');
      thankYouMessage.setAttribute('tabindex', '-1');
      thankYouMessage.setAttribute('role', 'alertdialog');
      thankYouMessage.innerHTML = submitSuccessResponse.thankYouMessage;
      formContainerElement.replaceWith(thankYouMessage);
      thankYouMessage.focus();
    }
  }
}
function defaultSubmitErrorHandler(defaultSubmitErrorMessage, globals) {
  window.alert(defaultSubmitErrorMessage);
}
async function fetchCaptchaToken(globals) {
  return new Promise((resolve, reject) => {
    const successCallback = function (token) {
      resolve(token);
    };
    const errorCallback = function (error) {
      reject(error);
    };
    try {
      const captcha = globals.form.$captcha;
      if (captcha.$captchaProvider === 'turnstile') {
        const turnstileContainer = document.getElementsByClassName('cmp-adaptiveform-turnstile__widget')[0];
        const turnstileParameters = {
          sitekey: captcha.$captchaSiteKey,
          callback: successCallback,
          'error-callback': errorCallback,
        };
        if (turnstile != undefined) {
          const widgetId = turnstile.render(turnstileContainer, turnstileParameters);
          if (widgetId) {
            turnstile.execute(widgetId);
          } else {
            reject({ error: 'Failed to render turnstile captcha' });
          }
        } else {
          reject({ error: 'Turnstile captcha not loaded' });
        }
      } else {
        const siteKey = captcha?.$properties['fd:captcha']?.config?.siteKey;
        const captchaElementName = captcha.$name.replaceAll('-', '_');
        let captchaPath = captcha?.$properties['fd:path'];
        const index = captchaPath.indexOf('/jcr:content');
        let formName = '';
        if (index > 0) {
          captchaPath = captchaPath.substring(0, index);
          formName = captchaPath.substring(captchaPath.lastIndexOf('/') + 1).replaceAll('-', '_');
        }
        const actionName = `submit_${formName}_${captchaElementName}`;
        grecaptcha.enterprise.ready(() => {
          grecaptcha.enterprise.execute(siteKey, { action: actionName })
            .then((token) => resolve(token))
            .catch((error) => reject(error));
        });
      }
    } catch (error) {
      reject(error);
    }
  });
}
function dateToDaysSinceEpoch(date) {
  let dateObj;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    return Math.floor(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    throw new Error('Invalid date input');
  }
  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid date input');
  }
  return Math.floor(dateObj.getTime() / (1000 * 60 * 60 * 24));
}

var functions$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  externalize: externalize,
  validateURL: validateURL,
  navigateTo: navigateTo,
  toObject: toObject,
  defaultErrorHandler: defaultErrorHandler,
  defaultSubmitSuccessHandler: defaultSubmitSuccessHandler,
  defaultSubmitErrorHandler: defaultSubmitErrorHandler,
  fetchCaptchaToken: fetchCaptchaToken,
  dateToDaysSinceEpoch: dateToDaysSinceEpoch
});

const headings = Array.from({ length: 6 }, (_, i) => `<h${i + 1}>`).join('');
const allowedTags = `${headings}<a><b><p><i><em><strong><ul><li><ol><br><hr><u><sup><sub><s>`;
function stripTags$1(input, allowd = allowedTags) {
  if (typeof input !== 'string') {
    return input;
  }
  const allowed = ((`${allowd || ''}`)
    .toLowerCase()
    .match(/<[a-z][a-z0-9]*>/g) || [])
    .join('');
  const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  const comments = /<!--[\s\S]*?-->/gi;
  const nbsp = /&nbsp;/g;
  return input.replace(comments, '')
    .replace(tags, ($0, $1) => (allowed.indexOf(`<${$1.toLowerCase()}>`) > -1 ? $0 : ''))
    .replace(nbsp, '')
    .trim();
}
function toClassName(name) {
  return typeof name === 'string'
    ? name
      .toLowerCase()
      .replace(/[^0-9a-z]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    : '';
}
const clear = Symbol('clear');
const getId = (function getId() {
  let ids = {};
  return (name) => {
    if (name === clear) {
      ids = {};
      return '';
    }
    const slug = toClassName(name);
    ids[slug] = ids[slug] || 0;
    const idSuffix = ids[slug] ? `-${ids[slug]}` : '';
    ids[slug] += 1;
    return `${slug}${idSuffix}`;
  };
}());
function createLabel(fd, tagName = 'label') {
  if (fd.label && fd.label.value) {
    const label = document.createElement(tagName);
    label.setAttribute('for', fd.id);
    label.className = 'field-label';
    if (fd.label.richText === true) {
      label.innerHTML = stripTags$1(fd.label.value);
    } else {
      label.textContent = fd.label.value;
    }
    if (fd.label.visible === false) {
      label.dataset.visible = 'false';
    }
    if (fd.tooltip) {
      label.title = stripTags$1(fd.tooltip, '');
    }
    return label;
  }
  return null;
}
function getHTMLRenderType(fd) {
  return fd?.fieldType?.replace('-input', '') ?? 'text';
}
function createFieldWrapper(fd, tagName = 'div', labelFn = createLabel) {
  const fieldWrapper = document.createElement(tagName);
  const nameStyle = fd.name ? ` field-${toClassName(fd.name)}` : '';
  const renderType = getHTMLRenderType(fd);
  const fieldId = `${renderType}-wrapper${nameStyle}`;
  fieldWrapper.className = fieldId;
  if (fd.Fieldset) {
    fieldWrapper.dataset.fieldset = fd.Fieldset;
  }
  fieldWrapper.dataset.id = fd.id;
  if (fd.visible === false) {
    fieldWrapper.dataset.visible = fd.visible;
  }
  if (fd?.fieldType === 'number-input' && fd?.type) {
    fieldWrapper.dataset.type = fd.type;
  }
  fieldWrapper.classList.add('field-wrapper');
  if (fd.label && fd.label.value && typeof labelFn === 'function') {
    const label = labelFn(fd);
    if (label) { fieldWrapper.append(label); }
  }
  return fieldWrapper;
}
function createButton$1(fd) {
  const wrapper = createFieldWrapper(fd);
  if (fd.buttonType) {
    wrapper.classList.add(`${fd?.buttonType}-wrapper`);
  }
  const button = document.createElement('button');
  button.textContent = fd?.label?.visible === false ? '' : fd?.label?.value;
  button.type = fd.buttonType || 'button';
  button.classList.add('button');
  button.id = fd.id;
  button.name = fd.name;
  if (fd?.label?.visible === false) {
    button.setAttribute('aria-label', fd?.label?.value || '');
  }
  if (fd.enabled === false) {
    button.disabled = true;
    button.setAttribute('disabled', '');
  }
  wrapper.replaceChildren(button);
  return wrapper;
}
function getFieldContainer(fieldElement) {
  const wrapper = fieldElement?.closest('.field-wrapper');
  let container = wrapper;
  if ((fieldElement.type === 'radio' || fieldElement.type === 'checkbox') && wrapper.dataset.fieldset) {
    container = fieldElement?.closest(`fieldset[name=${wrapper.dataset.fieldset}]`);
  }
  return container;
}
function createHelpText(fd) {
  const div = document.createElement('div');
  div.className = 'field-description';
  div.setAttribute('aria-live', 'polite');
  div.innerHTML = fd.description;
  div.id = `${fd.id}-description`;
  return div;
}
function updateOrCreateInvalidMsg(fieldElement, msg) {
  const container = getFieldContainer(fieldElement);
  let element = container.querySelector(':scope > .field-description');
  if (!element) {
    element = createHelpText({ id: fieldElement.id });
    container.append(element);
  }
  if (msg) {
    container.classList.add('field-invalid');
    element.textContent = msg;
  } else if (container.dataset.description) {
    container.classList.remove('field-invalid');
    element.innerHTML = container.dataset.description;
  } else if (element) {
    element.remove();
    container?.classList?.remove('field-invalid');
  }
  return element;
}
function removeInvalidMsg(fieldElement) {
  return updateOrCreateInvalidMsg(fieldElement, '');
}
const validityKeyMsgMap = {
  patternMismatch: { key: 'pattern', attribute: 'type' },
  rangeOverflow: { key: 'maximum', attribute: 'max' },
  rangeUnderflow: { key: 'minimum', attribute: 'min' },
  tooLong: { key: 'maxLength', attribute: 'maxlength' },
  tooShort: { key: 'minLength', attribute: 'minlength' },
  valueMissing: { key: 'required' },
};
function getCheckboxGroupValue(name, htmlForm) {
  const val = [];
  htmlForm.querySelectorAll(`input[name="${name}"]`).forEach((x) => {
    if (x.checked) {
      val.push(x.value);
    }
  });
  return val;
}
function updateRequiredCheckboxGroup(name, htmlForm) {
  const checkboxGroup = htmlForm.querySelectorAll(`input[name="${name}"]`) || [];
  const value = getCheckboxGroupValue(name, htmlForm);
  checkboxGroup.forEach((checkbox) => {
    if (checkbox.checked || !value.length) {
      checkbox.setAttribute('required', true);
    } else {
      checkbox.removeAttribute('required');
    }
  });
}
function getValidationMessage(fieldElement, wrapper) {
  const [invalidProperty] = Object.keys(validityKeyMsgMap)
    .filter((state) => fieldElement.validity[state]);
  const { key, attribute } = validityKeyMsgMap[invalidProperty] || {};
  const message = wrapper.dataset[`${key}ErrorMessage`] || (attribute ? defaultErrorMessages[key].replace(/\$0/, fieldElement.getAttribute(attribute)) : defaultErrorMessages[key]);
  return message || fieldElement.validationMessage;
}
function checkValidation(fieldElement) {
  const wrapper = fieldElement.closest('.field-wrapper');
  const isCheckboxGroup = fieldElement.dataset.fieldType === 'checkbox-group';
  const required = wrapper?.dataset?.required;
  if (isCheckboxGroup && required === 'true') {
    updateRequiredCheckboxGroup(fieldElement.name, fieldElement.form);
  }
  if (fieldElement.validity.valid && fieldElement.type !== 'file') {
    removeInvalidMsg(fieldElement);
    return;
  }
  const message = getValidationMessage(fieldElement, wrapper);
  updateOrCreateInvalidMsg(fieldElement, message);
}
function getSitePageName(path) {
  if (path == null) return '';
  const index = path.lastIndexOf('/jcr:content');
  if (index === -1) {
    return '';
  }
  const mpath = path.substring(0, index);
  const pathArray = mpath.split('/');
  return pathArray[pathArray.length - 1].replaceAll('-', '_');
}
function extractIdFromUrl(url) {
  const segments = url?.split('/');
  return segments?.[segments.length - 1];
}
const constraintsDef = Object.entries({
  'password|tel|email|text': [['maxLength', 'maxlength'], ['minLength', 'minlength'], 'pattern'],
  'number|range|date': [['maximum', 'Max'], ['minimum', 'Min'], 'step'],
  file: ['accept', 'Multiple'],
  panel: [['maxOccur', 'data-max'], ['minOccur', 'data-min']],
}).flatMap(([types, constraintDef]) => types.split('|')
  .map((type) => [type, constraintDef.map((cd) => (Array.isArray(cd) ? cd : [cd, cd]))]));
const constraintsObject = Object.fromEntries(constraintsDef);
function setConstraints(element, fd) {
  const renderType = getHTMLRenderType(fd);
  const constraints = constraintsObject[renderType];
  if (constraints) {
    constraints
      .filter(([nm]) => fd[nm])
      .forEach(([nm, htmlNm]) => {
        element.setAttribute(htmlNm, fd[nm]);
      });
  }
}
function setPlaceholder(element, fd) {
  if (fd.placeholder) {
    element.setAttribute('placeholder', fd.placeholder);
  }
}
function createInput(fd) {
  const input = document.createElement('input');
  input.type = getHTMLRenderType(fd);
  if (fd.fieldType === 'number-input' && fd.type === 'number') {
    input.setAttribute('step', 'any');
  }
  setPlaceholder(input, fd);
  setConstraints(input, fd);
  return input;
}
function createRadioOrCheckbox(fd) {
  const wrapper = createFieldWrapper(fd);
  const input = createInput(fd);
  const [value, uncheckedValue] = fd.enum || [];
  input.value = value;
  if (typeof uncheckedValue !== 'undefined') {
    input.dataset.uncheckedValue = uncheckedValue;
  }
  if (fd?.properties) {
    const { variant, alignment } = fd.properties;
    if (fd?.fieldType === 'checkbox' && variant === 'switch') {
      wrapper.classList.add(variant);
      if (alignment) {
        wrapper.classList.add(alignment);
      }
    }
  }
  wrapper.insertAdjacentElement('afterbegin', input);
  return wrapper;
}
function createRadioOrCheckboxUsingEnum(fd, wrapper) {
  const legend = wrapper.querySelector('legend');
  wrapper.innerHTML = '';
  if (legend) {
    wrapper.append(legend);
  }
  const type = fd.fieldType.split('-')[0];
  const isSameLength = fd.enum?.length === fd.enumNames?.length;
  fd.enum.forEach((value, index) => {
    let labelValues = fd?.enumNames;
    if (!isSameLength) {
      labelValues = fd?.enum;
    }
    const label = (typeof labelValues?.[index] === 'object' && labelValues?.[index] !== null) ? labelValues[index].value : labelValues?.[index] || value;
    const id = getId(fd.name);
    const field = createRadioOrCheckbox({
      name: fd.name,
      id,
      label: { value: label },
      fieldType: type,
      enum: [value],
      required: fd.required,
    });
    const { variant, 'afs:layout': layout } = fd.properties;
    if (variant === 'cards') {
      wrapper.classList.add(variant);
    } else {
      wrapper.classList.remove('cards');
    }
    if (layout?.orientation === 'horizontal') {
      wrapper.classList.add('horizontal');
    }
    if (layout?.orientation === 'vertical') {
      wrapper.classList.remove('horizontal');
    }
    field.classList.remove('field-wrapper', `field-${toClassName(fd.name)}`);
    const input = field.querySelector('input');
    input.id = id;
    input.dataset.fieldType = fd.fieldType;
    input.name = `${fd?.id}_${fd?.name}`;
    input.checked = Array.isArray(fd.value) ? fd.value.includes(value) : value === fd.value;
    if ((index === 0 && type === 'radio') || type === 'checkbox') {
      input.required = fd.required;
    }
    if (fd.enabled === false || fd.readOnly === true) {
      input.setAttribute('disabled', 'disabled');
    }
    wrapper.appendChild(field);
  });
}
function createDropdownUsingEnum(fd, wrapper) {
  wrapper.innerHTML = '';
  wrapper.required = fd.required;
  wrapper.title = fd.tooltip ? stripTags$1(fd.tooltip, '') : '';
  wrapper.readOnly = fd.readOnly;
  wrapper.multiple = fd.type === 'string[]' || fd.type === 'boolean[]' || fd.type === 'number[]';
  let ph;
  if (fd.placeholder) {
    ph = document.createElement('option');
    ph.textContent = fd.placeholder;
    ph.setAttribute('disabled', '');
    ph.setAttribute('value', '');
    wrapper.append(ph);
  }
  let optionSelected = false;
  const addOption = (label, value) => {
    const option = document.createElement('option');
    option.textContent = label instanceof Object ? label?.value?.trim() : label?.trim();
    option.value = String(value)?.trim() || String(label)?.trim();
    if (fd.value === option.value || (Array.isArray(fd.value) && fd.value.includes(option.value))) {
      option.setAttribute('selected', '');
      optionSelected = true;
    }
    wrapper.append(option);
    return option;
  };
  const options = fd?.enum || [];
  const optionNames = fd?.enumNames ?? options;
  if (options.length === 1
    && options?.[0]?.startsWith('https://')) {
    const optionsUrl = new URL(options?.[0]);
    if (optionsUrl.hostname.endsWith('hlx.page')
      || optionsUrl.hostname.endsWith('hlx.live')
      || optionsUrl.hostname.endsWith('aem.live')
      || optionsUrl.hostname.endsWith('aem.page')) {
      fetch(`${optionsUrl.pathname}${optionsUrl.search}`)
        .then(async (response) => {
          const json = await response.json();
          const values = [];
          json.data.forEach((opt) => {
            addOption(opt.Option, opt.Value);
            values.push(opt.Value || opt.Option);
          });
        });
    }
  } else if (options?.length !== optionNames.length) {
    options.forEach((value) => addOption(value, value));
  } else {
    options.forEach((value, index) => addOption(optionNames?.[index] ?? value, value));
  }
  if (ph && optionSelected === false) {
    ph.setAttribute('selected', '');
  }
}
async function fetchData(id, search = '') {
  try {
    const url = externalize(`/adobe/forms/af/data/${id}${search}`);
    const response = await fetch(url);
    const json = await response.json();
    const { data: prefillData } = json;
    const { data: { afData: { afBoundData: { data = {} } = {} } = {} } = {} } = json;
    return Object.keys(data).length > 0 ? data : (prefillData || json);
  } catch (ex) {
    return null;
  }
}

function submitSuccess(e, form) {
  const { payload } = e;
  const redirectUrl = form.dataset.redirectUrl || payload?.body?.redirectUrl;
  const thankYouMsg = form.dataset.thankYouMsg || payload?.body?.thankYouMessage;
  if (redirectUrl) {
    window.location.assign(encodeURI(redirectUrl));
  } else {
    let thankYouMessage = form.parentNode.querySelector('.form-message.success-message');
    if (!thankYouMessage) {
      thankYouMessage = document.createElement('div');
      thankYouMessage.className = 'form-message success-message';
    }
    thankYouMessage.innerHTML = thankYouMsg || DEFAULT_THANK_YOU_MESSAGE;
    form.parentNode.insertBefore(thankYouMessage, form);
    if (thankYouMessage.scrollIntoView) {
      thankYouMessage.scrollIntoView({ behavior: 'smooth' });
    }
    form.reset();
  }
  form.setAttribute('data-submitting', 'false');
  form.querySelector('button[type="submit"]').disabled = false;
}
function submitFailure(e, form) {
  let errorMessage = form.querySelector('.form-message.error-message');
  if (!errorMessage) {
    errorMessage = document.createElement('div');
    errorMessage.className = 'form-message error-message';
  }
  errorMessage.innerHTML = 'Some error occured while submitting the form';
  form.prepend(errorMessage);
  errorMessage.scrollIntoView({ behavior: 'smooth' });
  form.setAttribute('data-submitting', 'false');
  form.querySelector('button[type="submit"]').disabled = false;
}
function generateUnique() {
  return new Date().valueOf() + Math.random();
}
function getFieldValue(fe, payload) {
  if (fe.type === 'radio') {
    return fe.form.elements[fe.name].value;
  } if (fe.type === 'checkbox') {
    if (payload[fe.name]) {
      if (fe.checked) {
        return `${payload[fe.name]},${fe.value}`;
      }
      return payload[fe.name];
    } if (fe.checked) {
      return fe.value;
    }
  } else if (fe.type !== 'file') {
    return fe.value;
  }
  return null;
}
function constructPayload$1(form) {
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
  const { payload } = constructPayload$1(form);
  const headers = {
    'Content-Type': 'application/json',
    'x-adobe-form-hostname': window?.location?.hostname
  };
  const body = { data: payload };
  let url;
  let baseUrl = getSubmitBaseUrl();
  if (!baseUrl) {
    baseUrl = 'https://forms.adobe.com/adobe/forms/af/submit/';
    url = baseUrl + btoa(`${form.dataset.action}.json`);
  } else {
    url = form.dataset.action;
  }
  return { headers, body, url };
}
async function submitDocBasedForm(form, captcha) {
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
      submitSuccess(response, form);
    } else {
      const error = await response.text();
      throw new Error(error);
    }
  } catch (error) {
    submitFailure(error, form);
  }
}
async function handleSubmit(e, form, captcha) {
  e.preventDefault();
  const valid = form.checkValidity();
  if (valid) {
    e.submitter?.setAttribute('disabled', '');
    if (form.getAttribute('data-submitting') !== 'true') {
      form.setAttribute('data-submitting', 'true');
      form.querySelectorAll('.form-message.show').forEach((el) => el.classList.remove('show'));
      if (form.dataset.source === 'sheet') {
        await submitDocBasedForm(form, captcha);
      }
    }
  } else {
    const firstInvalidEl = form.querySelector(':invalid:not(fieldset)');
    if (firstInvalidEl) {
      firstInvalidEl.focus();
      firstInvalidEl.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

const preloadedUrls = new Set();
function preloadFunctionScripts(customFunctionsPath, codeBasePath) {
  if (typeof document === 'undefined' || !document?.head) return;
  const base = (typeof codeBasePath === 'string' && codeBasePath !== '')
    ? codeBasePath.replace(/\/$/, '')
    : '';
  const prefix = base ? `${base}/` : '/';
  const paths = [`${prefix}blocks/form/rules/functions.js`];
  if (typeof customFunctionsPath === 'string' && customFunctionsPath.trim() !== '') {
    paths.push(`${prefix}${customFunctionsPath.replace(/^\//, '').trim()}`);
  }
  paths.forEach((href) => {
    try {
      const url = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
      if (preloadedUrls.has(url)) return;
      preloadedUrls.add(url);
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = url;
      document.head.appendChild(link);
    } catch {
    }
  });
}
async function registerCustomFunctions(customFunctionsPath, codeBasePath) {
  try {
    function registerFunctionsInRuntime(module) {
      const keys = Object.keys(module);
      for (let i = 0; i < keys.length; i++) {
        const name = keys[i];
        const funcDef = module[keys[i]];
        if (typeof funcDef === 'function') {
          const functions = [];
          functions[name] = funcDef;
          registerFunctions$1(functions);
        }
      }
    }
    const ootbFunctionModule = await Promise.resolve().then(function () { return functions$1; });
    registerFunctionsInRuntime(ootbFunctionModule);
    if (codeBasePath != null && codeBasePath !== undefined && customFunctionsPath
      && customFunctionsPath !== undefined) {
      const customFunctionModule = await import(`${codeBasePath}${customFunctionsPath}`);
      registerFunctionsInRuntime(customFunctionModule);
    }
  } catch (e) {
    console.log(`error occured while registering custom functions in web worker ${e.message}`);
  }
}

const formSubscriptions = {};
const formModels = {};
const renderPromises = {};
function disableElement(el, value) {
  el.toggleAttribute('disabled', value === true);
  el.toggleAttribute('aria-readonly', value === true);
}
function compare(fieldVal, htmlVal, type) {
  if (type === 'number') {
    return fieldVal === Number(htmlVal);
  }
  if (type === 'boolean') {
    return fieldVal?.toString() === htmlVal;
  }
  return fieldVal === htmlVal;
}
function handleActiveChild(id, form) {
  form.querySelectorAll('[data-active="true"]').forEach((ele) => ele.removeAttribute('data-active'));
  const field = form.querySelector(`#${id}`);
  if (field) {
    field.closest('.field-wrapper').dataset.active = true;
    field.focus();
    if (document.activeElement !== field && !field.contains(document.activeElement)) {
      field.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
async function fieldChanged(payload, form, generateFormRendition) {
  const { changes, field: fieldModel } = payload;
  const {
    id, name, fieldType, ':type': componentType, readOnly, type, displayValue, displayFormat, displayValueExpression,
    activeChild, qualifiedName,
  } = fieldModel;
  const field = form.querySelector(`#${id}`);
  if (!field) {
    if (qualifiedName) {
      const matchingKey = Object.keys(renderPromises).find((key) => qualifiedName.includes(key));
      if (matchingKey) {
        await renderPromises[matchingKey];
        delete renderPromises[matchingKey];
        await fieldChanged(payload, form, generateFormRendition);
      }
    }
    return;
  }
  const fieldWrapper = field?.closest('.field-wrapper');
  changes.forEach((change) => {
    const { propertyName, currentValue, prevValue } = change;
    switch (propertyName) {
      case 'required':
        if (currentValue === true) {
          fieldWrapper.dataset.required = '';
        } else {
          fieldWrapper.removeAttribute('data-required');
        }
        break;
      case 'validationMessage':
        {
          const { validity } = payload.field;
          if (field.type === 'file' && validity && (
            validity.acceptMismatch
            || validity.fileSizeMismatch
            || validity.minItemsMismatch
            || validity.maxItemsMismatch
          )) {
            break;
          }
          if (field.setCustomValidity) {
            if (currentValue && validity && validity.valid === false) {
              field.setCustomValidity(currentValue);
              updateOrCreateInvalidMsg(field, currentValue);
            } else if (!currentValue) {
              if (field.type === 'file' && field.validationMessage) {
                break;
              }
              field.setCustomValidity('');
              updateOrCreateInvalidMsg(field, '');
            }
          }
        }
        break;
      case 'value':
        const valueToSet = currentValue === undefined ? '' : currentValue;
        if (['number', 'date', 'text', 'email'].includes(field.type) && (displayFormat || displayValueExpression)) {
          field.setAttribute('edit-value', valueToSet);
          field.setAttribute('display-value', displayValue);
          if (document.activeElement !== field) {
            field.value = displayValue;
          }
        } else if (fieldType === 'radio-group' || fieldType === 'checkbox-group') {
          field.querySelectorAll(`input[name=${id}_${name}]`).forEach((el) => {
            const exists = (Array.isArray(valueToSet)
              && valueToSet.some((x) => compare(x, el.value, type.replace('[]', ''))))
              || compare(valueToSet, el.value, type);
            el.checked = exists;
          });
        } else if (fieldType === 'checkbox') {
          field.checked = compare(valueToSet, field.value, type);
        } else if (fieldType === 'plain-text') {
          field.innerHTML = valueToSet;
        } else if (fieldType === 'image') {
          const altText = field?.querySelector('img')?.alt || '';
          field.querySelector('picture')?.replaceWith(createOptimizedPicture(valueToSet, altText));
        } else if (field.type !== 'file') {
          field.value = valueToSet;
        }
        break;
      case 'visible':
        fieldWrapper.dataset.visible = currentValue;
        if (fieldType === 'panel' && fieldWrapper.querySelector('dialog')) {
          const dialog = fieldWrapper.querySelector('dialog');
          if (currentValue === false && dialog.open) {
            dialog.close();
          }
        }
        break;
      case 'enabled':
        if (fieldType === 'radio-group' || fieldType === 'checkbox-group') {
          if (readOnly === false) {
            field.querySelectorAll(`input[name=${id}_${name}]`).forEach((el) => {
              disableElement(el, !currentValue);
            });
          }
        } else if (fieldType === 'drop-down') {
          if (readOnly === false) {
            disableElement(field, !currentValue);
          }
        } else if (componentType === 'rating') {
          if (readOnly === false) {
            fieldWrapper.querySelector('.rating')?.classList.toggle('disabled', !currentValue);
          }
        } else {
          field.toggleAttribute('disabled', currentValue === false);
        }
        break;
      case 'readOnly':
        if (fieldType === 'radio-group' || fieldType === 'checkbox-group') {
          field.querySelectorAll(`input[name=${id}_${name}]`).forEach((el) => {
            disableElement(el, currentValue);
          });
        } else if (fieldType === 'drop-down') {
          disableElement(field, currentValue);
        } else if (componentType === 'rating') {
          fieldWrapper.querySelector('.rating')?.classList.toggle('disabled', currentValue === true);
        } else {
          field.toggleAttribute('disabled', currentValue === true);
        }
        break;
      case 'label':
        if (fieldWrapper) {
          let labelEl = fieldWrapper.querySelector('.field-label');
          if (labelEl) {
            labelEl.textContent = currentValue.value;
            labelEl.setAttribute('data-visible', currentValue.visible);
          } else if (fieldType === 'button') {
            field.textContent = currentValue.value;
          } else if (currentValue.value !== '') {
            labelEl = createLabel({
              id,
              label: currentValue,
            });
            fieldWrapper.prepend(labelEl);
          }
        }
        break;
      case 'description':
        if (fieldWrapper) {
          let descriptionEl = fieldWrapper.querySelector('.field-description');
          if (descriptionEl) {
            descriptionEl.innerHTML = currentValue;
          } else if (currentValue !== '') {
            descriptionEl = createHelpText({
              id,
              description: currentValue,
            });
            fieldWrapper.append(descriptionEl);
          }
        }
        break;
      case 'items':
        if (currentValue === null) {
          const removeId = prevValue.id;
          field?.querySelector(`#${removeId}`)?.remove();
        } else {
          const promise = generateFormRendition({ items: [currentValue] }, field?.querySelector('.repeat-wrapper'), form.dataset?.id);
          renderPromises[currentValue?.qualifiedName] = promise;
        }
        break;
      case 'activeChild': handleActiveChild(activeChild, form);
        break;
      case 'valid':
        if (currentValue === true) {
          updateOrCreateInvalidMsg(field, '');
          if (field.validity?.customError) {
            field?.setCustomValidity('');
          }
        } else if (currentValue === false) {
          const validationMessage = fieldModel.validationMessage || fieldModel.errorMessage;
          if (validationMessage) {
            field?.setCustomValidity(validationMessage);
            updateOrCreateInvalidMsg(field, validationMessage);
          }
        }
        break;
      case 'enum':
      case 'enumNames':
        if (fieldType === 'radio-group' || fieldType === 'checkbox-group') {
          createRadioOrCheckboxUsingEnum(fieldModel, field);
        } else if (fieldType === 'drop-down') {
          createDropdownUsingEnum(fieldModel, field);
        }
        break;
    }
  });
}
function formChanged(payload, form) {
  const { changes } = payload;
  changes.forEach((change) => {
    const { propertyName, currentValue } = change;
    switch (propertyName) {
      case 'activeChild': handleActiveChild(currentValue?.id, form);
        break;
    }
  });
}
function handleRuleEngineEvent(e, form, generateFormRendition) {
  const { type, payload } = e;
  if (type === 'fieldChanged') {
    fieldChanged(payload, form, generateFormRendition);
  } else if (type === 'change') {
    formChanged(payload, form);
  } else if (type === 'submitSuccess') {
    submitSuccess(e, form);
  } else if (type === 'submitFailure') {
    submitFailure(e, form);
  }
}
function applyRuleEngine$1(htmlForm, form, captcha) {
  htmlForm.addEventListener('change', (e) => {
    const field = e.target;
    const { value, name, checked } = field;
    const { id } = field.closest('.field-wrapper').dataset;
    if ((field.type === 'checkbox' && field.dataset.fieldType === 'checkbox-group')) {
      const val = getCheckboxGroupValue(name, htmlForm);
      const el = form.getElement(id);
      el.value = val;
    } else if ((field.type === 'radio' && field.dataset.fieldType === 'radio-group')) {
      const el = form.getElement(id);
      el.value = value;
    } else if (field.type === 'checkbox') {
      form.getElement(id).value = checked ? value : field.dataset.uncheckedValue;
    } else if (field.type === 'file') {
      form.getElement(id).value = Array.from(e?.detail?.files || field.files || []);
    } else {
      form.getElement(id).value = value;
    }
  });
  htmlForm.addEventListener('focusin', (e) => {
    const field = e.target;
    let { id } = field;
    if (['radio', 'checkbox'].includes(field?.type)) {
      id = field.closest('.field-wrapper').dataset.id;
    }
    form.getElement(id)?.focus();
  });
  htmlForm.addEventListener('click', async (e) => {
    if (e.target.tagName === 'BUTTON') {
      const element = form.getElement(e.target.id);
      if (e.target.type === 'submit' && captcha) {
        const token = await captcha.getToken();
        form.getElement(captcha.id).value = token;
      }
      if (element) {
        element.dispatch({ type: 'click' });
      }
    }
  });
}
const FIELD_CHANGE_PROPERTIES = new Set([
  'activeChild', 'checked', 'description', 'enabled', 'enum', 'enumNames',
  'errorMessage', 'items', 'label', 'maximum', 'minimum', 'readOnly',
  'required', 'valid', 'validationMessage', 'validity', 'value', 'visible',
]);
function applyFieldChangeToFormModel(form, payload, onlyNotifyView = false) {
  const { changes } = payload;
  const fieldId = payload.field?.id;
  if (form && fieldId) {
    const element = form.getElement(fieldId);
    if (!element) return;
    try {
      if (onlyNotifyView) {
        element._onlyViewNotify = true;
      }
      changes?.forEach((change) => {
        const { propertyName, currentValue } = change;
        if (propertyName.startsWith('properties.')) {
          element.properties[propertyName.split('properties.')[1]] = currentValue;
        } else if (FIELD_CHANGE_PROPERTIES.has(propertyName)) {
          try {
            element[propertyName] = currentValue;
          } catch (err) {
            if (typeof element._setProperty === 'function') {
              element._setProperty(propertyName, currentValue);
            }
          }
        }
      });
    } finally {
      if (onlyNotifyView) {
        element._onlyViewNotify = false;
      }
    }
  }
}
async function loadRuleEngine(formDef, htmlForm, captcha, genFormRendition, data) {
  const ruleEngine = await import('./rules/model/afb-runtime.js');
  const form = ruleEngine.restoreFormInstance(formDef, data, { logLevel: LOG_LEVEL });
  window.myForm = form;
  formModels[htmlForm.dataset?.id] = form;
  const subscriptions = formSubscriptions[htmlForm.dataset?.id];
  form.subscribe((e) => {
    handleRuleEngineEvent(e, htmlForm, genFormRendition);
    const fieldId = e.payload?.field?.id;
    if (fieldId) {
      const subs = formSubscriptions[htmlForm.dataset?.id];
      const sub = subs?.get(fieldId);
      if (sub?.listenChanges) {
        try {
          sub.callback(sub.fieldDiv, e.payload.field, 'change', e.payload);
        } catch (err) {
          console.error(`Error in subscription callback for field "${fieldId}":`, err);
        }
      }
    }
  }, 'fieldChanged');
  form.subscribe((e) => {
    handleRuleEngineEvent(e, htmlForm, genFormRendition);
  }, 'change');
  form.subscribe((e) => {
    handleRuleEngineEvent(e, htmlForm);
  }, 'submitSuccess');
  form.subscribe((e) => {
    handleRuleEngineEvent(e, htmlForm);
  }, 'submitFailure');
  form.subscribe((e) => {
    handleRuleEngineEvent(e, htmlForm);
  }, 'submitError');
  applyRuleEngine$1(htmlForm, form, captcha);
  if (subscriptions) {
    subscriptions.forEach((subscription, id) => {
      const { callback, fieldDiv } = subscription;
      const model = form.getElement(id);
      callback(fieldDiv, model, 'register');
    });
  }
  form.dispatch(new CustomEvent('formViewInitialized'));
}
async function initializeRuleEngineWorker(formDef, renderHTMLForm) {
  if (typeof Worker === 'undefined') {
    const needsPrefill = formDef?.properties?.['fd:formDataEnabled'] === true;
    const data = needsPrefill ? await fetchData(formDef?.id, window.location.search || '') : null;
    const ruleEngine = await import('./rules/model/afb-runtime.js');
    const formDefWithData = { ...formDef, ...(data != null && { data }) };
    const form = ruleEngine.createFormInstance(formDefWithData, undefined, LOG_LEVEL);
    return renderHTMLForm(form.getState(true), data);
  }
  const myWorker = new Worker(`${window.hlx.codeBasePath}/blocks/form/rules/RuleEngineWorker.js`, { type: 'module' });
  const currentUrl = window.location.href;
  myWorker.postMessage({
    name: 'createFormInstance',
    payload: {
      ...formDef,
      search: window.location.search || '',
    },
    codeBasePath: window.hlx.codeBasePath,
    url: currentUrl,
  });
  return new Promise((resolve) => {
    let form,
      captcha,
      data,
      generateFormRendition;
    myWorker.addEventListener('message', async (e) => {
      if (e.data.name === 'renderForm') {
        const response = await renderHTMLForm(e.data.payload);
        form = response.form;
        captcha = response.captcha;
        data = response.data;
        generateFormRendition = response.generateFormRendition;
        form?.classList.add('loading');
        myWorker.postMessage({
          name: 'decorated',
        });
        resolve(response);
      }
      if (e.data.name === 'restoreState') {
        const { state } = e.data.payload;
        loadRuleEngine(state, form, captcha, generateFormRendition, data);
      }
      if (e.data.name === 'applyFieldChanges') {
        const { fieldChanges: changes } = e.data.payload;
        const formModel = formModels[form?.dataset?.id];
        if (Array.isArray(changes)) {
          if (form && formModel) {
            await changes.reduce(
              (promise, payload) => promise.then(async () => {
                await fieldChanged(payload, form, generateFormRendition);
                applyFieldChangeToFormModel(formModel, payload, true);
              }),
              Promise.resolve(),
            );
          }
        } else if (changes) {
          await fieldChanged(changes, form, generateFormRendition);
          if (formModel) applyFieldChangeToFormModel(formModel, changes, true);
        }
      }
      if (e.data.name === 'applyLiveFormChange') {
        const { payload } = e.data;
        const { changes } = payload;
        const formModel = formModels[form?.dataset?.id];
        if (formModel) {
          changes?.forEach((change) => {
            const { propertyName, currentValue } = change;
            if (propertyName.includes('properties.')) {
              const key = propertyName.split('properties.')[1];
              formModel.getPropertiesManager().updateSimpleProperty(key, currentValue);
            }
          });
        }
      }
      if (e.data.name === 'sync-complete') {
        form?.classList.remove('loading');
      }
    });
  });
}
async function initAdaptiveForm(formDef, createForm) {
  preloadFunctionScripts(formDef?.properties?.customFunctionsPath, window.hlx?.codeBasePath);
  await registerCustomFunctions(formDef?.properties?.customFunctionsPath || '/blocks/form/functions.js', window.hlx?.codeBasePath);
  const response = await initializeRuleEngineWorker(formDef, createForm);
  return response?.form;
}
function subscribe(fieldDiv, formId, callback, options) {
  if (callback) {
    let subscriptions = formSubscriptions[formId];
    if (!subscriptions) {
      subscriptions = new Map();
      formSubscriptions[formId] = subscriptions;
    }
    if (formModels[formId]) {
      const form = formModels[formId];
      callback(fieldDiv, form.getElement(fieldDiv?.dataset?.id), 'register');
    }
    const listenChanges = options?.listenChanges === true;
    subscriptions.set(fieldDiv?.dataset?.id, { callback, fieldDiv, listenChanges });
  }
}

var index_source = /*#__PURE__*/Object.freeze({
  __proto__: null,
  fieldChanged: fieldChanged,
  loadRuleEngine: loadRuleEngine,
  initAdaptiveForm: initAdaptiveForm,
  subscribe: subscribe
});

function updateRadioCheckboxNames(instance, index) {
  if (!instance.dataset.repeatable || instance.dataset.repeatable !== 'true') {
    return;
  }
  instance.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach((element) => {
    const baseName = element.name.replace(/-\d+$/, '');
    const expectedName = index > 0 ? `${baseName}-${index}` : baseName;
    if (element.name !== expectedName) {
      element.name = expectedName;
    }
  });
}
function update(fieldset, index, labelTemplate) {
  const legend = fieldset.querySelector(':scope>.field-label')?.firstChild;
  const text = labelTemplate?.replace('#', index + 1);
  if (legend) {
    legend.textContent = text;
  }
  if (typeof fieldset.id === 'undefined') {
    fieldset.id = getId(fieldset.name);
  }
  fieldset.setAttribute('data-index', index);
  if (index > 0) {
    fieldset.querySelectorAll('.field-wrapper').forEach((f) => {
      const [label, input, description] = ['label', 'input,select,button,textarea', 'description']
        .map((x) => f.querySelector(x));
      if (input) {
        input.id = getId(input.name);
      }
      if (label) {
        label.htmlFor = input.id;
      }
      if (description) {
        input.setAttribute('aria-describedby', `${input.Id}-description`);
        description.id = `${input.id}-description`;
      }
    });
  }
}
function createButton(label, icon) {
  const button = document.createElement('button');
  button.className = `item-${icon}`;
  button.type = 'button';
  const text = document.createElement('span');
  text.textContent = label;
  button.append(document.createElement('i'), text);
  return button;
}
function updateRepeatState(wrapper) {
  const instances = wrapper.querySelectorAll('[data-repeatable="true"]');
  const count = instances.length;
  const min = Number(wrapper.dataset.min) || 0;
  const max = Number(wrapper.dataset.max) || -1;
  wrapper.dataset.addInstance = (max === -1 || count < max) ? 'true' : 'false';
  wrapper.dataset.removeInstance = (count > min) ? 'true' : 'false';
  wrapper.dataset.instanceCount = count;
}
function getInstances(el) {
  let nextSibling = el.nextElementSibling;
  const siblings = [el];
  while (nextSibling && nextSibling.matches('[data-repeatable="true"]:not([data-repeatable="0"])')) {
    siblings.push(nextSibling);
    nextSibling = nextSibling.nextElementSibling;
  }
  return siblings;
}
const repeatStrategies = {
  af: {
    addInstance: (wrapper) => {
      if (wrapper.fieldModel) {
        const action = { type: 'addInstance', payload: wrapper.fieldModel.items?.length || 0 };
        wrapper.fieldModel.addItem(action);
      }
    },
    removeInstance: (wrapper, instanceIndex) => {
      if (wrapper.fieldModel) {
        const action = { type: 'removeInstance', payload: instanceIndex };
        wrapper.fieldModel.removeItem(action);
      }
    },
    setup: (wrapper, form, formId) => {
      const containerElement = wrapper.closest('fieldset[data-id]');
      subscribe(containerElement, formId, (fieldDiv, fieldModel) => {
        wrapper.fieldModel = fieldModel;
        fieldModel.subscribe((e) => {
          const { payload } = e;
          payload?.changes?.forEach((change) => {
            if (change?.propertyName === 'items') {
              requestAnimationFrame(() => {
                addRemoveButtons(wrapper, form, repeatStrategies.af);
                updateRepeatState(wrapper);
              });
            }
          });
        }, 'change');
      });
    },
  },
  doc: {
    addInstance: (wrapper, form) => {
      const fieldset = wrapper['#repeat-template'];
      const childCount = wrapper.children.length - 1;
      const newFieldset = fieldset.cloneNode(true);
      newFieldset.setAttribute('data-index', childCount);
      update(newFieldset, childCount, wrapper['#repeat-template-label']);
      updateRadioCheckboxNames(newFieldset, childCount);
      const actions = wrapper.querySelector('.repeat-actions');
      actions.insertAdjacentElement('beforebegin', newFieldset);
      insertRemoveButton(newFieldset, wrapper, repeatStrategies.doc);
      addRemoveButtons(wrapper, form, repeatStrategies.doc);
      updateRepeatState(wrapper);
      const event = new CustomEvent('item:add', {
        detail: { item: { name: newFieldset.name, id: newFieldset.id } },
        bubbles: false,
      });
      form.dispatchEvent(event);
    },
    removeInstance: (fieldset, wrapper) => {
      fieldset.remove();
      wrapper.querySelectorAll('[data-repeatable="true"]').forEach((el, index) => {
        update(el, index, wrapper['#repeat-template-label']);
      });
      wrapper.querySelectorAll('[data-repeatable="true"]').forEach((el, index) => {
        updateRadioCheckboxNames(el, index);
      });
      updateRepeatState(wrapper);
    },
  },
};
function insertRemoveButton(fieldset, wrapper, strategy = repeatStrategies.af) {
  const label = wrapper.dataset?.repeatDeleteButtonLabel || fieldset.dataset?.repeatDeleteButtonLabel || 'Delete';
  const removeButton = createButton(label, 'remove');
  removeButton.addEventListener('click', () => {
    const repeatWrapper = fieldset.closest('.repeat-wrapper');
    const allInstances = repeatWrapper.querySelectorAll('[data-repeatable="true"]');
    const currentIndex = Array.from(allInstances).indexOf(fieldset);
    if (strategy === repeatStrategies.doc) {
      strategy.removeInstance(fieldset, wrapper);
    } else {
      strategy.removeInstance(wrapper, currentIndex);
    }
  });
  fieldset.append(removeButton);
}
function addRemoveButtons(wrapper, form, strategy) {
  const instances = wrapper.querySelectorAll('[data-repeatable="true"]');
  instances.forEach((instance) => {
    const existingRemoveButton = instance.querySelector('.item-remove');
    if (existingRemoveButton) {
      return;
    }
    insertRemoveButton(instance, wrapper, strategy);
  });
}
function insertAddButton(wrapper, form, strategy = repeatStrategies.af) {
  const actions = document.createElement('div');
  actions.className = 'repeat-actions';
  const addLabel = wrapper?.dataset?.repeatAddButtonLabel || 'Add';
  const addButton = createButton(addLabel, 'add');
  addButton.addEventListener('click', () => {
    strategy.addInstance(wrapper, form);
  });
  actions.appendChild(addButton);
  wrapper.append(actions);
}
function transferRepeatableDOM(form, formDef, container, formId) {
  form.querySelectorAll('[data-repeatable="true"][data-index="0"]').forEach((el) => {
    const instances = getInstances(el);
    const isDocBased = form.dataset.source !== 'aem';
    const strategy = repeatStrategies[isDocBased ? 'doc' : 'af'];
    const wrapper = document.createElement('div');
    wrapper.dataset.min = el.dataset.min || 0;
    if (el.dataset.max) {
      wrapper.dataset.max = el.dataset.max;
    }
    wrapper.dataset.variant = el.dataset.variant || 'addDeleteButtons';
    wrapper.dataset.repeatAddButtonLabel = el.dataset?.repeatAddButtonLabel ? el.dataset.repeatAddButtonLabel : 'Add';
    wrapper.dataset.repeatDeleteButtonLabel = el.dataset?.repeatDeleteButtonLabel ? el.dataset.repeatDeleteButtonLabel : 'Delete';
    wrapper.className = 'repeat-wrapper';
    el.insertAdjacentElement('beforebegin', wrapper);
    wrapper.append(...instances);
    wrapper.querySelectorAll('.item-remove').forEach((element) => element.remove());
    wrapper.querySelectorAll('.repeat-actions').forEach((element) => element.remove());
    const cloneNode = el.cloneNode(true);
    cloneNode.removeAttribute('id');
    wrapper['#repeat-template'] = cloneNode;
    wrapper['#repeat-template-label'] = el.querySelector(':scope>.field-label')?.textContent;
    if (+el.dataset.min === 0) {
      el.remove();
    } else {
      update(el, 0, wrapper['#repeat-template-label']);
      el.setAttribute('data-index', 0);
    }
    if (strategy.setup) {
      strategy.setup(wrapper, form, formId);
    }
    if (isDocBased) {
      wrapper.querySelectorAll('[data-repeatable="true"]').forEach((instance, index) => {
        updateRadioCheckboxNames(instance, index);
      });
    }
    const min = Number(wrapper.dataset.min) || 0;
    if (instances.length > min) {
      addRemoveButtons(wrapper, form, strategy);
    }
    if (el.dataset.variant !== 'noButtons') {
      insertAddButton(wrapper, form, strategy);
    }
    updateRepeatState(wrapper);
  });
}

class GoogleReCaptcha {
  id;
  name;
  config;
  formName;
  loadPromise;
  constructor(config, id, name, formName) {
    this.config = config;
    this.name = name;
    this.id = id;
    this.formName = formName;
  }
  #loadScript(url) {
    if (!this.loadPromise) {
      this.loadPromise = new Promise((resolve, reject) => {
        const head = document.head || document.querySelector('head');
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = () => resolve(window.grecaptcha);
        script.onerror = () => reject(new Error(`Failed to load script ${url}`));
        head.append(script);
      });
    }
  }
  loadCaptcha(form) {
    if (form && this.config.siteKey) {
      const submit = form.querySelector('button[type="submit"]');
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const { siteKey } = this.config;
            const url = this.config.uri;
            if (this.config.version === 'enterprise') {
              this.#loadScript(`${url}?render=${siteKey}`);
            } else {
              this.#loadScript(`https://www.google.com/recaptcha/api.js?render=${siteKey}`);
            }
            obs.disconnect();
          }
        });
      });
      if (submit == null) {
        console.warn('Captcha can not be loaded. Submit button is missing.');
        alert('Captcha can not be loaded. Add Submit button.');
      } else {
        obs.observe(submit);
      }
    } else {
      console.warn('Captcha configuration in missing.');
      alert('Captcha can not be loaded. Captcha configuration in missing.');
    }
  }
  async getToken() {
    if (!this.config.siteKey) {
      return null;
    }
    return new Promise((resolve) => {
      const { grecaptcha } = window;
      if (this.config.version === 'enterprise') {
        grecaptcha.enterprise.ready(async () => {
          const submitAction = `submit_${this.formName}_${this.name}`;
          const token = await grecaptcha.enterprise.execute(
            this.config.siteKey,
            { action: submitAction },
          );
          resolve(token);
        });
      } else {
        grecaptcha.ready(async () => {
          const token = await grecaptcha.execute(this.config.siteKey, { action: 'submit' });
          resolve(token);
        });
      }
    });
  }
}

let customComponents = ['range'];
const OOTBComponentDecorators = ['accordion', 'file', 'modal', 'password', 'rating', 'repeat', 'tnc', 'toggleable-link', 'wizard'];
function getOOTBComponents() {
  return OOTBComponentDecorators;
}
function getCustomComponents() {
  return customComponents;
}
async function loadComponent(componentName, element, fd, container, formId) {
  const status = element.dataset.componentStatus;
  if (status !== 'loading' && status !== 'loaded') {
    element.dataset.componentStatus = 'loading';
    const { blockName } = element.dataset;
    try {
      loadCSS(`${window.hlx.codeBasePath}/blocks/form/components/${componentName}/${componentName}.css`);
      const decorationComplete = new Promise((resolve) => {
        (async () => {
          try {
            const mod = await import(
              `${window.hlx.codeBasePath}/blocks/form/components/${componentName}/${componentName}.js`
            );
            if (mod.default) {
              await mod.default(element, fd, container, formId);
            }
          } catch (error) {
            console.log(`failed to load component for ${blockName}`, error);
          }
          resolve();
        })();
      });
      await Promise.all([decorationComplete]);
    } catch (error) {
      console.log(`failed to load component ${blockName}`, error);
    }
    element.dataset.componentStatus = 'loaded';
  }
  return element;
}
async function componentDecorator(element, fd, container, formId) {
  const { ':type': type = '', fieldType } = fd;
  if (type.endsWith('wizard')) {
    await loadComponent('wizard', element, fd, container, formId);
  }
  if (getCustomComponents().includes(type) || getOOTBComponents().includes(type)) {
    await loadComponent(type, element, fd, container, formId);
  }
  if (fieldType === 'file-input') {
    await loadComponent('file', element, fd, container, formId);
  }
  return null;
}

function handleCheckboxAndRadio(field) {
  if (field?.fieldType === 'checkbox' || field?.fieldType === 'radio') {
    if (field.value) {
      field.enum = [field.value];
    } else if (field?.fieldType === 'checkbox') {
      field.enum = ['on'];
    }
    if (field.checked?.toLowerCase() !== 'true') {
      delete field.value;
    }
  }
}
function extractRules(field) {
  const rulesMapping = {
    value: 'Value Expression',
    visible: 'Visible Expression',
  };
  const entries = Object.entries(rulesMapping)
    .filter(([_, excelRuleName]) => field?.[excelRuleName])
    .map(([ruleName, excelRuleName]) => ({ prop: ruleName, expression: field?.[excelRuleName] }));
  return entries;
}
function initFormDef(name) {
  return {
    name,
    adaptiveform: '0.10.0',
    metadata: {
      grammar: 'json-formula-1.0.0',
      version: '1.0.0',
    },
    properties: {},
    items: [],
  };
}
function handleSpecialButtons(field) {
  if (field?.fieldType === 'submit' || field?.fieldType === 'reset') {
    field.buttonType = field.fieldType;
    field.fieldType = 'button';
    field.properties = field.properties || {};
    field.properties['fd:buttonType'] = field.buttonType;
  }
}
function setProperty(field, key, value) {
  if (field && value) {
    field[key] = value;
  }
}
function transformFlatToHierarchy(item) {
  Object.keys(item).forEach((key) => {
    if (key.includes('.')) {
      let temp = item;
      const keys = key.split('.');
      keys.forEach((k, i, values) => {
        if (i === values.length - 1) {
          temp[k] = item[key];
        } else {
          temp[k] = temp[k] != null ? temp[k] : {};
          temp = temp[k];
        }
      });
      delete item[key];
    }
  });
}
function handleMultiValues(item, key) {
  let values;
  if (item && item[key] && typeof item[key] === 'string') {
    values = item[key]?.split(',').map((value) => value.trim());
    item[key] = values;
  }
}
const booleanProperty = ['required', 'visible', 'enabled', 'readOnly', 'repeatable'];
function convertStringToBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  const trimmedValue = value?.trim();
  return trimmedValue === 'true' || trimmedValue === 'x';
}
function handleFranklinSpecialCases(item) {
  booleanProperty.forEach((prop) => {
    if (item[prop]) {
      item[prop] = convertStringToBoolean(item[prop]);
    }
  });
  item.required = (item.required === 'x' || item.required === true);
  if (item.Max || item.Min || item?.constraintMessages?.max || item?.constraintMessages?.min) {
    if (item.fieldType === 'number-input' || item.fieldType === 'date' || item.fieldType === 'range') {
      item.maximum = item.Max;
      item.minimum = item.Min;
      setProperty(item.constraintMessages, 'maximum', item?.constraintMessages?.max);
      setProperty(item.constraintMessages, 'minimum', item?.constraintMessages?.min);
    } else if (item.fieldType === 'panel') {
      item.maxOccur = item.Max;
      item.minOccur = item.Min;
      setProperty(item.constraintMessages, 'maxOccur', item?.constraintMessages?.max);
      setProperty(item.constraintMessages, 'minOccur', item?.constraintMessages?.min);
    } else {
      item.maxLength = item.Max;
      item.minLength = item.Min;
      setProperty(item.constraintMessages, 'maxLength', item?.constraintMessages?.max);
      setProperty(item.constraintMessages, 'minLength', item?.constraintMessages?.min);
    }
    delete item.Max;
    delete item.Min;
    delete item?.constraintMessages?.max;
    delete item?.constraintMessages?.min;
  }
  if (item.fieldType === 'plain-text' && !item.value) {
    item.value = item?.label?.value;
    item.label = null;
  }
}
function initField() {
  return {
    constraintMessages: {
      required: 'Please fill in this field.',
    },
  };
}
class DocBasedFormToAF {
  panelMap = new Map();
  containerNamesSet = new Set();
  errors = [];
  fieldPropertyMapping = {
    Default: 'default',
    Step: 'step',
    Pattern: 'pattern',
    Value: 'value',
    Placeholder: 'placeholder',
    Field: 'name',
    Name: 'name',
    ReadOnly: 'readOnly',
    Description: 'description',
    Type: 'fieldType',
    Label: 'label.value',
    Mandatory: 'required',
    Accept: 'accept',
    Options: 'enum',
    OptionNames: 'enumNames',
    Visible: 'visible',
    Repeatable: 'repeatable',
    Style: 'appliedCssClassNames',
    'Required Error Message': 'constraintMessages.required',
    'Pattern Error Message': 'constraintMessages.pattern',
    'Min Error Message': 'constraintMessages.min',
    'Max Error Message': 'constraintMessages.max',
    'Custom Type': ':type',
  };
  static parseStyleFromBlock(block) {
    if (!block?.children?.length) return undefined;
    let style;
    [...block.children].forEach((row) => {
      const text = row?.textContent?.trim() || '';
      if (text.includes(':')) {
        const [key, ...rest] = text.split(':');
        if (key.trim().toLowerCase() === 'style') {
          style = rest.join(':').trim();
          row.remove();
        }
      }
    });
    return style;
  }
  fieldMapping = new Map([
    ['text', 'text-input'],
    ['number', 'number-input'],
    ['datetime-local', 'date-input'],
    ['file', 'file-input'],
    ['select', 'drop-down'],
    ['radio-group', 'radio-group'],
    ['checkbox-group', 'checkbox-group'],
    ['plain-text', 'plain-text'],
    ['plaintext', 'plain-text'],
    ['checkbox', 'checkbox'],
    ['textarea', 'multiline-input'],
    ['text-area', 'multiline-input'],
    ['fieldset', 'panel'],
    ['button', 'button'],
    ['rating', 'number-input'],
  ]);
  transform(exData, { name, block } = { name: 'Form' }) {
    this.errors = [];
    const applyStyleFromBlock = (def) => {
      if (block) {
        const style = DocBasedFormToAF.parseStyleFromBlock(block);
        if (style) {
          def.properties = def.properties || {};
          def.properties.style = style;
        }
      }
    };
    if (exData?.adaptiveform) {
      applyStyleFromBlock(exData);
      return { formDef: exData, excelData: null };
    }
    if (!exData || !exData.data) {
      throw new Error('Unable to retrieve the form details from json');
    }
    const formDef = initFormDef(name);
    this.panelMap.set('root', formDef);
    const fieldIdMap = {};
    const rules = [];
    exData.data.forEach((data) => {
      this.containerNamesSet.add(data?.Fieldset);
    });
    exData.data.forEach(( item, index) => {
      if (item.Type) {
        const source = Object.fromEntries(Object.entries(item).filter(([_, v]) => (v != null && v !== '')));
        let field = { ...source, ...initField() };
        field.id = field.Id || getId(field.Name);
        field.value = field.Value || '';
        this.#transformFieldNames(field);
        if (field?.fieldType === 'submit') {
          const submitValue = field.value;
          if (submitValue.startsWith('https')) {
            formDef.redirectUrl = submitValue;
          } else if (submitValue) {
            formDef.thankYouMsg = submitValue;
          }
        }
        if (this.containerNamesSet.has(field.name)) {
          this.panelMap.set(field?.name, field);
          delete field?.constraintMessages;
        }
        field = this.#handleField(field);
        this.#addToParent(field);
        fieldIdMap[index + 2] = { name: field.name, id: field.id };
        const currentRules = extractRules(field);
        if (currentRules.length) {
          rules.push([field.id, currentRules]);
        }
      }
    });
    formDef.properties.rules = { fieldIdMap, rules };
    applyStyleFromBlock(formDef);
    return formDef;
  }
  #handleField(field) {
    this.#transformFieldType(field);
    transformFlatToHierarchy(field);
    handleCheckboxAndRadio(field);
    handleMultiValues(field, 'enum');
    handleMultiValues(field, 'enumNames');
    handleFranklinSpecialCases(field);
    handleSpecialButtons(field);
    return field;
  }
  #transformFieldType(field) {
    if (!field[':type']) {
      field[':type'] = field.fieldType;
    }
    if (this.fieldMapping.has(field?.fieldType)) {
      field.fieldType = this.fieldMapping.get(field?.fieldType);
    } else if (this.containerNamesSet.has(field.name)) {
      field.fieldType = 'panel';
    }
  }
  #transformFieldNames(field) {
    Object.keys(this.fieldPropertyMapping).forEach((key) => {
      if (field[key]) {
        field[this.fieldPropertyMapping[key]] = field[key];
        delete field[key];
      }
    });
  }
  #addToParent(field) {
    const parent = field?.Fieldset || 'root';
    const parentField = this.panelMap.get(this.panelMap.has(parent) ? parent : 'root');
    parentField.items = parentField.items || [];
    parentField.items.push(field);
    delete field?.parent;
  }
}

const DELAY_MS = 0;
let captchaField;
let afModule;
const withFieldWrapper = (element) => (fd) => {
  const wrapper = createFieldWrapper(fd);
  wrapper.append(element(fd));
  return wrapper;
};
const createTextArea = withFieldWrapper((fd) => {
  const input = document.createElement('textarea');
  setPlaceholder(input, fd);
  return input;
});
const createSelect = withFieldWrapper((fd) => {
  const select = document.createElement('select');
  createDropdownUsingEnum(fd, select);
  return select;
});
function createHeading(fd) {
  const wrapper = createFieldWrapper(fd);
  const heading = document.createElement('h2');
  heading.textContent = fd.value || fd.label.value;
  heading.id = fd.id;
  wrapper.append(heading);
  return wrapper;
}
function createLegend(fd) {
  return createLabel(fd, 'legend');
}
function createRepeatablePanel(wrapper, fd) {
  setConstraints(wrapper, fd);
  wrapper.dataset.repeatable = true;
  wrapper.dataset.index = fd.index || 0;
  if (fd.properties) {
    Object.keys(fd.properties).forEach((key) => {
      if (!key.startsWith('fd:')) {
        wrapper.dataset[key] = fd.properties[key];
      }
    });
  }
  if ((!fd.index || fd?.index === 0) && fd.properties?.variant !== 'noButtons') {
    insertAddButton(wrapper, wrapper);
    insertRemoveButton(wrapper, wrapper);
  }
}
function createFieldSet(fd) {
  const wrapper = createFieldWrapper(fd, 'fieldset', createLegend);
  wrapper.id = fd.id;
  wrapper.name = fd.name;
  if (fd.fieldType === 'panel') {
    wrapper.classList.add('panel-wrapper');
  }
  if (fd.repeatable === true) {
    createRepeatablePanel(wrapper, fd);
  }
  return wrapper;
}
function setConstraintsMessage(field, messages = {}) {
  Object.keys(messages).forEach((key) => {
    field.dataset[`${key}ErrorMessage`] = messages[key];
  });
}
function createRadioOrCheckboxGroup(fd) {
  const wrapper = createFieldSet({ ...fd });
  createRadioOrCheckboxUsingEnum(fd, wrapper);
  wrapper.dataset.required = fd.required;
  if (fd.tooltip) {
    wrapper.title = stripTags$1(fd.tooltip, '');
  }
  setConstraintsMessage(wrapper, fd.constraintMessages);
  return wrapper;
}
function createPlainText(fd) {
  const paragraph = document.createElement('p');
  if (fd.richText) {
    paragraph.innerHTML = stripTags$1(fd.value);
  } else {
    paragraph.textContent = fd.value;
  }
  const wrapper = createFieldWrapper(fd);
  wrapper.id = fd.id;
  wrapper.replaceChildren(paragraph);
  return wrapper;
}
function createImage(fd) {
  const field = createFieldWrapper(fd);
  field.id = fd?.id;
  const imagePath = fd.value || fd.properties['fd:repoPath'] || '';
  const altText = fd.altText || fd.name;
  field.append(createOptimizedPicture(imagePath, altText));
  return field;
}
const fieldRenderers = {
  'drop-down': createSelect,
  'plain-text': createPlainText,
  checkbox: createRadioOrCheckbox,
  button: createButton$1,
  multiline: createTextArea,
  panel: createFieldSet,
  radio: createRadioOrCheckbox,
  'radio-group': createRadioOrCheckboxGroup,
  'checkbox-group': createRadioOrCheckboxGroup,
  image: createImage,
  heading: createHeading,
};
function colSpanDecorator(field, element) {
  const colSpan = field['Column Span'] || field.properties?.colspan;
  if (colSpan && element) {
    element.classList.add(`col-${colSpan}`);
  }
}
const handleFocus = (input, field) => {
  const editValue = input.getAttribute('edit-value');
  input.type = field.type;
  input.value = editValue;
};
const handleFocusOut = (input) => {
  const displayValue = input.getAttribute('display-value');
  input.type = 'text';
  input.value = displayValue;
};
function inputDecorator(field, element) {
  const input = element?.querySelector('input,textarea,select');
  if (input) {
    input.id = field.id;
    input.name = field.name;
    if (field.tooltip) {
      input.title = stripTags$1(field.tooltip, '');
    }
    input.readOnly = field.readOnly;
    input.autocomplete = field.autoComplete ?? 'off';
    input.disabled = field.enabled === false;
    if (field.fieldType === 'drop-down' && field.readOnly) {
      input.disabled = true;
    }
    const fieldType = getHTMLRenderType(field);
    if (['number', 'date', 'text', 'email'].includes(fieldType) && (field.displayFormat || field.displayValueExpression)) {
      field.type = fieldType;
      input.setAttribute('edit-value', field.value ?? '');
      input.setAttribute('display-value', field.displayValue ?? '');
      input.type = 'text';
      input.value = field.displayValue ?? '';
      let isMobileTouch = false;
      input.addEventListener('touchstart', () => {
        isMobileTouch = true;
        input.type = field.type;
        const editValue = input.getAttribute('edit-value');
        if (editValue) {
          input.value = editValue;
        }
      });
      input.addEventListener('focus', () => {
        if (!isMobileTouch && input.type !== field.type) {
          input.type = field.type;
        }
        handleFocus(input, field);
        isMobileTouch = false;
      });
      input.addEventListener('blur', () => handleFocusOut(input));
    } else if (input.type !== 'file') {
      input.value = field.value ?? '';
      if (input.type === 'radio' || input.type === 'checkbox') {
        input.value = field?.enum?.[0] ?? 'on';
        input.checked = field.value === input.value;
      }
    } else {
      input.multiple = field.type === 'file[]';
    }
    if (field.required) {
      input.setAttribute('required', 'required');
    }
    if (field.description) {
      input.setAttribute('aria-describedby', `${field.id}-description`);
    }
    if (field.minItems) {
      input.dataset.minItems = field.minItems;
    }
    if (field.maxItems) {
      input.dataset.maxItems = field.maxItems;
    }
    if (field.maxFileSize) {
      input.dataset.maxFileSize = field.maxFileSize;
    }
    if (field.default !== undefined) {
      input.setAttribute('value', field.default);
    }
    if (input.type === 'email') {
      input.pattern = emailPattern;
    }
    setConstraintsMessage(element, field.constraintMessages);
    element.dataset.required = field.required;
  }
}
function decoratePanelContainer(panelDefinition, panelContainer) {
  if (!panelContainer) return;
  const isPanelWrapper = (container) => container.classList?.contains('panel-wrapper');
  const shouldAddLabel = (container, panel) => panel.label && !container.querySelector(`legend[for=${container.dataset.id}]`);
  if (isPanelWrapper(panelContainer)) {
    if (shouldAddLabel(panelContainer, panelDefinition)) {
      const legend = createLegend(panelDefinition);
      if (legend) {
        panelContainer.insertAdjacentElement('afterbegin', legend);
      }
    }
  }
}
function renderField(fd) {
  const fieldType = fd?.fieldType?.replace('-input', '') ?? 'text';
  const renderer = fieldRenderers[fieldType];
  let field;
  if (typeof renderer === 'function') {
    field = renderer(fd);
  } else {
    field = createFieldWrapper(fd);
    field.append(createInput(fd));
  }
  if (fd.description) {
    field.append(createHelpText(fd));
    field.dataset.description = fd.description;
  }
  if (fd.fieldType !== 'radio-group' && fd.fieldType !== 'checkbox-group' && fd.fieldType !== 'captcha') {
    inputDecorator(fd, field);
  }
  return field;
}
async function generateFormRendition(panel, container, formId, getItems = (p) => p?.items) {
  const items = getItems(panel) || [];
  const promises = items.map(async (field) => {
    field.value = field.value ?? '';
    const { fieldType } = field;
    if (fieldType === 'captcha') {
      captchaField = field;
      const element = createFieldWrapper(field);
      element.textContent = 'CAPTCHA';
      return element;
    }
    const element = renderField(field);
    if (field.appliedCssClassNames) {
      element.className += ` ${field.appliedCssClassNames}`;
    }
    colSpanDecorator(field, element);
    if (field?.fieldType === 'panel') {
      await generateFormRendition(field, element, formId, getItems);
      return element;
    }
    await componentDecorator(element, field, container, formId);
    return element;
  });
  const children = await Promise.all(promises);
  container.append(...children.filter((_) => _ != null));
  decoratePanelContainer(panel, container);
  await componentDecorator(container, panel, null, formId);
}
function enableValidation(form) {
  form.querySelectorAll('input,textarea,select').forEach((input) => {
    input.addEventListener('invalid', (event) => {
      checkValidation(event.target);
    });
  });
  form.addEventListener('change', (event) => {
    checkValidation(event.target);
  });
}
function isDocumentBasedForm(formDef) {
  return formDef?.[':type'] === 'sheet' && formDef?.data;
}
async function createFormForAuthoring(formDef) {
  const form = document.createElement('form');
  await generateFormRendition(formDef, form, formDef.id, (container) => {
    if (container[':itemsOrder'] && container[':items']) {
      return container[':itemsOrder'].map((itemKey) => container[':items'][itemKey]);
    }
    return [];
  });
  return form;
}
async function createForm(formDef, data, source = 'aem') {
  const { action: formPath } = formDef;
  const form = document.createElement('form');
  form.dataset.action = formPath;
  form.dataset.source = source;
  form.noValidate = true;
  if (formDef.appliedCssClassNames) {
    form.className = formDef.appliedCssClassNames;
  }
  const formId = extractIdFromUrl(formPath);
  await generateFormRendition(formDef, form, formId);
  let captcha;
  if (captchaField) {
    let config = captchaField?.properties?.['fd:captcha']?.config;
    if (!config) {
      config = {
        siteKey: captchaField?.value,
        uri: captchaField?.uri,
        version: captchaField?.version,
      };
    }
    const pageName = getSitePageName(captchaField?.properties?.['fd:path']);
    captcha = new GoogleReCaptcha(config, captchaField.id, captchaField.name, pageName);
    captcha.loadCaptcha(form);
  }
  if (source === 'sheet') {
    enableValidation(form);
  }
  transferRepeatableDOM(form, formDef, form, formId);
  if (afModule && typeof Worker === 'undefined') {
    window.setTimeout(async () => {
      afModule.loadRuleEngine(formDef, form, captcha, generateFormRendition, data);
    }, DELAY_MS);
  }
  form.addEventListener('reset', async () => {
    const currentSource = form.dataset.source || 'aem';
    const response = await createForm(formDef, undefined, currentSource);
    if (response?.form) {
      document.querySelector(`[data-action="${form?.dataset?.action}"]`)?.replaceWith(response?.form);
    }
  });
  form.addEventListener('submit', (e) => {
    handleSubmit(e, form, captcha);
  });
  return {
    form,
    captcha,
    generateFormRendition,
    data,
  };
}
function cleanUp(content) {
  const formDef = content.replaceAll('^(([^<>()\\\\[\\\\]\\\\\\\\.,;:\\\\s@\\"]+(\\\\.[^<>()\\\\[\\\\]\\\\\\\\.,;:\\\\s@\\"]+)*)|(\\".+\\"))@((\\\\[[0-9]{1,3}\\\\.[0-9]{1,3}\\\\.[0-9]{1,3}\\\\.[0-9]{1,3}])|(([a-zA-Z\\\\-0-9]+\\\\.)\\+[a-zA-Z]{2,}))$', '');
  return formDef?.replace(/\x83\n|\n|\s\s+/g, '');
}
function decode(rawContent) {
  const content = rawContent.trim();
  if (content.startsWith('"') && content.endsWith('"')) {
    return JSON.parse(JSON.parse(content));
  }
  return JSON.parse(cleanUp(content));
}
function extractFormDefinition(block) {
  let formDef;
  const container = block.querySelector('pre');
  const codeEl = container?.querySelector('code');
  const content = codeEl?.textContent;
  if (content) {
    formDef = decode(content);
  }
  return { container, formDef };
}
async function fetchForm(pathname) {
  let data;
  let path = pathname;
  if (path.startsWith(window.location.origin) && !path.includes('.json')) {
    if (path.endsWith('.html')) {
      path = path.substring(0, path.lastIndexOf('.html'));
    }
    path += '/jcr:content/root/section/form.html';
  }
  let resp = await fetch(path);
  if (resp?.headers?.get('Content-Type')?.includes('application/json')) {
    data = await resp.json();
  } else if (resp?.headers?.get('Content-Type')?.includes('text/html')) {
    resp = await fetch(path);
    data = await resp.text().then((html) => {
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        if (doc) {
          return extractFormDefinition(doc.body).formDef;
        }
        return doc;
      } catch (e) {
        console.error('Unable to fetch form definition for path', pathname, path);
        return null;
      }
    });
  }
  return data;
}
function addRequestContextToForm(formDef) {
  if (formDef && typeof formDef === 'object') {
    formDef.properties = formDef.properties || {};
    try {
      const urlParams = new URLSearchParams(window?.location?.search || '');
      if (!formDef.properties.queryParams) {
        formDef.properties.queryParams = {};
      }
      urlParams?.forEach((value, key) => {
        formDef.properties.queryParams[key?.toLowerCase()] = value;
      });
    } catch (e) {
      console.warn('Error reading URL parameters:', e);
    }
    try {
      const cookies = document?.cookie.split(';');
      formDef.properties.cookies = {};
      cookies?.forEach((cookie) => {
        if (cookie.trim()) {
          const [key, value] = cookie.trim().split('=');
          formDef.properties.cookies[key.trim()] = value || '';
        }
      });
    } catch (e) {
      console.warn('Error reading cookies:', e);
    }
  }
}
function loadFormCustomStyles(formDef) {
  const { style } = formDef?.properties || {};
  if (style) {
    try {
      const base = (window.hlx?.codeBasePath || '').replace(/\/$/, '');
      const stylePath = style.startsWith('/') ? style : `/${style}`;
      loadCSS(`${base}${stylePath}`);
    } catch (error) {
      console.error('Failed to load form CSS:', error);
    }
  }
}
async function decorate(block) {
  let container = block.querySelector('a[href]');
  let formDef;
  let pathname;
  if (container) {
    ({ pathname } = new URL(container.href));
    formDef = await fetchForm(container.href);
  } else {
    ({ container, formDef } = extractFormDefinition(block));
  }
  let source = 'aem';
  let rules = true;
  let form;
  if (formDef) {
    const submitProps = formDef?.properties?.['fd:submit'];
    const actionType = submitProps?.actionName || formDef?.properties?.actionType;
    const spreadsheetUrl = submitProps?.spreadsheet?.spreadsheetUrl
      || formDef?.properties?.spreadsheetUrl;
    if (actionType === 'spreadsheet' && spreadsheetUrl) {
      const iframePath = window.frameElement ? window.parent.location.pathname
        : window.location.pathname;
      formDef.action = SUBMISSION_SERVICE + btoa(pathname || iframePath);
    } else {
      formDef.action = getSubmitBaseUrl() + (formDef.action || '');
    }
    if (isDocumentBasedForm(formDef)) {
      const transform = new DocBasedFormToAF();
      formDef = transform.transform(formDef, { block });
      source = 'sheet';
      loadFormCustomStyles(formDef);
      const response = await createForm(formDef, null, source);
      form = response?.form;
      const docRuleEngine = await Promise.resolve().then(function () { return index; });
      docRuleEngine.default(formDef, form);
      rules = false;
    } else {
      loadFormCustomStyles(formDef);
      afModule = await Promise.resolve().then(function () { return index_source; });
      addRequestContextToForm(formDef);
      if (afModule && afModule.initAdaptiveForm && !block.classList.contains('edit-mode')) {
        form = await afModule.initAdaptiveForm(formDef, createForm);
      } else {
        form = await createFormForAuthoring(formDef);
      }
    }
    form.dataset.redirectUrl = formDef.redirectUrl || '';
    form.dataset.thankYouMsg = formDef.thankYouMsg || '';
    form.dataset.action = formDef.action || pathname?.split('.json')[0];
    form.dataset.source = source;
    form.dataset.rules = rules;
    form.dataset.id = formDef.id;
    if (source === 'aem' && formDef.properties && formDef.properties['fd:path']) {
      form.dataset.formpath = formDef.properties['fd:path'];
    }
    container.replaceWith(form);
  }
}

async function applyRuleEngine(form, formTag) {
  try {
    const { fieldIdMap, rules } = form.properties.rules;
    if (rules.length > 0) {
      const RuleEngine = (await Promise.resolve().then(function () { return RuleEngine$1; })).default;
      const ruleEngine = new RuleEngine(rules, fieldIdMap, formTag);
      ruleEngine.enable();
    }
  } catch (e) {
    console.log('unable to apply rules ', e);
  }
}

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  'default': applyRuleEngine
});

var tokenDefinitions = {
  TOK_EOF: 'EOF',
  TOK_ADD: 'Add',
  TOK_COMMA: 'Comma',
  TOK_CONCATENATE: 'Concatenate',
  TOK_DIVIDE: 'Divide',
  TOK_EQ: 'EQ',
  TOK_FIELD: 'Field',
  TOK_GT: 'GT',
  TOK_GTE: 'GTE',
  TOK_LITERAL: 'Literal',
  TOK_LPAREN: 'Lparen',
  TOK_LT: 'LT',
  TOK_LTE: 'LTE',
  TOK_MULTIPLY: 'Multiply',
  TOK_NE: 'NE',
  TOK_NUMBER: 'Number',
  TOK_QUOTEDIDENTIFIER: 'QuotedIdentifier',
  TOK_RPAREN: 'Rparen',
  TOK_SUBTRACT: 'Subtract',
  TOK_UNARY_MINUS: 'UnaryMinus',
  TOK_UNQUOTEDIDENTIFIER: 'UnquotedIdentifier',
  TOK_SHEET_ACCESS: 'Sheet',
};

const {
  TOK_ADD: TOK_ADD$1,
  TOK_COMMA: TOK_COMMA$1,
  TOK_CONCATENATE: TOK_CONCATENATE$1,
  TOK_DIVIDE: TOK_DIVIDE$1,
  TOK_EQ: TOK_EQ$2,
  TOK_GT: TOK_GT$2,
  TOK_GTE: TOK_GTE$2,
  TOK_LITERAL: TOK_LITERAL$1,
  TOK_LPAREN: TOK_LPAREN$1,
  TOK_LT: TOK_LT$2,
  TOK_LTE: TOK_LTE$2,
  TOK_MULTIPLY: TOK_MULTIPLY$1,
  TOK_NE: TOK_NE$2,
  TOK_NUMBER: TOK_NUMBER$1,
  TOK_QUOTEDIDENTIFIER: TOK_QUOTEDIDENTIFIER$1,
  TOK_RPAREN: TOK_RPAREN$1,
  TOK_SUBTRACT: TOK_SUBTRACT$1,
  TOK_UNARY_MINUS: TOK_UNARY_MINUS$1,
  TOK_UNQUOTEDIDENTIFIER: TOK_UNQUOTEDIDENTIFIER$1,
  TOK_SHEET_ACCESS: TOK_SHEET_ACCESS$1,
} = tokenDefinitions;
const basicTokens = {
  '!': TOK_SHEET_ACCESS$1,
  ',': TOK_COMMA$1,
  '(': TOK_LPAREN$1,
  ')': TOK_RPAREN$1,
};
const operatorStartToken = {
  '<': true,
  '>': true,
  '=': true,
};
const skipChars = {
  ' ': true,
  '\t': true,
  '\n': true,
};
function isNum(ch) {
  return (ch >= '0' && ch <= '9') || (ch === '.');
}
function isAlphaNum(ch) {
  return (ch >= 'a' && ch <= 'z')
    || (ch >= 'A' && ch <= 'Z')
    || (ch >= '0' && ch <= '9')
    || ch === '_';
}
function isIdentifier(stream, pos) {
  const ch = stream[pos];
  if (ch === '$') {
    return stream.length > pos && isAlphaNum(stream[pos + 1]);
  }
  return (ch >= 'a' && ch <= 'z')
    || (ch >= 'A' && ch <= 'Z')
    || ch === '_';
}
class Lexer {
  constructor(debug = []) {
    this.debug = debug;
  }
  tokenize(stream) {
    const tokens = [];
    this.current = 0;
    let start;
    let identifier;
    let token;
    while (this.current < stream.length) {
      const prev = tokens.length ? tokens.slice(-1)[0].type : null;
      if (isIdentifier(stream, this.current)) {
        start = this.current;
        identifier = this.consumeUnquotedIdentifier(stream);
        tokens.push({
          type: TOK_UNQUOTEDIDENTIFIER$1,
          value: identifier,
          start,
        });
      } else if (basicTokens[stream[this.current]] !== undefined) {
        tokens.push({
          type: basicTokens[stream[this.current]],
          value: stream[this.current],
          start: this.current,
        });
        this.current += 1;
      } else if (stream[this.current] === '-'
        && ![TOK_NUMBER$1, TOK_RPAREN$1, TOK_UNQUOTEDIDENTIFIER$1, TOK_QUOTEDIDENTIFIER$1].includes(prev)) {
        token = { type: TOK_UNARY_MINUS$1, value: '-', start: this.current };
        this.current += 1;
        tokens.push(token);
      } else if (isNum(stream[this.current])) {
        token = this.consumeNumber(stream);
        tokens.push(token);
      } else if (stream[this.current] === "'") {
        start = this.current;
        identifier = this.consumeQuotedIdentifier(stream);
        tokens.push({
          type: TOK_QUOTEDIDENTIFIER$1,
          value: identifier,
          start,
        });
      } else if (stream[this.current] === '"') {
        start = this.current;
        identifier = this.consumeRawStringLiteral(stream);
        tokens.push({
          type: TOK_LITERAL$1,
          value: identifier,
          start,
        });
      } else if (operatorStartToken[stream[this.current]] !== undefined) {
        tokens.push(this.consumeOperator(stream));
      } else if (skipChars[stream[this.current]] !== undefined) {
        this.current += 1;
      } else if (stream[this.current] === '&') {
        tokens.push({ type: TOK_CONCATENATE$1, value: '&', start: this.current });
        this.current += 1;
      } else if (stream[this.current] === '+') {
        tokens.push({ type: TOK_ADD$1, value: '+', start: this.current });
        this.current += 1;
      } else if (stream[this.current] === '-') {
        tokens.push({ type: TOK_SUBTRACT$1, value: '-', start: this.current });
        this.current += 1;
      } else if (stream[this.current] === '*') {
        tokens.push({ type: TOK_MULTIPLY$1, value: '*', start: this.current });
        this.current += 1;
      } else if (stream[this.current] === '/') {
        tokens.push({ type: TOK_DIVIDE$1, value: '/', start: this.current });
        this.current += 1;
      } else {
        const error = new Error(`Unknown character:${stream[this.current]}`);
        error.name = 'LexerError';
        throw error;
      }
    }
    return tokens;
  }
  consumeUnquotedIdentifier(stream) {
    const start = this.current;
    this.current += 1;
    while (this.current < stream.length && isAlphaNum(stream[this.current])) {
      this.current += 1;
    }
    return stream.slice(start, this.current);
  }
  consumeQuotedIdentifier(stream) {
    const start = this.current;
    this.current += 1;
    const maxLength = stream.length;
    let foundNonAlpha = !isIdentifier(stream, start + 1);
    while (stream[this.current] !== "'" && this.current < maxLength) {
      let { current } = this;
      if (!isAlphaNum(stream[current])) foundNonAlpha = true;
      if (stream[current] === '\\' && (stream[current + 1] === '\\'
        || stream[current + 1] === "'")) {
        current += 2;
      } else {
        current += 1;
      }
      this.current = current;
    }
    this.current += 1;
    const val = stream.slice(start, this.current);
    try {
      if (!foundNonAlpha || val.includes(' ')) {
        this.debug.push(`Suspicious quotes: ${val}`);
        this.debug.push(`Did you intend a literal? '${val.replace(/'/g, '')}'?`);
      }
    } catch (e) { }
    return val.substring(1, val.length - 1);
  }
  consumeRawStringLiteral(stream) {
    const start = this.current;
    this.current += 1;
    const maxLength = stream.length;
    while (stream[this.current] !== '"' && this.current < maxLength) {
      let { current } = this;
      if (stream[current] === '\\' && (stream[current + 1] === '\\'
        || stream[current + 1] === '"')) {
        current += 2;
      } else {
        current += 1;
      }
      this.current = current;
    }
    this.current += 1;
    const literal = stream.slice(start + 1, this.current - 1);
    return literal.replaceAll('\\"', '"');
  }
  consumeNumber(stream) {
    const start = this.current;
    this.current += 1;
    const maxLength = stream.length;
    while (isNum(stream[this.current]) && this.current < maxLength) {
      this.current += 1;
    }
    const n = stream.slice(start, this.current);
    let value;
    if (n.includes('.')) {
      value = parseFloat(n);
    } else {
      value = parseInt(n, 10);
    }
    return { type: TOK_NUMBER$1, value, start };
  }
  consumeOperator(stream) {
    const start = this.current;
    const startingChar = stream[start];
    this.current += 1;
    if (startingChar === '<') {
      if (stream[this.current] === '=') {
        this.current += 1;
        return { type: TOK_LTE$2, value: '<=', start };
      }
      if (stream[this.current] === '>') {
        this.current += 1;
        return { type: TOK_NE$2, value: '<>', start };
      }
      return { type: TOK_LT$2, value: '<', start };
    }
    if (startingChar === '>') {
      if (stream[this.current] === '=') {
        this.current += 1;
        return { type: TOK_GTE$2, value: '>=', start };
      }
      return { type: TOK_GT$2, value: '>', start };
    }
    if (stream[this.current] === '=') {
      this.current += 1;
      return { type: TOK_EQ$2, value: '==', start };
    }
    return { type: TOK_EQ$2, value: '=', start };
  }
}

const {
  TOK_EOF,
  TOK_ADD,
  TOK_COMMA,
  TOK_CONCATENATE,
  TOK_DIVIDE,
  TOK_EQ: TOK_EQ$1,
  TOK_FIELD,
  TOK_GT: TOK_GT$1,
  TOK_GTE: TOK_GTE$1,
  TOK_LITERAL,
  TOK_LPAREN,
  TOK_LT: TOK_LT$1,
  TOK_LTE: TOK_LTE$1,
  TOK_MULTIPLY,
  TOK_NE: TOK_NE$1,
  TOK_NUMBER,
  TOK_QUOTEDIDENTIFIER,
  TOK_RPAREN,
  TOK_SUBTRACT,
  TOK_UNARY_MINUS,
  TOK_UNQUOTEDIDENTIFIER,
  TOK_SHEET_ACCESS,
} = tokenDefinitions;
const bindingPower = {
  [TOK_EOF]: 0,
  [TOK_UNQUOTEDIDENTIFIER]: 0,
  [TOK_QUOTEDIDENTIFIER]: 0,
  [TOK_RPAREN]: 0,
  [TOK_NUMBER]: 0,
  [TOK_FIELD]: 0,
  [TOK_COMMA]: 0,
  [TOK_CONCATENATE]: 5,
  [TOK_ADD]: 6,
  [TOK_SUBTRACT]: 6,
  [TOK_MULTIPLY]: 7,
  [TOK_DIVIDE]: 7,
  [TOK_EQ$1]: 5,
  [TOK_GT$1]: 5,
  [TOK_LT$1]: 5,
  [TOK_GTE$1]: 5,
  [TOK_LTE$1]: 5,
  [TOK_NE$1]: 5,
  [TOK_UNARY_MINUS]: 30,
  [TOK_SHEET_ACCESS]: 40,
  [TOK_LPAREN]: 60,
};
class Parser {
  parse(expression, debug) {
    this.loadTokens(expression, debug);
    this.index = 0;
    const ast = this.expression(0);
    if (this.lookahead(0) !== TOK_EOF) {
      const t = this.lookaheadToken(0);
      const error = new Error(
        `Unexpected token type: ${t.type}, value: ${t.value}`,
      );
      error.name = 'ParserError';
      throw error;
    }
    return ast;
  }
  loadTokens(expression, debug) {
    const lexer = new Lexer(debug);
    const tokens = lexer.tokenize(expression);
    tokens.push({ type: TOK_EOF, value: '', start: expression.length });
    this.tokens = tokens;
  }
  expression(rbp) {
    const leftToken = this.lookaheadToken(0);
    this.advance();
    let left = this.nud(leftToken);
    let currentToken = this.lookahead(0);
    while (rbp < bindingPower[currentToken]) {
      this.advance();
      left = this.led(currentToken, left);
      currentToken = this.lookahead(0);
    }
    return left;
  }
  lookahead(number) {
    return this.tokens[this.index + number].type;
  }
  lookaheadToken(number) {
    return this.tokens[this.index + number];
  }
  advance() {
    this.index += 1;
  }
  nud(token) {
    let right;
    let expression;
    let node;
    let args;
    switch (token.type) {
      case TOK_LITERAL:
        return { type: 'Literal', value: token.value };
      case TOK_NUMBER:
        return { type: 'Number', value: token.value };
      case TOK_UNQUOTEDIDENTIFIER:
        return { type: 'Field', name: token.value };
      case TOK_QUOTEDIDENTIFIER:
        node = { type: 'Field', name: token.value };
        if (this.lookahead(0) === TOK_LPAREN) {
          throw new Error('Quoted identifier not allowed for function names.');
        }
        return node;
      case TOK_UNARY_MINUS:
        right = this.expression(bindingPower.UnaryMinus);
        return { type: 'UnaryMinusExpression', children: [right] };
      case TOK_FIELD:
        return { type: TOK_FIELD };
      case TOK_LPAREN:
        args = [];
        while (this.lookahead(0) !== TOK_RPAREN) {
          expression = this.expression(0);
          args.push(expression);
        }
        this.match(TOK_RPAREN);
        return args[0];
      default:
        this.errorToken(token);
    }
  }
  led(tokenName, left) {
    let right;
    let name;
    let args;
    let expression;
    let node;
    let rbp;
    switch (tokenName) {
      case TOK_SHEET_ACCESS:
        rbp = bindingPower.Sheet;
        right = this.parseSheetRHS(rbp);
        return { type: 'Subexpression', children: [left, right] };
      case TOK_CONCATENATE:
        right = this.expression(bindingPower.Concatenate);
        return { type: 'ConcatenateExpression', children: [left, right] };
      case TOK_ADD:
        right = this.expression(bindingPower.Add);
        return { type: 'AddExpression', children: [left, right] };
      case TOK_SUBTRACT:
        right = this.expression(bindingPower.Subtract);
        return { type: 'SubtractExpression', children: [left, right] };
      case TOK_MULTIPLY:
        right = this.expression(bindingPower.Multiply);
        return { type: 'MultiplyExpression', children: [left, right] };
      case TOK_DIVIDE:
        right = this.expression(bindingPower.Divide);
        return { type: 'DivideExpression', children: [left, right] };
      case TOK_LPAREN:
        name = left.name;
        args = [];
        while (this.lookahead(0) !== TOK_RPAREN) {
          expression = this.expression(0);
          if (this.lookahead(0) === TOK_COMMA) {
            this.match(TOK_COMMA);
          }
          args.push(expression);
        }
        this.match(TOK_RPAREN);
        node = { type: 'Function', name, children: args };
        return node;
      case TOK_EQ$1:
      case TOK_NE$1:
      case TOK_GT$1:
      case TOK_GTE$1:
      case TOK_LT$1:
      case TOK_LTE$1:
        return this.parseComparator(left, tokenName);
      default:
        this.errorToken(this.lookaheadToken(0));
    }
  }
  match(tokenType) {
    if (this.lookahead(0) === tokenType) {
      this.advance();
    } else {
      const t = this.lookaheadToken(0);
      const error = new Error(`Expected ${tokenType}, got: ${t.type}`);
      error.name = 'ParserError';
      throw error;
    }
  }
  errorToken(token) {
    const error = new Error(`Invalid token (${token.type}): "${token.value}"`);
    error.name = 'ParserError';
    throw error;
  }
  parseComparator(left, comparator) {
    const right = this.expression(bindingPower[comparator]);
    return { type: 'Comparator', name: comparator, children: [left, right] };
  }
  parseSheetRHS(rbp) {
    const lookahead = this.lookahead(0);
    const exprTokens = [TOK_UNQUOTEDIDENTIFIER];
    if (exprTokens.indexOf(lookahead) >= 0) {
      return this.expression(rbp);
    }
  }
}

function getValueOf(a) {
  if (a === null || a === undefined) return a;
  if (Array.isArray(a)) {
    return a.map((i) => getValueOf(i));
  }
  return a.valueOf();
}
const defaultStringToNumber = ((str) => {
  const n = +str;
  return Number.isNaN(n) ? 0 : n;
});
function getToNumber(debug = []) {
  return (value) => {
    const n = getValueOf(value);
    if (n === null) return null;
    if (Array.isArray(n)) {
      debug.push('Converted array to zero');
      return 0;
    }
    const type = typeof n;
    if (type === 'number') return n;
    if (type === 'string') return defaultStringToNumber(n);
    if (type === 'boolean') return n ? 1 : 0;
    debug.push('Converted object to zero');
    return 0;
  };
}

const {
  TOK_EQ,
  TOK_GT,
  TOK_LT,
  TOK_GTE,
  TOK_LTE,
  TOK_NE,
} = tokenDefinitions;
class TreeInterpreter {
  constructor(runtime, debug) {
    this.runtime = runtime;
    this.debug = debug;
    this.toNumber = getToNumber(debug);
  }
  search(node, value) {
    return this.visit(node, value);
  }
  visit(n, v) {
    const visitFunctions = {
      Field: (node, value) => {
        if (value !== null) {
          let field = value[node.name];
          if (typeof field === 'function') field = undefined;
          if (field === undefined) {
            try {
              this.debug.push(`Failed to find: '${node.name}'`);
              const available = Object.keys(value).map((a) => `'${a}'`).toString();
              if (available.length) this.debug.push(`Available fields: ${available}`);
            } catch (e) { }
            return null;
          }
          return field;
        }
        return null;
      },
      Comparator: (node, value) => {
        const first = this.visit(node.children[0], value);
        const second = this.visit(node.children[1], value);
        if (node.name === TOK_EQ) return first === second;
        if (node.name === TOK_NE) return first !== second;
        if (node.name === TOK_GT) return first > second;
        if (node.name === TOK_GTE) return first >= second;
        if (node.name === TOK_LT) return first < second;
        if (node.name === TOK_LTE) return first <= second;
        throw new Error(`Unknown comparator: ${node.name}`);
      },
      Identity: (_node, value) => value,
      AddExpression: (node, value) => {
        const first = this.visit(node.children[0], value);
        const second = this.visit(node.children[1], value);
        return this.applyOperator(first, second, '+');
      },
      ConcatenateExpression: (node, value) => {
        let first = this.visit(node.children[0], value);
        let second = this.visit(node.children[1], value);
        first = first.toString();
        second = second.toString();
        return this.applyOperator(first, second, '&');
      },
      SubtractExpression: (node, value) => {
        const first = this.visit(node.children[0], value);
        const second = this.visit(node.children[1], value);
        return this.applyOperator(first, second, '-');
      },
      MultiplyExpression: (node, value) => {
        const first = this.visit(node.children[0], value);
        const second = this.visit(node.children[1], value);
        return this.applyOperator(first, second, '*');
      },
      DivideExpression: (node, value) => {
        const first = this.visit(node.children[0], value);
        const second = this.visit(node.children[1], value);
        return this.applyOperator(first, second, '/');
      },
      UnaryMinusExpression: (node, value) => {
        const first = this.visit(node.children[0], value);
        return first * -1;
      },
      Literal: (node) => node.value,
      Number: (node) => node.value,
      Function: (node, value) => {
        if (node.name === 'if') return this.runtime.callFunction(node.name, node.children, value, this, false);
        const resolvedArgs = node.children.map((child) => this.visit(child, value));
        return this.runtime.callFunction(node.name, resolvedArgs, value, this);
      },
    };
    const fn = n && visitFunctions[n.type];
    if (!fn) throw new Error(`Unknown/missing node type ${(n && n.type) || ''}`);
    return fn(n, v);
  }
  applyOperator(first, second, operator) {
    if (Array.isArray(first) && Array.isArray(second)) {
      const shorter = first.length < second.length ? first : second;
      const diff = Math.abs(first.length - second.length);
      shorter.length += diff;
      shorter.fill(null, shorter.length - diff);
      const result = [];
      for (let i = 0; i < first.length; i += 1) {
        result.push(this.applyOperator(first[i], second[i], operator));
      }
      return result;
    }
    if (Array.isArray(first)) return first.map((a) => this.applyOperator(a, second, operator));
    if (Array.isArray(second)) return second.map((a) => this.applyOperator(first, a, operator));
    if (operator === '*') return this.toNumber(first, this.debug) * this.toNumber(second, this.debug);
    if (operator === '&') return first.toString() + second.toString();
    if (operator === '+') {
      return this.toNumber(first, this.debug) + this.toNumber(second, this.debug);
    }
    if (operator === '-') return this.toNumber(first, this.debug) - this.toNumber(second, this.debug);
    if (operator === '/') {
      const result = first / second;
      return Number.isFinite(result) ? result : null;
    }
    throw new Error(`Unknown operator: ${operator}`);
  }
}

function functions(debug) {
  const toNumber = getToNumber(debug);
  const fnMap = {
    and: {
      _func: (resolvedArgs) => {
        let result = !!getValueOf(resolvedArgs[0]);
        resolvedArgs.slice(1).forEach((arg) => {
          result = result && !!getValueOf(arg);
        });
        return result;
      },
    },
    false: {
      _func: () => false,
    },
    if: {
      _func: (unresolvedArgs, data, interpreter) => {
        const conditionNode = unresolvedArgs[0];
        const leftBranchNode = unresolvedArgs[1];
        const rightBranchNode = unresolvedArgs[2];
        const condition = interpreter.visit(conditionNode, data);
        if (getValueOf(condition)) {
          return interpreter.visit(leftBranchNode, data);
        }
        return interpreter.visit(rightBranchNode, data);
      },
    },
    not: {
      _func: (resolveArgs) => !getValueOf(resolveArgs[0]),
    },
    or: {
      _func: (resolvedArgs) => {
        let result = !!getValueOf(resolvedArgs[0]);
        resolvedArgs.slice(1).forEach((arg) => {
          result = result || !!getValueOf(arg);
        });
        return result;
      },
    },
    true: {
      _func: () => true,
    },
    power: {
      _func: (args) => {
        const base = toNumber(args[0]);
        const power = toNumber(args[1]);
        return base ** power;
      },
    },
    round: {
      _func: (args) => {
        const num = toNumber(args[0]);
        const digits = toNumber(args[1]);
        const precision = 10 ** digits;
        return Math.round(num * precision) / precision;
      },
    },
    ceiling: {
      _func: (args) => {
        const num = toNumber(args[0]);
        const significance = toNumber(args[1]);
        if (num === 0 || significance === 0) {
          return 0;
        }
        return Math.ceil(num / significance) * significance;
      },
    },
    min: {
      _func: (args) => {
        const array = args.reduce((prev, cur) => {
          if (Array.isArray(cur)) prev.push(...cur);
          else prev.push(cur);
          return prev;
        }, []);
        const first = array.find((r) => r !== null);
        if (array.length === 0 || first === undefined) return null;
        const isNumber = !Number.isNaN(parseInt(first, 10));
        const compare = isNumber
          ? (prev, cur) => {
            const current = toNumber(cur);
            return prev <= current ? prev : current;
          }
          : (prev, cur) => {
            const current = toString(cur);
            return prev.localeCompare(current) === 1 ? current : prev;
          };
        return array.reduce(compare, isNumber ? toNumber(first) : toString(first));
      },
    },
    sum: {
      _func: (args) => args.reduce((sum, x) => {
        if (Array.isArray(x)) return sum + fnMap.sum.func(x);
        return sum + toNumber(x);
      }, 0),
    },
  };
  return fnMap;
}

class Runtime {
  constructor(debug, customFunctions) {
    const funs = functions(debug);
    this.functionTable = { ...funs, ...customFunctions };
  }
  callFunction(name, resolvedArgs, data, interpreter) {
    if (!Object.prototype.hasOwnProperty.call(this.functionTable, name)) throw new Error(`Unknown function: ${name}()`);
    const functionEntry = this.functionTable[name];
    return functionEntry._func.call(functionEntry, resolvedArgs, data, interpreter);
  }
}

class Formula {
  constructor(customFunctions) {
    this.debug = [];
    this.runtime = new Runtime(this.debug, customFunctions);
  }
  compile(stream) {
    let ast;
    try {
      const parser = new Parser();
      ast = parser.parse(stream, this.debug);
    } catch (e) {
      this.debug.push(e.toString());
      throw e;
    }
    return ast;
  }
  evaluate(node, data) {
    this.runtime.interpreter = new TreeInterpreter(
      this.runtime,
      this.debug,
    );
    try {
      return this.runtime.interpreter.search(node, data);
    } catch (e) {
      this.debug.push(e.message || e.toString());
      throw e;
    }
  }
}

const cellNameRegex = /^\$?[A-Z]+\$?(\d+)$/;
function visitor(nameMap, fields, bExcelFormula) {
  return function visit(n) {
    if (n.type === 'Field') {
      const name = n?.name;
      let field;
      if (bExcelFormula) {
        const match = cellNameRegex.exec(name);
        if (match?.[1]) {
          field = nameMap[match[1]];
        }
        if (!field) {
          console.log(`Unknown column used in excel formula ${n.name}`);
        } else {
          n.name = field.name;
          fields.add(field.id);
        }
      } else {
        fields.add(name);
      }
    } if (n.type === 'Function') {
      n.name = n.name.toLowerCase();
    } else if (n.type === 'Subexpression') {
      return visit({
        type: 'Field',
        name: n.children[1].name,
      }, n.children[0].name);
    }
    return {
      ...n,
      children: n.children?.map((c) => visit(c)),
    };
  };
}
function updateCellNames(ast, rowNumberFieldMap, bExcelFormula = true) {
  const fields = new Set();
  const newAst = visitor(rowNumberFieldMap, fields, bExcelFormula)(ast);
  return [newAst, Array.from(fields)];
}
function transformRule({ prop, expression }, fieldToCellMap, formula) {
  const biSExcelFormula = expression.startsWith('=');
  const updatedExpression = biSExcelFormula ? expression.slice(1) : expression;
  const ast = formula.compile(updatedExpression);
  const [newAst, deps] = updateCellNames(ast, fieldToCellMap, biSExcelFormula);
  return {
    prop,
    deps,
    ast: newAst,
  };
}

function getFullName(firstname, lastname) {
  return `${firstname} ${lastname}`.trim();
}
function submitFormArrayToString(globals) {
  const data = globals.functions.exportData();
  Object.keys(data).forEach((key) => {
    if (Array.isArray(data[key])) {
      data[key] = data[key].join(',');
    }
  });
  globals.functions.submitForm(data, true, 'application/json');
}
function days(endDate, startDate) {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }
  const diffInMs = Math.abs(end.getTime() - start.getTime());
  return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
}

var customFunctions = /*#__PURE__*/Object.freeze({
  __proto__: null,
  getFullName: getFullName,
  days: days,
  submitFormArrayToString: submitFormArrayToString
});

function stripTags(input, allowd) {
  const allowed = ((`${allowd || ''}`)
    .toLowerCase()
    .match(/<[a-z][a-z0-9]*>/g) || [])
    .join('');
  const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  const comments = /<!--[\s\S]*?-->/gi;
  return input.replace(comments, '')
    .replace(tags, ($0, $1) => (allowed.indexOf(`<${$1.toLowerCase()}>`) > -1 ? $0 : ''));
}
function sanitizeHTML(input) {
  return stripTags(input, '<a>');
}
function coerceValue(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  return val;
}
const isFieldset = (e) => e.tagName === 'FIELDSET';
const isRepeatableFieldset = (e) => isFieldset(e) && e.getAttribute('data-repeatable') === 'true';
const isDataElement = (element) => element.tagName !== 'BUTTON' && !isFieldset(element) && element.name;
function getValue(fe) {
  if (fe.type === 'checkbox' || fe.type === 'radio') {
    if (fe.checked) return coerceValue(fe.value);
  } else if (fe.tagName === 'OUTPUT') {
    return fe.dataset.value;
  } else if (fe.name) {
    return coerceValue(fe.value);
  }
  return undefined;
}
function constructData(elements) {
  const payload = {};
  elements.filter(isDataElement)
    .forEach((fe) => {
      payload[fe.name] = getValue(fe);
    });
  return payload;
}
function getFieldsetPayload(form, fieldsetName) {
  let fieldsets = form.elements[fieldsetName];
  if (!(fieldsets instanceof NodeList)) {
    fieldsets = [fieldsets];
  }
  const payload = {};
  fieldsets.forEach((fe, i) => {
    [...fe.elements].filter(isDataElement).forEach((e) => {
      payload[e.name] = payload[e.name] || [];
      payload[e.name][i] = getValue(e);
    });
  });
  return payload;
}
function constructPayload(form) {
  const elements = [...form.elements];
  const payload = constructData(elements);
  const fieldsetNames = [...elements.filter(isRepeatableFieldset)
    .reduce((names, x) => {
      names.add(x.name);
      return names;
    }, new Set())];
  return fieldsetNames.reduce((currPayload, x) => {
    const fieldsetPayload = getFieldsetPayload(form, x);
    return {
      ...currPayload,
      ...fieldsetPayload,
    };
  }, payload);
}
function registerFunctions(functions) {
  const functionsMap = {};
  Object.entries(functions).forEach(([name, funcDef]) => {
    let finalFunction = funcDef;
    if (typeof funcDef === 'function') {
      finalFunction = {
        _func: (args, data) => funcDef(...args, data),
        _signature: [],
      };
    }
    if (!Object.prototype.hasOwnProperty.call(finalFunction, '_func')) {
      console.warn(`Unable to register function with name ${name}.`);
    } else {
      functionsMap[name?.toLowerCase()] = finalFunction;
    }
  });
  return functionsMap;
}
class RuleEngine {
  rulesOrder = {};
  constructor(formRules, fieldIdMap, formTag) {
    this.formTag = formTag;
    this.data = constructPayload(formTag);
    this.formula = new Formula(registerFunctions(customFunctions));
    const newRules = formRules.map(([fieldId, fieldRules]) => [
      fieldId,
      fieldRules.map((rule) => transformRule(rule, fieldIdMap, this.formula)),
    ]);
    this.formRules = Object.fromEntries(newRules);
    this.dependencyTree = newRules.reduce((fields, [fieldId, rules]) => {
      fields[fieldId] = fields[fieldId] || { deps: {} };
      rules.forEach(({ prop, deps }) => {
        deps.forEach((dep) => {
          fields[dep] = fields[dep] || { deps: {} };
          fields[dep].deps[prop] = fields[dep].deps[prop] || [];
          fields[dep].deps[prop].push(fieldId);
        });
      });
      return fields;
    }, {});
  }
  listRules(fieldId) {
    const arr = {};
    let index = 0;
    const stack = [fieldId];
    do {
      const el = stack.pop();
      arr[el] = index;
      index += 1;
      if (this.dependencyTree[el]?.deps.value) {
        stack.push(...this.dependencyTree[el].deps.value);
      }
      ['visible'].forEach((prop) => {
        this.dependencyTree[el]?.deps[prop]?.forEach((field) => {
          arr[field] = index;
          index += 1;
        });
      });
    } while (stack.length > 0);
    return Object.entries(arr).sort((a, b) => a[1] - b[1]).map((_) => _[0]).slice(1);
  }
  valueUpdate(fieldId, value) {
    const element = this.formTag.querySelector(`#${fieldId}`);
    if (!(element instanceof NodeList)) {
      this.data[element.name] = coerceValue(value);
      if (element.tagName === 'OUTPUT') {
        element.value = value;
        element.dataset.value = value;
      } else {
        element.value = value;
      }
      if (element.type === 'range') {
        element.dispatchEvent(new CustomEvent('input', { bubbles: false }));
      }
    }
  }
  visibleUpdate(fieldId, value) {
    const element = this.formTag.querySelector(`#${fieldId}`);
    let wrapper = element;
    if (!isFieldset(element)) {
      wrapper = element.closest('.field-wrapper');
    }
    wrapper.dataset.visible = value;
  }
  setData(field) {
    const fieldName = field.name;
    if (field.type === 'checkbox') {
      this.data[fieldName] = field.checked ? coerceValue(field.value) : undefined;
    } else {
      this.data[fieldName] = coerceValue(field.value);
    }
  }
  applyRules(rules) {
    rules.forEach((fId) => {
      this.formRules[fId]?.forEach((rule) => {
        const newValue = this.formula.evaluate(rule.ast, this.data);
        const handler = this[`${rule.prop}Update`];
        if (handler instanceof Function) {
          handler.apply(this, [fId, newValue]);
        }
      });
    });
  }
  getRules(id) {
    if (!this.rulesOrder[id]) {
      this.rulesOrder[id] = this.listRules(id);
    }
    return this.rulesOrder[id];
  }
  enable() {
    this.formTag.addEventListener('change', (e) => {
      const field = e.target;
      const valid = e.target.checkValidity();
      if (valid) {
        let fieldId = field.id;
        let rules = [];
        const fieldset = field.closest('fieldset');
        if (fieldset && fieldset.getAttribute('data-repeatable') === 'true') {
          this.data = {
            ...this.data,
            ...getFieldsetPayload(this.formTag, fieldset.name),
          };
          fieldId = field.name;
        } else {
          this.setData(field);
        }
        if (field.type === 'radio') {
          const radios = this.formTag.elements[field.name];
          if (radios instanceof NodeList) {
            rules = [...radios].flatMap((f) => this.getRules(f.id));
          } else {
            rules = this.getRules(radios.id);
          }
        } else {
          rules = this.getRules(fieldId);
        }
        this.applyRules(rules);
      }
    });
  }
}

var RuleEngine$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  sanitizeHTML: sanitizeHTML,
  'default': RuleEngine
});

export { DELAY_MS, createForm, decorate as default, fetchForm, generateFormRendition, subscribe };
