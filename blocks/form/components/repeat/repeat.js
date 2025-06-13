import { getId } from '../../util.js';
import { subscribe } from '../../rules/index.js';

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

// Helper function to update button visibility for non-AEM forms
function updateButtonVisibilityForNonAEM(wrapper) {
  const instances = wrapper.querySelectorAll('[data-repeatable="true"]');
  const count = instances.length;
  const min = parseInt(wrapper.dataset.min || 0, 10);
  const max = parseInt(wrapper.dataset.max || -1, 10);

  // Control add button
  const addButton = wrapper.querySelector('.item-add');
  if (addButton) {
    if (max !== -1 && count >= max) {
      addButton.style.display = 'none';
    } else {
      addButton.style.display = 'block';
    }
  }

  // Control remove buttons
  const removeButtons = wrapper.querySelectorAll('.item-remove');
  removeButtons.forEach((btn) => {
    if (count <= min) {
      btn.style.display = 'none';
    } else {
      btn.style.display = 'block';
    }
  });
}

export class RepeatManager {
  constructor(wrapper, form, formId) {
    this.wrapper = wrapper;
    this.form = form;
    this.formId = formId;
    this.fieldModel = null;
    this.containerElement = wrapper.closest('fieldset[data-id]');
  }

  setFieldModel(model) {
    this.fieldModel = model;
  }

  // Update button visibility based on current instance count vs min/max
  updateButtonVisibility() {
    const instances = this.wrapper.querySelectorAll('[data-repeatable="true"]');
    const count = instances.length;
    const min = parseInt(this.wrapper.dataset.min || 0, 10);
    const max = parseInt(this.wrapper.dataset.max || -1, 10);

    // Control add button
    const addButton = this.wrapper.querySelector('.item-add');
    if (addButton) {
      if (max !== -1 && count >= max) {
        addButton.style.display = 'none';
      } else {
        addButton.style.display = 'block';
      }
    }

    // Control remove buttons
    const removeButtons = this.wrapper.querySelectorAll('.item-remove');
    removeButtons.forEach((btn) => {
      if (count <= min) {
        btn.style.display = 'none';
      } else {
        btn.style.display = 'block';
      }
    });
  }

  // Model-driven add instance - triggers model change instead of manual DOM
  addInstance() {
    if (this.fieldModel) {
      // Use the model's addInstance function
      const action = { type: 'addInstance', payload: this.fieldModel.items?.length || 0 };
      this.fieldModel.addItem(action);

      // The UI will automatically update via the fieldChanged listener in rules/index.js
    }
  }

  // Model-driven remove instance
  removeInstance(instanceIndex) {
    if (this.fieldModel) {
      const action = { type: 'removeInstance', payload: instanceIndex };
      this.fieldModel.removeItem(action);
      // The UI will automatically update via the fieldChanged listener
    }
  }

  // Add remove buttons to instances that don't have them
  addRemoveButtonsToInstances() {
    const instances = this.wrapper.querySelectorAll('[data-repeatable="true"]');

    instances.forEach((instance) => {
      const existingRemoveButton = instance.querySelector('.item-remove');
      if (!existingRemoveButton) {
        this.insertRemoveButton(instance);
      }
    });
  }

  // Insert remove button with model-driven functionality
  insertRemoveButton(fieldset) {
    const label = fieldset.dataset?.repeatDeleteButtonLabel || this.wrapper.dataset?.repeatDeleteButtonLabel || 'Delete';
    const removeButton = createButton(label, 'remove');

    removeButton.addEventListener('click', () => {
      // Find the current index dynamically in case instances have been reordered
      const allInstances = this.wrapper.querySelectorAll('[data-repeatable="true"]');
      const currentIndex = Array.from(allInstances).indexOf(fieldset);

      this.removeInstance(currentIndex);
    });

    fieldset.append(removeButton);
  }

  setupModelSubscription() {
    // Subscribe to model changes for the container that manages the repeatable elements
    subscribe(this.containerElement, this.formId, (fieldDiv, fieldModel) => {
      this.setFieldModel(fieldModel);

      // Listen for items changes to handle UI updates automatically
      fieldModel.subscribe((e) => {
        const { payload } = e;
        payload?.changes?.forEach((change) => {
          if (change?.propertyName === 'items') {
            // Use requestAnimationFrame to ensure DOM updates are complete
            // This is better than setTimeout as it's tied to the browser's rendering cycle
            requestAnimationFrame(() => {
              this.addRemoveButtonsToInstances();
              this.updateButtonVisibility();
            });
          }
        });
      }, 'change');
    });
  }
}

export function insertRemoveButton(fieldset, wrapper, form) {
  const label = fieldset.dataset?.repeatDeleteButtonLabel || 'Delete';
  const removeButton = createButton(label, 'remove');
  removeButton.addEventListener('click', () => {
    // Find the actual current index by looking at position among siblings
    const repeatWrapper = fieldset.closest('.repeat-wrapper');
    const allInstances = repeatWrapper.querySelectorAll('[data-repeatable="true"]');
    const currentIndex = Array.from(allInstances).indexOf(fieldset);

    // For AEM forms, try to use RepeatManager if available
    if (form.dataset.source === 'aem' && repeatWrapper.repeatManager) {
      repeatWrapper.repeatManager.removeInstance(currentIndex);
    } else {
      // Fallback to original DOM manipulation
      fieldset.remove();
      wrapper.querySelectorAll('[data-repeatable="true"]').forEach((el, index) => {
        update(el, index, wrapper['#repeat-template-label']);
      });

      // Update button visibility for non-AEM forms
      updateButtonVisibilityForNonAEM(wrapper);

      const event = new CustomEvent('item:remove', {
        detail: { item: { name: fieldset.name, id: fieldset.id } },
        bubbles: false,
      });
      form.dispatchEvent(event);
    }
  });
  fieldset.append(removeButton);
}

export const add = (wrapper, form, actions) => () => {
  const fieldset = wrapper['#repeat-template'];
  const childCount = wrapper.children.length - 1;
  const newFieldset = fieldset.cloneNode(true);
  newFieldset.setAttribute('data-index', childCount);
  update(newFieldset, childCount, wrapper['#repeat-template-label']);

  // Add the new instance first
  actions.insertAdjacentElement('beforebegin', newFieldset);

  // Add remove button to the new instance for non-AEM forms
  insertRemoveButton(newFieldset, wrapper, form);

  // Update button visibility for non-AEM forms
  updateButtonVisibilityForNonAEM(wrapper);

  const event = new CustomEvent('item:add', {
    detail: { item: { name: newFieldset.name, id: newFieldset.id } },
    bubbles: false,
  });
  form.dispatchEvent(event);
};

function getInstances(el) {
  let nextSibling = el.nextElementSibling;
  const siblings = [el];
  while (nextSibling && nextSibling.matches('[data-repeatable="true"]:not([data-repeatable="0"])')) {
    siblings.push(nextSibling);
    nextSibling = nextSibling.nextElementSibling;
  }
  return siblings;
}

export function insertAddButton(wrapper, form, repeatManager = null) {
  const actions = document.createElement('div');
  actions.className = 'repeat-actions';
  const addLabel = wrapper?.dataset?.repeatAddButtonLabel || 'Add';
  const addButton = createButton(addLabel, 'add');
  addButton.addEventListener('click', (e) => {
    if (repeatManager && form.dataset.source === 'aem') {
      // Use model-driven approach for AEM forms
      repeatManager.addInstance();
    } else {
      // Fallback to original approach for non-AEM forms
      add(wrapper, form, actions)(e);
    }
  });
  actions.appendChild(addButton);
  wrapper.append(actions);
}

export default function transferRepeatableDOM(form, formDef, container, formId) {
  form.querySelectorAll('[data-repeatable="true"][data-index="0"]').forEach((el) => {
    const instances = getInstances(el);
    const wrapper = document.createElement('div');
    wrapper.dataset.min = el.dataset.min || 0;
    wrapper.dataset.max = el.dataset.max;
    wrapper.dataset.variant = el.dataset.variant || 'addDeleteButtons';
    wrapper.dataset.repeatAddButtonLabel = el.dataset?.repeatAddButtonLabel ? el.dataset.repeatAddButtonLabel : 'Add';
    wrapper.dataset.repeatDeleteButtonLabel = el.dataset?.repeatDeleteButtonLabel ? el.dataset.repeatDeleteButtonLabel : 'Remove';

    // Set the ID to match the repeatable element for model subscription
    wrapper.dataset.id = el.dataset.id;

    el.insertAdjacentElement('beforebegin', wrapper);
    wrapper.append(...instances);
    wrapper.querySelectorAll('.item-remove').forEach((element) => element.remove());
    wrapper.querySelectorAll('.repeat-actions').forEach((element) => element.remove());
    const cloneNode = el.cloneNode(true);
    cloneNode.removeAttribute('id');
    wrapper['#repeat-template'] = cloneNode;
    wrapper['#repeat-template-label'] = el.querySelector(':scope>.field-label')?.textContent;

    // Create repeat manager only for AEM forms with model-driven approach
    let repeatManager = null;
    if (form.dataset.source === 'aem') {
      repeatManager = new RepeatManager(wrapper, form, formId);
      // Store RepeatManager on the wrapper for easy access
      wrapper.repeatManager = repeatManager;
      repeatManager.setupModelSubscription();
    }

    if (+el.dataset.min === 0) {
      el.remove();
    } else {
      update(el, 0, wrapper['#repeat-template-label']);
      el.setAttribute('data-index', 0);
    }

    // Add remove buttons to existing instances
    if (repeatManager) {
      // For AEM forms, let RepeatManager handle adding remove buttons and initial visibility
      repeatManager.addRemoveButtonsToInstances();
      // Initial button visibility will be set when model subscription is established
    } else {
      // For non-AEM forms, use the original approach
      instances.forEach((instance) => {
        insertRemoveButton(instance, wrapper, form);
      });
      // Set initial button visibility for non-AEM forms
      updateButtonVisibilityForNonAEM(wrapper);
    }

    if (el.dataset.variant !== 'noButtons') {
      insertAddButton(wrapper, form, repeatManager);
    }
    wrapper.className = 'repeat-wrapper';

    // For AEM forms, set initial button visibility after setup is complete
    if (repeatManager) {
      repeatManager.updateButtonVisibility();
    }
  });
}
