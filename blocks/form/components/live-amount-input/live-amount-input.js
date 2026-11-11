import { subscribe } from '../../rules/index.js';

const SMALL = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const AMOUNT_PATTERN = /^(?:(?:\d{1,9}|[1-9]\d{0,2}(?:,\d{3}){1,2}|[1-9]\d?(?:,\d{2}){0,2},\d{3})(?:\.\d{0,2})?|\.\d{1,2})$/;
const AMOUNT_ERROR = 'Enter an amount from 0 to 99,99,99,999.99 with at most two decimal places.';

function integerInWords(value) {
  if (value < 20) return SMALL[value];
  if (value < 100) return `${TENS[Math.floor(value / 10)]}${value % 10 ? ` ${SMALL[value % 10]}` : ''}`;
  const scales = [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand'], [100, 'Hundred']];
  const [scale, label] = scales.find(([size]) => value >= size);
  const rest = value % scale;
  return `${integerInWords(Math.floor(value / scale))} ${label}${rest ? ` ${integerInWords(rest)}` : ''}`;
}

export function describeAmount(value) {
  const text = String(value ?? '');
  if (!text) return { words: '', error: '' };
  if (!AMOUNT_PATTERN.test(text)) return { words: '', error: AMOUNT_ERROR };
  const [whole, fraction = ''] = text.replaceAll(',', '').split('.');
  const rupees = Number(whole);
  const paise = Number(fraction.padEnd(2, '0'));
  const words = `Rupees ${integerInWords(rupees)}${paise ? ` and ${integerInWords(paise)} Paise` : ''} Only`;
  return { words, error: '' };
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  const { heading = 'live-amount-input', wordsLabel = 'Amount (in words)' } = fieldJson.properties || {};
  fieldDiv.classList.add('live-amount-input');
  input.classList.add('live-amount-input-value');
  input.inputMode = 'decimal';

  const header = document.createElement('div');
  header.className = 'live-amount-input-header';
  const title = document.createElement('h3');
  title.textContent = heading;
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Amount input with live amount-in-words update';
  header.append(title, subtitle);
  fieldDiv.prepend(header);

  const entry = document.createElement('div');
  entry.className = 'live-amount-input-entry';
  const prefix = document.createElement('span');
  prefix.className = 'live-amount-input-currency';
  prefix.textContent = '\u20b9';
  prefix.setAttribute('aria-hidden', 'true');
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'live-amount-input-clear';
  clear.setAttribute('aria-label', 'Clear amount');
  clear.textContent = '\u00d7';
  input.before(entry);
  entry.append(prefix, input, clear);

  const error = document.createElement('p');
  error.className = 'live-amount-input-error';
  error.id = `${input.id}-amount-error`;
  error.setAttribute('aria-live', 'polite');
  error.hidden = true;
  const describedBy = [input.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' ');
  input.setAttribute('aria-describedby', describedBy);

  const result = document.createElement('div');
  result.className = 'live-amount-input-result';
  const label = document.createElement('label');
  label.htmlFor = `${input.id}-words`;
  label.textContent = wordsLabel;
  const words = document.createElement('input');
  words.id = label.htmlFor;
  words.type = 'text';
  words.readOnly = true;
  words.className = 'live-amount-input-words';
  const status = document.createElement('span');
  status.className = 'live-amount-input-status';
  status.setAttribute('role', 'status');
  const note = document.createElement('div');
  note.className = 'live-amount-input-note';
  const lock = document.createElement('span');
  lock.className = 'live-amount-input-lock';
  lock.setAttribute('aria-hidden', 'true');
  note.append(lock, 'Read-only');
  result.append(label, words, status, note);
  entry.after(error, result);

  let model;
  const update = () => {
    const description = describeAmount(input.value);
    words.value = description.words;
    status.textContent = description.words;
    error.textContent = description.error;
    error.hidden = !description.error;
    input.setCustomValidity(description.error);
    if (description.error) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    clear.disabled = input.disabled || input.readOnly;
    clear.hidden = !input.value;
  };
  const commit = () => {
    if (input.disabled || input.readOnly) return;
    if (model && model.value !== input.value) model.value = input.value;
    update();
  };
  input.addEventListener('input', commit);
  clear.addEventListener('click', () => {
    if (input.disabled || input.readOnly) return;
    input.value = '';
    commit();
    input.focus();
  });
  // The derived input must never write its text into the amount's model.
  words.addEventListener('change', (event) => event.stopPropagation());

  subscribe(fieldDiv, formId, (_element, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      input.value = model.value ?? '';
    } else if (eventType === 'change') {
      payload?.changes?.forEach(({ propertyName, currentValue }) => {
        if (propertyName === 'value') input.value = currentValue ?? '';
      });
    }
    input.readOnly = fieldModel.readOnly === true;
    input.disabled = fieldModel.enabled === false;
    update();
  }, { listenChanges: true });

  update();
  return fieldDiv;
}
