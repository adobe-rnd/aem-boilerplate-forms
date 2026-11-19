import { subscribe } from '../../rules/index.js';
import { createOptimizedPicture } from '../../../../scripts/aem.js';

function toList(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === '' ? [] : [value];
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const props = fieldJson?.properties || {};
  const isMulti = props.selectionMode === 'multi';
  const images = toList(props.images).map((src) => String(src).trim());
  const columns = Number(props.columns);
  const fieldset = fieldDiv.matches('fieldset') ? fieldDiv : fieldDiv.querySelector('fieldset');
  const group = fieldset || fieldDiv;

  group.classList.add('image-choice', isMulti ? 'image-choice-multi' : 'image-choice-single');
  if (props.showLabels === true || props.showLabels === 'true') {
    group.classList.add('image-choice-labels');
  }
  if (columns > 0) {
    group.style.setProperty('--image-choice-columns', columns);
  }

  const options = [...group.querySelectorAll('input[type="checkbox"]')];
  options.forEach((input, index) => {
    const label = group.querySelector(`label[for="${input.id}"]`);
    if (!label) return;
    const text = label.textContent.trim();
    label.classList.add('image-choice-tile');
    label.textContent = '';
    if (images[index]) {
      const picture = createOptimizedPicture(images[index], text, false, [{ width: '300' }]);
      picture.classList.add('image-choice-image');
      label.append(picture);
    }
    const caption = document.createElement('span');
    caption.className = 'image-choice-caption';
    caption.textContent = text;
    label.append(caption);
    if (!images[index]) label.classList.add('image-choice-no-image');
    input.setAttribute('aria-label', text);
  });

  // Runs before the form-level handler, so the model receives the single value.
  if (!isMulti) {
    group.addEventListener('change', (e) => {
      const changed = e.target;
      if (changed.type !== 'checkbox' || !changed.checked) return;
      options.forEach((input) => {
        if (input !== changed) input.checked = false;
      });
    });
  }

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (isMulti || eventType !== 'change') return;
    const valueChange = payload?.changes?.find((c) => c.propertyName === 'value');
    const current = toList(valueChange?.currentValue);
    if (current.length > 1) {
      fieldModel.value = [current[0]];
    }
  }, { listenChanges: true });

  return fieldDiv;
}
