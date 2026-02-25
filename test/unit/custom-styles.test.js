/* eslint-env mocha */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readBlockConfig } from '../../scripts/aem.js';
import decorate, {
  removeStyleConfigRow,
  normalizeStylePath,
} from '../../blocks/form/form.js';
import { createBlock } from './testUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../..');

/** Creates a two-cell style row: first cell "style", second cell link with href (or plain text). */
function createStyleRow(path, useLink = true) {
  const row = document.createElement('div');
  const keyCell = document.createElement('div');
  keyCell.textContent = 'style';
  const valueCell = document.createElement('div');
  if (useLink) {
    const link = document.createElement('a');
    link.href = path;
    link.textContent = path;
    valueCell.appendChild(link);
  } else {
    valueCell.textContent = path;
  }
  row.appendChild(keyCell);
  row.appendChild(valueCell);
  return row;
}

describe('Custom form styles', () => {
  describe('readBlockConfig + style row', () => {
    it('readBlockConfig returns style from link href; removeStyleConfigRow removes the row', () => {
      const block = document.createElement('div');
      block.appendChild(createStyleRow('blocks/form/form-1.css'));

      const config = readBlockConfig(block);
      const stylePath = normalizeStylePath(config.style);
      removeStyleConfigRow(block);

      assert.strictEqual(stylePath, 'blocks/form/form-1.css');
      assert.strictEqual(block.children.length, 0, 'style row should be removed');
    });

    it('readBlockConfig returns style from second cell text when no link', () => {
      const block = document.createElement('div');
      block.appendChild(createStyleRow('styles/custom.css', false));

      const config = readBlockConfig(block);
      const stylePath = normalizeStylePath(config.style);
      removeStyleConfigRow(block);

      assert.strictEqual(stylePath, 'styles/custom.css');
      assert.strictEqual(block.children.length, 0);
    });

    it('readBlockConfig returns empty config when block has no children', () => {
      const block = document.createElement('div');
      const config = readBlockConfig(block);
      assert.strictEqual(normalizeStylePath(config.style), undefined);
    });

    it('removeStyleConfigRow does not throw when block is null or undefined', () => {
      assert.doesNotThrow(() => removeStyleConfigRow(null));
      assert.doesNotThrow(() => removeStyleConfigRow(undefined));
    });

    it('ignores rows that do not have first cell "style"', () => {
      const block = document.createElement('div');
      const otherRow = document.createElement('div');
      const keyCell = document.createElement('div');
      keyCell.textContent = 'other';
      const valueCell = document.createElement('div');
      valueCell.textContent = 'value';
      otherRow.appendChild(keyCell);
      otherRow.appendChild(valueCell);
      block.appendChild(otherRow);

      const config = readBlockConfig(block);
      removeStyleConfigRow(block);

      assert.strictEqual(config.style, undefined);
      assert.strictEqual(block.children.length, 1, 'other row should remain');
    });

    it('handles "style" key case-insensitively (readBlockConfig uses toClassName)', () => {
      const block = document.createElement('div');
      const row = document.createElement('div');
      const keyCell = document.createElement('div');
      keyCell.textContent = 'STYLE';
      const valueCell = document.createElement('div');
      valueCell.textContent = 'styles/custom.css';
      row.appendChild(keyCell);
      row.appendChild(valueCell);
      block.appendChild(row);

      const config = readBlockConfig(block);
      const stylePath = normalizeStylePath(config.style);
      removeStyleConfigRow(block);

      assert.strictEqual(stylePath, 'styles/custom.css');
      assert.strictEqual(block.children.length, 0);
    });
  });

  describe('normalizeStylePath', () => {
    it('returns path unchanged when relative', () => {
      assert.strictEqual(normalizeStylePath('styles/custom.css'), 'styles/custom.css');
    });

    it('strips leading slash from absolute URL pathname', () => {
      assert.strictEqual(
        normalizeStylePath('http://localhost/blocks/form/form-1.css'),
        'blocks/form/form-1.css',
      );
    });

    it('returns undefined for null, undefined, empty string', () => {
      assert.strictEqual(normalizeStylePath(null), undefined);
      assert.strictEqual(normalizeStylePath(undefined), undefined);
      assert.strictEqual(normalizeStylePath(''), undefined);
    });
  });

  describe('loadFormCustomStyles via decorate', () => {
    beforeEach(() => {
      document.head.innerHTML = '';
      window.hlx = { codeBasePath: '/base' };
    });

    afterEach(() => {
      document.head.innerHTML = '';
    });

    it('loads stylesheet when AEM form has properties.style', async () => {
      const formDef = {
        adaptiveform: '0.10.0',
        metadata: {},
        properties: { style: 'blocks/form/form-2.css' },
        items: [],
        id: 'test-form',
      };
      const block = createBlock(formDef);

      await decorate(block);

      const link = document.head.querySelector('link[rel="stylesheet"][href*="blocks/form/form-2.css"]');
      assert.ok(link, 'stylesheet link should be added to head');
      assert.ok(link.href.includes('/base/blocks/form/form-2.css') || link.href.endsWith('blocks/form/form-2.css'), 'href should include style path');
    });

    it('loads stylesheet when document-based block has style row (two-cell with link)', async () => {
      const sheetDef = {
        total: 1,
        offset: 0,
        limit: 1,
        data: [{ Name: 'f1', Type: 'text', Label: 'Field 1', Mandatory: '', Value: '', Fieldset: '' }],
        ':type': 'sheet',
      };
      const block = document.createElement('div');
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = JSON.stringify(JSON.stringify(sheetDef));
      pre.appendChild(code);
      block.appendChild(pre);
      block.appendChild(createStyleRow('blocks/form/form-1.css'));

      await decorate(block);

      const link = document.head.querySelector('link[rel="stylesheet"][href*="blocks/form/form-1.css"]');
      assert.ok(link, 'stylesheet link should be added for document-based form with style row');
      const styleConfigRow = [...block.children].find(
        (el) => el.children?.[0]?.textContent?.trim()?.toLowerCase() === 'style',
      );
      assert.strictEqual(styleConfigRow, undefined, 'style config row should be removed from block');
    });

    it('does not add stylesheet when formDef has no properties.style', async () => {
      const formDef = {
        adaptiveform: '0.10.0',
        metadata: {},
        properties: {},
        items: [],
        id: 'test-form',
      };
      const block = createBlock(formDef);

      await decorate(block);

      const links = document.head.querySelectorAll('link[rel="stylesheet"][href*="form"]');
      const formStyleLinks = [...links].filter((l) => l.href.includes('form-1') || l.href.includes('form-2'));
      assert.strictEqual(formStyleLinks.length, 0, 'no custom form stylesheet should be added');
    });

    it('builds href without double slash when style already starts with "/"', async () => {
      const formDef = {
        adaptiveform: '0.10.0',
        metadata: {},
        properties: { style: '/blocks/form/form-2.css' },
        items: [],
        id: 'test-form',
      };
      const block = createBlock(formDef);

      await decorate(block);

      const link = document.head.querySelector('link[rel="stylesheet"][href*="blocks/form/form-2.css"]');
      assert.ok(link, 'stylesheet link should be added');
      assert.ok(!link.href.includes('/base//'), 'href should not contain double slash between base and style path');
      assert.ok(link.href.includes('/base/blocks/form/form-2.css'), 'href should be base + style path');
    });
  });

  describe('Custom form styles rendition', () => {
    beforeEach(() => {
      document.head.innerHTML = '';
      document.body.innerHTML = '';
      window.hlx = { codeBasePath: '/base' };
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    /**
     * Reads the CSS from the link href that decorate added and injects it as a <style>
     * so we can assert computed styles. (In jsdom, link[rel=stylesheet] does not load
     * file content; this simulates the stylesheet having loaded.)
     */
    function injectFixtureStyles() {
      const link = document.head.querySelector('link[rel="stylesheet"][href*="rendition-fixture.css"]');
      assert.ok(link, 'decorate should have added a stylesheet link for the custom style');
      const pathname = link.href.startsWith('http')
        ? new URL(link.href).pathname
        : (link.href.startsWith('/') ? link.href : `/${link.href}`);
      const codeBasePath = (window.hlx?.codeBasePath || '').replace(/^\/|\/$/g, '');
      const relativePath = pathname.replace(new RegExp(`^/${codeBasePath}/?`), '').replace(/^\//, '');
      const filePath = path.join(PROJECT_ROOT, relativePath);
      const css = fs.readFileSync(filePath, 'utf8');
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }

    it('applies custom styles to the form when stylesheet is loaded (AEM form)', async () => {
      const formDef = {
        adaptiveform: '0.10.0',
        metadata: {},
        properties: { style: 'test/unit/fixtures/custom-styles/rendition-fixture.css' },
        items: [],
        id: 'test-form',
      };
      const block = createBlock(formDef);

      await decorate(block);

      const form = block.querySelector('form');
      assert.ok(form, 'form should be rendered');
      assert.strictEqual(form.dataset.source, 'aem', 'form should have data-source="aem"');

      document.body.appendChild(block);
      injectFixtureStyles();

      const computed = window.getComputedStyle(form);
      assert.strictEqual(computed.outlineWidth, '5px', 'custom style outline-width should be applied');
      assert.strictEqual(computed.outlineStyle, 'solid', 'custom style outline-style should be applied');
    });

    it('applies custom styles to the form when stylesheet is loaded (document-based with style row)', async () => {
      const sheetDef = {
        total: 1,
        offset: 0,
        limit: 1,
        data: [{ Name: 'f1', Type: 'text', Label: 'Field 1', Mandatory: '', Value: '', Fieldset: '' }],
        ':type': 'sheet',
      };
      const block = document.createElement('div');
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = JSON.stringify(JSON.stringify(sheetDef));
      pre.appendChild(code);
      block.appendChild(pre);
      block.appendChild(createStyleRow('test/unit/fixtures/custom-styles/rendition-fixture.css'));

      await decorate(block);

      const form = block.querySelector('form');
      assert.ok(form, 'form should be rendered');
      assert.strictEqual(form.dataset.source, 'sheet', 'form should have data-source="sheet"');

      document.body.appendChild(block);
      injectFixtureStyles();

      const computed = window.getComputedStyle(form);
      assert.strictEqual(computed.outlineWidth, '5px', 'custom style outline-width should be applied');
      assert.strictEqual(computed.outlineStyle, 'solid', 'custom style outline-style should be applied');
    });
  });
});
