import { subscribe } from '../../rules/index.js';

const DEFAULT_MIN = 50000;
const DEFAULT_MAX = 1250000;
const DEFAULT_SPLITS = 10;
const MAX_LABELS = 6;
const THUMB_SIZE = 26;

const trim = (n) => String(Math.round(n * 100) / 100);

function formatShort(value) {
  if (value >= 100000) return `${trim(value / 100000)}L`;
  if (value >= 1000) return `${trim(value / 1000)}K`;
  return trim(value);
}

const formatFull = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;

function positionStyle(ratio) {
  return `left: calc(${ratio * 100}% + ${(0.5 - ratio) * THUMB_SIZE}px)`;
}

function readConfig(fieldJson) {
  const props = fieldJson?.properties || {};
  let min = Number(props.minAmount);
  let max = Number(props.maxAmount);
  if (!Number.isFinite(min) || props.minAmount === '' || props.minAmount == null) min = DEFAULT_MIN;
  if (!Number.isFinite(max) || props.maxAmount === '' || props.maxAmount == null) max = DEFAULT_MAX;
  if (max < min) [min, max] = [max, min];
  if (max === min) max = min + DEFAULT_SPLITS;
  const splits = Math.floor(Number(props.splits));
  return { min, max, splits: splits >= 1 ? splits : DEFAULT_SPLITS };
}

function buildScale(min, max, splits) {
  const scale = document.createElement('div');
  scale.className = 'loan-slider-scale';
  const stride = Math.ceil(splits / (MAX_LABELS - 1));
  for (let i = 0; i <= splits; i += 1) {
    const ratio = i / splits;
    const tick = document.createElement('span');
    tick.className = 'loan-slider-tick';
    tick.setAttribute('style', positionStyle(ratio));
    scale.append(tick);
    // keep the last label only if it will not overlap the previous one
    const showLabel = i % stride === 0 || (i === splits && i % stride >= stride / 2);
    if (showLabel) {
      const label = document.createElement('span');
      label.className = 'loan-slider-label';
      label.textContent = formatShort(min + (max - min) * ratio);
      label.setAttribute('style', positionStyle(ratio));
      scale.append(label);
    }
  }
  return scale;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  const { min, max, splits } = readConfig(fieldJson);
  const stepSize = (max - min) / splits;
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const snap = (v) => Math.round(min + Math.round((clamp(v) - min) / stepSize) * stepSize);

  const initial = Number(input.value);
  let current = Number.isFinite(initial) && input.value !== '' ? clamp(initial) : min;

  // the original input stays in the DOM as the value carrier for the form model
  input.type = 'number';
  input.min = min;
  input.max = max;
  input.hidden = true;
  input.value = current;

  const labelEl = fieldDiv.querySelector('.field-label, label');
  const header = document.createElement('div');
  header.className = 'loan-slider-header';
  const textBox = document.createElement('input');
  textBox.type = 'text';
  textBox.inputMode = 'numeric';
  textBox.className = 'loan-slider-value';
  textBox.autocomplete = 'off';
  textBox.setAttribute('aria-label', labelEl?.textContent?.trim() || 'Loan amount');
  if (labelEl) header.append(labelEl);
  header.append(textBox);

  const widget = document.createElement('div');
  widget.className = 'loan-slider-widget';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.min = min;
  slider.max = max;
  slider.step = 'any';
  widget.append(slider, buildScale(min, max, splits));

  input.before(header, widget);

  const disabled = fieldJson?.enabled === false || fieldJson?.readOnly === true;
  slider.disabled = disabled;
  textBox.disabled = disabled;

  const render = (value) => {
    const n = Number(value);
    const shown = Number.isFinite(n) ? n : min;
    slider.value = clamp(shown);
    textBox.value = formatFull(shown);
    const ratio = (clamp(shown) - min) / (max - min);
    widget.setAttribute('style', `--loan-slider-progress: calc(${ratio * 100}% + ${(0.5 - ratio) * THUMB_SIZE}px)`);
  };

  const commit = (value) => {
    if (value === current) return;
    current = value;
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  slider.addEventListener('input', () => {
    // while dragging the head jumps from split to split
    const snapped = snap(Number(slider.value));
    render(snapped);
    commit(snapped);
  });

  const commitText = () => {
    const parsed = parseFloat(textBox.value.replace(/[^\d.]/g, ''));
    if (Number.isNaN(parsed)) {
      render(current);
      return;
    }
    const value = Math.round(clamp(parsed));
    render(value);
    commit(value);
  };
  textBox.addEventListener('change', commitText);
  textBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitText();
    }
  });
  textBox.addEventListener('focus', () => {
    textBox.value = String(current);
    textBox.select();
  });
  textBox.addEventListener('blur', () => render(current));

  render(current);

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      const modelValue = Number(fieldModel.value);
      if (fieldModel.value != null && fieldModel.value !== '' && modelValue !== current) {
        current = clamp(modelValue);
        render(modelValue);
      }
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') {
          const n = Number(change.currentValue);
          if (change.currentValue != null && change.currentValue !== '' && n !== current) {
            current = n;
            input.value = n;
            if (document.activeElement !== textBox) render(n);
          }
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
