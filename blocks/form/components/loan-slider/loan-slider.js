import { subscribe } from '../../rules/index.js';

const DEFAULT_SPLITS = 10;

/** Formats a number using the Indian digit grouping, e.g. 500000 -> 5,00,000 */
export function formatAmount(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
}

/** Compact label for tick marks, e.g. 50000 -> 50K, 200000 -> 2L, 20000000 -> 2Cr */
export function formatCompact(value) {
  const units = [[10000000, 'Cr'], [100000, 'L'], [1000, 'K']];
  const unit = units.find(([size]) => Math.abs(value) >= size);
  if (!unit) return `${+value.toFixed(2)}`;
  return `${+(value / unit[0]).toFixed(2)}${unit[1]}`;
}

export function parseAmount(text) {
  const cleaned = `${text ?? ''}`.replace(/[^0-9.-]/g, '');
  return cleaned === '' ? NaN : Number(cleaned);
}

/** Returns equally spaced values from min to max (inclusive) */
export function generateSplits(min, max, splits) {
  const count = Math.max(1, Math.floor(splits) || DEFAULT_SPLITS);
  const size = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => (i === count ? max : min + size * i));
}

export default async function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;

  let min = Number(fieldJson?.minimum ?? input.min);
  let max = Number(fieldJson?.maximum ?? input.max);
  if (Number.isNaN(min)) min = 0;
  if (Number.isNaN(max) || max <= min) max = min + 100;
  const splits = Number(fieldJson?.properties?.splits) || DEFAULT_SPLITS;
  const step = Number(fieldJson?.properties?.stepValue) || 1;
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const percent = (v) => ((v - min) / (max - min)) * 100;

  // the original input stays the source of truth for the model, but is hidden from view
  input.type = 'number';
  input.min = min;
  input.max = max;
  input.classList.add('loan-slider-source');
  input.hidden = true;

  const wrapper = document.createElement('div');
  wrapper.className = 'loan-slider-widget decorated';

  const textWrapper = document.createElement('div');
  textWrapper.className = 'loan-slider-value';
  const currency = document.createElement('span');
  currency.className = 'loan-slider-currency';
  currency.textContent = '₹';
  const textBox = document.createElement('input');
  textBox.type = 'text';
  textBox.inputMode = 'numeric';
  textBox.className = 'loan-slider-text';
  textBox.setAttribute('aria-label', fieldJson?.label?.value || 'Loan amount');
  textWrapper.append(currency, textBox);

  const track = document.createElement('div');
  track.className = 'loan-slider-track';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.setAttribute('aria-label', fieldJson?.label?.value || 'Loan amount');
  track.appendChild(slider);

  const labels = document.createElement('div');
  labels.className = 'loan-slider-labels';
  generateSplits(min, max, splits).forEach((value) => {
    const tick = document.createElement('span');
    tick.className = 'loan-slider-tick';
    tick.style.left = `${percent(value)}%`;
    tick.dataset.value = value;
    tick.textContent = formatCompact(value);
    labels.appendChild(tick);
  });
  const ticks = document.createElement('div');
  ticks.className = 'loan-slider-ticks';
  generateSplits(min, max, splits).forEach((value) => {
    const mark = document.createElement('span');
    mark.style.left = `${percent(value)}%`;
    ticks.appendChild(mark);
  });
  track.appendChild(ticks);

  wrapper.append(textWrapper, track, labels);
  input.after(wrapper);

  const render = (value) => {
    const v = clamp(value);
    slider.value = v;
    textBox.value = formatAmount(v);
    wrapper.style.setProperty('--loan-slider-percent', `${percent(v)}%`);
    return v;
  };

  const commit = (value) => {
    const v = render(value);
    if (`${input.value}` !== `${v}`) {
      input.value = v;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const initial = parseAmount(input.value);
  render(Number.isNaN(initial) ? min : initial);
  if (Number.isNaN(initial)) input.value = '';

  // keep the visible controls' events away from the form-level change handler
  [slider, textBox].forEach((el) => el.addEventListener('change', (e) => e.stopPropagation()));

  slider.addEventListener('input', () => commit(Number(slider.value)));

  textBox.addEventListener('focus', () => {
    textBox.value = `${parseAmount(textBox.value)}`;
  });
  const commitText = () => {
    const parsed = parseAmount(textBox.value);
    if (Number.isNaN(parsed)) {
      render(parseAmount(input.value) || min);
    } else {
      commit(parsed);
    }
  };
  textBox.addEventListener('blur', commitText);
  textBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitText();
    }
  });
  // while typing, move the slider without reformatting the text
  textBox.addEventListener('input', () => {
    const parsed = parseAmount(textBox.value);
    if (!Number.isNaN(parsed)) {
      slider.value = clamp(parsed);
      wrapper.style.setProperty('--loan-slider-percent', `${percent(clamp(parsed))}%`);
    }
  });

  const setEnabled = (enabled) => {
    slider.disabled = !enabled;
    textBox.disabled = !enabled;
  };
  setEnabled(fieldJson?.enabled !== false && fieldJson?.readOnly !== true);

  // reflect model-driven changes (rules, reset, prefill) back into the widget
  subscribe(fieldDiv, formId, (_el, fieldModel) => {
    if (!fieldModel) return;
    const value = parseAmount(fieldModel.value);
    if (!Number.isNaN(value) && document.activeElement !== textBox) render(value);
    setEnabled(fieldModel.enabled !== false && fieldModel.readOnly !== true);
  }, { listenChanges: true });

  return fieldDiv;
}
