import { subscribe } from '../../rules/index.js';

const DEFAULT_MIN = 50000;
const DEFAULT_MAX = 1250000;
const DEFAULT_SPLITS = 12;
const MAX_LABELS = 7;
const LOCALE = 'en-IN';

function toNumber(value, fallback) {
  const num = Number(value);
  return value !== '' && value !== null && value !== undefined && Number.isFinite(num) ? num : fallback;
}

// 50000 -> 50K, 200000 -> 2L, 1250000 -> 12.5L, 20000000 -> 2Cr
export function formatCompact(value) {
  const units = [[10000000, 'Cr'], [100000, 'L'], [1000, 'K']];
  const [size, suffix] = units.find(([s]) => Math.abs(value) >= s) || [1, ''];
  return `${Number((value / size).toFixed(2))}${suffix}`;
}

export function parseAmount(text) {
  const digits = `${text ?? ''}`.replace(/[^\d.]/g, '');
  const num = parseFloat(digits);
  return Number.isNaN(num) ? null : num;
}

function buildTicks(track, min, max, splits) {
  const stride = Math.ceil((splits + 1) / MAX_LABELS);
  const size = (max - min) / splits;
  for (let i = 0; i <= splits; i += 1) {
    const tick = document.createElement('span');
    tick.className = 'loan-slider-tick';
    tick.style.setProperty('--pos', i / splits);
    track.append(tick);
    if (i === 0 || i === splits || (i % stride === 0 && splits - i >= stride)) {
      const label = document.createElement('span');
      label.className = 'loan-slider-tick-label';
      label.style.setProperty('--pos', i / splits);
      label.textContent = formatCompact(min + size * i);
      track.append(label);
    }
  }
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  fieldDiv.classList.add('loan-slider-wrapper');
  const props = fieldJson?.properties || {};
  const symbol = props.currencySymbol ?? '₹';
  let min = toNumber(fieldJson?.minimum, DEFAULT_MIN);
  let max = toNumber(fieldJson?.maximum, DEFAULT_MAX);
  if (min >= max) {
    min = DEFAULT_MIN;
    max = DEFAULT_MAX;
  }
  const splits = Math.max(1, Math.floor(toNumber(props.splits, DEFAULT_SPLITS)));
  const splitSize = (max - min) / splits;
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const snap = (v) => clamp(min + Math.round((v - min) / splitSize) * splitSize);
  const format = (v) => `${symbol}${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(v)}`;

  // the original input keeps the raw number that the form model reads on `change`
  input.type = 'number';
  input.min = min;
  input.max = max;
  input.hidden = true;

  const textBox = document.createElement('input');
  textBox.type = 'text';
  textBox.inputMode = 'numeric';
  textBox.className = 'loan-slider-text';
  textBox.autocomplete = 'off';
  if (input.id) {
    textBox.id = `${input.id}-display`;
    fieldDiv.querySelector('label')?.setAttribute('for', textBox.id);
  }
  textBox.disabled = input.disabled;
  textBox.readOnly = input.readOnly;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.min = min;
  slider.max = max;
  slider.step = 'any';
  slider.disabled = input.disabled || input.readOnly;
  slider.setAttribute('aria-label', fieldJson?.label?.value || 'Loan amount');

  const track = document.createElement('div');
  track.className = 'loan-slider-track';
  track.append(slider);
  buildTicks(track, min, max, splits);

  const widget = document.createElement('div');
  widget.className = 'loan-slider-widget decorated';
  widget.append(textBox, track);
  input.after(widget);

  let current = null;
  const render = (value, { skipText = false } = {}) => {
    current = value;
    slider.value = value;
    slider.setAttribute('aria-valuetext', format(value));
    track.style.setProperty('--progress', (value - min) / (max - min));
    if (!skipText) textBox.value = format(value);
  };
  const commit = (value) => {
    if (`${value}` === input.value) return;
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // dragging snaps to the nearest split
  slider.addEventListener('input', () => {
    render(snap(Number(slider.value)));
  });
  slider.addEventListener('change', (e) => {
    e.stopPropagation();
    commit(current);
  });

  // typing moves the slider live; the value is committed when the user leaves the box
  textBox.addEventListener('input', () => {
    const typed = parseAmount(textBox.value);
    if (typed !== null && typed >= min && typed <= max) render(typed, { skipText: true });
  });
  const commitText = () => {
    const typed = parseAmount(textBox.value);
    const value = clamp(typed === null ? current : typed);
    render(value);
    commit(value);
  };
  textBox.addEventListener('change', (e) => {
    e.stopPropagation();
    commitText();
  });
  textBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitText();
    }
  });

  const initial = parseAmount(input.value);
  render(clamp(initial === null ? min : initial));

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      if (toNumber(fieldModel.value, null) === null) {
        fieldModel.value = current;
      }
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') {
          const value = toNumber(change.currentValue, null);
          if (value !== null && value !== current) {
            input.value = value;
            render(clamp(value));
          }
        } else if (change?.propertyName === 'enabled' || change?.propertyName === 'readOnly') {
          const locked = fieldModel.enabled === false || fieldModel.readOnly === true;
          textBox.disabled = locked;
          slider.disabled = locked;
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
