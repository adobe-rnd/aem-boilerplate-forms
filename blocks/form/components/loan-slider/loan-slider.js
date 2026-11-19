import { subscribe } from '../../rules/index.js';

const MAX_TICK_LABELS = 7;

function toNumber(value, fallback) {
  const num = Number(value);
  return value !== undefined && value !== null && value !== '' && Number.isFinite(num)
    ? num
    : fallback;
}

export function formatAmount(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
}

/** Compact Indian notation: 50K, 2L, 12.5L, 1Cr */
export function formatCompact(value) {
  const units = [[10000000, 'Cr'], [100000, 'L'], [1000, 'K']];
  const unit = units.find(([size]) => Math.abs(value) >= size);
  if (!unit) {
    return `${Math.round(value * 100) / 100}`;
  }
  return `${Math.round((value / unit[0]) * 100) / 100}${unit[1]}`;
}

export function parseAmount(text) {
  const cleaned = `${text ?? ''}`.replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') {
    return NaN;
  }
  return Number(cleaned);
}

export function getTickValues(min, max, splits) {
  const size = (max - min) / splits;
  return Array.from({ length: splits + 1 }, (_, i) => (i === splits ? max : min + size * i));
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  const label = fieldDiv.querySelector('label');
  const props = fieldJson?.properties || {};

  const min = toNumber(fieldJson?.minimum, 0);
  const maxValue = toNumber(fieldJson?.maximum, 100000);
  const max = maxValue > min ? maxValue : min + 1;
  const splits = Math.max(1, Math.floor(toNumber(props.splits, 10)));
  const step = toNumber(props.stepValue, 1) > 0 ? toNumber(props.stepValue, 1) : 1;
  const symbol = props.currencySymbol ?? '₹';

  const clamp = (num) => Math.min(max, Math.max(min, num));
  const percent = (num) => ((clamp(num) - min) / (max - min)) * 100;

  // the original input keeps the committed numeric value and no longer renders
  input.type = 'hidden';

  const header = document.createElement('div');
  header.className = 'loan-slider-header';
  const textWrapper = document.createElement('div');
  textWrapper.className = 'loan-slider-text';
  const symbolEl = document.createElement('span');
  symbolEl.className = 'loan-slider-symbol';
  symbolEl.textContent = symbol;
  symbolEl.setAttribute('aria-hidden', 'true');
  const textBox = document.createElement('input');
  textBox.type = 'text';
  textBox.inputMode = 'numeric';
  textBox.className = 'loan-slider-input';
  textBox.autocomplete = 'off';
  if (input.id) {
    textBox.id = `${input.id}-text`;
    if (label) {
      label.setAttribute('for', textBox.id);
    }
  }
  textWrapper.append(symbolEl, textBox);

  const track = document.createElement('div');
  track.className = 'loan-slider-track';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.min = min;
  slider.max = max;
  slider.step = step;
  if (label) {
    slider.setAttribute('aria-labelledby', label.id || (label.id = `${input.id || fieldJson.id}-label`));
  }

  const ticks = document.createElement('div');
  ticks.className = 'loan-slider-ticks';
  const labels = document.createElement('div');
  labels.className = 'loan-slider-labels';
  const labelEvery = Math.ceil((splits + 1) / MAX_TICK_LABELS);
  getTickValues(min, max, splits).forEach((tick, i) => {
    const pos = `${percent(tick)}`;
    const mark = document.createElement('span');
    mark.className = 'loan-slider-tick';
    mark.style.setProperty('--pos', pos);
    mark.dataset.value = tick;
    ticks.append(mark);
    if (i === 0 || i === splits || i % labelEvery === 0) {
      const text = document.createElement('span');
      text.className = 'loan-slider-label';
      text.style.setProperty('--pos', pos);
      text.textContent = formatCompact(tick);
      labels.append(text);
    }
  });
  // drop a penultimate label that would collide with the max label
  if (splits % labelEvery !== 0 && labels.children.length > 2) {
    labels.children[labels.children.length - 2].remove();
  }

  track.append(ticks, slider, labels);
  if (label) {
    header.append(label);
  }
  header.append(textWrapper);
  input.after(header, track);

  const render = (num) => {
    const value = clamp(num);
    slider.value = value;
    textBox.value = formatAmount(value);
    track.style.setProperty('--fill', percent(value));
    ticks.querySelectorAll('.loan-slider-tick').forEach((tick) => {
      tick.classList.toggle('filled', Number(tick.dataset.value) <= value);
    });
    slider.setAttribute('aria-valuetext', `${symbol}${formatAmount(value)}`);
    return value;
  };

  const commit = (num) => {
    const value = render(num);
    if (Number(input.value) !== value || input.value === '') {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  // The form block commits any bubbling change event to the model; the widget's own
  // inputs hold display text, so only the hidden input is allowed to commit.
  [slider, textBox].forEach((el) => el.addEventListener('change', (e) => e.stopPropagation()));

  slider.addEventListener('input', () => render(Number(slider.value)));
  slider.addEventListener('change', () => commit(Number(slider.value)));

  textBox.addEventListener('input', () => {
    const num = parseAmount(textBox.value);
    if (!Number.isNaN(num)) {
      const value = clamp(num);
      slider.value = value;
      track.style.setProperty('--fill', percent(value));
    }
  });
  const commitText = () => {
    const num = parseAmount(textBox.value);
    commit(Number.isNaN(num) ? Number(input.value) || min : num);
  };
  textBox.addEventListener('change', commitText);
  textBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitText();
    }
  });

  const setDisabled = (disabled) => {
    slider.disabled = disabled;
    textBox.disabled = disabled;
  };
  setDisabled(fieldJson?.enabled === false || fieldJson?.readOnly === true);

  const initial = toNumber(fieldJson?.value ?? input.value, min);
  render(initial);

  subscribe(fieldDiv, formId, (_fieldDiv, model, eventType, payload) => {
    if (eventType === 'register') {
      const start = toNumber(model.value, min);
      const value = render(start);
      if (model.value !== value) {
        model.value = value;
      }
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') {
          render(toNumber(change.currentValue, min));
        } else if (change?.propertyName === 'enabled' || change?.propertyName === 'readOnly') {
          setDisabled(model.enabled === false || model.readOnly === true);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
