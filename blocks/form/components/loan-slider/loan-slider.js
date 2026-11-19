import { subscribe } from '../../rules/index.js';

const DEFAULT_SPLITS = 10;
const MAX_LABELS = 7;

export function formatShort(value) {
  const trim = (n) => `${Math.round(n * 100) / 100}`;
  if (value >= 10000000) return `${trim(value / 10000000)}Cr`;
  if (value >= 100000) return `${trim(value / 100000)}L`;
  if (value >= 1000) return `${trim(value / 1000)}K`;
  return `${trim(value)}`;
}

const toNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export function getBounds(fd) {
  const min = toNumber(fd?.minimum, 0);
  let max = toNumber(fd?.maximum, min + 100);
  if (max <= min) max = min + 1;
  const splitsNum = Math.floor(toNumber(fd?.properties?.splits ?? fd?.splits, 0));
  const splits = splitsNum > 0 ? splitsNum : DEFAULT_SPLITS;
  return { min, max, splits };
}

export default async function decorate(fieldDiv, fd, container, formId) {
  const input = fieldDiv.querySelector('input');
  const { min, max, splits } = getBounds(fd);
  const splitSize = (max - min) / splits;
  const customStep = toNumber(fd?.properties?.stepValue ?? fd?.stepValue, 0);
  const step = customStep > 0 ? customStep : splitSize;

  const wrapper = document.createElement('div');
  wrapper.className = 'loan-slider-wrapper decorated';

  const header = document.createElement('div');
  header.className = 'loan-slider-header';
  const label = fieldDiv.querySelector('label');
  if (label) header.appendChild(label);
  const box = document.createElement('div');
  box.className = 'loan-slider-input';
  const symbol = document.createElement('span');
  symbol.className = 'loan-slider-currency';
  symbol.textContent = '₹';
  symbol.setAttribute('aria-hidden', 'true');
  box.append(symbol, input);
  header.appendChild(box);

  const track = document.createElement('div');
  track.className = 'loan-slider-track';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'loan-slider-range';
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = input.value !== '' ? input.value : min;
  slider.setAttribute('aria-label', label?.textContent || fd?.name || 'Loan amount');
  slider.disabled = input.disabled;

  const ticks = document.createElement('div');
  ticks.className = 'loan-slider-ticks';
  const labels = document.createElement('div');
  labels.className = 'loan-slider-labels';
  const labelEvery = Math.ceil(splits / (MAX_LABELS - 1));
  for (let i = 0; i <= splits; i += 1) {
    const pos = i / splits;
    if (i > 0 && i < splits) {
      const tick = document.createElement('span');
      tick.className = 'loan-slider-tick';
      tick.style.setProperty('--pos', pos);
      tick.dataset.value = min + i * splitSize;
      ticks.appendChild(tick);
    }
    if (i % labelEvery === 0 || i === splits) {
      const text = document.createElement('span');
      text.className = 'loan-slider-label';
      text.style.setProperty('--pos', pos);
      text.textContent = formatShort(min + i * splitSize);
      labels.appendChild(text);
    }
  }
  track.append(slider, ticks);
  wrapper.append(header, track, labels);
  fieldDiv.appendChild(wrapper);

  const paint = () => {
    const value = Number(slider.value);
    const pct = (value - min) / (max - min);
    track.style.setProperty('--pos', Math.min(Math.max(pct, 0), 1));
    ticks.querySelectorAll('.loan-slider-tick').forEach((tick) => {
      tick.classList.toggle('filled', Number(tick.dataset.value) <= value);
    });
  };

  const syncFromInput = () => {
    if (input.value === '') {
      slider.value = min;
    } else {
      // out of range typed values pin the thumb to the nearest end
      slider.value = Math.min(Math.max(Number(input.value), min), max);
    }
    paint();
  };

  slider.addEventListener('input', () => {
    input.value = slider.value;
    paint();
  });
  slider.addEventListener('change', () => {
    input.value = slider.value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  input.addEventListener('input', syncFromInput);
  input.addEventListener('change', syncFromInput);

  subscribe(fieldDiv, formId, (el, model, eventType, payload) => {
    if (eventType === 'register') {
      syncFromInput();
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change.propertyName === 'value') {
          syncFromInput();
        } else if (change.propertyName === 'enabled' || change.propertyName === 'readOnly') {
          slider.disabled = input.disabled || input.getAttribute('aria-readonly') === 'true';
        }
      });
    }
  }, { listenChanges: true });

  paint();
  return fieldDiv;
}
