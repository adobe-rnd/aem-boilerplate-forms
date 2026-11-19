import { subscribe } from '../../rules/index.js';

function toList(value) {
  if (Array.isArray(value)) return value;
  return value ? String(value).split(',').map((s) => s.trim()) : [];
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const props = fieldJson?.properties || {};
  const isMulti = props.selectionMode === 'multi';
  const images = toList(props.images);
  const columns = parseInt(props.columns, 10) || 4;
  const showLabels = props.showLabels === true || props.showLabels === 'true';

  fieldDiv.classList.add('image-choice');
  fieldDiv.classList.toggle('image-choice-single', !isMulti);
  fieldDiv.classList.toggle('image-choice-show-labels', showLabels);
  fieldDiv.style.setProperty('--image-choice-columns', columns);

  // Options are rebuilt by the form block when enum/enumNames change, so decorate lazily.
  const enhance = () => {
    fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((input, index) => {
      const item = input.parentElement;
      if (item.classList.contains('image-choice-item')) return;
      item.classList.add('image-choice-item');
      const label = item.querySelector('label');
      const text = label.textContent;
      label.textContent = '';
      const src = images[index];
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = showLabels ? '' : text;
        img.loading = 'lazy';
        label.append(img);
      }
      const caption = document.createElement('span');
      caption.className = 'image-choice-label';
      caption.textContent = text;
      if (src && !showLabels) caption.classList.add('image-choice-sr-only');
      label.append(caption);
    });
  };

  enhance();
  new MutationObserver(enhance).observe(fieldDiv, { childList: true });

  // Capture phase runs before the form block's change handler reads the checked inputs.
  fieldDiv.addEventListener('change', (e) => {
    if (!isMulti && e.target.checked) {
      fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((other) => {
        if (other !== e.target) other.checked = false;
      });
    }
  }, true);

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType) => {
    if (eventType === 'register' && !isMulti && Array.isArray(fieldModel.value)
      && fieldModel.value.length > 1) {
      fieldModel.value = fieldModel.value.slice(0, 1);
    }
  }, { listenChanges: true });

  return fieldDiv;
}
