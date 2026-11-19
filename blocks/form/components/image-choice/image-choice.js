import { subscribe } from '../../rules/index.js';

function toList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim());
  if (typeof value === 'string') return value.split(/[\n,]/).map((v) => v.trim());
  return [];
}

function decorateOptions(fieldDiv, images, columns) {
  const options = [...fieldDiv.querySelectorAll(':scope > div')]
    .filter((div) => div.querySelector('input[type="checkbox"]'));
  options.forEach((option, index) => {
    if (option.classList.contains('image-choice-option')) return;
    option.classList.add('image-choice-option');
    const input = option.querySelector('input');
    const label = option.querySelector('label');
    const text = label.textContent.trim();
    const src = images[index];
    label.textContent = '';
    label.classList.add('image-choice-label');
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = text;
      img.loading = 'lazy';
      label.append(img);
    }
    const caption = document.createElement('span');
    caption.className = src ? 'image-choice-text visually-hidden' : 'image-choice-text';
    caption.textContent = text;
    label.append(caption);
    input.title = text;
  });
  if (columns > 0) {
    fieldDiv.style.setProperty('--image-choice-columns', columns);
  }
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const props = fieldJson?.properties || {};
  const single = props.selectionMode !== 'multiple';
  const images = toList(props.images);
  const columns = parseInt(props.columns, 10) || 0;

  fieldDiv.classList.add('image-choice', single ? 'image-choice-single' : 'image-choice-multiple');
  decorateOptions(fieldDiv, images, columns);

  // options are rebuilt by the form block when enum/enumNames change
  new MutationObserver(() => decorateOptions(fieldDiv, images, columns))
    .observe(fieldDiv, { childList: true });

  if (single) {
    // uncheck siblings before the form block reads the group value on bubble
    fieldDiv.addEventListener('change', (event) => {
      const { target } = event;
      if (target.type !== 'checkbox' || !target.checked) return;
      fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        if (input !== target) input.checked = false;
      });
    });
  }

  subscribe(fieldDiv, formId, (_fieldDiv, model, eventType, payload) => {
    if (eventType !== 'change' || !single) return;
    const change = payload?.changes?.find((c) => c.propertyName === 'value');
    const value = change?.currentValue;
    // a rule may set several values; keep a single selection in the model
    if (Array.isArray(value) && value.length > 1) {
      model.value = [value[value.length - 1]];
    }
  }, { listenChanges: true });

  return fieldDiv;
}
