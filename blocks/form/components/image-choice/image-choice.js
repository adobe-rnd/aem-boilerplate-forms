import { subscribe } from '../../rules/index.js';

function parseUrls(value) {
  return (value || '').split(/\r?\n/).map((url) => url.trim());
}

function buildOptions(fieldDiv, urls) {
  fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((input, index) => {
    const option = input.closest('div');
    const label = option.querySelector('label');
    option.classList.add('image-choice-option');
    const url = urls[index];
    if (url && !label.querySelector('.image-choice-image')) {
      const img = document.createElement('img');
      img.className = 'image-choice-image';
      img.src = url;
      img.alt = label.textContent.trim();
      img.loading = 'lazy';
      label.prepend(img);
    }
    const text = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (text && !label.querySelector('.image-choice-text')) {
      const span = document.createElement('span');
      span.className = 'image-choice-text';
      span.textContent = text.textContent;
      text.replaceWith(span);
    }
  });
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const props = fieldJson?.properties || {};
  const isSingle = props.selectionMode !== 'multi';
  const columns = Number.parseInt(props.columns, 10) || 4;
  const showLabels = props.showLabels === true || props.showLabels === 'true';

  fieldDiv.classList.add('image-choice', isSingle ? 'image-choice-single' : 'image-choice-multi');
  fieldDiv.classList.toggle('image-choice-show-labels', showLabels);
  fieldDiv.style.setProperty('--image-choice-columns', columns);
  buildOptions(fieldDiv, parseUrls(props.imageUrls));

  // Runs before the form-level listener so the model sees a single selection.
  fieldDiv.addEventListener('change', (e) => {
    const input = e.target;
    if (isSingle && input.checked) {
      fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((other) => {
        if (other !== input) other.checked = false;
      });
    }
  }, true);

  const enforceSingle = (model) => {
    const value = model?.value;
    if (isSingle && Array.isArray(value) && value.length > 1) {
      const [first] = value;
      const inputs = fieldDiv.querySelectorAll('input[type="checkbox"]');
      inputs.forEach((input) => { input.checked = String(input.value) === String(first); });
    }
  };

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      enforceSingle(fieldModel);
    } else if (eventType === 'change') {
      if (payload?.changes?.some((c) => c.propertyName === 'enum' || c.propertyName === 'enumNames')) {
        buildOptions(fieldDiv, parseUrls(props.imageUrls));
      }
      if (payload?.changes?.some((c) => c.propertyName === 'value')) {
        enforceSingle(fieldModel);
      }
    }
  }, { listenChanges: true });

  return fieldDiv;
}
