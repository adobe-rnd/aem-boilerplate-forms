import { subscribe } from '../../rules/index.js';

const DEFAULT_MIN = 50000;
const DEFAULT_MAX = 1250000;
const DEFAULT_SPLITS = 12;

const inr = new Intl.NumberFormat('en-IN');

function formatInr(value) {
  return `₹${inr.format(value)}`;
}

// 50000 -> 50K, 200000 -> 2L, 1250000 -> 12.5L, 10000000 -> 1Cr
function shortLabel(value) {
  const trim = (n) => `${Math.round(n * 100) / 100}`;
  if (value >= 10000000) return `${trim(value / 10000000)}Cr`;
  if (value >= 100000) return `${trim(value / 100000)}L`;
  if (value >= 1000) return `${trim(value / 1000)}K`;
  return `${value}`;
}

function toNumber(v) {
  const n = parseFloat(`${v ?? ''}`.replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? null : n;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const nativeInput = fieldDiv.querySelector('input');
  const props = fieldJson?.properties || {};
  let min = toNumber(fieldJson?.minimum) ?? DEFAULT_MIN;
  let max = toNumber(fieldJson?.maximum) ?? DEFAULT_MAX;
  if (max <= min) {
    min = DEFAULT_MIN;
    max = DEFAULT_MAX;
  }
  const splits = Math.max(1, Math.floor(toNumber(props.splits) || DEFAULT_SPLITS));
  const stepSize = (max - min) / splits;
  let model = null;

  const clampSnap = (n) => {
    const index = Math.round((Math.min(max, Math.max(min, n)) - min) / stepSize);
    return Math.round(min + index * stepSize);
  };

  // the native input stays in the DOM (hidden) so the form block keeps its field wiring
  nativeInput.hidden = true;

  const widget = document.createElement('div');
  widget.className = 'loan-slider-widget';

  const textBox = document.createElement('input');
  textBox.type = 'text';
  textBox.inputMode = 'numeric';
  textBox.className = 'loan-slider-value';
  textBox.setAttribute('aria-label', fieldJson?.label?.value || 'Loan amount');

  const track = document.createElement('div');
  track.className = 'loan-slider-track';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.min = 0;
  slider.max = splits;
  slider.step = 1;
  slider.setAttribute('aria-label', 'Loan amount slider');

  const ticks = document.createElement('div');
  ticks.className = 'loan-slider-ticks';
  const labels = document.createElement('div');
  labels.className = 'loan-slider-labels';
  // show at most ~6 labels, always including min and max
  const labelEvery = Math.ceil(splits / 6);
  for (let i = 0; i <= splits; i += 1) {
    const pct = (i / splits) * 100;
    const tick = document.createElement('span');
    tick.className = 'loan-slider-tick';
    tick.style.left = `${pct}%`;
    ticks.append(tick);
    if (i === 0 || i === splits || (i % labelEvery === 0 && splits - i >= labelEvery / 2)) {
      const label = document.createElement('span');
      label.className = 'loan-slider-label';
      label.style.left = `${pct}%`;
      label.textContent = shortLabel(Math.round(min + i * stepSize));
      labels.append(label);
    }
  }

  track.append(ticks, slider);
  widget.append(textBox, track, labels);
  nativeInput.after(widget);

  const render = (value, updateText = true) => {
    const index = Math.round((value - min) / stepSize);
    slider.value = index;
    slider.setAttribute('aria-valuetext', formatInr(value));
    widget.style.setProperty('--loan-slider-progress', `${(index / splits) * 100}%`);
    if (updateText) textBox.value = formatInr(value);
    nativeInput.value = value;
  };

  const commit = (value) => {
    render(value);
    if (model && model.value !== value) model.value = value;
  };

  // the extra inputs are not form fields: keep their events away from the form-level handler
  [slider, textBox].forEach((el) => el.addEventListener('change', (e) => e.stopPropagation()));

  slider.addEventListener('input', () => render(Math.round(min + Number(slider.value) * stepSize)));
  slider.addEventListener('change', () => commit(Math.round(min + Number(slider.value) * stepSize)));

  textBox.addEventListener('focus', () => {
    textBox.value = `${toNumber(textBox.value) ?? ''}`;
    textBox.select();
  });
  textBox.addEventListener('input', () => {
    const n = toNumber(textBox.value);
    if (n !== null) render(clampSnap(n), false);
  });
  const commitText = () => {
    const n = toNumber(textBox.value);
    commit(clampSnap(n ?? toNumber(model?.value) ?? min));
  };
  textBox.addEventListener('blur', commitText);
  textBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitText();
    }
  });

  const initial = toNumber(fieldJson?.value) ?? toNumber(fieldJson?.default) ?? min;
  render(clampSnap(initial));

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      const n = toNumber(model.value);
      if (n !== null) render(clampSnap(n));
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change.propertyName === 'value') {
          const n = toNumber(change.currentValue);
          if (n !== null && document.activeElement !== textBox) render(clampSnap(n));
        } else if (change.propertyName === 'enabled') {
          slider.disabled = change.currentValue === false;
          textBox.disabled = change.currentValue === false;
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
