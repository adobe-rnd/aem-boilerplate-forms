import { subscribe } from '../../rules/index.js';

const toArray = (v) => {
  if (Array.isArray(v)) return v;
  return v === undefined || v === null || v === '' ? [] : [v];
};

function enhance(fieldDiv, props) {
  const images = toArray(props.imageUrls);
  const columns = parseInt(props.columns, 10);
  fieldDiv.classList.add('image-choice');
  if (columns > 0) fieldDiv.style.setProperty('--image-choice-columns', columns);
  fieldDiv.classList.toggle('show-labels', props.showLabels === true || props.showLabels === 'true');

  fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((input, index) => {
    const label = input.parentElement.querySelector('label');
    if (!label || label.querySelector('.image-choice-image')) return;
    const text = label.textContent.trim();
    const caption = document.createElement('span');
    caption.className = 'image-choice-label';
    caption.textContent = text;
    label.replaceChildren();
    if (images[index]) {
      const img = document.createElement('img');
      img.className = 'image-choice-image';
      img.src = images[index];
      img.alt = '';
      img.loading = 'lazy';
      label.append(img);
    }
    label.append(caption);
    label.title = text;
  });
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const props = fieldJson?.properties || {};
  const single = props.selectionMode !== 'multiple';
  enhance(fieldDiv, props);
  fieldDiv.dataset.selectionMode = single ? 'single' : 'multiple';

  // Runs before the form-level change listener, so the model receives one combined value.
  fieldDiv.addEventListener('change', (e) => {
    const { target } = e;
    if (!single || target.type !== 'checkbox' || !target.checked) return;
    fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((other) => {
      if (other !== target) other.checked = false;
    });
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'change') {
      const changed = payload?.changes?.some((c) => c?.propertyName === 'properties');
      if (changed) enhance(fieldDiv, fieldModel.properties || {});
    }
  }, { listenChanges: true });

  return fieldDiv;
}
