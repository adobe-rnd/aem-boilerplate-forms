import { subscribe } from '../../rules/index.js';

const DEFAULT_MIN = 50000;
const DEFAULT_MAX = 1250000;
const DEFAULT_SPLITS = 12;
const MAX_LABELS = 6;

export function formatAmount(value) {
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

export function formatCompact(value) {
  const units = [[10000000, 'Cr'], [100000, 'L'], [1000, 'K']];
  const unit = units.find(([size]) => value >= size);
  if (!unit) return `${value}`;
  return `${parseFloat((value / unit[0]).toFixed(2))}${unit[1]}`;
}

export function parseAmount(text) {
  const digits = `${text ?? ''}`.replace(/[^\d.]/g, '');
  return digits === '' ? NaN : Number(digits);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback) {
  const num = Number(value);
  return value === undefined || value === null || value === '' || Number.isNaN(num) ? fallback : num;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  let min = toNumber(fieldJson?.minimum, DEFAULT_MIN);
  let max = toNumber(fieldJson?.maximum, DEFAULT_MAX);
  if (max <= min) {
    min = DEFAULT_MIN;
    max = DEFAULT_MAX;
  }
  const splits = Math.max(1, Math.floor(toNumber(fieldJson?.properties?.splits, DEFAULT_SPLITS)));
  const splitSize = (max - min) / splits;
  const valueAt = (index) => Math.round(min + index * splitSize);
  const indexOf = (value) => Math.round((clamp(value, min, max) - min) / splitSize);

  // the original input keeps feeding the model; it is hidden and only written programmatically
  input.type = 'number';
  input.min = min;
  input.max = max;
  input.step = 'any';
  input.classList.add('loan-slider-source');
  input.hidden = true;
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

  const widget = document.createElement('div');
  widget.className = 'loan-slider-widget';

  const textbox = document.createElement('input');
  textbox.type = 'text';
  textbox.inputMode = 'numeric';
  textbox.className = 'loan-slider-text';
  textbox.autocomplete = 'off';
  textbox.disabled = input.disabled;
  textbox.readOnly = input.readOnly;
  const label = fieldDiv.querySelector('label');
  if (label) {
    if (!input.id) input.id = `${fieldJson?.id || 'loan-slider'}-source`;
    textbox.id = `${input.id}-text`;
    label.setAttribute('for', textbox.id);
  }

  const track = document.createElement('div');
  track.className = 'loan-slider-track';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.min = 0;
  slider.max = splits;
  slider.step = 1;
  slider.disabled = input.disabled;
  slider.setAttribute('aria-label', label?.textContent?.trim() || 'Loan amount');
  slider.setAttribute('aria-valuetext', formatAmount(min));

  const ticks = document.createElement('div');
  ticks.className = 'loan-slider-ticks';
  const labels = document.createElement('div');
  labels.className = 'loan-slider-labels';
  const labelEvery = Math.ceil(splits / (MAX_LABELS - 1));
  for (let i = 0; i <= splits; i += 1) {
    const pos = `${(i / splits) * 100}%`;
    const tick = document.createElement('span');
    tick.className = 'loan-slider-tick';
    tick.style.setProperty('--pos', pos);
    ticks.appendChild(tick);
    const isEdge = i === 0 || i === splits;
    if (isEdge || (i % labelEvery === 0 && splits - i >= labelEvery / 2)) {
      const text = document.createElement('span');
      text.className = 'loan-slider-label';
      text.style.setProperty('--pos', pos);
      text.textContent = formatCompact(valueAt(i));
      labels.appendChild(text);
    }
  }

  track.append(ticks, slider);
  widget.append(textbox, track, labels);
  input.after(widget);

  const render = (value, { updateText = true } = {}) => {
    const index = indexOf(value);
    slider.value = index;
    slider.setAttribute('aria-valuetext', formatAmount(value));
    widget.style.setProperty('--fill', `${(index / splits) * 100}%`);
    if (updateText) textbox.value = formatAmount(value);
  };

  const commit = (value) => {
    if (`${input.value}` !== `${value}`) {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const initial = Number.isNaN(Number(input.value)) || input.value === ''
    ? min : clamp(Number(input.value), min, max);
  render(initial);

  // slider -> textbox live; committed to the model when the head is released
  slider.addEventListener('input', () => {
    render(valueAt(Number(slider.value)));
  });
  // native change events of the helper controls must not reach the form's model handler
  slider.addEventListener('change', (e) => {
    e.stopPropagation();
    commit(valueAt(Number(slider.value)));
  });

  // textbox -> slider
  textbox.addEventListener('input', () => {
    const typed = parseAmount(textbox.value);
    if (!Number.isNaN(typed)) render(clamp(typed, min, max), { updateText: false });
  });
  textbox.addEventListener('change', (e) => {
    e.stopPropagation();
    const typed = parseAmount(textbox.value);
    const value = Number.isNaN(typed) ? Number(input.value) || min : clamp(typed, min, max);
    render(value);
    commit(value);
  });
  textbox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      textbox.dispatchEvent(new Event('change'));
    }
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      const current = Number(fieldModel.value);
      if (fieldModel.value !== null && fieldModel.value !== undefined && !Number.isNaN(current)) {
        render(clamp(current, min, max));
      }
    } else if (eventType === 'change') {
      payload?.changes?.forEach(({ propertyName, currentValue }) => {
        if (propertyName === 'value' && document.activeElement !== textbox) {
          const num = Number(currentValue);
          if (currentValue !== null && currentValue !== undefined && currentValue !== ''
            && !Number.isNaN(num)) {
            render(clamp(num, min, max));
          }
        } else if (propertyName === 'enabled') {
          const disabled = currentValue === false;
          textbox.disabled = disabled;
          slider.disabled = disabled;
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
