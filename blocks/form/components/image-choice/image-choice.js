import { subscribe } from '../../rules/index.js';

function parseImages(value) {
  return String(value || '').split(',').map((url) => url.trim());
}

function decorateTiles(fieldDiv, images) {
  const inputs = [...fieldDiv.querySelectorAll('input[type="checkbox"]')];
  let grid = fieldDiv.querySelector('.image-choice-grid');
  if (!grid) {
    grid = document.createElement('div');
    grid.className = 'image-choice-grid';
    const legend = fieldDiv.querySelector('legend');
    if (legend) legend.after(grid);
    else fieldDiv.prepend(grid);
  }
  inputs.forEach((input, index) => {
    const tile = input.parentElement;
    const label = tile.querySelector('label');
    const text = label?.textContent.trim() || input.value;
    tile.classList.add('image-choice-tile');
    if (tile.parentElement !== grid) grid.append(tile);
    input.setAttribute('aria-label', text);
    tile.classList.toggle('selected', input.checked);
    const url = images[index];
    if (label && url && !label.querySelector('img')) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = text;
      img.loading = 'lazy';
      label.textContent = '';
      label.append(img);
      label.classList.add('image-choice-image');
    }
  });
}

function syncSelected(fieldDiv) {
  fieldDiv.querySelectorAll('.image-choice-tile').forEach((tile) => {
    tile.classList.toggle('selected', !!tile.querySelector('input')?.checked);
  });
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const images = parseImages(fieldJson?.properties?.optionImages);
  const single = fieldJson?.properties?.selectionMode === 'single';
  fieldDiv.classList.add('image-choice');
  decorateTiles(fieldDiv, images);

  // Runs in the capture phase, before the form block commits the value to the model.
  fieldDiv.addEventListener('change', (e) => {
    const { target } = e;
    if (target?.type !== 'checkbox') return;
    if (single) {
      if (target.checked) {
        fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((other) => {
          if (other !== target) other.checked = false;
        });
      } else {
        // clicking the selected tile keeps it selected
        target.checked = true;
        e.stopPropagation();
      }
    }
    syncSelected(fieldDiv);
  }, true);

  let model = null;
  const enforceSingle = () => {
    if (single && Array.isArray(model?.value) && model.value.length > 1) {
      model.value = [model.value[0]];
    }
  };

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      enforceSingle();
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        const name = change?.propertyName;
        if (name === 'enum' || name === 'enumNames') {
          decorateTiles(fieldDiv, images);
        } else if (name === 'value') {
          enforceSingle();
        }
      });
      // field wrapper updates may have run before or after the model event
      syncSelected(fieldDiv);
    }
  }, { listenChanges: true });

  return fieldDiv;
}
