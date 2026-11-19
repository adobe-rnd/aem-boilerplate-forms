import { subscribe } from '../../rules/index.js';

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100000;
const DEFAULT_SPLITS = 10;
const MAX_LABELS = 7;

const toNumber = (val, fallback) => {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : fallback;
};

const formatAmount = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);

// compact Indian-style label: 50K, 2L, 1.5Cr
export const formatCompact = (value) => {
  const abs = Math.abs(value);
  const fmt = (n, unit) => `${parseFloat(n.toFixed(2))}${unit}`;
  if (abs >= 1e7) return fmt(value / 1e7, 'Cr');
  if (abs >= 1e5) return fmt(value / 1e5, 'L');
  if (abs >= 1e3) return fmt(value / 1e3, 'K');
  return `${parseFloat(value.toFixed(2))}`;
};

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;

  const props = fieldJson?.properties || {};
  let min = toNumber(input.getAttribute('min') ?? fieldJson?.minimum, DEFAULT_MIN);
  let max = toNumber(input.getAttribute('max') ?? fieldJson?.maximum, DEFAULT_MAX);
  if (max <= min) {
    min = DEFAULT_MIN;
    max = DEFAULT_MAX;
  }
  const splits = Math.max(1, Math.floor(toNumber(props.splits, DEFAULT_SPLITS)));
  const step = Math.max(toNumber(props.stepValue, 1), Number.EPSILON);
  const symbol = props.currencySymbol ?? '₹';
  const editable = fieldJson?.enabled !== false && fieldJson?.readOnly !== true;

  const normalize = (raw) => {
    const clamped = Math.min(max, Math.max(min, raw));
    const snapped = min + Math.round((clamped - min) / step) * step;
    return Math.min(max, parseFloat(snapped.toFixed(6)));
  };
  const parseText = (text) => parseFloat(String(text).replace(/[^\d.-]/g, ''));

  // the original input stays as the hidden source of truth for the form model
  input.type = 'number';
  input.style.display = 'none';
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;

  const wrapper = document.createElement('div');
  wrapper.className = 'loan-slider-widget';

  const textWrap = document.createElement('div');
  textWrap.className = 'loan-slider-value';
  const prefix = document.createElement('span');
  prefix.className = 'loan-slider-symbol';
  prefix.textContent = symbol;
  const text = document.createElement('input');
  text.type = 'text';
  text.inputMode = 'numeric';
  text.className = 'loan-slider-text';
  text.id = `${input.id || fieldJson?.id || 'loan'}-slider-text`;
  text.autocomplete = 'off';
  textWrap.append(prefix, text);

  const track = document.createElement('div');
  track.className = 'loan-slider-track';
  const range = document.createElement('input');
  range.type = 'range';
  range.className = 'loan-slider-range';
  range.min = min;
  range.max = max;
  range.step = step;
  range.setAttribute('aria-label', fieldJson?.label?.value || 'Loan amount');
  const ticks = document.createElement('div');
  ticks.className = 'loan-slider-ticks';
  const labels = document.createElement('div');
  labels.className = 'loan-slider-labels';

  const stride = Math.ceil(splits / (MAX_LABELS - 1));
  for (let i = 0; i <= splits; i += 1) {
    const amount = min + ((max - min) * i) / splits;
    const pct = (i / splits) * 100;
    const tick = document.createElement('span');
    tick.className = 'loan-slider-tick';
    tick.style.setProperty('--pos', pct / 100);
    ticks.append(tick);
    if (i % stride === 0 || i === splits) {
      const label = document.createElement('span');
      label.className = 'loan-slider-label';
      label.style.setProperty('--pos', pct / 100);
      label.textContent = formatCompact(amount);
      labels.append(label);
    }
  }
  track.append(range, ticks, labels);
  wrapper.append(textWrap, track);
  input.after(wrapper);

  const label = fieldDiv.querySelector('label');
  if (label) label.htmlFor = text.id;

  if (!editable) {
    range.disabled = true;
    text.disabled = true;
  }

  let current = null;
  const render = (value) => {
    current = value;
    range.value = value;
    text.value = formatAmount(value);
    wrapper.style.setProperty('--pct', (value - min) / (max - min));
  };

  const commit = (value) => {
    if (String(input.value) !== String(value)) {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  // live preview while sliding; the model is committed on release
  range.addEventListener('input', () => render(normalize(parseFloat(range.value))));
  range.addEventListener('change', () => commit(current));

  text.addEventListener('input', () => {
    const parsed = parseText(text.value);
    if (Number.isFinite(parsed)) {
      wrapper.style.setProperty('--pct', (normalize(parsed) - min) / (max - min));
      range.value = normalize(parsed);
    }
  });
  const commitText = () => {
    const parsed = parseText(text.value);
    const value = normalize(Number.isFinite(parsed) ? parsed : current);
    render(value);
    commit(value);
  };
  text.addEventListener('change', commitText);
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitText();
    }
  });

  const initial = toNumber(input.value, toNumber(fieldJson?.default, min));
  render(normalize(initial));
  if (String(input.value) !== String(current)) input.value = current;

  subscribe(fieldDiv, formId, (_fieldDiv, model, eventType, payload) => {
    if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') {
          const value = toNumber(change.currentValue, null);
          if (value !== null && value !== current) render(normalize(value));
        } else if (change?.propertyName === 'enabled' || change?.propertyName === 'readOnly') {
          const on = model.enabled !== false && !model.readOnly;
          range.disabled = !on;
          text.disabled = !on;
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
