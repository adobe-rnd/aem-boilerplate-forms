import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowThousand(n) {
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) {
    parts.push(rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` ${ONES[rest % 10]}` : ''}`);
  }
  return parts.join(' ');
}

function integerToWords(digits) {
  const stripped = digits.replace(/^0+/, '');
  if (!stripped) return 'Zero';
  const parts = [];
  const crores = stripped.slice(0, -7);
  let n = Number(stripped.slice(-7));
  // crores can exceed 99, so they are expressed recursively
  if (crores) parts.push(`${integerToWords(crores)} Crore`);
  [[100000, 'Lakh'], [1000, 'Thousand']].forEach(([size, name]) => {
    const q = Math.floor(n / size);
    n %= size;
    if (q) parts.push(`${belowThousand(q)} ${name}`);
  });
  if (n > 0) parts.push(belowThousand(n));
  return parts.join(' ');
}

/**
 * Sanitizes raw user text to digits with at most one decimal point and two decimals.
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeAmount(raw) {
  const cleaned = String(raw ?? '').replace(/[^\d.]/g, '');
  const [whole, ...fraction] = cleaned.split('.');
  if (!fraction.length) return whole;
  return `${whole}.${fraction.join('').slice(0, 2)}`;
}

/**
 * Converts an amount to words using the Indian numbering system.
 * @param {string|number} value
 * @returns {string} words, or an empty string for empty/invalid input
 */
export function amountToWords(value) {
  const text = sanitizeAmount(String(value ?? '').replace(/,/g, ''));
  if (!/\d/.test(text)) return '';
  const [whole = '', fraction = ''] = text.split('.');
  const rupees = whole.replace(/^0+(?=\d)/, '') || '0';
  const paise = Number(fraction.padEnd(2, '0').slice(0, 2));
  if (rupees === '0' && paise === 0) return 'Zero Rupees Only';
  const parts = [];
  if (rupees !== '0') parts.push(`${integerToWords(rupees)} ${rupees === '1' ? 'Rupee' : 'Rupees'}`);
  if (paise) parts.push(`${belowThousand(paise)} Paise`);
  return `${parts.join(' and ')} Only`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input || fieldDiv.querySelector('.inr-input-group')) return fieldDiv;

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

  const wordsId = `${input.id}-words`;
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
  group.after(wordsWrapper);

  const lock = document.createElement('div');
  lock.className = 'inr-input-readonly-hint';
  lock.textContent = 'Read-only';
  wordsWrapper.append(lock);

  const render = (text) => {
    words.value = amountToWords(text);
  };

  let model = null;

  input.addEventListener('input', () => {
    const clean = sanitizeAmount(input.value);
    if (clean !== input.value) input.value = clean;
    render(clean);
    // commit per keystroke so rules see the live amount; skip when unchanged
    if (model && model.value !== clean) model.value = clean;
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      render(input.value);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') {
          const next = change.currentValue == null ? '' : String(change.currentValue);
          if (sanitizeAmount(input.value) !== next) input.value = next;
          render(next);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
