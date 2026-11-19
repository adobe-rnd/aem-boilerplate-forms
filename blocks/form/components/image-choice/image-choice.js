import { subscribe } from '../../rules/index.js';

function parseUrls(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(/\r?\n|,/).map((s) => s.trim());
  return [];
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const props = fieldJson?.properties || {};
  const single = props.selectionMode !== 'multiple';
  const urls = parseUrls(props.imageUrls);
  const columns = parseInt(props.columns, 10);

  fieldDiv.classList.add('image-choice');
  fieldDiv.classList.toggle('image-choice-single', single);
  fieldDiv.classList.toggle('image-choice-multiple', !single);
  fieldDiv.classList.toggle('image-choice-hide-labels', props.showLabels !== true && props.showLabels !== 'true');
  if (columns > 0) fieldDiv.style.setProperty('--image-choice-columns', columns);

  const inputs = [...fieldDiv.querySelectorAll('input[type="checkbox"]')];
  inputs.forEach((input, index) => {
    const option = input.closest('div');
    const label = option?.querySelector('label');
    option?.classList.add('image-choice-option');
    const url = urls[index];
    if (!label || !url) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    label.classList.add('image-choice-label');
    const text = document.createElement('span');
    text.className = 'image-choice-text';
    text.textContent = label.textContent;
    label.replaceChildren(img, text);
  });

  // Runs before the form-level change handler, so the model sees the final selection.
  fieldDiv.addEventListener('change', (e) => {
    const { target } = e;
    if (single && target.type === 'checkbox' && target.checked) {
      inputs.forEach((input) => {
        if (input !== target) input.checked = false;
      });
    }
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'change' && single) {
      const change = payload?.changes?.find((c) => c.propertyName === 'value');
      const value = change?.currentValue;
      if (Array.isArray(value) && value.length > 1) {
        // a rule or prefill set several values; keep only the last one
        fieldModel.value = [value[value.length - 1]];
      }
    }
  }, { listenChanges: true });

  return fieldDiv;
}
