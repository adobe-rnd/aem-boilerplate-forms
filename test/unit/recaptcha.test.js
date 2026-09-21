/* eslint-env mocha */
import assert from 'assert';
import sinon from 'sinon';
import jsdom from 'jsdom';
import GoogleReCaptcha from '../../blocks/form/integrations/recaptcha.js';

const siteKey = 'test-site-key';
const testToken = 'token123';

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

  describe('submit button detection', () => {
    it('should observe the submit button when exactly one is present', () => {
      const recaptcha = new GoogleReCaptcha(configv3, 123, 'cap123', 'site123');
      recaptcha.loadCaptcha(form);

      const observerInstance = global.IntersectionObserver.getCall(0).returnValue;
      assert.equal(observerInstance.observe.callCount, 1, 'Expected observe to be called once');
      assert.equal(
        observerInstance.observe.getCall(0).args[0],
        form.querySelector('button[type="submit"]'),
        'Expected the single submit button to be observed',
      );
    });

    it('should observe every submit button when multiple are present', () => {
      const { JSDOM } = jsdom;
      const dom = new JSDOM(`<!DOCTYPE html><form>
        <button type="submit" id="panel1-submit"></button>
        <button type="submit" id="panel2-submit"></button>
      </form>`);
      const multiButtonForm = dom.window.document.querySelector('form');
      const submitButtons = multiButtonForm.querySelectorAll('button[type="submit"]');

      const recaptcha = new GoogleReCaptcha(configv3, 123, 'cap123', 'site123');
      recaptcha.loadCaptcha(multiButtonForm);

      const observerInstance = global.IntersectionObserver.getCall(0).returnValue;
      assert.equal(observerInstance.observe.callCount, 2, 'Expected observe to be called once per submit button');
      assert.deepEqual(
        [...observerInstance.observe.getCalls()].map((call) => call.args[0]),
        [...submitButtons],
        'Expected each submit button to be observed',
      );
    });

    it('should load the captcha when a non-first submit button becomes intersecting', () => {
      const { JSDOM } = jsdom;
      const dom = new JSDOM(`<!DOCTYPE html><form>
        <button type="submit" id="panel1-submit"></button>
        <button type="submit" id="panel2-submit"></button>
      </form>`);
      const multiButtonForm = dom.window.document.querySelector('form');
      document.head.querySelector('script')?.remove();

      const recaptcha = new GoogleReCaptcha(configv3, 123, 'cap123', 'site123');
      recaptcha.loadCaptcha(multiButtonForm);

      // Simulate only the second (non-first) submit button becoming visible
      const callback = global.IntersectionObserver.getCall(0).args[0];
      callback([{ isIntersecting: true }]);

      const script = document.head.querySelector('script');
      assert.equal(
        script.src,
        `https://www.google.com/recaptcha/api.js?render=${siteKey}`,
        'Expected the script to be loaded when any submit button intersects',
      );
    });

    it('should warn and alert without observing when no submit button is present', () => {
      const { JSDOM } = jsdom;
      const dom = new JSDOM('<!DOCTYPE html><form></form>');
      const noButtonForm = dom.window.document.querySelector('form');
      const warnStub = sinon.stub(console, 'warn');
      const originalAlert = global.alert;
      global.alert = sinon.stub();

      const recaptcha = new GoogleReCaptcha(configv3, 123, 'cap123', 'site123');
      recaptcha.loadCaptcha(noButtonForm);

      const observerInstance = global.IntersectionObserver.getCall(0).returnValue;
      assert.equal(observerInstance.observe.callCount, 0, 'Expected observe to never be called');
      assert.ok(warnStub.calledWith('Captcha can not be loaded. Submit button is missing.'));
      assert.ok(global.alert.calledWith('Captcha can not be loaded. Add Submit button.'));

      warnStub.restore();
      global.alert = originalAlert;
    });
  });
});
