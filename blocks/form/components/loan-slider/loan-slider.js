import { subscribe } from '../../rules/index.js';

const DEFAULT_MIN = 50000;
const DEFAULT_MAX = 1250000;
const DEFAULT_SPLITS = 10;
const MAX_LABELS = 7;

const inrFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const formatAmount = (value) => `₹${inrFormatter.format(value)}`;

// compact label in the Indian numbering system: 50K, 2L, 12.5L, 1Cr
export function formatCompact(value) {
  const units = [[10000000, 'Cr'], [100000, 'L'], [1000, 'K']];
  const unit = units.find(([size]) => Math.abs(value) >= size);
  if (!unit) return `${value}`;
  return `${parseFloat((value / unit[0]).toFixed(2))}${unit[1]}`;
}

export function parseAmount(text) {
  const cleaned = `${text ?? ''}`.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

const toNumber = (value, fallback) => {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

function createTicks(min, max, splits) {
  const ticks = document.createElement('div');
  ticks.className = 'loan-slider-ticks';
  const labelEvery = Math.ceil(splits / (MAX_LABELS - 1));
  for (let i = 0; i <= splits; i += 1) {
    const value = min + ((max - min) * i) / splits;
    const tick = document.createElement('span');
    tick.className = 'loan-slider-tick';
    tick.style.setProperty('--position', i / splits);
    ticks.append(tick);
    if (i % labelEvery === 0 || i === splits) {
      const label = document.createElement('span');
      label.className = 'loan-slider-tick-label';
      label.style.setProperty('--position', i / splits);
      label.textContent = formatCompact(value);
      ticks.append(label);
    }
  }
  return ticks;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  const props = fieldJson?.properties || {};

  let min = toNumber(fieldJson?.minimum ?? input.min, DEFAULT_MIN);
  let max = toNumber(fieldJson?.maximum ?? input.max, DEFAULT_MAX);
  if (min >= max) {
    min = DEFAULT_MIN;
    max = DEFAULT_MAX;
  }
  const splits = Math.max(1, Math.floor(toNumber(props.splits, DEFAULT_SPLITS)));
  const stepSize = (max - min) / splits;
  const label = fieldDiv.querySelector('.field-label, label');
  const disabled = fieldJson?.enabled === false || fieldJson?.readOnly === true;

  const clamp = (value) => Math.min(max, Math.max(min, value));

  // the original input stays in the DOM as the carrier of the committed value
  input.type = 'hidden';
  input.removeAttribute('min');
  input.removeAttribute('max');
  fieldDiv.classList.add('loan-slider-field');

  const textBox = document.createElement('input');
  textBox.type = 'text';
  textBox.inputMode = 'numeric';
  textBox.autocomplete = 'off';
  textBox.className = 'loan-slider-value';
  if (label) textBox.setAttribute('aria-label', label.textContent.trim());

  const widget = document.createElement('div');
  widget.className = 'loan-slider-widget';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.min = min;
  slider.max = max;
  slider.step = stepSize;
  if (label) slider.setAttribute('aria-label', label.textContent.trim());
  slider.setAttribute('aria-valuetext', '');
  widget.append(slider, createTicks(min, max, splits));

  textBox.disabled = disabled;
  slider.disabled = disabled;

  (label || input).after(textBox);
  textBox.after(widget);

  const showValue = (value) => {
    slider.value = value;
    slider.style.setProperty('--fill', (value - min) / (max - min));
    slider.setAttribute('aria-valuetext', formatAmount(value));
  };

  const display = (value) => {
    showValue(value);
    textBox.value = formatAmount(value);
  };

  const commit = (value) => {
    if (parseAmount(input.value) === value) return;
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const initial = parseAmount(input.value);
  display(initial === null ? min : clamp(initial));

  slider.addEventListener('input', () => {
    const value = clamp(parseFloat(slider.value));
    textBox.value = formatAmount(value);
    showValue(value);
  });
  slider.addEventListener('change', () => commit(clamp(parseFloat(slider.value))));

  // slider follows the typed amount live; the value is committed on blur / Enter
  textBox.addEventListener('input', () => {
    const typed = parseAmount(textBox.value);
    if (typed !== null) showValue(clamp(typed));
  });
  const commitText = () => {
    const typed = parseAmount(textBox.value);
    const value = typed === null ? clamp(parseAmount(input.value) ?? min) : clamp(typed);
    display(value);
    commit(value);
  };
  textBox.addEventListener('change', commitText);
  textBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitText();
    }
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      const current = parseAmount(fieldModel.value);
      if (current !== null) display(clamp(current));
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') {
          const current = parseAmount(change.currentValue);
          if (current !== null && current !== parseAmount(textBox.value)) display(clamp(current));
        } else if (change?.propertyName === 'enabled') {
          textBox.disabled = change.currentValue === false;
          slider.disabled = textBox.disabled;
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
