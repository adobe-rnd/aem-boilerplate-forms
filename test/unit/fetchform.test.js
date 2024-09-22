import { describe, it, before } from 'mocha'; // Import the describe function from Mocha or the appropriate testing framework.
import assert from 'assert';
import nock from 'nock';
import { extractFormDefinition } from '../../blocks/form/lib/aemform.js';
import { createBlockWithUrl } from './testUtils.js';
import { buildBlock } from '../../scripts/aem.js';

function escapeHTML(str) {
  return (str.replace(/[&<>'"]/g, (tag) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[tag])));
}

const data = {
  id: 'someid',
  items: [
    {
      fieldType: 'text-input',
      id: 'text-input',
      name: 'f2',
      rules: {
        value: 'f1',
      },
    },
    {
      fieldType: 'text-input',
      id: 'text-input-2',
      name: 'f1',
    },
    {
      fieldType: 'button',
      id: 'button',
      events: {
        click: 'submitForm()',
      },
    },
  ],
};

const formPath = 'http://abc.com/adobe/forms/myform.html';
const formBlock = `<div class="form"><div><div></div><pre>
<code>${escapeHTML(JSON.stringify(data))}</code></pre></div></div>`;

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock HTML</title>
</head>
<body>
  <main>${formBlock}</main>
</body>
</html>
`;

describe('extractFormDefinition api for aem forms', () => {
  let scope;
  before(() => {
    global.window = Object.create(window);
    Object.defineProperty(global.window, 'location', {
      get() {
        return { origin: 'http://abc.com' };
      },
    });
    scope = nock('http://abc.com')
      .get('/adobe/forms/myform/jcr:content/root/section/form.html')
      .reply(200, htmlContent, {
        'Content-Type': 'text/html',
      });
  });
  it('should work with html reference as well', async () => {
    const anchor = createBlockWithUrl(null, formPath, false);
    const block = buildBlock('form', [[anchor]]);
    const { formDef } = await extractFormDefinition(block);
    assert.equal(scope.isDone(), true);

    assert.deepStrictEqual(formDef, data);
    // assert.equal(form, JSON.stringify(data));
  });
});
