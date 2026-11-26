/* eslint-env mocha */
import assert from 'assert';
import { createForm } from '../../blocks/form/form.js';
import DocBasedFormToAF from '../../blocks/form/transform.js';
import { validateContainer } from '../../blocks/form/components/wizard/wizard.js';

const sheet = {
  total: 2,
  offset: 0,
  limit: 2,
  data: [{
    Name: 'email',
    Type: 'email',
    Label: 'Email',
  }, {
    Name: 'workEmail',
    Type: 'email',
    Label: 'Work Email',
    Pattern: '.+@example\\.com',
    'Pattern Error Message': 'Use your example.com address.',
  }],
  ':type': 'sheet',
};

function setValue(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function errorOf(input) {
  const wrapper = input.closest('.field-wrapper');
  return wrapper.classList.contains('field-invalid')
    ? wrapper.querySelector('.field-description')?.textContent : '';
}

describe('Email validation in document-based forms', () => {
  let form;

  beforeEach(async () => {
    const def = new DocBasedFormToAF().transform(sheet);
    ({ form } = await createForm(def, null, 'sheet'));
    document.body.replaceChildren(form);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('accepts valid addresses with +, - and subdomains', () => {
    const email = form.querySelector('input[name="email"]');
    assert.equal(email.getAttribute('pattern'), null, 'no pattern should be forced on email inputs');
    ['user+tag@example.com', 'taro-yamada@example.co.jp', 'taro.yamada@mail.example.co.jp', 'a@b.co']
      .forEach((value) => {
        setValue(email, value);
        assert.equal(errorOf(email), '', `${value} should be accepted`);
      });
  });

  it('shows the format error for an invalid address', () => {
    const email = form.querySelector('input[name="email"]');
    setValue(email, 'not-an-email');
    assert.equal(errorOf(email), 'Specify the value in allowed format : email.');
  });

  it('keeps the author-defined pattern and its error message', () => {
    const workEmail = form.querySelector('input[name="workEmail"]');
    assert.equal(workEmail.getAttribute('pattern'), '.+@example\\.com');
    setValue(workEmail, 'user@other.com');
    assert.equal(errorOf(workEmail), 'Use your example.com address.');
    setValue(workEmail, 'user@example.com');
    assert.equal(errorOf(workEmail), '');
  });
});

describe('Email validation in AEM (UE) authored forms', () => {
  it('does not block wizard navigation for valid addresses', async () => {
    const def = {
      id: 'ue-email-form',
      fieldType: 'form',
      items: [{
        id: 'step-1', fieldType: 'panel', name: 'step1', items: [{
          id: 'email-1', fieldType: 'email', name: 'email', type: 'string', required: true,
        }],
      }],
    };
    const { form } = await createForm(def);
    document.body.replaceChildren(form);
    const email = form.querySelector('input[name="email"]');
    const step = email.closest('fieldset');
    // The wizard uses the browser's checkValidity() before moving to the next step.
    ['name+tag@example.com', 'first-last@mail.example.co.jp'].forEach((value) => {
      email.value = value;
      assert.equal(validateContainer(step), true, `${value} should not block the wizard`);
    });
    email.value = 'not-an-email';
    assert.equal(validateContainer(step), false);
    document.body.innerHTML = '';
  });
});
