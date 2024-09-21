import { createForm, generateFormRendition } from './forms-common.js';

export const DELAY_MS = 0;

function cleanUp(content) {
  const formDef = content.replaceAll('^(([^<>()\\\\[\\\\]\\\\\\\\.,;:\\\\s@\\"]+(\\\\.[^<>()\\\\[\\\\]\\\\\\\\.,;:\\\\s@\\"]+)*)|(\\".+\\"))@((\\\\[[0-9]{1,3}\\\\.[0-9]{1,3}\\\\.[0-9]{1,3}\\\\.[0-9]{1,3}])|(([a-zA-Z\\\\-0-9]+\\\\.)\\+[a-zA-Z]{2,}))$', '');
  return formDef?.replace(/\x83\n|\n|\s\s+/g, '');
}
/*
  Newer Clean up - Replace backslashes that are not followed by valid json escape characters
  function cleanUp(content) {
    return content.replace(/\\/g, (match, offset, string) => {
      const prevChar = string[offset - 1];
      const nextChar = string[offset + 1];
      const validEscapeChars = ['b', 'f', 'n', 'r', 't', '"', '\\'];
      if (validEscapeChars.includes(nextChar) || prevChar === '\\') {
        return match;
      }
      return '';
    });
  }
*/

function decode(rawContent) {
  const content = rawContent.trim();
  if (content.startsWith('"') && content.endsWith('"')) {
    // In the new 'jsonString' context, Server side code comes as a string with escaped characters,
    // hence the double parse
    return JSON.parse(JSON.parse(content));
  }
  return JSON.parse(cleanUp(content));
}

function readInlineFormDefinition(block) {
  const pre = block.querySelector('pre');
  const codeEl = pre?.querySelector('code');
  const content = codeEl?.textContent;
  if (content) {
    const formDef = decode(content);
    return { container: pre, formDef };
  }
  return {};
}

export async function fetchForm(pathname) {
  // get the main form
  let data;
  let path = pathname;
  if (path.startsWith(window.location.origin) && !path.endsWith('.json')) {
    if (path.endsWith('.html')) {
      path = path.substring(0, path.lastIndexOf('.html'));
    }
    path += '/jcr:content/root/section/form.html';
  }
  const resp = await fetch(path);

  if (resp?.headers?.get('Content-Type')?.includes('application/json')) {
    data = await resp.json();
  } else if (resp?.headers?.get('Content-Type')?.includes('text/html')) {
    data = await resp.text().then((html) => {
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        if (doc) {
          return readInlineFormDefinition(doc.body).formDef;
        }
        return doc;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Unable to fetch form definition for path', pathname, path);
        return null;
      }
    });
  }
  return data;
}

export async function extractFormDefinition(block) {
  const container = block.querySelector('a[href]');
  if (container) {
    const formDef = await fetchForm(container.href);
    return { container, formDef };
  }
  const { container: c2, formDef } = readInlineFormDefinition(block);
  return { container: c2, formDef };
}

async function createFormForAuthoring(formDef) {
  const form = document.createElement('form');
  await generateFormRendition(formDef, form, (container) => {
    if (container[':itemsOrder'] && container[':items']) {
      return container[':itemsOrder'].map((itemKey) => container[':items'][itemKey]);
    }
    return [];
  });
  return form;
}

export async function renderForm(formDef, block) {
  const afModule = await import('./rules/index.js');
  let form;
  if (afModule && afModule.initAdaptiveForm && !block.classList.contains('edit-mode')) {
    form = await afModule.initAdaptiveForm(
      formDef,
      (updatedFormDef, data) => createForm(updatedFormDef, data, {
        onFormLoad: ({ formEl, captcha }) => {
          window.setTimeout(async () => {
            afModule.loadRuleEngine(updatedFormDef, formEl, captcha, generateFormRendition, data);
          }, DELAY_MS);
        },
      }),
    );
  } else {
    form = await createFormForAuthoring(formDef);
  }
  form.dataset.source = 'aem';
  form.dataset.id = formDef.id;
  if (formDef.properties) {
    form.dataset.formpath = formDef.properties['fd:path'];
  }
  return form;
}
