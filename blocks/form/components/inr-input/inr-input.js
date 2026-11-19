/* global BigInt */
import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
  'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim();
}

function belowThousand(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', belowHundred(rest)].filter(Boolean).join(' ');
}

/**
 * Converts a non-negative integer to words using the Indian numbering system.
 * Crore is the largest unit, so larger values read e.g. "One Hundred Crore".
 * @param {bigint} num
 * @returns {string}
 */
function integerToWords(num) {
  if (num === 0n) return 'Zero';
  const crore = num / 10000000n;
  const rest = Number(num % 10000000n);
  const parts = [];
  if (crore > 0n) {
    parts.push(`${crore >= 100n ? integerToWords(crore) : belowHundred(Number(crore))} Crore`);
  }
  [[Math.floor(rest / 100000), 'Lakh'], [Math.floor((rest % 100000) / 1000), 'Thousand']]
    .forEach(([n, unit]) => {
      if (n) parts.push(`${belowHundred(n)} ${unit}`);
    });
  const last = rest % 1000;
  if (last) parts.push(belowThousand(last));
  return parts.join(' ');
}

/**
 * Converts an amount to words in Rupees and Paise, e.g.
 * 1234.5 -> "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only".
 * Returns an empty string for empty, negative or non-numeric input.
 * Digits beyond two decimal places are truncated.
 * @param {string|number} amount
 * @returns {string}
 */
export function amountToWords(amount) {
  const str = String(amount ?? '').trim();
  if (!/^\d*\.?\d*$/.test(str) || !/\d/.test(str)) return '';
  const [intPart = '', decPart = ''] = str.split('.');
  const rupees = BigInt(intPart || '0');
  const paise = Number(decPart.padEnd(2, '0').slice(0, 2));
  if (rupees === 0n && paise === 0) return 'Rupees Zero Only';
  const rupeeWords = rupees > 0n ? `Rupees ${integerToWords(rupees)}` : '';
  const paiseWords = paise > 0 ? `${belowHundred(paise)} Paise` : '';
  return `${[rupeeWords, paiseWords].filter(Boolean).join(' and ')} Only`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;
  fieldDiv.classList.add('inr-input-wrapper');
  input.type = 'number';
  input.step = 'any';
  input.min = input.min || '0';
  input.inputMode = 'decimal';

  const group = document.createElement('div');
  group.className = 'inr-input-group';
  const symbol = document.createElement('span');
  symbol.className = 'inr-input-symbol';
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = '₹';
  input.after(group);
  group.append(symbol, input);

  const wordsId = `${input.id || fieldJson?.id || 'inr'}-words`;
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
  fieldDiv.append(wordsWrapper);

  const update = (value) => {
    const text = amountToWords(value);
    if (words.value !== text) words.value = text;
  };

  input.addEventListener('input', () => update(input.value));
  update(input.value);

  // keeps the words in sync with values set by rules or prefill
  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      update(fieldModel.value ?? input.value);
    } else if (eventType === 'change'
      && payload?.changes?.some((c) => c.propertyName === 'value')) {
      update(fieldModel.value);
    }
  }, { listenChanges: true });

  return fieldDiv;
}
