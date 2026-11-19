/* global BigInt */
import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n) {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(' ');
}

function belowThousand(n) {
  const parts = [];
  if (n >= 100) parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
  if (n % 100) parts.push(belowHundred(n % 100));
  return parts.join(' ');
}

/**
 * Converts a non-negative integer to words using the Indian numbering system.
 * @param {bigint} num
 * @returns {string}
 */
function integerToWords(num) {
  if (num === 0n) return 'Zero';
  const crore = num / 10000000n;
  const lakh = Number((num / 100000n) % 100n);
  const thousand = Number((num / 1000n) % 100n);
  const rest = Number(num % 1000n);
  const parts = [];
  if (crore > 0n) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

/**
 * Converts an amount (number or numeric string, max 2 decimals) to Indian Rupee words.
 * Returns an empty string for empty or invalid input.
 * @param {string|number} value
 * @returns {string}
 */
export function amountToWords(value) {
  const str = String(value ?? '').replace(/,/g, '').trim();
  const match = /^(\d*)(?:\.(\d*))?$/.exec(str);
  if (!str || !match || (!match[1] && !match[2])) return '';
  const rupees = BigInt(match[1] || '0');
  const paise = Number(`${match[2] || ''}00`.slice(0, 2));
  const parts = [];
  if (rupees > 0n || paise === 0) {
    parts.push(`${integerToWords(rupees)} ${rupees === 1n ? 'Rupee' : 'Rupees'}`);
  }
  if (paise > 0) parts.push(`${belowHundred(paise)} Paise`);
  return `${parts.join(' and ')} Only`;
}

function sanitize(raw) {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [intPart, ...decimals] = cleaned.split('.');
  return decimals.length ? `${intPart}.${decimals.join('').slice(0, 2)}` : intPart;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.removeAttribute('step');

  const group = document.createElement('div');
  group.className = 'inr-input-group';
  const symbol = document.createElement('span');
  symbol.className = 'inr-input-symbol';
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = '₹';
  input.before(group);
  group.append(symbol, input);

  const wordsId = `${input.id || fieldJson.id}-words`;
  const wordsWrapper = document.createElement('div');
  wordsWrapper.className = 'inr-input-words-wrapper';
  const wordsLabel = document.createElement('label');
  wordsLabel.className = 'inr-input-words-label';
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

  const anchor = fieldDiv.querySelector('.field-description, .field-description-container');
  if (anchor) anchor.before(wordsWrapper);
  else group.after(wordsWrapper);

  const update = (value) => {
    words.value = amountToWords(value);
  };

  input.addEventListener('input', () => {
    const cleaned = sanitize(input.value);
    if (cleaned !== input.value) input.value = cleaned;
    update(cleaned);
  });

  subscribe(fieldDiv, formId, (_, fieldModel, eventType, payload) => {
    // model changes made outside typing (rules, reset, default value)
    const changed = eventType === 'register'
      || (eventType === 'change' && payload?.changes?.some((c) => c.propertyName === 'value'));
    if (changed && document.activeElement !== input) {
      update(fieldModel.value ?? input.value);
    }
  }, { listenChanges: true });

  update(input.value);
  return fieldDiv;
}
