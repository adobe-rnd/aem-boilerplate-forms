/* global BigInt */
import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
  'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const MAX_INTEGER_DIGITS = 15;

function belowThousand(n) {
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) {
    parts.push(rest < 20 ? ONES[rest] : [TENS[Math.floor(rest / 10)], ONES[rest % 10]].filter(Boolean).join(' '));
  }
  return parts.join(' ');
}

/**
 * Converts a non-negative integer to words using the Indian numbering system.
 * @param {number|bigint} num
 * @returns {string}
 */
export function integerToIndianWords(num) {
  let n = BigInt(num);
  if (n === 0n) return 'Zero';
  const parts = [];
  const crores = n / 10000000n;
  n %= 10000000n;
  if (crores > 0n) {
    parts.push(`${crores >= 1000n ? integerToIndianWords(crores) : belowThousand(Number(crores))} Crore`);
  }
  const lakhs = Number(n / 100000n);
  n %= 100000n;
  if (lakhs) parts.push(`${belowThousand(lakhs)} Lakh`);
  const thousands = Number(n / 1000n);
  n %= 1000n;
  if (thousands) parts.push(`${belowThousand(thousands)} Thousand`);
  if (n > 0n) parts.push(belowThousand(Number(n)));
  return parts.join(' ');
}

/**
 * Converts an amount (string or number) to Indian Rupees and Paise in words.
 * Returns an empty string for empty, invalid, negative or too large values.
 * @param {string|number} value
 * @returns {string}
 */
export function amountToWords(value) {
  const str = String(value ?? '').replace(/,/g, '').trim();
  if (!/^(\d+\.?\d*|\.\d+)$/.test(str)) return '';
  const [intPart = '', decPart = ''] = str.split('.');
  const integerDigits = intPart.replace(/^0+/, '');
  if (integerDigits.length > MAX_INTEGER_DIGITS) return '';
  // Round half up to paise using the third decimal digit, without float arithmetic
  let total = BigInt(integerDigits || '0') * 100n + BigInt(`${decPart}00`.slice(0, 2));
  if (decPart.length > 2 && decPart[2] >= '5') total += 1n;
  const rupees = total / 100n;
  const paise = Number(total % 100n);
  if (total === 0n) return 'Zero Rupees Only';
  const result = [];
  if (rupees > 0n) result.push(`${integerToIndianWords(rupees)} ${rupees === 1n ? 'Rupee' : 'Rupees'}`);
  if (paise > 0) result.push(`${belowThousand(paise)} Paise`);
  return `${result.join(' and ')} Only`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;

  const id = fieldJson?.id;
  const wordsId = `${id}-words`;

  const group = document.createElement('div');
  group.className = 'inr-input-group';
  const symbol = document.createElement('span');
  symbol.className = 'inr-input-symbol';
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = '₹';
  input.before(group);
  group.append(symbol, input);
  input.step = input.step && input.step !== 'any' ? input.step : '0.01';
  input.inputMode = 'decimal';

  const wordsWrapper = document.createElement('div');
  wordsWrapper.className = 'inr-input-words-wrapper';
  const wordsLabel = document.createElement('label');
  wordsLabel.className = 'field-label inr-input-words-label';
  wordsLabel.htmlFor = wordsId;
  wordsLabel.textContent = fieldJson?.properties?.wordsLabel || 'Amount (in words)';
  const words = document.createElement('input');
  words.type = 'text';
  words.id = wordsId;
  words.className = 'inr-input-words';
  words.readOnly = true;
  words.tabIndex = -1;
  words.setAttribute('aria-live', 'polite');
  wordsWrapper.append(wordsLabel, words);
  const description = fieldDiv.querySelector('.field-description');
  if (description) description.before(wordsWrapper);
  else fieldDiv.append(wordsWrapper);

  const update = (value) => {
    const text = amountToWords(value);
    if (words.value !== text) words.value = text;
    words.title = text;
  };

  // Live update while typing; model.value is still committed by the native change event on blur
  input.addEventListener('input', () => update(input.value));
  update(input.value);

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      update(fieldModel.value);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') update(change.currentValue);
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
