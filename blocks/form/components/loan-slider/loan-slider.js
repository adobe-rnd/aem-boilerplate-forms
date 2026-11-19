import { subscribe } from '../../rules/index.js';

const MAX_LABELS = 6;

export function formatINR(value) {
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

export function shortINR(value) {
  const v = Number(value);
  const fmt = (n, unit) => `${Number.isInteger(n) ? n : +n.toFixed(2)}${unit}`;
  if (v >= 10000000) return fmt(v / 10000000, 'Cr');
  if (v >= 100000) return fmt(v / 100000, 'L');
  if (v >= 1000) return fmt(v / 1000, 'K');
  return `${v}`;
}

export function parseAmount(text) {
  const n = parseFloat(String(text).replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? null : n;
}

/** Clamps to [min, max] and snaps to the nearest split. */
export function snap(value, min, max, step) {
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Math.min(max, snapped);
}

export default async function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  const min = Number(fieldJson?.minimum ?? input.min ?? 0) || 0;
  let max = Number(fieldJson?.maximum ?? input.max ?? 100) || 100;
  if (max <= min) max = min + 1;
  const stepProp = Number(fieldJson?.properties?.stepValue ?? fieldJson?.step);
  const step = stepProp > 0 ? stepProp : (max - min) / 10;
  const splits = Math.max(1, Math.round((max - min) / step));

  const wrapper = document.createElement('div');
  wrapper.className = 'loan-slider-wrapper';

  const display = document.createElement('input');
  display.type = 'text';
  display.inputMode = 'numeric';
  display.className = 'loan-slider-text';
  display.id = input.id;
  display.autocomplete = 'off';
  input.removeAttribute('id');
  input.type = 'hidden';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.setAttribute('aria-label', fieldJson?.label?.value || 'Loan amount');

  const track = document.createElement('div');
  track.className = 'loan-slider-track';
  const ticks = document.createElement('div');
  ticks.className = 'loan-slider-ticks';
  const labels = document.createElement('div');
  labels.className = 'loan-slider-labels';
  const labelEvery = Math.ceil((splits + 1) / MAX_LABELS);
  for (let i = 0; i <= splits; i += 1) {
    const value = Math.min(max, min + i * step);
    const pos = `--pos:${i / splits}`;
    const tick = document.createElement('span');
    tick.className = 'loan-slider-tick';
    tick.setAttribute('style', pos);
    ticks.append(tick);
    if (i % labelEvery === 0 || i === splits) {
      const label = document.createElement('span');
      label.className = 'loan-slider-label';
      label.setAttribute('style', pos);
      label.textContent = shortINR(value);
      labels.append(label);
    }
  }
  track.append(ticks, slider);
  wrapper.append(track, labels);

  const header = document.createElement('div');
  header.className = 'loan-slider-header';
  const label = fieldDiv.querySelector('label');
  if (label) header.append(label);
  header.append(display);
  input.before(header);
  input.after(wrapper);

  const render = (value) => {
    slider.value = value;
    display.value = formatINR(value);
    wrapper.style.setProperty('--progress', (value - min) / (max - min));
  };

  const commit = (value) => {
    const next = snap(value, min, max, step);
    render(next);
    if (String(input.value) !== String(next)) {
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  slider.addEventListener('input', () => {
    render(Number(slider.value));
  });
  slider.addEventListener('change', () => commit(Number(slider.value)));
  display.addEventListener('focus', () => {
    display.value = display.value.replace(/[^\d.]/g, '');
  });
  display.addEventListener('input', () => {
    const typed = parseAmount(display.value);
    if (typed !== null && typed >= min && typed <= max) {
      slider.value = snap(typed, min, max, step);
      wrapper.style.setProperty('--progress', (slider.value - min) / (max - min));
    }
  });
  const onTextCommit = () => {
    const typed = parseAmount(display.value);
    commit(typed === null ? Number(slider.value) : typed);
  };
  display.addEventListener('blur', onTextCommit);
  display.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onTextCommit();
    }
  });

  const initial = parseAmount(input.value);
  render(snap(initial ?? min, min, max, step));
  if (initial === null) input.value = min;

  // reflect model-driven changes (rules, prefill, reset)
  subscribe(fieldDiv, formId, (_, fieldModel) => {
    fieldModel?.subscribe((e) => {
      e.payload?.changes?.forEach((change) => {
        if (change.propertyName === 'value') {
          const v = Number(change.currentValue);
          if (!Number.isNaN(v) && change.currentValue !== '') {
            input.value = v;
            render(snap(v, min, max, step));
          }
        }
      });
    }, 'change');
  });
  return fieldDiv;
}
