const DEFAULT_SPLITS = 10;

export function formatInr(value) {
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

export function formatShort(value) {
  const abs = Math.abs(value);
  const trim = (n) => `${Math.round(n * 100) / 100}`;
  if (abs >= 10000000) return `${trim(value / 10000000)}Cr`;
  if (abs >= 100000) return `${trim(value / 100000)}L`;
  if (abs >= 1000) return `${trim(value / 1000)}K`;
  return `${value}`;
}

export function parseAmount(text) {
  const digits = `${text}`.replace(/[^\d.]/g, '');
  return digits === '' ? NaN : Number(digits);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getSplitValues(min, max, splits) {
  const count = Math.max(1, splits);
  return Array.from({ length: count + 1 }, (_, i) => Math.round(min + ((max - min) * i) / count));
}

export function snapToSplit(value, min, max, splits) {
  const count = Math.max(1, splits);
  const size = (max - min) / count;
  return Math.round(min + Math.round((value - min) / size) * size);
}

export default async function decorate(fieldDiv, fieldJson) {
  const input = fieldDiv.querySelector('input');
  const min = Number(fieldJson?.minimum ?? input.min) || 0;
  let max = Number(fieldJson?.maximum ?? input.max);
  if (!max || max <= min) max = min + 100;
  const splits = Math.max(1, Math.floor(Number(fieldJson?.properties?.splits)) || DEFAULT_SPLITS);

  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = 1;
  input.classList.add('loan-slider-input');

  const wrapper = document.createElement('div');
  wrapper.className = 'loan-slider-wrapper decorated';

  const textbox = document.createElement('input');
  textbox.type = 'text';
  textbox.inputMode = 'numeric';
  textbox.className = 'loan-slider-textbox';
  textbox.setAttribute('aria-label', 'Loan amount');

  const track = document.createElement('div');
  track.className = 'loan-slider-track';
  const ticks = document.createElement('div');
  ticks.className = 'loan-slider-ticks';
  const labels = document.createElement('div');
  labels.className = 'loan-slider-labels';

  const values = getSplitValues(min, max, splits);
  // thin out labels so they stay readable when there are many splits
  const labelStride = Math.ceil(values.length / 7);
  values.forEach((v, i) => {
    const pos = `${((v - min) / (max - min)) * 100}%`;
    if (i > 0 && i < values.length - 1) {
      const tick = document.createElement('span');
      tick.className = 'loan-slider-tick';
      tick.style.left = pos;
      tick.dataset.value = v;
      ticks.appendChild(tick);
    }
    if (i % labelStride === 0 || i === values.length - 1) {
      const label = document.createElement('span');
      label.className = 'loan-slider-label';
      label.style.left = pos;
      label.textContent = formatShort(v);
      labels.appendChild(label);
    }
  });

  input.after(wrapper);
  track.append(input, ticks);
  wrapper.append(textbox, track, labels);

  const renderSlider = (value) => {
    wrapper.style.setProperty('--loan-slider-progress', `${((value - min) / (max - min)) * 100}%`);
    input.setAttribute('aria-valuetext', formatInr(value));
    ticks.querySelectorAll('.loan-slider-tick').forEach((t) => {
      t.classList.toggle('filled', Number(t.dataset.value) <= value);
    });
  };

  const render = (value) => {
    renderSlider(value);
    textbox.value = formatInr(value);
  };

  const rawAttr = input.getAttribute('value');
  const parsedInitial = Number(rawAttr);
  const start = rawAttr === null || rawAttr === '' || Number.isNaN(parsedInitial)
    ? min : clamp(parsedInitial, min, max);
  input.value = start;
  render(start);

  // set while dispatching our own events so they are not re-snapped
  let internal = false;
  const fire = (type) => {
    internal = true;
    input.dispatchEvent(new Event(type, { bubbles: true }));
    internal = false;
  };

  // slider head moves between the equal splits
  input.addEventListener('input', () => {
    if (internal) return;
    const snapped = snapToSplit(Number(input.value), min, max, splits);
    input.value = snapped;
    render(snapped);
  });

  // textbox accepts any amount within range; slider follows
  const commitText = () => {
    const parsed = parseAmount(textbox.value);
    const value = Number.isNaN(parsed) ? Number(input.value) : clamp(Math.round(parsed), min, max);
    const changed = value !== Number(input.value);
    input.value = value;
    render(value);
    if (changed) {
      fire('input');
      fire('change');
    }
  };
  textbox.addEventListener('focus', () => {
    textbox.value = `${Number(input.value)}`;
    textbox.select();
  });
  textbox.addEventListener('blur', commitText);
  textbox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitText();
    }
  });
  textbox.addEventListener('input', () => {
    const parsed = parseAmount(textbox.value);
    if (!Number.isNaN(parsed)) {
      const value = clamp(Math.round(parsed), min, max);
      input.value = value;
      renderSlider(value);
    }
  });

  return fieldDiv;
}
