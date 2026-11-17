import { subscribe } from '../../rules/index.js';

function parseImages(value) {
  return (value || '').split(',').map((url) => url.trim());
}

function enhanceOptions(fieldDiv, images) {
  fieldDiv.querySelectorAll(':scope > div').forEach((option, index) => {
    const label = option.querySelector('label');
    if (!label || option.dataset.imageChoice || !option.querySelector('input')) return;
    option.dataset.imageChoice = 'true';
    option.classList.add('image-choice-tile');
    const text = label.textContent.trim();
    const url = images[index];
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = text;
      img.loading = 'lazy';
      label.replaceChildren(img);
    } else {
      label.classList.add('image-choice-text');
    }
  });
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const images = parseImages(fieldJson?.properties?.optionImages);
  const single = fieldJson?.properties?.selectionMode === 'single';
  fieldDiv.classList.add('image-choice');
  fieldDiv.dataset.selectionMode = single ? 'single' : 'multiple';

  enhanceOptions(fieldDiv, images);
  // options are re-rendered by the form block when enum/enumNames change
  new MutationObserver(() => enhanceOptions(fieldDiv, images))
    .observe(fieldDiv, { childList: true });

  // runs before the form-level change handler that commits the model value
  fieldDiv.addEventListener('change', (e) => {
    const input = e.target;
    if (!single || input.type !== 'checkbox') return;
    if (input.checked) {
      fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((other) => {
        if (other !== input) other.checked = false;
      });
    } else {
      input.checked = true;
      e.stopPropagation();
    }
  });

  subscribe(fieldDiv, formId, (fieldModel, eventType) => {
    if (eventType === 'register' || eventType === 'change') {
      if (single && Array.isArray(fieldModel.value) && fieldModel.value.length > 1) {
        fieldModel.value = [fieldModel.value[0]];
      }
    }
  }, { listenChanges: true });

  return fieldDiv;
}
