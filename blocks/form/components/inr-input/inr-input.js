import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const MAX_INTEGER_DIGITS = 15;

function belowThousand(n) {
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest < 20) {
    if (rest) parts.push(ONES[rest]);
  } else {
    parts.push(`${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` ${ONES[rest % 10]}` : ''}`);
  }
  return parts.join(' ');
}

function integerToWords(value) {
  let n = Number(value);
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const parts = [];
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  const rest = n % 1000;
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

/**
 * Converts an amount to words using the Indian numbering system.
 * @param {string|number} amount - e.g. "1,23,456.50"
 * @returns {string} e.g. "Rupees One Lakh ... and Fifty Paise Only", or '' when not a valid amount
 */
export function amountToWords(amount) {
  const text = String(amount ?? '').replace(/[₹,\s]/g, '');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return '';
  const [intPart = '', decPart = ''] = text.split('.');
  const rupees = Number(intPart || '0');
  const paise = Number(`${decPart}00`.slice(0, 2));
  if (rupees === 0 && paise === 0) return '';
  const parts = [];
  if (rupees > 0) parts.push(`Rupees ${integerToWords(rupees)}`);
  if (paise > 0) parts.push(`${rupees > 0 ? 'and ' : ''}${belowThousand(paise)} Paise`);
  return `${parts.join(' ')} Only`;
}

/** Formats a plain numeric string with Indian digit grouping (12,34,567.5). */
export function formatIndian(raw) {
  const [intPart, decPart] = raw.split('.');
  let grouped = intPart;
  if (intPart.length > 3) {
    grouped = `${intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${intPart.slice(-3)}`;
  }
  return decPart === undefined ? grouped : `${grouped}.${decPart}`;
}

/** Keeps digits and a single decimal point, with at most two decimals. */
export function sanitizeAmount(text) {
  const cleaned = String(text ?? '').replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned.slice(0, MAX_INTEGER_DIGITS);
  const intPart = cleaned.slice(0, dot).slice(0, MAX_INTEGER_DIGITS);
  const decPart = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return `${intPart}.${decPart}`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;
  const id = fieldJson?.id || input.id;
  const wordsLabelText = fieldJson?.properties?.wordsLabel || 'Amount (in words)';
  let model = null;

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

  const wordsWrapper = document.createElement('div');
  wordsWrapper.className = 'inr-input-words-wrapper';
  const wordsId = `${id}-words`;
  const wordsLabel = document.createElement('label');
  wordsLabel.className = 'field-label inr-input-words-label';
  wordsLabel.htmlFor = wordsId;
  wordsLabel.textContent = wordsLabelText;
  const words = document.createElement('input');
  words.type = 'text';
  words.id = wordsId;
  words.className = 'inr-input-words';
  words.readOnly = true;
  words.tabIndex = -1;
  words.setAttribute('aria-live', 'polite');
  const hint = document.createElement('div');
  hint.className = 'inr-input-readonly';
  hint.textContent = 'Read-only';
  wordsWrapper.append(wordsLabel, words, hint);
  group.after(wordsWrapper);

  const rawValue = () => input.value.replace(/,/g, '');
  const updateWords = (raw) => {
    const text = amountToWords(raw);
    words.value = text;
    words.title = text;
  };

  input.addEventListener('input', () => {
    const raw = sanitizeAmount(rawValue());
    const formatted = formatIndian(raw);
    if (input.value !== formatted) input.value = formatted;
    updateWords(raw);
    // commit on each keystroke so change rules see the live value
    if (model && String(model.value ?? '') !== raw) model.value = raw;
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      const initial = sanitizeAmount(model.value);
      input.value = formatIndian(initial);
      updateWords(initial);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') {
          const raw = sanitizeAmount(change.currentValue);
          if (raw !== rawValue()) input.value = formatIndian(raw);
          updateWords(raw);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
