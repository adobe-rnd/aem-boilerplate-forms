import { generateFormRendition } from '../blocks/form/form.js';

function getItems(container) {
  if (container[':itemsOrder'] && container[':items']) {
    return container[':itemsOrder'].map((itemKey) => container[':items'][itemKey]);
  }
  return [];
}

function getFieldById(panel, id, formFieldMap) {
  let field;

  if (panel.id === id) {
    field = panel;
  } else if (formFieldMap[id]) {
    field = formFieldMap[id];
  } else {
    const items = getItems(panel);
    items.forEach((item) => {
      formFieldMap[item.id] = item;
      if (item.id === id) {
        field = item;
      } else if (item.fieldType === 'panel') {
        field = getFieldById(item, id, formFieldMap);
      }
    });
  }
  return field;
}

function annotateItems(items, formDefinition, formFieldMap) {
  items.forEach((fieldWrapper) => {
    if (fieldWrapper.classList.contains('field-wrapper')) {
      const { id } = fieldWrapper.dataset;
      const fd = getFieldById(formDefinition, id, formFieldMap);
      if (fd && fd.properties) {
        fieldWrapper.setAttribute('data-aue-type', 'component');
        fieldWrapper.setAttribute('data-aue-resource', `urn:aemconnection:${fd.properties['fd:path']}`);
        if (fd.properties['fd:fragment']) {
          fieldWrapper.setAttribute('data-aue-model', 'fragment');
        } else {
          fieldWrapper.setAttribute('data-aue-model', fd.fieldType === 'image' || fd.fieldType === 'button' ? `form-${fd.fieldType}` : fd.fieldType);
        }
        fieldWrapper.setAttribute('data-aue-label', fd.name);
      } else {
        console.warn(`field ${id} not found in form definition`);
      }
      if (fieldWrapper.classList.contains('panel-wrapper')) {
        fieldWrapper.setAttribute('data-aue-type', 'container');
        fieldWrapper.setAttribute('data-aue-behavior', 'component');
        annotateItems(fieldWrapper.childNodes, formDefinition, formFieldMap);
      }
    }
  });
}

function annotateFormForEditing(formEl, formDefinition) {
  if (document.documentElement.classList.contains('adobe-ue-edit')) {
    formEl.classList.add('edit-mode');
  }
  const formFieldMap = {};
  annotateItems(formEl.childNodes, formDefinition, formFieldMap);
}

/**
 * Event listener for aue:ui-select, selection of a component
 */
function handleEditorSelect(event) {
  if (event.target.closest('.wizard') && event.detail.selected && !event.target.classList.contains('wizard')) {
    const wizardEl = event.target.closest('.wizard');
    const { resource } = event.detail;
    const el = wizardEl.querySelector(`[data-aue-resource='${resource}']`);
    const existingSelectedEl = wizardEl.querySelector('.current-wizard-step');
    existingSelectedEl.classList.remove('current-wizard-step');
    if (el.hasAttribute('data-index')) {
      // if selected element is the direct chld of wizard
      el.classList.add('current-wizard-step');
    } else {
      wizardEl.children.forEach((child) => {
        const isElPresentUnderChild = child.querySelector(`[data-aue-resource='${resource}']`);
        if (isElPresentUnderChild) {
          child.classList.add('current-wizard-step');
        }
      });
    }
  }
}

async function annotateFormsForEditing(forms) {
  forms.forEach(async (form) => {
    const formDefResp = await fetch(`${form.dataset.formpath}.model.json`);
    const formDef = await formDefResp.json();
    console.log('formDef', formDef);
    annotateFormForEditing(form, formDef);
  });
}

async function instrumentForms(mutationsList) {
  const formsEl = [];
  mutationsList.forEach((mutation) => {
    // Check if the mutation type is 'childList' and if nodes are added
    if (mutation.type === 'childList' && mutation.addedNodes.length) {
      mutation.addedNodes.forEach((node) => {
        // Check if the added node is a form element
        if (node.nodeName.toLowerCase() === 'form') {
          formsEl.push(node);
        }
      });
    }
  });
  annotateFormsForEditing(formsEl);
}

function cleanUp(content) {
  const formDef = content.replaceAll('^(([^<>()\\\\[\\\\]\\\\\\\\.,;:\\\\s@\\"]+(\\\\.[^<>()\\\\[\\\\]\\\\\\\\.,;:\\\\s@\\"]+)*)|(\\".+\\"))@((\\\\[[0-9]{1,3}\\\\.[0-9]{1,3}\\\\.[0-9]{1,3}\\\\.[0-9]{1,3}])|(([a-zA-Z\\\\-0-9]+\\\\.)\\+[a-zA-Z]{2,}))$', '');
  return formDef?.replace(/\x83\n|\n|\s\s+/g, '');
}

function decode(rawContent) {
  const content = rawContent.trim();
  if (content.startsWith('"') && content.endsWith('"')) {
    // In the new 'jsonString' context, Server side code comes as a string with escaped characters,
    // hence the double parse
    return JSON.parse(JSON.parse(content));
  }
  return JSON.parse(cleanUp(content));
}

async function applyChanges(event) {
  // redecorate default content and blocks on patches (in the properties rail)
  const { detail } = event;

  const resource = detail?.request?.target?.resource // update, patch components
      || detail?.request?.target?.container?.resource // update, patch, add to sections
      || detail?.request?.to?.container?.resource; // move in sections
  if (!resource) return false;
  const updates = detail?.response?.updates;
  if (!updates.length) return false;
  const { content } = updates[0];
  if (!content) return false;

  const parsedUpdate = new DOMParser().parseFromString(content, 'text/html');
  const element = document.querySelector(`[data-aue-resource="${resource}"]`);

  if (element) {
    const block = element.parentElement?.closest('.block[data-aue-resource]') || element?.closest('.block[data-aue-resource]');
    if (block) {
      const blockResource = block.getAttribute('data-aue-resource');
      const newBlock = parsedUpdate.querySelector(`[data-aue-resource="${blockResource}"]`);
      if (block.dataset.aueModel === 'form') {
        const newContainer = newBlock.querySelector('pre');
        const codeEl = newContainer?.querySelector('code');
        const jsonContent = codeEl?.textContent;
        if (jsonContent) {
          const formDef = decode(jsonContent);
          const parent = element.closest('.panel-wrapper') || element.closest('form') || element.querySelector('form');
          const parentDef = getFieldById(formDef, parent.dataset.id, {});
          parent.replaceChildren();
          await generateFormRendition(parentDef, parent, getItems);
          annotateItems(parent.childNodes, formDef, {});
          return true;
        }
        return false;
      }
    }
  }
  return true;
}

function attachEventListners(main) {
  [
    'aue:content-patch',
    'aue:content-update',
    'aue:content-add',
    'aue:content-move',
    'aue:content-remove',
  ].forEach((eventType) => main?.addEventListener(eventType, async (event) => {
    event.stopPropagation();
    const applied = await applyChanges(event);
    if (!applied) window.location.reload();
  }));

  main?.addEventListener('aue:ui-select', handleEditorSelect);

  document.body.addEventListener('aue:ui-preview', () => {
    const forms = document.querySelectorAll('form');
    forms.forEach((formEl) => {
      formEl.classList.remove('edit-mode');
    });
  });

  document.body.addEventListener('aue:ui-edit', () => {
    const forms = document.querySelectorAll('form');
    forms.forEach((formEl) => {
      if (!formEl.classList.contains('edit-mode')) {
        formEl.classList.add('edit-mode');
      }
    });
  });
}

attachEventListners(document.querySelector('main'));
const forms = document.querySelectorAll('form');
annotateFormsForEditing(forms);
const observer = new MutationObserver(instrumentForms);
observer.observe(document, { childList: true, subtree: true, attributeFilter: ['form'] });
