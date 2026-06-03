/* eslint-env mocha */
import assert from 'assert';
import { preloadFunctionScripts } from '../../blocks/form/rules/functionRegistration.js';

// jsdom-global sets up window and document via setup-env.js.
//
// window.location.origin is 'null' in jsdom (about:blank), which makes
// new URL(path, origin) throw. In production, codeBasePath is always an
// absolute URL. Tests pass 'http://localhost:3000' to keep hrefs absolute
// and bypass the new URL() call in preloadFunctionScripts.

const BASE = 'http://localhost:3000';

// The preloadedUrls Set inside functionRegistration.js is a module-level
// singleton. We use unique sub-paths per test to avoid dedup cross-contamination.
let testId = 0;
function uniquePath(name = 'fn') {
  testId += 1;
  return `/blocks/form/t${testId}/${name}.js`;
}

function modulepreloadsInHead() {
  return [...document.head.querySelectorAll('link[rel="modulepreload"]')].map((l) => l.href);
}
function prefetchesInHead() {
  return [...document.head.querySelectorAll('link[rel="prefetch"]')].map((l) => l.href);
}
function snapshotLinks() {
  return {
    modulepreload: modulepreloadsInHead(),
    prefetch: prefetchesInHead(),
  };
}
function addedSince(snap) {
  return {
    modulepreload: modulepreloadsInHead().filter((h) => !snap.modulepreload.includes(h)),
    prefetch: prefetchesInHead().filter((h) => !snap.prefetch.includes(h)),
  };
}

describe('functionRegistration', () => {
  describe('preloadFunctionScripts', () => {
    describe('OOTB-only paths (no customFunctionsPath)', () => {
      it('adds modulepreload for both OOTB bundles and no prefetch when customFunctionsPath is null', () => {
        const snap = snapshotLinks();
        preloadFunctionScripts(null, `${BASE}/ootb-null-test`);
        const { modulepreload, prefetch } = addedSince(snap);
        assert.ok(
          modulepreload.some((h) => h.includes('blocks/form/rules/functions.min.js')),
          'should preload rules/functions.min.js',
        );
        assert.ok(
          modulepreload.some((h) => h.includes('blocks/form/functions.min.js')
            && !h.includes('rules/functions.min.js')),
          'should preload blocks/form/functions.min.js (eager-bundle dep)',
        );
        assert.strictEqual(prefetch.length, 0, 'no prefetch without customFunctionsPath');
      });

      it('does NOT add a prefetch when customFunctionsPath is empty string', () => {
        const snap = snapshotLinks();
        preloadFunctionScripts('', `${BASE}/ootb-empty-test`);
        assert.strictEqual(addedSince(snap).prefetch.length, 0, 'no prefetch for empty customFunctionsPath');
      });
    });

    describe('with customFunctionsPath configured', () => {
      it('adds modulepreload for the shim (customFunctionsPath itself)', () => {
        const p = uniquePath('shim');
        const snap = snapshotLinks();
        preloadFunctionScripts(p, BASE);
        const { modulepreload } = addedSince(snap);
        assert.ok(
          modulepreload.some((h) => h.includes('shim.js')),
          'should modulepreload the shim file',
        );
      });

      it('adds modulepreload for {basename}.min.js (eager bundle)', () => {
        const p = uniquePath('eager');
        const snap = snapshotLinks();
        preloadFunctionScripts(p, BASE);
        const { modulepreload } = addedSince(snap);
        assert.ok(
          modulepreload.some((h) => h.includes('eager-bundle-eager.min.js')),
          'should modulepreload {name}-bundle-eager.min.js',
        );
      });

      it('adds a prefetch for {basename}-bundle-lazy.min.js (not modulepreload)', () => {
        const p = uniquePath('lazy');
        const snap = snapshotLinks();
        preloadFunctionScripts(p, BASE);
        const { modulepreload, prefetch } = addedSince(snap);
        assert.ok(
          prefetch.some((h) => h.includes('lazy-bundle-lazy.min.js')),
          'should prefetch {name}-bundle-lazy.min.js',
        );
        assert.ok(
          !modulepreload.some((h) => h.includes('lazy-bundle-lazy.min.js')),
          'lazy bundle must NOT be modulepreload — avoids LCP bandwidth competition',
        );
      });

      it('derives basename correctly for arbitrary customFunctionsPath filenames', () => {
        const p = '/blocks/form/perf/eds-perf-collateral.js';
        const snap = snapshotLinks();
        preloadFunctionScripts(p, BASE);
        const { modulepreload, prefetch } = addedSince(snap);
        assert.ok(
          modulepreload.some((h) => h.includes('eds-perf-collateral-bundle-eager.min.js')),
          'should modulepreload eds-perf-collateral-bundle-eager.min.js (eager bundle)',
        );
        assert.ok(
          prefetch.some((h) => h.includes('eds-perf-collateral-bundle-lazy.min.js')),
          'should prefetch eds-perf-collateral-bundle-lazy.min.js',
        );
      });

      it('prefixes all generated URLs with codeBasePath', () => {
        const codeBase = 'https://example.aem.live';
        const p = uniquePath('basetest');
        const snap = snapshotLinks();
        preloadFunctionScripts(p, codeBase);
        const { modulepreload, prefetch } = addedSince(snap);
        const customHrefs = [...modulepreload, ...prefetch].filter((h) => h.includes('basetest'));
        assert.ok(customHrefs.length > 0, 'should add custom-function links');
        assert.ok(
          customHrefs.every((h) => h.startsWith('https://example.aem.live')),
          'all custom-function URLs should start with codeBasePath',
        );
      });
    });

    describe('deduplication', () => {
      it('does not add duplicate link elements on repeated calls with the same path', () => {
        const p = uniquePath('dedup');
        preloadFunctionScripts(p, BASE);
        const countAfterFirst = document.head.querySelectorAll('link').length;
        preloadFunctionScripts(p, BASE);
        assert.strictEqual(
          document.head.querySelectorAll('link').length,
          countAfterFirst,
          'second call must not add duplicate link elements',
        );
      });
    });
  });
});
