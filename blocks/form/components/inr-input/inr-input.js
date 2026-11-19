import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const MAX_INTEGER_DIGITS = 15;

function belowHundred(n) {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(' ');
}

function belowThousand(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', belowHundred(rest)].filter(Boolean).join(' ');
}

/**
 * Converts a non-negative integer to words using the Indian numbering system.
 * @param {number} n integer (safe up to 15 digits)
 * @returns {string} words, empty string for 0
 */
function integerToWords(n) {
  if (n === 0) return '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  return [
    crore ? `${integerToWords(crore)} Crore` : '',
    lakh ? `${belowHundred(lakh)} Lakh` : '',
    thousand ? `${belowHundred(thousand)} Thousand` : '',
    rest ? belowThousand(rest) : '',
  ].filter(Boolean).join(' ');
}

/**
 * Converts an amount (string or number) to Indian Rupees and Paise in words.
 * @param {string|number} amount e.g. "123456.50"
 * @returns {string} e.g. "Rupees One Lakh Twenty Three Thousand ... and Fifty Paise Only"
 */
export function amountToWords(amount) {
  const text = String(amount ?? '').replace(/,/g, '').trim();
  if (!/^\d*\.?\d*$/.test(text) || text === '' || text === '.') return '';
  const [intPart = '', fraction = ''] = text.split('.');
  const rupees = Number(intPart.slice(0, MAX_INTEGER_DIGITS) || 0);
  const paise = Number(`${fraction}00`.slice(0, 2));
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';
  const parts = [];
  if (rupees > 0) parts.push(`Rupees ${integerToWords(rupees)}`);
  if (paise > 0) parts.push(`${rupees > 0 ? 'and ' : ''}${belowHundred(paise)} Paise`);
  return `${parts.join(' ')} Only`;
}

/**
 * Keeps digits and at most one decimal point with up to two decimal places.
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeAmount(raw) {
  const cleaned = String(raw ?? '').replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned.slice(0, MAX_INTEGER_DIGITS);
  const integer = cleaned.slice(0, dot).slice(0, MAX_INTEGER_DIGITS);
  const fraction = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return `${integer}.${fraction}`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;

  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';

  // wrap the input with a rupee prefix
  const group = document.createElement('div');
  group.className = 'inr-input-group';
  const symbol = document.createElement('span');
  symbol.className = 'inr-input-symbol';
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = '₹';
  input.before(group);
  group.append(symbol, input);

  const wordsId = `${fieldJson?.id || input.id}-words`;
  const wordsWrapper = document.createElement('div');
  wordsWrapper.className = 'inr-input-words';
  const wordsLabel = document.createElement('label');
  wordsLabel.className = 'field-label inr-input-words-label';
  wordsLabel.setAttribute('for', wordsId);
  wordsLabel.textContent = fieldJson?.properties?.wordsLabel || 'Amount (in words)';
  const words = document.createElement('input');
  words.type = 'text';
  words.id = wordsId;
  words.className = 'inr-input-words-output';
  words.readOnly = true;
  words.tabIndex = -1;
  words.setAttribute('aria-live', 'polite');
  const badge = document.createElement('span');
  badge.className = 'inr-input-readonly';
  badge.textContent = 'Read-only';
  wordsWrapper.append(wordsLabel, words, badge);
  group.after(wordsWrapper);

  const updateWords = (value) => {
    words.value = amountToWords(value);
  };

  let model = null;
  // commit on every keystroke so that rules and the words field stay live
  input.addEventListener('input', () => {
    const clean = sanitizeAmount(input.value);
    if (clean !== input.value) input.value = clean;
    updateWords(clean);
    if (model && model.value !== clean) model.value = clean;
  });

  subscribe(fieldDiv, formId, (_el, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      updateWords(input.value || fieldModel.value);
    } else if (eventType === 'change') {
      const change = payload?.changes?.find((c) => c.propertyName === 'value');
      if (change) {
        const next = sanitizeAmount(change.currentValue);
        if (input.value !== next && document.activeElement !== input) input.value = next;
        updateWords(next);
      }
    }
  }, { listenChanges: true });

  updateWords(input.value);
  return fieldDiv;
}
