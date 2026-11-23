/* eslint-env mocha */
import assert from 'assert';
import { createForm } from '../../blocks/form/form.js';
import DocBasedFormToAF from '../../blocks/form/transform.js';

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
