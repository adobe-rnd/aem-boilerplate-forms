import { subscribe } from '../../rules/index.js';

function toList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) return value.split(',').map((v) => v.trim());
  return [];
}

function decorateOptions(fieldDiv, images, showLabels) {
  fieldDiv.querySelectorAll(':scope > div').forEach((option, index) => {
    const input = option.querySelector('input[type="checkbox"]');
    const label = option.querySelector('label');
    if (!input || !label || option.classList.contains('image-choice-option')) return;
    option.classList.add('image-choice-option');
    const text = label.textContent;
    const src = images[index];
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = text;
      img.loading = 'lazy';
      label.prepend(img);
    }
    label.title = text;
    if (src) {
      const caption = document.createElement('span');
      caption.className = showLabels ? 'image-choice-caption' : 'image-choice-caption image-choice-sr-only';
      caption.textContent = text;
      label.replaceChildren(label.querySelector('img'), caption);
    }
  });
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const {
    selectionMode = 'single', images, columns, showLabels,
  } = fieldJson?.properties || {};
  const single = selectionMode !== 'multiple';
  const imageList = toList(images);
  const showCaptions = showLabels === true || showLabels === 'true';

  fieldDiv.classList.add('image-choice', single ? 'image-choice-single' : 'image-choice-multiple');
  fieldDiv.style.setProperty('--image-choice-columns', Number(columns) > 0 ? Number(columns) : 4);
  decorateOptions(fieldDiv, imageList, showCaptions);

  // runs before the form-level listener that commits the value to the model
  fieldDiv.addEventListener('change', (e) => {
    const input = e.target;
    if (!single || input.type !== 'checkbox' || !input.checked) return;
    fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((other) => {
      if (other !== input) other.checked = false;
    });
  });

  subscribe(fieldDiv, formId, (_el, fieldModel, eventType, payload) => {
    if (eventType !== 'change') return;
    if (payload?.changes?.some((c) => c.propertyName === 'enum' || c.propertyName === 'enumNames')) {
      decorateOptions(fieldDiv, imageList, showCaptions);
    }
  }, { listenChanges: true });

  return fieldDiv;
}
