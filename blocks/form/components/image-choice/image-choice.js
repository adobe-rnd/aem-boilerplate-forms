import { subscribe } from '../../rules/index.js';

function parseUrls(imageUrls) {
  if (Array.isArray(imageUrls)) return imageUrls;
  return String(imageUrls || '').split(/\r?\n/).map((url) => url.trim());
}

function enhanceOptions(fieldDiv, props) {
  const urls = parseUrls(props.imageUrls);
  const single = props.selectionMode !== 'multi';
  fieldDiv.classList.add('image-choice');
  fieldDiv.classList.toggle('image-choice-labels', props.showLabels === true || props.showLabels === 'true');
  fieldDiv.style.setProperty('--image-choice-columns', Math.max(1, Number(props.columns) || 4));
  if (single) fieldDiv.setAttribute('role', 'radiogroup');
  else fieldDiv.removeAttribute('role');

  fieldDiv.querySelectorAll(':scope > div').forEach((option, index) => {
    const input = option.querySelector('input[type="checkbox"]');
    const label = option.querySelector('label');
    if (!input || !label) return;
    option.classList.add('image-choice-option');
    if (single) input.setAttribute('role', 'radio');
    else input.removeAttribute('role');
    if (option.querySelector('.image-choice-image')) return;
    const text = document.createElement('span');
    text.className = 'image-choice-text';
    text.textContent = label.textContent;
    label.replaceChildren(text);
    if (urls[index]) {
      const img = document.createElement('img');
      img.className = 'image-choice-image';
      img.src = urls[index];
      img.alt = '';
      img.loading = 'lazy';
      label.prepend(img);
    }
  });
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const props = fieldJson?.properties || {};
  const isSingle = () => props.selectionMode !== 'multi';
  let model = null;

  // the core re-renders the options when enum/enumNames change, so re-apply the decoration
  const observer = new MutationObserver(() => {
    observer.disconnect();
    enhanceOptions(fieldDiv, props);
    observer.observe(fieldDiv, { childList: true });
  });
  enhanceOptions(fieldDiv, props);
  observer.observe(fieldDiv, { childList: true });

  // runs before the form-level change handler, so the model receives the final selection
  fieldDiv.addEventListener('change', (e) => {
    const { target } = e;
    if (!isSingle() || target.type !== 'checkbox' || !target.checked) return;
    fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      if (input !== target) input.checked = false;
    });
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
    } else if (eventType === 'change' && isSingle()) {
      const change = payload?.changes?.find((c) => c.propertyName === 'value');
      if (Array.isArray(change?.currentValue) && change.currentValue.length > 1) {
        model.value = [change.currentValue[0]];
      }
    }
  }, { listenChanges: true });

  return fieldDiv;
}
