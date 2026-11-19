import { subscribe } from '../../rules/index.js';

const DEFAULT_SPLITS = 10;

export function formatCompact(value) {
  const fmt = (n, unit) => `${Number(n.toFixed(2))}${unit}`;
  if (value >= 10000000) return fmt(value / 10000000, 'Cr');
  if (value >= 100000) return fmt(value / 100000, 'L');
  if (value >= 1000) return fmt(value / 1000, 'K');
  return `${value}`;
}

export function buildSplits(min, max, splits) {
  const count = Math.max(1, Math.floor(splits) || DEFAULT_SPLITS);
  const size = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => (i === count ? max : min + size * i));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default async function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  let min = Number(fieldJson?.minimum ?? input.min);
  let max = Number(fieldJson?.maximum ?? input.max);
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max) || max <= min) max = min + 100;
  const step = Number(fieldJson?.properties?.stepValue) || 1;
  const splits = buildSplits(min, max, Number(fieldJson?.properties?.splits));

  input.type = 'number';
  input.min = min;
  input.max = max;
  input.step = step;

  const wrapper = document.createElement('div');
  wrapper.className = 'loan-slider-wrapper decorated';

  const inputBox = document.createElement('div');
  inputBox.className = 'loan-slider-input';
  const prefix = document.createElement('span');
  prefix.className = 'loan-slider-currency';
  prefix.textContent = '₹';
  input.after(wrapper);
  inputBox.append(prefix, input);

  const track = document.createElement('div');
  track.className = 'loan-slider-track';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.setAttribute('aria-label', fieldJson?.label?.value || 'Loan amount');
  const ticks = document.createElement('div');
  ticks.className = 'loan-slider-ticks';
  const labels = document.createElement('div');
  labels.className = 'loan-slider-labels';
  splits.forEach((val) => {
    const pos = `${((val - min) / (max - min)) * 100}%`;
    const tick = document.createElement('span');
    tick.className = 'loan-slider-tick';
    tick.style.left = pos;
    ticks.append(tick);
    const label = document.createElement('span');
    label.className = 'loan-slider-label';
    label.style.left = pos;
    label.textContent = formatCompact(Math.round(val));
    labels.append(label);
  });
  track.append(ticks, slider);
  wrapper.append(inputBox, track, labels);

  const paint = (value) => {
    const pct = ((value - min) / (max - min)) * 100;
    wrapper.style.setProperty('--loan-slider-progress', `${pct}%`);
  };

  const syncSlider = () => {
    const raw = parseFloat(input.value);
    const value = Number.isNaN(raw) ? min : clamp(raw, min, max);
    slider.value = value;
    paint(value);
  };

  // slider -> textbox
  slider.addEventListener('input', () => {
    input.value = slider.value;
    paint(Number(slider.value));
  });
  slider.addEventListener('change', (e) => {
    e.stopPropagation();
    input.value = slider.value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // textbox -> slider
  input.addEventListener('input', syncSlider);
  input.addEventListener('change', syncSlider);

  // model driven updates (rules, reset, data binding)
  subscribe(fieldDiv, formId, (_el, fieldModel) => {
    if (fieldModel) {
      fieldModel.subscribe(() => syncSlider(), 'change');
    }
  });

  syncSlider();
  return fieldDiv;
}
