import { subscribe } from '../../rules/index.js';

function toArray(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === '' ? [] : [value];
}

/**
 * Turns a checkbox-group into a grid of selectable images.
 * Single mode allows one selected image, multi mode allows any number.
 */
export default function decorate(fieldDiv, fieldJson, container, formId) {
  const { images, selectionMode, columns } = fieldJson?.properties || {};
  const showLabels = fieldJson?.properties?.showLabels === true
    || fieldJson?.properties?.showLabels === 'true';
  const imageList = toArray(images);
  const isSingle = selectionMode !== 'multi';

  fieldDiv.classList.add('image-choice');
  fieldDiv.classList.toggle('image-choice-single', isSingle);
  fieldDiv.classList.toggle('image-choice-multi', !isSingle);
  fieldDiv.classList.toggle('image-choice-labels', showLabels);
  const columnCount = Number.parseInt(columns, 10);
  if (columnCount > 0) {
    fieldDiv.style.setProperty('--image-choice-columns', columnCount);
  }

  fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((input, index) => {
    const label = fieldDiv.querySelector(`label[for="${input.id}"]`);
    const src = imageList[index];
    if (!label || !src) return;
    const text = label.textContent.trim();
    const img = document.createElement('img');
    img.src = src;
    img.alt = text;
    img.loading = 'lazy';
    label.replaceChildren(img);
    if (showLabels) {
      const caption = document.createElement('span');
      caption.className = 'image-choice-label';
      caption.textContent = text;
      label.append(caption);
    }
    label.title = text;
    input.parentElement.classList.add('image-choice-option');
  });

  // Runs before the form-level change listener, so the model receives a single value.
  fieldDiv.addEventListener('change', (e) => {
    const { target } = e;
    if (isSingle && target.checked) {
      fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((other) => {
        if (other !== target) other.checked = false;
      });
    }
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType !== 'register' && eventType !== 'change') return;
    if (eventType === 'change'
      && !payload?.changes?.some((c) => c.propertyName === 'value')) return;
    const selected = toArray(fieldModel.value);
    // A rule or prefill may set several values in single mode; keep only the last one.
    if (isSingle && selected.length > 1) {
      fieldModel.value = [selected[selected.length - 1]];
    }
  }, { listenChanges: true });

  return fieldDiv;
}
