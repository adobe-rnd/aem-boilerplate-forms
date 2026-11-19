import { subscribe } from '../../rules/index.js';

function toList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim());
  if (typeof value === 'string') return value.split(/[\n,]/).map((v) => v.trim());
  return [];
}

function checkedValues(fieldDiv) {
  return [...fieldDiv.querySelectorAll('input[type="checkbox"]:checked')].map((i) => i.value);
}

/**
 * Renders the options of a checkbox group as a grid of selectable images.
 * Selection mode (single or multi) is authored via `selectionMode`.
 */
export default function decorate(fieldDiv, fieldJson, container, formId) {
  const {
    images, selectionMode, columns, showCaptions,
  } = fieldJson?.properties || {};
  const isSingle = selectionMode !== 'multi';
  const imageList = toList(images);

  fieldDiv.classList.add('image-choice', isSingle ? 'image-choice-single' : 'image-choice-multi');
  if (showCaptions === 'show') fieldDiv.classList.add('image-choice-captions');
  const cols = Number(columns);
  if (cols > 0) fieldDiv.style.setProperty('--image-choice-columns', cols);

  fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((input, index) => {
    const option = input.parentElement;
    const label = option.querySelector('label');
    option.classList.add('image-choice-option');
    const text = label?.textContent?.trim() || input.value;
    const src = imageList[index];
    if (label) {
      label.textContent = '';
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = text;
        img.loading = 'lazy';
        label.append(img);
      }
      const caption = document.createElement('span');
      caption.className = 'image-choice-caption';
      caption.textContent = text;
      label.append(caption);
    }
    if (!src) option.classList.add('image-choice-no-image');
  });

  // Runs before the form-level change listener, so the model sees the final selection.
  fieldDiv.addEventListener('change', (e) => {
    const { target } = e;
    if (isSingle && target.checked) {
      fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((other) => {
        if (other !== target) other.checked = false;
      });
    }
  });

  subscribe(fieldDiv, formId, (_fieldDiv, model, eventType, payload) => {
    if (!isSingle) return;
    const valueChanged = eventType === 'register'
      || payload?.changes?.some((c) => c.propertyName === 'value');
    if (!valueChanged) return;
    const selected = checkedValues(fieldDiv);
    if (selected.length > 1) {
      // Model was set to several values (e.g. by a rule): keep the first only.
      const [keep] = selected;
      fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((i) => {
        i.checked = i.value === keep;
      });
      const current = Array.isArray(model.value) ? model.value : [];
      if (current.length !== 1 || String(current[0]) !== keep) {
        model.value = [keep];
      }
    }
  }, { listenChanges: true });

  return fieldDiv;
}
