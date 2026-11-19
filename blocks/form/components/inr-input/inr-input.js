import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowThousand(n) {
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` ${ONES[rest % 10]}` : ''}`);
  return parts.join(' ');
}

function integerToWords(digits) {
  const str = digits.replace(/^0+(?=\d)/, '');
  if (/^0*$/.test(str)) return 'Zero';
  const thousandPart = Number(str.slice(-3));
  let rest = str.slice(0, -3);
  const parts = [];
  const small = [];
  ['Thousand', 'Lakh'].forEach((name) => {
    const chunk = Number(rest.slice(-2) || 0);
    rest = rest.slice(0, -2);
    if (chunk) small.push(`${belowThousand(chunk)} ${name}`);
  });
  // everything above Lakh is expressed in Crores (e.g. "One Hundred Crore")
  if (rest) parts.push(`${integerToWords(rest)} Crore`);
  parts.push(...small.reverse());
  if (thousandPart) parts.push(belowThousand(thousandPart));
  return parts.join(' ');
}

/**
 * Converts an amount string to words in the Indian numbering system.
 * @param {string|number} amount
 * @returns {string} e.g. "Rupees One Lakh and Fifty Paise Only", or '' when invalid/empty
 */
export function amountToWords(amount) {
  const text = `${amount ?? ''}`.replace(/,/g, '').trim();
  if (!/^\d*\.?\d*$/.test(text) || !/\d/.test(text)) return '';
  const [intPart = '', decPart = ''] = text.split('.');
  const rupees = intPart.replace(/^0+(?=\d)/, '') || '0';
  const paise = Number(`${decPart}00`.slice(0, 2));
  if (rupees === '0' && paise === 0) return '';
  const segments = [];
  if (rupees !== '0') segments.push(`Rupees ${integerToWords(rupees)}`);
  if (paise) segments.push(`${integerToWords(String(paise))} Paise`);
  return `${segments.join(' and ')} Only`;
}

function sanitize(raw) {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [intPart, ...rest] = cleaned.split('.');
  return rest.length ? `${intPart}.${rest.join('').slice(0, 2)}` : intPart;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;
  fieldDiv.classList.add('inr-input');
  input.setAttribute('inputmode', 'decimal');
  input.setAttribute('autocomplete', 'off');

  const group = document.createElement('div');
  group.className = 'inr-input-group';
  const symbol = document.createElement('span');
  symbol.className = 'inr-input-symbol';
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = '₹';
  input.before(group);
  group.append(symbol, input);

  const wordsId = `${fieldJson.id || input.id}-words`;
  const wordsWrapper = document.createElement('div');
  wordsWrapper.className = 'inr-input-words-wrapper';
  const wordsLabel = document.createElement('label');
  wordsLabel.className = 'inr-input-words-label';
  wordsLabel.htmlFor = wordsId;
  wordsLabel.textContent = fieldJson.properties?.wordsLabel || 'Amount (in words)';
  const words = document.createElement('input');
  words.type = 'text';
  words.id = wordsId;
  words.className = 'inr-input-words';
  words.readOnly = true;
  words.tabIndex = -1;
  words.setAttribute('aria-live', 'polite');
  wordsWrapper.append(wordsLabel, words);
  const description = fieldDiv.querySelector('.field-description');
  (description || group).after(wordsWrapper);

  const render = (value) => { words.value = amountToWords(value); };

  // live update; model.value still commits on the native change (blur)
  input.addEventListener('input', () => {
    const clean = sanitize(input.value);
    if (clean !== input.value) input.value = clean;
    render(clean);
  });

  render(input.value);

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      render(fieldModel.value ?? input.value);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') render(change.currentValue);
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
