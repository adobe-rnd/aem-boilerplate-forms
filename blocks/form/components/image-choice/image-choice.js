import { subscribe } from '../../rules/index.js';

const DEFAULT_IMAGE_SIZE = 80;

function toArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const props = fieldJson?.properties || {};
  const images = toArray(props.images);
  const isMulti = props.selectionMode === 'multi';
  const size = Number(props.imageSize) > 0 ? Number(props.imageSize) : DEFAULT_IMAGE_SIZE;
  const names = toArray(fieldJson?.enumNames);

  fieldDiv.classList.add('image-choice');
  fieldDiv.classList.toggle('image-choice-multi', isMulti);
  fieldDiv.style.setProperty('--image-choice-size', `${size}px`);

  const inputs = Array.from(fieldDiv.querySelectorAll('input[type="checkbox"]'));
  inputs.forEach((input, index) => {
    const item = input.parentElement;
    const label = item.querySelector('label');
    const src = images[index]?.trim();
    item.classList.add('image-choice-item');
    if (!src || !label) return;
    const text = label.textContent.trim() || names[index] || input.value;
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.loading = 'lazy';
    img.className = 'image-choice-img';
    label.classList.add('image-choice-label');
    label.title = text;
    const caption = document.createElement('span');
    caption.className = 'image-choice-text';
    caption.textContent = text;
    label.replaceChildren(img, caption);
  });

  // Runs before the form-level listener, which reads the checked state to build the model value.
  fieldDiv.addEventListener('change', (e) => {
    const { target } = e;
    if (isMulti || target.type !== 'checkbox' || !target.checked) return;
    inputs.forEach((other) => {
      if (other !== target) other.checked = false;
    });
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'change' && !isMulti) {
      const valueChange = payload?.changes?.find((c) => c?.propertyName === 'value');
      const current = valueChange?.currentValue;
      // Single mode keeps at most one selection, e.g. when a rule sets several values.
      if (Array.isArray(current) && current.length > 1) {
        fieldModel.value = [current[0]];
      }
    }
  }, { listenChanges: true });

  return fieldDiv;
}
