import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const MAX_INTEGER_DIGITS = 13;

function belowHundred(n) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function belowThousand(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', belowHundred(rest)].filter(Boolean).join(' ');
}

/** Converts a non-negative integer to words using the Indian system (Thousand, Lakh, Crore). */
export function integerToWords(num) {
  let n = Math.floor(num);
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  // crore can exceed 99, so it is spoken recursively
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  [[100000, 'Lakh'], [1000, 'Thousand']].forEach(([unit, name]) => {
    const count = Math.floor(n / unit);
    if (count) parts.push(`${belowHundred(count)} ${name}`);
    n %= unit;
  });
  if (n) parts.push(belowThousand(n));
  return parts.join(' ');
}

/** Converts an amount string like "1,23,456.50" to words; '' for empty or invalid input. */
export function amountToWords(value) {
  const cleaned = String(value ?? '').replace(/[,\s₹]/g, '');
  if (!/^\d*\.?\d*$/.test(cleaned) || !/\d/.test(cleaned)) return '';
  const [intPart = '', decPart = ''] = cleaned.split('.');
  const rupees = Number(intPart.slice(0, MAX_INTEGER_DIGITS) || 0);
  const paise = Number(decPart.padEnd(2, '0').slice(0, 2));
  const rupeeWords = `${integerToWords(rupees)} ${rupees === 1 ? 'Rupee' : 'Rupees'}`;
  if (!paise) return `${rupeeWords} Only`;
  const paiseWords = `${integerToWords(paise)} Paise`;
  return rupees ? `${rupeeWords} and ${paiseWords} Only` : `${paiseWords} Only`;
}

/** Keeps digits and a single decimal point, with at most two decimals. */
export function sanitizeAmount(raw) {
  const cleaned = String(raw ?? '').replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot < 0) return cleaned.slice(0, MAX_INTEGER_DIGITS);
  const intPart = cleaned.slice(0, dot).slice(0, MAX_INTEGER_DIGITS);
  const decPart = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return `${intPart}.${decPart}`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;
  fieldDiv.classList.add('inr-input-wrapper');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';

  const group = document.createElement('div');
  group.className = 'inr-input-group';
  const symbol = document.createElement('span');
  symbol.className = 'inr-input-symbol';
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = '₹';
  input.after(group);
  group.append(symbol, input);

  const words = document.createElement('div');
  words.className = 'inr-input-words';
  const wordsId = `${input.id || fieldJson.id}-words`;
  const label = document.createElement('label');
  label.className = 'inr-input-words-label';
  label.htmlFor = wordsId;
  label.textContent = fieldJson?.properties?.wordsLabel || 'Amount (in words)';
  const output = document.createElement('input');
  output.type = 'text';
  output.id = wordsId;
  output.className = 'inr-input-words-output';
  output.readOnly = true;
  output.tabIndex = -1;
  words.append(label, output);
  group.after(words);

  const update = (value) => {
    output.value = amountToWords(value);
  };

  input.addEventListener('input', () => {
    const clean = sanitizeAmount(input.value);
    if (clean !== input.value) input.value = clean;
    update(clean);
  });

  subscribe(fieldDiv, formId, (_element, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      update(fieldModel.value);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change.propertyName === 'value') update(change.currentValue);
      });
    }
  }, { listenChanges: true });

  update(input.value);
  return fieldDiv;
}
