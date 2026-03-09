/* eslint-env mocha */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import DocBasedFormToAF from '../../blocks/form/transform.js';
import decorate from '../../blocks/form/form.js';
import { createBlock } from './testUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../..');

describe('Custom form styles', () => {
  describe('DocBasedFormToAF.parseStyleFromBlock', () => {
    it('returns CSS path and removes the row when block has "css: path"', () => {
      const block = document.createElement('div');
      const row = document.createElement('div');
      row.textContent = 'style: blocks/form/form-1.css';
      block.appendChild(row);

      const result = DocBasedFormToAF.parseStyleFromBlock(block);

      assert.strictEqual(result, 'blocks/form/form-1.css');
      assert.strictEqual(block.children.length, 0, 'css row should be removed');
    });

    it('returns undefined when block has no children', () => {
      const block = document.createElement('div');
      const result = DocBasedFormToAF.parseStyleFromBlock(block);
      assert.strictEqual(result, undefined);
    });

    it('returns undefined when block is null or undefined', () => {
      assert.strictEqual(DocBasedFormToAF.parseStyleFromBlock(null), undefined);
      assert.strictEqual(DocBasedFormToAF.parseStyleFromBlock(undefined), undefined);
    });

    it('ignores rows that do not contain "css:"', () => {
      const block = document.createElement('div');
      const otherRow = document.createElement('div');
      otherRow.textContent = 'other: value';
      block.appendChild(otherRow);

      const result = DocBasedFormToAF.parseStyleFromBlock(block);

      assert.strictEqual(result, undefined);
      assert.strictEqual(block.children.length, 1, 'other row should remain');
    });

    it('handles "CSS:" key case-insensitively', () => {
      const block = document.createElement('div');
      const row = document.createElement('div');
      row.textContent = 'STYLE: styles/custom.css';
      block.appendChild(row);

      const result = DocBasedFormToAF.parseStyleFromBlock(block);

      assert.strictEqual(result, 'styles/custom.css');
      assert.strictEqual(block.children.length, 0);
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

    it('loads stylesheet when document-based block has "css: path" row', async () => {
      const sheetDef = {
        total: 1,
        offset: 0,
        limit: 1,
        data: [{ Name: 'f1', Type: 'text', Label: 'Field 1', Mandatory: '', Value: '', Fieldset: '' }],
        ':type': 'sheet',
      };
      const block = document.createElement('div');
      const cssRow = document.createElement('div');
      cssRow.textContent = 'style: blocks/form/form-1.css';
      block.appendChild(cssRow);
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = JSON.stringify(JSON.stringify(sheetDef));
      pre.appendChild(code);
      block.appendChild(pre);

      await decorate(block);

      const link = document.head.querySelector('link[rel="stylesheet"][href*="blocks/form/form-1.css"]');
      assert.ok(link, 'stylesheet link should be added for document-based form with css row');
      const configRow = [...block.children].find((el) => el.textContent?.trim().toLowerCase().startsWith('style:'));
      assert.strictEqual(configRow, undefined, 'css config row should be removed from block');
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

    it('applies custom styles to the form when stylesheet is loaded (document-based with css row)', async () => {
      const sheetDef = {
        total: 1,
        offset: 0,
        limit: 1,
        data: [{ Name: 'f1', Type: 'text', Label: 'Field 1', Mandatory: '', Value: '', Fieldset: '' }],
        ':type': 'sheet',
      };
      const block = document.createElement('div');
      const cssRow = document.createElement('div');
      cssRow.textContent = 'style: test/unit/fixtures/custom-styles/rendition-fixture.css';
      block.appendChild(cssRow);
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = JSON.stringify(JSON.stringify(sheetDef));
      pre.appendChild(code);
      block.appendChild(pre);

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
