import { subscribe } from '../../rules/index.js';
import { generateFormRendition } from '../../form.js';

function createReviewFieldElement(item) {
  const {
    value, name, fieldType, enumNames,
  } = item;
  const divElement = document.createElement('div');
  divElement.className = `review-field-value ${name}`;
  if (fieldType === 'radio-group' || fieldType === 'checkbox-group' || fieldType === 'drop-down') {
    const index = item?.enum?.indexOf(value);
    if (index !== -1) {
      divElement.textContent = enumNames[index] || item?.enum?.[index] || value;
    }
  } else {
    divElement.textContent = value || '';
  }

  return divElement;
}

function replaceInputs(element, model) {
  function processItem(item) {
    if (item.isContainer) {
      item.items?.forEach(processItem);
      return;
    }
    const { fieldType, id } = item;

    if (fieldType === 'button') {
      element.querySelector(`[data-id="${id}"]`)?.remove();
      return;
    }

    if (!item.value || !item.id) return;
    const divElement = createReviewFieldElement(item);

    if (fieldType === 'radio-group' || fieldType === 'checkbox-group') {
      const group = element.querySelector(`fieldset[data-id="${id}"]`);
      if (group) {
        group.querySelectorAll('.radio-wrapper, .checkbox-wrapper').forEach((wrapper) => wrapper.remove());
        group.appendChild(divElement);
      }
    } else if (fieldType === 'checkbox') {
      const input = element.querySelector(`input[id="${id}"]`);
      if (input) {
        const label = input.parentNode.querySelector('label');
        input.parentNode.insertBefore(divElement, label.nextSibling);
        input.remove();
      }
    } else {
      const input = element.querySelector(`input[id="${id}"], select[id="${id}"], textarea[id="${id}"]`);
      input?.parentNode.replaceChild(divElement, input);
    }
  }

  model.items?.forEach(processItem);
  return element;
}

function render(element, fd, model) {
  if (!model) return;

  const { form } = model;
  const { properties } = fd;

  if (!properties?.panelNames) return;

  element.innerHTML = '';

  const panelModels = [];
  form.visit((field) => {
    if (properties.panelNames.includes(field.name)) {
      panelModels.push(field);
    }
  });

  panelModels.forEach(async (field) => {
    if (!field.isContainer) return;

    const panelWrapper = document.createElement('div');
    panelWrapper.className = `review-panel-wrapper ${field.name}`;

    await generateFormRendition(field.getState(), panelWrapper, form.id);
    const decoratedPanel = replaceInputs(panelWrapper, field);

    if (!decoratedPanel) return;

    element.appendChild(panelWrapper);
  });
}

export default function decorate(element, fd, container, formId) {
  element.classList.add('review-container');
  let fieldModel;

  subscribe(element, formId, (_element, model) => {
    fieldModel = model;
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        render(element, fd, fieldModel);
      }
    });
  }, { threshold: 0.1 });

  observer.observe(element);
  return element;
}
