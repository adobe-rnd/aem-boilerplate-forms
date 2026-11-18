import { subscribe } from '../../rules/index.js';

const RANGES = [
  { name: 'low', label: 'Not likely', color: '#f2546b' },
  { name: 'middle', label: 'May be', color: '#ffa12f' },
  { name: 'high', label: 'Very likely', color: '#25b783' },
];

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  const label = fieldDiv.querySelector('.field-label');
  const properties = fieldJson.properties || {};
  const lowMax = Number(properties.lowMax ?? 6);
  const middleMax = Number(properties.middleMax ?? 8);
  if (!Number.isInteger(lowMax) || !Number.isInteger(middleMax)
    || lowMax < 0 || middleMax <= lowMax || middleMax > 9) {
    throw new Error('NPS rating requires integer thresholds: 0 <= lowMax < middleMax <= 9.');
  }

  fieldDiv.classList.add('nps-rating');
  input.hidden = true;
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  if (label) {
    label.id = `${input.id}-nps-label`;
    label.removeAttribute('for');
  }

  const scale = document.createElement('div');
  scale.className = 'nps-rating-scale';
  scale.setAttribute('role', 'radiogroup');
  if (label) scale.setAttribute('aria-labelledby', label.id);
  else scale.setAttribute('aria-label', fieldJson.name || 'Recommendation score');

  const legend = document.createElement('div');
  legend.className = 'nps-rating-legend';
  const counts = [lowMax + 1, middleMax - lowMax, 10 - middleMax];
  RANGES.forEach((range, index) => {
    const color = properties[`${range.name}Color`] ?? range.color;
    if (!CSS.supports('color', color)) {
      throw new Error(`Invalid NPS rating color: ${range.name}Color.`);
    }
    fieldDiv.style.setProperty(`--nps-${range.name}-color`, color);
    const segment = document.createElement('div');
    segment.className = `nps-rating-segment nps-rating-${range.name}`;
    segment.style.gridColumn = `span ${counts[index]}`;
    const text = document.createElement('span');
    text.id = `${input.id}-nps-${range.name}`;
    text.textContent = properties[`${range.name}Label`] ?? range.label;
    segment.append(text);
    legend.append(segment);
  });

  let model;
  const buttons = Array.from({ length: 11 }, (_, score) => {
    const button = document.createElement('button');
    let range = 'high';
    if (score <= lowMax) range = 'low';
    else if (score <= middleMax) range = 'middle';
    button.type = 'button';
    button.className = `nps-rating-score nps-rating-${range}`;
    button.textContent = score;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-describedby', `${input.id}-nps-${range}`);
    button.addEventListener('click', () => {
      if (model && model.enabled !== false && model.readOnly !== true && model.value !== score) {
        model.value = score;
      }
    });
    scale.append(button);
    return button;
  });

  const render = (state) => {
    const { value } = state;
    const number = value !== null && value !== undefined && value !== '' ? Number(value) : NaN;
    const selected = Number.isInteger(number) && number >= 0 && number <= 10 ? number : -1;
    const disabled = state.enabled === false || state.readOnly === true;
    buttons.forEach((button, score) => {
      button.setAttribute('aria-checked', String(score === selected));
      button.disabled = disabled;
      button.tabIndex = score === (selected === -1 ? 0 : selected) ? 0 : -1;
    });
    scale.setAttribute('aria-required', String(state.required === true));
    scale.setAttribute('aria-invalid', String(state.valid === false));
    const description = fieldDiv.querySelector('.field-description');
    if (description?.id) scale.setAttribute('aria-describedby', description.id);
    else scale.removeAttribute('aria-describedby');
  };

  scale.addEventListener('keydown', (event) => {
    const current = buttons.indexOf(event.target);
    if (current < 0 || !model || model.enabled === false || model.readOnly === true) return;
    const next = {
      ArrowRight: (current + 1) % 11,
      ArrowDown: (current + 1) % 11,
      ArrowLeft: (current + 10) % 11,
      ArrowUp: (current + 10) % 11,
      Home: 0,
      End: 10,
    }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      buttons[next].focus();
      buttons[next].click();
    }
  });

  input.after(scale, legend);
  render(fieldJson);
  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType) => {
    if (eventType === 'register') model = fieldModel;
    if (eventType === 'register' || eventType === 'change') render(fieldModel);
  }, { listenChanges: true });

  return fieldDiv;
}
