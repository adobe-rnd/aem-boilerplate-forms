import { subscribe } from '../../rules/index.js';

function parseImages(images) {
  if (Array.isArray(images)) return images;
  if (typeof images === 'string') {
    return images.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function decorateOptions(fieldDiv, images) {
  fieldDiv.querySelectorAll('.checkbox-wrapper').forEach((option, index) => {
    const label = option.querySelector('label');
    if (!label || label.querySelector('.image-choice-picture')) return;
    const text = label.textContent.trim();
    const src = images[index];
    const caption = document.createElement('span');
    caption.className = 'image-choice-caption';
    caption.textContent = text;
    label.textContent = '';
    if (src) {
      const img = document.createElement('img');
      img.className = 'image-choice-picture';
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      label.append(img);
    } else {
      label.classList.add('image-choice-noimage');
    }
    label.append(caption);
    label.title = text;
  });
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const fieldset = fieldDiv.matches('fieldset') ? fieldDiv : fieldDiv.querySelector('fieldset');
  const target = fieldset || fieldDiv;
  const props = fieldJson?.properties || {};
  const images = parseImages(props.images);
  const single = props.selectionMode !== 'multiple';
  const columns = parseInt(props.columns, 10);

  target.classList.add('image-choice');
  target.classList.toggle('image-choice-single', single);
  if (columns > 0) target.style.setProperty('--image-choice-columns', columns);
  decorateOptions(fieldDiv, images);

  // Runs on the field before the form-level handler that writes model.value
  fieldDiv.addEventListener('change', (e) => {
    const input = e.target;
    if (single && input.type === 'checkbox' && input.checked) {
      fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((other) => {
        if (other !== input) other.checked = false;
      });
    }
  });

  subscribe(fieldDiv, formId, (_el, _model, eventType, payload) => {
    if (eventType === 'change') {
      const rebuilt = payload?.changes?.some((c) => ['enum', 'enumNames'].includes(c?.propertyName));
      if (rebuilt) decorateOptions(fieldDiv, images);
    }
  }, { listenChanges: true });

  return fieldDiv;
}
