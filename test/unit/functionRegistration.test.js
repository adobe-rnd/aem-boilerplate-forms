/* eslint-env mocha */
import assert from 'assert';
import { resolveFunctionUrl } from '../../blocks/form/rules/functionRegistration.js';

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
  });
});
