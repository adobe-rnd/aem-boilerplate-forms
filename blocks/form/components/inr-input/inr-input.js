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
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? belowHundred(rest) : '']
    .filter(Boolean).join(' ');
}

// Indian grouping: last 3 digits, then pairs (Thousand, Lakh), then Crore for everything above.
function integerToWords(digits) {
  const n = digits.replace(/^0+/, '');
  if (!n) return '';
  const lastThree = parseInt(n.slice(-3), 10);
  const rest = n.slice(0, -3);
  const thousand = rest ? parseInt(rest.slice(-2), 10) : 0;
  const lakh = rest.length > 2 ? parseInt(rest.slice(-4, -2), 10) : 0;
  const crore = rest.length > 4 ? rest.slice(0, -4) : '';
  return [
    crore ? `${integerToWords(crore)} Crore` : '',
    lakh ? `${belowHundred(lakh)} Lakh` : '',
    thousand ? `${belowHundred(thousand)} Thousand` : '',
    lastThree ? belowThousand(lastThree) : '',
  ].filter(Boolean).join(' ');
}

/**
 * Converts an amount to words using the Indian numbering system.
 * @param {string|number} amount - Amount in rupees, optionally with up to 2 decimal places.
 * @returns {string} e.g. "Rupees One Lakh Twenty Three Thousand and Fifty Paise Only", or ''.
 */
export function amountToWords(amount) {
  const cleaned = String(amount ?? '').replace(/[₹,\s]/g, '');
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return '';
  const [intPart = '', decPart = ''] = cleaned.split('.');
  const rupees = integerToWords(intPart);
  const paise = parseInt(`${decPart}00`.slice(0, 2), 10);
  const paiseWords = paise ? `${belowHundred(paise)} Paise` : '';
  if (!rupees && !paiseWords) return 'Zero Rupees Only';
  const parts = [];
  if (rupees) parts.push(`Rupees ${rupees}`);
  if (paiseWords) parts.push(paiseWords);
  return `${parts.join(' and ')} Only`;
}

// Keeps digits and a single decimal point, with at most 2 decimals.
function sanitize(value) {
  const raw = String(value ?? '').replace(/[^\d.]/g, '');
  const dot = raw.indexOf('.');
  if (dot === -1) return raw.slice(0, MAX_INTEGER_DIGITS);
  const intPart = raw.slice(0, dot).slice(0, MAX_INTEGER_DIGITS);
  const decPart = raw.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return `${intPart}.${decPart}`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';

  const group = document.createElement('div');
  group.className = 'inr-input-group';
  const symbol = document.createElement('span');
  symbol.className = 'inr-input-symbol';
  symbol.textContent = '₹';
  symbol.setAttribute('aria-hidden', 'true');
  input.before(group);
  group.append(symbol, input);

  const words = document.createElement('div');
  words.className = 'inr-input-words-field';
  const wordsId = `${input.id || fieldJson?.id}-words`;
  const wordsLabel = document.createElement('label');
  wordsLabel.className = 'field-label inr-input-words-label';
  wordsLabel.htmlFor = wordsId;
  wordsLabel.textContent = fieldJson?.properties?.amountInWordsLabel || 'Amount (in words)';
  const output = document.createElement('output');
  output.className = 'inr-input-words';
  output.id = wordsId;
  output.setAttribute('aria-live', 'polite');
  const hint = document.createElement('span');
  hint.className = 'inr-input-readonly';
  hint.textContent = 'Read-only';
  words.append(wordsLabel, output, hint);
  group.after(words);

  const update = () => { output.textContent = amountToWords(input.value); };

  input.addEventListener('input', () => {
    const clean = sanitize(input.value);
    if (clean !== input.value) input.value = clean;
    update();
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      update();
    } else if (eventType === 'change'
      && payload?.changes?.some((c) => c?.propertyName === 'value')) {
      const clean = sanitize(fieldModel.value);
      if (clean !== input.value) input.value = clean;
      update();
    }
  }, { listenChanges: true });

  update();
  return fieldDiv;
}
