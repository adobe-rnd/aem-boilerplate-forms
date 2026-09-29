/* eslint-env mocha */
import assert from 'assert';
import sinon from 'sinon';
import jsdom from 'jsdom';
import path from 'path';
import fs from 'fs';
import GoogleReCaptcha from '../../blocks/form/integrations/recaptcha.js';

const siteKey = 'test-site-key';
const testToken = 'token123';
const CAPTCHA_ID = 'captcha';
const CAPTCHA_RESOURCE_TYPE = 'core/fd/components/form/recaptcha/v1/recaptcha';

const configv3 = {
  siteKey,
  uri: 'https://www.recaptcha.net/recaptcha/api.js?render=',
};
const configEnterprise = {
  siteKey,
  uri: 'https://www.recaptcha.net/recaptcha/enterprise.js',
  version: 'enterprise',
};
const configNull = {
  siteKey: null,
  uri: 'https://www.google.com/recaptcha/api.js',
};

let form;

describe('Google recaptcha Integeration', () => {
  beforeEach(() => {
    global.window.grecaptcha = {
      ready: (callback) => {
        callback();
      },
      enterprise: {
        ready: (callback) => {
          callback();
        },
        execute: (key, options) => {
          if (key === siteKey && options.action === 'submit_site123_cap123') {
            return Promise.resolve(testToken);
          }
          return Promise.resolve(null);
        },
      },
      execute: (key, options) => {
        if (key === siteKey && options.action === 'submit') {
          return Promise.resolve(testToken);
        }
        return Promise.resolve(null);
      },
    };
    // Mock the IntersectionObserver
    global.IntersectionObserver = sinon.stub().returns({
      observe: sinon.spy(),
      disconnect: sinon.spy(),
    });

    // Mock the form and button
    const { JSDOM } = jsdom;
    const dom = new JSDOM('<!DOCTYPE html><form><button type="submit"></button></form>');
    form = dom.window.document.querySelector('form');
    dom.window.grecaptcha = global.grecaptcha;
  });

  it('should load the captcha when the submit button is intersecting', () => {
    const recaptcha = new GoogleReCaptcha(configv3, 123, 'cap123', 'site123');
    recaptcha.loadCaptcha(form);

    // Simulate the IntersectionObserver callback
    const callback = global.IntersectionObserver.getCall(0).args[0];
    callback([{ isIntersecting: true }]);

    const script = document.head.querySelector('script');
    assert.equal(script.src, `https://www.google.com/recaptcha/api.js?render=${siteKey}`, 'Expected the script to be loaded');
  });

  it('should load the captcha when the submit button is intersecting for enterprise', () => {
    const recaptcha = new GoogleReCaptcha(configEnterprise, 123, 'cap123', 'site123');
    document.head.querySelector('script')?.remove();
    recaptcha.loadCaptcha(form);

    // Simulate the IntersectionObserver callback
    const callback = global.IntersectionObserver.getCall(0).args[0];
    callback([{ isIntersecting: true }]);

    const script = document.head.querySelector('script');
    assert.equal(script.src, `${configEnterprise.uri}?render=${configEnterprise.siteKey}`, 'Expected the script to be loaded');
  });

  it('getToken should return null if siteKey is not set', async () => {
    const recaptcha = new GoogleReCaptcha(configNull, 123, 'cap123', 'site123');
    const token = await recaptcha.getToken();
    assert.equal(token, null, 'Expected token to be null');
  });

  it('getToken should return token for v3', async () => {
    const recaptcha = new GoogleReCaptcha(configv3, 123, 'cap123', 'site123');
    const token = await recaptcha.getToken();
    assert.equal(token, testToken, 'Expected token to be not null');
  });

  it('getToken should return token for enterprise', async () => {
    const recaptcha = new GoogleReCaptcha(configEnterprise, 123, 'cap123', 'site123');
    const token = await recaptcha.getToken();
    assert.equal(token, testToken, 'Expected token to be not null');
  });
});

/**
 * The captcha component is authored as a required field, so that the required constraint in the
 * form runtime rejects a submission that carries no captcha token.
 */
describe('Captcha required constraint', () => {
  function readJson(filePath) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  }

  function assertCaptchaTemplate(definition) {
    assert.ok(definition, `captcha definition with id "${CAPTCHA_ID}" is missing`);
    const { page } = definition.plugins.xwalk;
    assert.strictEqual(page.resourceType, CAPTCHA_RESOURCE_TYPE);
    assert.strictEqual(page.template.fieldType, CAPTCHA_ID);
    assert.strictEqual(
      page.template.required,
      true,
      'captcha template must set required=true, otherwise the captcha is not validated on submit',
    );
  }

  it('marks the captcha as required in the component definition model', () => {
    const model = readJson('blocks/form/models/form-components/_recaptcha.json');
    const definition = model.definitions.find((def) => def.id === CAPTCHA_ID);
    assertCaptchaTemplate(definition);
  });

  it('marks the captcha as required in the generated component definition', () => {
    const { groups } = readJson('component-definition.json');
    const definitions = groups.flatMap((group) => group.components || []);
    const definition = definitions.find((def) => def.id === CAPTCHA_ID);
    assertCaptchaTemplate(definition);
  });
});
