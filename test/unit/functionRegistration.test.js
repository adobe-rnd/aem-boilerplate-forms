/* eslint-env mocha */
import assert from 'assert';
import jsdom from 'jsdom';
import registerCustomFunctions, { resolveFunctionUrl, preloadFunctionScripts } from '../../blocks/form/rules/functionRegistration.js';
import { createFormInstance } from '../../blocks/form/rules/model/afb-runtime.min.js';

describe('functionRegistration', () => {
  describe('resolveFunctionUrl', () => {
    it('joins with exactly one slash regardless of which side supplies it', () => {
      assert.strictEqual(resolveFunctionUrl('/base/', '/form/functions.js'), '/base/form/functions.js');
      assert.strictEqual(resolveFunctionUrl('/base', 'form/functions.js'), '/base/form/functions.js');
      assert.strictEqual(
        resolveFunctionUrl('/base/', 'form/functions.js'),
        resolveFunctionUrl('/base', '/form/functions.js'),
      );
    });

    it('falls back to a root-relative URL when codeBasePath is empty or missing', () => {
      assert.strictEqual(resolveFunctionUrl('', '/form/functions.js'), '/form/functions.js');
      assert.strictEqual(resolveFunctionUrl(undefined, 'form/functions.js'), '/form/functions.js');
    });

    it('does not alter the path when there is no overlap (legacy: path relative to codeBasePath)', () => {
      assert.strictEqual(
        resolveFunctionUrl('/eds-unified-cc', '/blocks/form/functions.js'),
        '/eds-unified-cc/blocks/form/functions.js',
      );
    });

    it('collapses a single overlapping segment (FORMS-26373)', () => {
      // codeBasePath ends with the mount folder and customFunctionsPath (repo-root) starts
      // with it; the shared segment must appear once, not be duplicated.
      const codeBasePath = '/abc/def/ghi';
      const customFunctionsPath = '/ghi/blocks/form/functions.js';
      assert.strictEqual(
        resolveFunctionUrl(codeBasePath, customFunctionsPath),
        '/abc/def/ghi/blocks/form/functions.js',
      );
    });

    it('collapses a multi-segment overlap', () => {
      assert.strictEqual(
        resolveFunctionUrl('/root/abc/def/xyz', '/abc/def/xyz/blocks/form/functions.js'),
        '/root/abc/def/xyz/blocks/form/functions.js',
      );
    });

    it('matches overlap only on full segment boundaries (no partial-name collapse)', () => {
      assert.strictEqual(
        resolveFunctionUrl('/forms', '/forms-utils/functions.js'),
        '/forms/forms-utils/functions.js',
      );
    });

    it('preserves an absolute origin in codeBasePath', () => {
      assert.strictEqual(
        resolveFunctionUrl('https://main--repo--owner.aem.live', '/blocks/form/functions.js'),
        'https://main--repo--owner.aem.live/blocks/form/functions.js',
      );
      assert.strictEqual(
        resolveFunctionUrl('https://host/eds-unified-cc', '/eds-unified-cc/blocks/form/functions.js'),
        'https://host/eds-unified-cc/blocks/form/functions.js',
      );
    });

    it('keeps the result relative when codeBasePath is itself a bare relative path', () => {
      // codeBasePath values like '../..' show up in the no-Worker fallback / test harness.
      // Forcing a leading '/' here would turn a valid relative specifier into an invalid
      // "above the origin root" absolute path (/../../...).
      assert.strictEqual(
        resolveFunctionUrl('../..', 'blocks/form/rules/functions.js'),
        '../../blocks/form/rules/functions.js',
      );
      assert.strictEqual(
        resolveFunctionUrl('../../', 'blocks/form/rules/functions.js'),
        '../../blocks/form/rules/functions.js',
      );
    });

    it('collapses overlap uniformly even for the OOTB relative path (accepted trade-off)', () => {
      // Deliberate: collapsing is applied the same way regardless of caller. If codeBasePath's
      // last segment happens to coincidentally match the OOTB path's first segment ('blocks'),
      // it gets collapsed too, even though the two 'blocks' name unrelated folders (repo source
      // tree vs. AEM content path). This is a known, accepted false-positive risk, not a bug.
      assert.strictEqual(
        resolveFunctionUrl('/content/site/blocks', 'blocks/form/rules/functions.js'),
        '/content/site/blocks/form/rules/functions.js',
      );
    });
  });

  describe('preloadFunctionScripts', () => {
    beforeEach(() => {
      document.head.innerHTML = '';
      // preloadFunctionScripts resolves hrefs against window.location.origin; the default
      // jsdom-global window sits at about:blank (origin === null), which makes new URL()
      // throw and gets silently swallowed. Give window a real URL, same as testUtils.js does
      // for rendering tests. This doesn't touch the (separate) bare `document` that both this
      // function and the assertions below read/write.
      global.window = new jsdom.JSDOM('', { url: 'http://localhost:2000/test/path' }).window;
    });

    afterEach(() => {
      document.head.innerHTML = '';
    });

    function preloadHrefs() {
      return [...document.head.querySelectorAll('link[rel="modulepreload"]')].map((l) => l.href);
    }

    // preloadFunctionScripts dedupes via a module-level, page-lifetime Set of already-preloaded
    // URLs (by design - a real page load should only preload each URL once). Each test below
    // therefore uses a codeBasePath unique to that test, so it can never be skipped because some
    // other test (in this file or another) already preloaded the same resulting URL.

    it('preloads the OOTB module joined with codeBasePath', () => {
      preloadFunctionScripts(undefined, '/frt-ootb');
      const hrefs = preloadHrefs();
      assert.ok(hrefs.some((h) => h.endsWith('/frt-ootb/blocks/form/rules/functions.js')), `expected an OOTB preload href, got ${JSON.stringify(hrefs)}`);
    });

    it('preloads the custom module joined with codeBasePath, single slash regardless of input slashes', () => {
      preloadFunctionScripts('/form/functions.js', '/frt-slash/');
      const hrefs = preloadHrefs();
      assert.ok(hrefs.some((h) => h.endsWith('/frt-slash/form/functions.js')), `expected a custom preload href, got ${JSON.stringify(hrefs)}`);
      assert.ok(!hrefs.some((h) => h.includes('/frt-slash//')), 'no href should contain a double slash');
    });

    it('does not add a custom preload link when customFunctionsPath is absent', () => {
      preloadFunctionScripts(undefined, '/frt-no-custom');
      const hrefs = preloadHrefs();
      assert.strictEqual(hrefs.length, 1, `expected only the OOTB preload, got ${JSON.stringify(hrefs)}`);
    });

    it('collapses the mount-folder overlap for the custom module (FORMS-26373)', () => {
      preloadFunctionScripts(
        '/eds-unified-cc-frt/blocks/form/functions.js',
        '/content/forms/af/cards/unified-cc-login-panel.resource/eds-unified-cc-frt',
      );
      const hrefs = preloadHrefs();
      assert.ok(
        hrefs.some((h) => h.endsWith('/content/forms/af/cards/unified-cc-login-panel.resource/eds-unified-cc-frt/blocks/form/functions.js')),
        `expected the mount folder to appear once, got ${JSON.stringify(hrefs)}`,
      );
    });

    it('does not add a duplicate link when called twice with the same arguments', () => {
      preloadFunctionScripts('/form/functions.js', '/frt-dedup');
      preloadFunctionScripts('/form/functions.js', '/frt-dedup');
      const hrefs = preloadHrefs().filter((h) => h.endsWith('/frt-dedup/form/functions.js'));
      assert.strictEqual(hrefs.length, 1, `expected the second call to be deduped, got ${JSON.stringify(hrefs)}`);
    });
  });

  describe('registerCustomFunctions', () => {
    function formWithEvent(id, eventFormula) {
      return {
        id: 'frt-form',
        action: '/submit',
        ':itemsOrder': ['trigger', 'result'],
        metadata: {},
        adaptiveform: '0.10.0',
        items: [
          {
            id: 'trigger',
            fieldType: 'number-input',
            name: 'trigger',
            type: 'number',
            value: 0,
            events: { change: [eventFormula], 'custom:setProperty': ['$event.payload'] },
          },
          {
            id,
            fieldType: 'number-input',
            name: id,
            type: 'number',
            value: 0,
            events: { 'custom:setProperty': ['$event.payload'] },
          },
        ],
      };
    }

    it('registers a form-specific custom function reachable via a relative codeBasePath and the rule engine can call it', async () => {
      // codeBasePath here is a bare relative path ('../..', up from blocks/form/rules/ to
      // the repo root) - this is exactly the shape that was broken before the Case 1 fix
      // (resolveFunctionUrl used to force a leading '/', turning it into an invalid path).
      // frtCombine is unique to this fixture file, so a passing result proves the *custom*
      // import succeeded - it can't be coming from the OOTB functions.js fallback.
      await registerCustomFunctions('/test/unit/fixtures/functionRegistration-custom-fn.js', '../../..');
      const formDef = formWithEvent('result', "dispatchEvent(result, 'custom:setProperty', {value: frtCombine('fname', 'lname')})");
      const form = createFormInstance(formDef, undefined, 'error');
      form.getElement('trigger').value = 1;
      assert.strictEqual(form.getElement('result').value, 'lname-fname');
    });

    it('still registers the default OOTB functions when the custom path fails to resolve', async () => {
      // Pinning test for the current single shared try/catch: the OOTB import runs and
      // registers successfully *before* the custom import is attempted, so a broken
      // customFunctionsPath does not prevent OOTB functions from working.
      await registerCustomFunctions('/totally/does/not/exist.js', '../..');
      const formDef = formWithEvent('result', "dispatchEvent(result, 'custom:setProperty', {value: dateToDaysSinceEpoch('1970-01-11')})");
      const form = createFormInstance(formDef, undefined, 'error');
      form.getElement('trigger').value = 1;
      assert.strictEqual(form.getElement('result').value, 10);
    });
  });
});
