import { subscribe } from '../../rules/index.js';

const DEFAULT_MIN = 50000;
const DEFAULT_MAX = 1250000;
const DEFAULT_SPLITS = 5;

const toNumber = (v) => (v === undefined || v === null || v === '' ? NaN : Number(v));

export function formatCurrency(value) {
  const rounded = Math.round(value * 100) / 100;
  return `₹${rounded.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatCompact(value) {
  const trim = (n) => `${Math.round(n * 100) / 100}`;
  if (value >= 1e7) return `${trim(value / 1e7)}Cr`;
  if (value >= 1e5) return `${trim(value / 1e5)}L`;
  if (value >= 1e3) return `${trim(value / 1e3)}K`;
  return trim(value);
}

export function parseAmount(text) {
  const cleaned = `${text ?? ''}`.replace(/[^0-9.-]/g, '');
  if (!/\d/.test(cleaned)) return NaN;
  return parseFloat(cleaned);
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const nativeInput = fieldDiv.querySelector('input');
  const label = fieldDiv.querySelector('label');
  const authoredMin = toNumber(fieldJson?.minimum ?? nativeInput?.getAttribute('min'));
  const authoredMax = toNumber(fieldJson?.maximum ?? nativeInput?.getAttribute('max'));
  let min = Number.isFinite(authoredMin) ? authoredMin : DEFAULT_MIN;
  let max = Number.isFinite(authoredMax) ? authoredMax : DEFAULT_MAX;
  if (max <= min) {
    min = DEFAULT_MIN;
    max = DEFAULT_MAX;
  }
  const authoredSplits = Math.floor(toNumber(fieldJson?.properties?.splits));
  const splits = authoredSplits >= 1 ? authoredSplits : DEFAULT_SPLITS;

  const clamp = (v) => Math.min(max, Math.max(min, v));
  const initial = toNumber(fieldJson?.value);
  let current = Number.isFinite(initial) ? clamp(initial) : min;
  let model = null;

  // the native input stays in the DOM (visually hidden) as the form block's value carrier
  nativeInput.classList.add('loan-slider-native');
  nativeInput.tabIndex = -1;
  nativeInput.setAttribute('aria-hidden', 'true');

  const labelId = `${fieldJson.id}-loan-slider-label`;
  if (label) {
    label.id = labelId;
    label.removeAttribute('for');
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'loan-slider-widget';

  const header = document.createElement('div');
  header.className = 'loan-slider-header';
  if (label) header.append(label);

  const amount = document.createElement('input');
  amount.type = 'text';
  amount.className = 'loan-slider-amount';
  amount.id = `${fieldJson.id}-loan-slider-amount`;
  amount.inputMode = 'numeric';
  amount.autocomplete = 'off';
  amount.setAttribute('aria-label', label?.textContent?.trim() || 'Amount');
  header.append(amount);

  const track = document.createElement('div');
  track.className = 'loan-slider-track';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.id = `${fieldJson.id}-loan-slider-range`;
  slider.min = min;
  slider.max = max;
  slider.step = fieldJson?.step > 0 ? fieldJson.step : 1;
  slider.setAttribute('aria-labelledby', labelId);

  const ticks = document.createElement('div');
  ticks.className = 'loan-slider-ticks';
  ticks.setAttribute('aria-hidden', 'true');
  const labels = document.createElement('div');
  labels.className = 'loan-slider-labels';
  labels.setAttribute('aria-hidden', 'true');
  for (let i = 0; i <= splits; i += 1) {
    const ratio = i / splits;
    const tick = document.createElement('span');
    tick.className = 'loan-slider-tick';
    tick.style.setProperty('--ratio', ratio);
    ticks.append(tick);
    const text = document.createElement('span');
    text.className = 'loan-slider-tick-label';
    text.style.setProperty('--ratio', ratio);
    text.textContent = formatCompact(i === splits ? max : min + (max - min) * ratio);
    labels.append(text);
  }

  track.append(slider, ticks);
  wrapper.append(header, track, labels);
  nativeInput.before(wrapper);

  const render = () => {
    slider.value = current;
    amount.value = formatCurrency(current);
    const pct = ((current - min) / (max - min)) * 100;
    slider.style.setProperty('--fill', `${pct}%`);
    slider.setAttribute('aria-valuetext', formatCurrency(current));
  };

  const commit = (value) => {
    current = clamp(value);
    render();
    if (model && model.value !== current) {
      model.value = current;
    }
  };

  slider.addEventListener('input', () => commit(Number(slider.value)));
  const commitText = () => {
    const parsed = parseAmount(amount.value);
    commit(Number.isFinite(parsed) ? parsed : current);
  };
  amount.addEventListener('change', commitText);
  amount.addEventListener('blur', commitText);
  amount.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitText();
    }
  });

  const applyModelValue = (value) => {
    const n = toNumber(value);
    if (Number.isFinite(n)) {
      current = clamp(n);
      render();
    }
  };

  render();

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      applyModelValue(fieldModel.value);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') applyModelValue(change.currentValue);
        if (change?.propertyName === 'enabled' || change?.propertyName === 'readOnly') {
          const off = fieldModel.enabled === false || fieldModel.readOnly === true;
          slider.disabled = off;
          amount.disabled = off;
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
