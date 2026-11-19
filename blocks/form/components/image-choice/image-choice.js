import { subscribe } from '../../rules/index.js';

function toList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.split(',').map((v) => v.trim());
  return [];
}

function isTrue(value) {
  return value === true || value === 'true';
}

function decorateOptions(fieldDiv, { images, showLabels }) {
  fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((input, index) => {
    const item = input.parentElement;
    const label = item.querySelector('label');
    if (!label || item.classList.contains('image-choice-item')) return;
    item.classList.add('image-choice-item');
    const text = label.textContent.trim();
    const src = images[index];
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = text;
      img.loading = 'lazy';
      label.textContent = '';
      label.append(img);
      if (showLabels) {
        const caption = document.createElement('span');
        caption.className = 'image-choice-caption';
        caption.textContent = text;
        label.append(caption);
      } else {
        label.title = text;
      }
    }
  });
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const props = fieldJson?.properties || {};
  const isSingle = props.selectionMode !== 'multi';
  const options = {
    images: toList(props.imageUrls),
    showLabels: isTrue(props.showLabels),
  };
  const columns = parseInt(props.columns, 10);

  fieldDiv.classList.add('image-choice');
  fieldDiv.dataset.selectionMode = isSingle ? 'single' : 'multi';
  if (columns > 0) {
    fieldDiv.style.setProperty('--image-choice-columns', columns);
    fieldDiv.classList.add('image-choice-fixed-columns');
  }

  decorateOptions(fieldDiv, options);

  // Runs before the form's own change handler, so the model sees only the final selection.
  fieldDiv.addEventListener('change', (e) => {
    const { target } = e;
    if (isSingle && target.type === 'checkbox' && target.checked) {
      fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((other) => {
        if (other !== target && other.checked) other.checked = false;
      });
    }
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType !== 'change') return;
    const changes = payload?.changes || [];
    if (changes.some((c) => ['enum', 'enumNames'].includes(c.propertyName))) {
      // The form block re-renders the options on enum changes; decorate the new markup afterwards.
      Promise.resolve().then(() => decorateOptions(fieldDiv, options));
    }
  }, { listenChanges: true });

  return fieldDiv;
}
