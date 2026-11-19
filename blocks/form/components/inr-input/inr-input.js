import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
  'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

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
 * Crore is applied recursively, so 100 crore reads "One Hundred Crore".
 * @param {number} n
 * @returns {string}
 */
function integerToWords(n) {
  if (n === 0) return 'Zero';
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
 * Converts an amount string (for example "1234.5") to Rupees and Paise in words.
 * Works on the string so that no floating point rounding is involved; digits beyond
 * two decimals are ignored.
 * @param {string|number} amount
 * @returns {string} words, or an empty string when the amount is empty or invalid.
 */
export function amountToWords(amount) {
  const text = String(amount ?? '').trim();
  if (!/^\d*\.?\d*$/.test(text) || !/\d/.test(text)) return '';
  const [intPart = '', fracPart = ''] = text.split('.');
  const rupees = Number(intPart || '0');
  const paise = Number(`${fracPart}00`.slice(0, 2));
  if (!Number.isSafeInteger(rupees)) return '';
  const parts = [];
  if (rupees > 0 || paise === 0) {
    parts.push(`${integerToWords(rupees)} ${rupees === 1 ? 'Rupee' : 'Rupees'}`);
  }
  if (paise > 0) {
    parts.push(`${integerToWords(paise)} Paise`);
  }
  return `${parts.join(' and ')} Only`;
}

/** Keeps digits and a single decimal point, with at most two decimal places. */
function sanitize(raw) {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return `${cleaned.slice(0, dot)}.${cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';

  const group = document.createElement('div');
  group.className = 'inr-input-group';
  const symbol = document.createElement('span');
  symbol.className = 'inr-input-symbol';
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = '₹';
  input.before(group);
  group.append(symbol, input);

  const wordsId = `${fieldJson.id}-words`;
  const words = document.createElement('div');
  words.className = 'inr-input-words';
  const wordsLabel = document.createElement('label');
  wordsLabel.className = 'field-label';
  wordsLabel.setAttribute('for', wordsId);
  wordsLabel.textContent = fieldJson?.properties?.wordsLabel || 'Amount (in words)';
  const output = document.createElement('output');
  output.id = wordsId;
  output.className = 'inr-input-words-value';
  output.setAttribute('aria-live', 'polite');
  words.append(wordsLabel, output);
  group.after(words);

  const updateWords = () => {
    output.textContent = amountToWords(input.value);
  };

  let model = null;
  const toModelValue = (text) => (/\d/.test(text) ? Number(text) : null);

  // commit on every keystroke so that rules see the live value
  input.addEventListener('input', () => {
    const cleaned = sanitize(input.value);
    if (cleaned !== input.value) input.value = cleaned;
    updateWords();
    const next = toModelValue(cleaned);
    if (model && model.value !== next) model.value = next;
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
    }
    const incoming = eventType === 'register'
      ? { currentValue: fieldModel.value }
      : payload?.changes?.find((c) => c?.propertyName === 'value');
    if (incoming) {
      const value = incoming.currentValue;
      if (toModelValue(input.value) !== (value ?? null)) {
        input.value = value === null || value === undefined ? '' : String(value);
      }
      updateWords();
    }
  }, { listenChanges: true });

  updateWords();
  return fieldDiv;
}
