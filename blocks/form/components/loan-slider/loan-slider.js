import { subscribe } from '../../rules/index.js';

const DEFAULT_MIN = 50000;
const DEFAULT_MAX = 1000000;
const DEFAULT_SPLITS = 10;
const MAX_LABELS = 6;

const inrFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export const formatCurrency = (value) => `₹${inrFormatter.format(value)}`;

function trim(n) {
  return `${Number.parseFloat(n.toFixed(2))}`;
}

/** Compact Indian-style label: 50K, 2L, 1.5Cr */
export function formatCompact(value) {
  if (value >= 1e7) return `${trim(value / 1e7)}Cr`;
  if (value >= 1e5) return `${trim(value / 1e5)}L`;
  if (value >= 1e3) return `${trim(value / 1e3)}K`;
  return `${trim(value)}`;
}

export function parseAmount(text) {
  const cleaned = `${text ?? ''}`.replace(/[^\d.]/g, '');
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

function toNumber(val, fallback) {
  const num = Number.parseFloat(val);
  return Number.isNaN(num) ? fallback : num;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;

  let min = toNumber(fieldJson?.minimum ?? input.min, DEFAULT_MIN);
  let max = toNumber(fieldJson?.maximum ?? input.max, DEFAULT_MAX);
  if (max <= min) {
    min = DEFAULT_MIN;
    max = DEFAULT_MAX;
  }
  const splitsProp = Math.floor(toNumber(fieldJson?.properties?.splits, DEFAULT_SPLITS));
  const splits = splitsProp >= 1 ? splitsProp : DEFAULT_SPLITS;
  const stepSize = (max - min) / splits;
  const readOnly = fieldJson?.readOnly === true;
  const labelText = fieldDiv.querySelector('label')?.textContent?.trim() || 'Loan amount';

  const clamp = (v) => Math.min(max, Math.max(min, v));
  const toIndex = (v) => Math.round((clamp(v) - min) / stepSize);
  const toValue = (idx) => Number.parseFloat((min + idx * stepSize).toFixed(2));

  fieldDiv.classList.add('loan-slider-field');
  input.classList.add('loan-slider-source');
  input.hidden = true;

  const textBox = document.createElement('input');
  textBox.type = 'text';
  textBox.inputMode = 'numeric';
  textBox.className = 'loan-slider-amount';
  textBox.setAttribute('aria-label', labelText);
  textBox.autocomplete = 'off';

  const widget = document.createElement('div');
  widget.className = 'loan-slider-widget';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.min = 0;
  slider.max = splits;
  slider.step = 1;
  slider.setAttribute('aria-label', labelText);

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
    tick.dataset.index = i;
    ticks.append(tick);
    if (i === 0 || i === splits || (i % labelEvery === 0 && splits - i >= labelEvery / 2)) {
      const lbl = document.createElement('span');
      lbl.className = 'loan-slider-label';
      lbl.style.setProperty('--pos', pos);
      lbl.textContent = formatCompact(toValue(i));
      labels.append(lbl);
    }
  }
  widget.append(slider, ticks, labels);
  input.after(textBox, widget);

  if (readOnly || fieldJson?.enabled === false) {
    slider.disabled = true;
    textBox.disabled = true;
  }

  let current = null;
  const render = (value) => {
    const v = clamp(value);
    const idx = toIndex(v);
    current = v;
    textBox.value = formatCurrency(v);
    slider.value = idx;
    slider.setAttribute('aria-valuetext', formatCurrency(v));
    widget.style.setProperty('--fill', `${(idx / splits) * 100}%`);
    ticks.querySelectorAll('.loan-slider-tick').forEach((t) => {
      t.classList.toggle('filled', Number(t.dataset.index) <= idx);
    });
  };

  // commits to the form model via the native change event on the underlying input
  const commit = (value) => {
    if (`${input.value}` === `${value}`) return;
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  slider.addEventListener('input', () => {
    render(toValue(Number(slider.value)));
  });
  slider.addEventListener('change', () => {
    commit(current);
  });

  textBox.addEventListener('focus', () => {
    if (current !== null) textBox.value = `${current}`;
    textBox.select();
  });
  textBox.addEventListener('input', () => {
    // live-sync slider position while typing, without reformatting the text
    const typed = parseAmount(textBox.value);
    if (typed !== null) {
      const idx = toIndex(typed);
      slider.value = idx;
      widget.style.setProperty('--fill', `${(idx / splits) * 100}%`);
    }
  });
  const commitText = () => {
    const typed = parseAmount(textBox.value);
    render(typed === null ? (current ?? min) : typed);
    commit(current);
  };
  textBox.addEventListener('change', commitText);
  textBox.addEventListener('blur', () => render(current ?? min));
  textBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitText();
    }
  });

  const initial = parseAmount(fieldJson?.value ?? input.value ?? fieldJson?.default);
  render(initial ?? min);

  subscribe(fieldDiv, formId, (_fieldDiv, model, eventType, payload) => {
    if (eventType === 'register') {
      const val = parseAmount(model.value);
      if (val !== null && val !== current) render(val);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') {
          const val = parseAmount(change.currentValue);
          if (val !== null && val !== current) render(val);
        } else if (change?.propertyName === 'enabled') {
          const disabled = change.currentValue === false || readOnly;
          slider.disabled = disabled;
          textBox.disabled = disabled;
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
