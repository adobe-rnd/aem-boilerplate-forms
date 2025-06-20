import { getId } from '../../util.js';
import { subscribe } from '../../rules/index.js';

/* Radio buttons within the same instance should have the same name,
but different instances should have different group names */
function updateRadioButtonNames(instance, index) {
  // Only update if this is actually a repeatable instance
  if (!instance.dataset.repeatable || instance.dataset.repeatable !== 'true') {
    return;
  }

  instance.querySelectorAll('input[type="radio"]').forEach((radio) => {
    const baseName = radio.name.replace(/-\d+$/, '');
    radio.name = index > 0 ? `${baseName}-${index}` : baseName;
  });
}

function update(fieldset, index, labelTemplate) {
  const legend = fieldset.querySelector(':scope>.field-label')?.firstChild;
  const text = labelTemplate?.replace('#', index + 1);
  if (legend) {
    legend.textContent = text;
  }
  if (typeof fieldset.id === 'undefined') {
    fieldset.id = getId(fieldset.name);
  }
  fieldset.setAttribute('data-index', index);
  if (index > 0) {
    fieldset.querySelectorAll('.field-wrapper').forEach((f) => {
      const [label, input, description] = ['label', 'input,select,button,textarea', 'description']
        .map((x) => f.querySelector(x));
      if (input) {
        input.id = getId(input.name);
      }
      if (label) {
        label.htmlFor = input.id;
      }
      if (description) {
        input.setAttribute('aria-describedby', `${input.Id}-description`);
        description.id = `${input.id}-description`;
      }
    });
  }

  updateRadioButtonNames(fieldset, index);
}

function createButton(label, icon) {
  const button = document.createElement('button');
  button.className = `item-${icon}`;
  button.type = 'button';
  const text = document.createElement('span');
  text.textContent = label;
  button.append(document.createElement('i'), text);
  return button;
}

function updateButtonVisibility(wrapper) {
  const instances = wrapper.querySelectorAll('[data-repeatable="true"]');
  const count = instances.length;
  const min = parseInt(wrapper.dataset.min || 0, 10);
  const max = parseInt(wrapper.dataset.max || -1, 10);

  const addButton = wrapper.querySelector('.item-add');
  if (addButton) {
    if (max !== -1 && count >= max) {
      addButton.style.display = 'none';
    } else {
      addButton.style.display = '';
    }
  }

  const removeButtons = wrapper.querySelectorAll('.item-remove');
  removeButtons.forEach((btn) => {
    if (count <= min) {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
    }
  });
}

function removeInstanceViaModel(wrapper, instanceIndex) {
  if (wrapper.fieldModel) {
    const action = { type: 'removeInstance', payload: instanceIndex };
    wrapper.fieldModel.removeItem(action);
  }
}

function addInstanceViaModel(wrapper) {
  if (wrapper.fieldModel) {
    const action = { type: 'addInstance', payload: wrapper.fieldModel.items?.length || 0 };
    wrapper.fieldModel.addItem(action);
  }
}

function removeInstanceManually(fieldset, wrapper, form) {
  fieldset.remove();
  wrapper.querySelectorAll('[data-repeatable="true"]').forEach((el, index) => {
    update(el, index, wrapper['#repeat-template-label']);
  });
  updateButtonVisibility(wrapper);
  const event = new CustomEvent('item:remove', {
    detail: { item: { name: fieldset.name, id: fieldset.id } },
    bubbles: false,
  });
  form.dispatchEvent(event);
}

function insertRemoveButton(fieldset, wrapper, form, isDocBased = false) {
  const label = wrapper.dataset?.repeatDeleteButtonLabel || fieldset.dataset?.repeatDeleteButtonLabel || 'Delete';
  const removeButton = createButton(label, 'remove');

  removeButton.addEventListener('click', () => {
    const repeatWrapper = fieldset.closest('.repeat-wrapper');
    const allInstances = repeatWrapper.querySelectorAll('[data-repeatable="true"]');
    const currentIndex = Array.from(allInstances).indexOf(fieldset);

    if (isDocBased) {
      removeInstanceManually(fieldset, wrapper, form);
    } else {
      removeInstanceViaModel(wrapper, currentIndex);
    }
  });

  fieldset.append(removeButton);
}

function addRemoveButtons(wrapper, form, isDocBased = false, checkExisting = false) {
  const instances = wrapper.querySelectorAll('[data-repeatable="true"]');

  instances.forEach((instance) => {
    if (checkExisting) {
      const existingRemoveButton = instance.querySelector('.item-remove');
      if (existingRemoveButton) {
        return;
      }
    }

    insertRemoveButton(instance, wrapper, form, isDocBased);
  });
}

function setupModelSubscription(wrapper, form, formId) {
  const containerElement = wrapper.closest('fieldset[data-id]');

  subscribe(containerElement, formId, (fieldDiv, fieldModel) => {
    wrapper.fieldModel = fieldModel;
    fieldModel.subscribe((e) => {
      const { payload } = e;
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'items') {
          // eslint-disable-next-line max-len
          // Reason for requestAnimationFrame: Model changes fire immediately but DOM updates are async.
          // We need to wait for the browser's next paint cycle to ensure the new/removed fieldsets
          // are in the DOM before adding/updating buttons.
          requestAnimationFrame(() => {
            wrapper.querySelectorAll('[data-repeatable="true"]').forEach((instance, index) => {
              updateRadioButtonNames(instance, index);
            });
            addRemoveButtons(wrapper, form, false, true);
            updateButtonVisibility(wrapper);
          });
        }
      });
    }, 'change');
  });
}

// Doc-based manual DOM manipulation (exception case)
function addInstanceManually(wrapper, form) {
  const fieldset = wrapper['#repeat-template'];
  const childCount = wrapper.children.length - 1;
  const newFieldset = fieldset.cloneNode(true);
  newFieldset.setAttribute('data-index', childCount);
  update(newFieldset, childCount, wrapper['#repeat-template-label']);

  const actions = wrapper.querySelector('.repeat-actions');
  actions.insertAdjacentElement('beforebegin', newFieldset);

  // Add remove button to the new instance
  insertRemoveButton(newFieldset, wrapper, form, true);

  // Add remove buttons to all existing instances that don't have them
  // (this handles the case where we started with min instances and no buttons)
  addRemoveButtons(wrapper, form, true, true);

  updateButtonVisibility(wrapper);

  const event = new CustomEvent('item:add', {
    detail: { item: { name: newFieldset.name, id: newFieldset.id } },
    bubbles: false,
  });
  form.dispatchEvent(event);
}

function addInstance(wrapper, form, isDocBased = false) {
  if (isDocBased) {
    addInstanceManually(wrapper, form);
  } else {
    addInstanceViaModel(wrapper);
  }
}

function getInstances(el) {
  let nextSibling = el.nextElementSibling;
  const siblings = [el];
  while (nextSibling && nextSibling.matches('[data-repeatable="true"]:not([data-repeatable="0"])')) {
    siblings.push(nextSibling);
    nextSibling = nextSibling.nextElementSibling;
  }
  return siblings;
}

export function insertAddButton(wrapper, form, isDocBased = false) {
  const actions = document.createElement('div');
  actions.className = 'repeat-actions';
  const addLabel = wrapper?.dataset?.repeatAddButtonLabel || 'Add';
  const addButton = createButton(addLabel, 'add');
  addButton.addEventListener('click', () => {
    addInstance(wrapper, form, isDocBased);
  });
  actions.appendChild(addButton);
  wrapper.append(actions);
}

export default function transferRepeatableDOM(form, formDef, container, formId) {
  form.querySelectorAll('[data-repeatable="true"][data-index="0"]').forEach((el) => {
    const instances = getInstances(el);
    const isDocBased = form.dataset.source !== 'aem';

    const wrapper = document.createElement('div');
    wrapper.dataset.min = el.dataset.min || 0;
    wrapper.dataset.max = el.dataset.max;
    wrapper.dataset.variant = el.dataset.variant || 'addDeleteButtons';
    wrapper.dataset.repeatAddButtonLabel = el.dataset?.repeatAddButtonLabel ? el.dataset.repeatAddButtonLabel : 'Add';
    wrapper.dataset.repeatDeleteButtonLabel = el.dataset?.repeatDeleteButtonLabel ? el.dataset.repeatDeleteButtonLabel : 'Remove';
    wrapper.className = 'repeat-wrapper';

    el.insertAdjacentElement('beforebegin', wrapper);
    wrapper.append(...instances);
    wrapper.querySelectorAll('.item-remove').forEach((element) => element.remove());
    wrapper.querySelectorAll('.repeat-actions').forEach((element) => element.remove());

    const cloneNode = el.cloneNode(true);
    cloneNode.removeAttribute('id');
    wrapper['#repeat-template'] = cloneNode;
    wrapper['#repeat-template-label'] = el.querySelector(':scope>.field-label')?.textContent;

    // Handle minimum instance removal
    if (+el.dataset.min === 0) {
      el.remove();
    } else {
      update(el, 0, wrapper['#repeat-template-label']);
      el.setAttribute('data-index', 0);
    }

    if (!isDocBased) {
      setupModelSubscription(wrapper, form, formId);
      wrapper.querySelectorAll('[data-repeatable="true"]').forEach((instance, index) => {
        updateRadioButtonNames(instance, index);
      });
    }

    // Add remove buttons only if there are more instances than minimum
    const min = parseInt(wrapper.dataset.min || 0, 10);
    if (instances.length > min) {
      // Only difference: checkExisting parameter (true for AEM, false for doc-based)
      addRemoveButtons(wrapper, form, isDocBased, !isDocBased);
    }

    if (el.dataset.variant !== 'noButtons') {
      insertAddButton(wrapper, form, isDocBased);
    }

    updateButtonVisibility(wrapper);
  });
}

// Export functions for external use
export { insertRemoveButton, addInstance, updateButtonVisibility };
