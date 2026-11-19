import { subscribe } from '../../rules/index.js';

const DEFAULT_SPLITS = 10;
const MAX_TICKS = 100;
const MAX_LABELS = 6;

function formatAmount(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
}

function compact(value) {
  const trim = (n) => `${Number(n.toFixed(2))}`;
  if (value >= 1e7) return `${trim(value / 1e7)}Cr`;
  if (value >= 1e5) return `${trim(value / 1e5)}L`;
  if (value >= 1e3) return `${trim(value / 1e3)}K`;
  return trim(value);
}

function toNumber(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const source = fieldDiv.querySelector('input');
  const label = fieldDiv.querySelector('label');
  const props = fieldJson?.properties || {};
  const symbol = props.currencySymbol ?? '₹';

  let min = toNumber(source.min) ?? toNumber(fieldJson?.minimum) ?? 0;
  let max = toNumber(source.max) ?? toNumber(fieldJson?.maximum) ?? 100;
  if (max < min) [min, max] = [max, min];
  const requested = Math.floor(toNumber(props.splits) || DEFAULT_SPLITS);
  const splits = Math.max(1, requested);
  const stepSize = (max - min) / splits;

  const valueAt = (index) => Number((min + index * stepSize).toFixed(2));
  const indexOf = (value) => Math.min(splits, Math.max(0, Math.round((value - min) / stepSize)));

  // the original input stays as the model-bound carrier of the raw numeric value
  source.type = 'hidden';

  const wrapper = document.createElement('div');
  wrapper.className = 'loan-slider-widget';

  const textbox = document.createElement('input');
  textbox.type = 'text';
  textbox.inputMode = 'numeric';
  textbox.className = 'loan-slider-input';
  textbox.id = `${source.id}-amount`;
  textbox.autocomplete = 'off';
  if (source.placeholder) textbox.placeholder = source.placeholder;
  if (label) label.htmlFor = textbox.id;
  textbox.disabled = source.disabled;
  textbox.readOnly = source.readOnly;

  const track = document.createElement('div');
  track.className = 'loan-slider-track';
  track.setAttribute('aria-hidden', 'true');
  if (splits <= MAX_TICKS) {
    for (let i = 0; i <= splits; i += 1) {
      const tick = document.createElement('span');
      tick.className = 'loan-slider-tick';
      tick.style.setProperty('--pos', i / splits);
      track.appendChild(tick);
    }
  }

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.min = 0;
  slider.max = splits;
  slider.step = 1;
  slider.disabled = source.disabled;
  slider.setAttribute('aria-labelledby', label?.id || '');
  if (label && !label.id) {
    label.id = `${source.id}-label`;
    slider.setAttribute('aria-labelledby', label.id);
  }
  slider.setAttribute('aria-valuetext', '');

  const labels = document.createElement('div');
  labels.className = 'loan-slider-labels';
  labels.setAttribute('aria-hidden', 'true');
  const labelCount = Math.min(splits + 1, MAX_LABELS);
  const labelIdx = new Set();
  for (let i = 0; i < labelCount; i += 1) {
    labelIdx.add(Math.round((i * splits) / (labelCount - 1 || 1)));
  }
  labelIdx.forEach((i) => {
    const span = document.createElement('span');
    span.className = 'loan-slider-label';
    span.style.setProperty('--pos', i / splits);
    span.textContent = compact(valueAt(i));
    labels.appendChild(span);
  });

  const sliderWrap = document.createElement('div');
  sliderWrap.className = 'loan-slider-control';
  sliderWrap.append(track, slider, labels);

  const header = document.createElement('div');
  header.className = 'loan-slider-header';
  if (label) header.appendChild(label);
  header.appendChild(textbox);
  wrapper.append(header, sliderWrap);
  fieldDiv.prepend(wrapper);

  let current = null;

  const render = (value, force = false) => {
    const index = indexOf(value ?? min);
    const shown = value === null || value === undefined ? null : valueAt(index);
    slider.value = index;
    sliderWrap.style.setProperty('--fill', index / splits);
    slider.setAttribute('aria-valuetext', `${symbol}${formatAmount(valueAt(index))}`);
    if (force || document.activeElement !== textbox) {
      textbox.value = shown === null ? '' : `${symbol}${formatAmount(shown)}`;
    }
  };

  const commit = (value) => {
    if (value === current) return;
    current = value;
    source.value = value;
    source.dispatchEvent(new Event('change', { bubbles: true }));
  };

  slider.addEventListener('input', () => {
    const value = valueAt(Number(slider.value));
    sliderWrap.style.setProperty('--fill', Number(slider.value) / splits);
    textbox.value = `${symbol}${formatAmount(value)}`;
    slider.setAttribute('aria-valuetext', textbox.value);
  });
  // `change` fires once the user releases the head or finishes a key press
  slider.addEventListener('change', (e) => {
    // the form block would otherwise write the raw index/typed text to the model
    e.stopPropagation();
    commit(valueAt(Number(slider.value)));
  });

  textbox.addEventListener('focus', () => {
    if (current !== null) textbox.value = String(current);
    textbox.select();
  });
  textbox.addEventListener('input', () => {
    const typed = toNumber(textbox.value.replace(/[^\d.]/g, ''));
    if (typed !== null) {
      slider.value = indexOf(typed);
      sliderWrap.style.setProperty('--fill', Number(slider.value) / splits);
    }
  });
  const commitTextbox = () => {
    const typed = toNumber(textbox.value.replace(/[^\d.]/g, ''));
    if (typed === null) {
      render(current, true);
      return;
    }
    const value = valueAt(indexOf(typed));
    render(value, true);
    commit(value);
  };
  textbox.addEventListener('change', (e) => e.stopPropagation());
  textbox.addEventListener('blur', commitTextbox);
  textbox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTextbox();
      textbox.select();
    }
  });

  const initial = toNumber(source.value);
  if (initial !== null) current = valueAt(indexOf(initial));
  render(current);

  subscribe(fieldDiv, formId, (_fd, model, eventType, payload) => {
    if (eventType === 'register') {
      const v = toNumber(model.value);
      current = v === null ? null : valueAt(indexOf(v));
      render(current);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change.propertyName === 'value') {
          const v = toNumber(change.currentValue);
          current = v === null ? null : valueAt(indexOf(v));
          render(current);
        } else if (change.propertyName === 'enabled') {
          slider.disabled = !change.currentValue;
          textbox.disabled = !change.currentValue;
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
