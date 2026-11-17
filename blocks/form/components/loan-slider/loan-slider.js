import { subscribe } from '../../rules/index.js';

const DEFAULT_MIN = 50000;
const DEFAULT_MAX = 1250000;
const DEFAULT_SPLITS = 5;

const rupeeFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function toNumber(value, fallback) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export function formatRupees(value) {
  return `₹${rupeeFormat.format(Math.round(value))}`;
}

export function formatCompact(value) {
  const trim = (n) => `${parseFloat(n.toFixed(2))}`;
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${trim(value / 1e7)}Cr`;
  if (abs >= 1e5) return `${trim(value / 1e5)}L`;
  if (abs >= 1e3) return `${trim(value / 1e3)}K`;
  return trim(value);
}

export function parseAmount(text) {
  const cleaned = String(text ?? '').replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const props = fieldJson?.properties || {};
  let min = toNumber(fieldJson?.minimum, DEFAULT_MIN);
  let max = toNumber(fieldJson?.maximum, DEFAULT_MAX);
  if (max <= min) {
    min = DEFAULT_MIN;
    max = DEFAULT_MAX;
  }
  const splits = Math.max(1, Math.floor(toNumber(props.splits, DEFAULT_SPLITS)));
  const keyStep = Math.max(1, Math.round((max - min) / 100));

  fieldDiv.classList.add('loan-slider-wrapper');
  const modelInput = fieldDiv.querySelector('input');
  const label = fieldDiv.querySelector('label');
  modelInput.type = 'number';
  modelInput.hidden = true;
  modelInput.tabIndex = -1;
  modelInput.setAttribute('aria-hidden', 'true');

  const widget = document.createElement('div');
  widget.className = 'loan-slider-widget';

  const header = document.createElement('div');
  header.className = 'loan-slider-header';

  const amount = document.createElement('input');
  amount.type = 'text';
  amount.className = 'loan-slider-amount';
  amount.id = `${modelInput.id}-amount`;
  amount.inputMode = 'numeric';
  amount.autocomplete = 'off';
  amount.placeholder = formatRupees(min);
  if (label) {
    label.htmlFor = amount.id;
    header.append(label);
  }
  header.append(amount);

  const track = document.createElement('div');
  track.className = 'loan-slider-track';

  const range = document.createElement('input');
  range.type = 'range';
  range.className = 'loan-slider-range';
  range.min = min;
  range.max = max;
  range.step = 1;
  range.value = min;
  range.setAttribute('aria-valuemin', min);
  range.setAttribute('aria-valuemax', max);
  range.setAttribute('aria-valuenow', min);
  if (label) {
    label.id = label.id || `${modelInput.id}-label`;
    range.setAttribute('aria-labelledby', label.id);
  } else {
    range.setAttribute('aria-label', fieldJson?.label?.value || 'Amount');
  }

  const ticks = document.createElement('div');
  ticks.className = 'loan-slider-ticks';
  ticks.setAttribute('aria-hidden', 'true');
  const labels = document.createElement('div');
  labels.className = 'loan-slider-labels';
  labels.setAttribute('aria-hidden', 'true');
  for (let i = 0; i <= splits; i += 1) {
    const pos = i / splits;
    const tick = document.createElement('span');
    tick.className = 'loan-slider-tick';
    tick.style.setProperty('--pos', pos);
    ticks.append(tick);
    const text = document.createElement('span');
    text.className = 'loan-slider-tick-label';
    text.style.setProperty('--pos', pos);
    text.textContent = formatCompact(i === splits ? max : min + (max - min) * pos);
    labels.append(text);
  }

  track.append(range, ticks, labels);
  widget.append(header, track);
  modelInput.before(widget);

  let model = null;
  const clamp = (n) => Math.min(max, Math.max(min, n));

  const render = (value) => {
    const has = value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
    const n = has ? clamp(Number(value)) : min;
    range.value = n;
    range.setAttribute('aria-valuenow', n);
    range.setAttribute('aria-valuetext', formatRupees(n));
    widget.style.setProperty('--fill', `${((n - min) / (max - min)) * 100}%`);
    amount.value = has ? formatRupees(n) : '';
  };

  const commit = (n) => {
    if (model && model.value !== n) model.value = n;
  };

  // Keep the number input's native events away from the form-level handler,
  // which would write the formatted text into the model.
  ['change', 'input'].forEach((evt) => {
    amount.addEventListener(evt, (e) => e.stopPropagation());
    range.addEventListener(evt, (e) => e.stopPropagation());
  });

  range.addEventListener('input', () => {
    const n = Number(range.value);
    render(n);
    commit(n);
  });

  range.addEventListener('keydown', (e) => {
    const dir = {
      ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1,
    }[e.key];
    const big = { PageUp: 1, PageDown: -1 }[e.key];
    if (!dir && !big) return;
    e.preventDefault();
    const n = clamp(Number(range.value) + (dir || big * 10) * keyStep);
    render(n);
    commit(n);
  });

  const commitText = () => {
    const parsed = parseAmount(amount.value);
    if (parsed === null) {
      render(model?.value);
      return;
    }
    const n = clamp(parsed);
    render(n);
    commit(n);
  };
  amount.addEventListener('blur', commitText);
  amount.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitText();
    }
  });
  amount.addEventListener('focus', () => {
    const parsed = parseAmount(amount.value);
    if (parsed !== null) amount.value = String(parsed);
    amount.select();
  });

  const setEnabled = (enabled, readOnly) => {
    const disabled = enabled === false || readOnly === true;
    range.disabled = disabled;
    amount.disabled = disabled;
  };
  setEnabled(fieldJson?.enabled, fieldJson?.readOnly);
  render(fieldJson?.value ?? modelInput.value);

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      render(fieldModel.value);
      setEnabled(fieldModel.enabled, fieldModel.readOnly);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') {
          if (document.activeElement !== amount) render(change.currentValue);
          else range.value = clamp(toNumber(change.currentValue, min));
        } else if (['enabled', 'readOnly'].includes(change?.propertyName)) {
          setEnabled(model?.enabled, model?.readOnly);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
