import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const MAX_INTEGER_DIGITS = 15;

function twoDigits(n) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function threeDigits(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
}

/** Converts a non-negative integer (as a digit string) using Indian units. */
export function integerToWords(digits) {
  const clean = String(digits).replace(/^0+/, '');
  if (!clean) return 'Zero';
  const lastSeven = clean.slice(-7);
  const croresPart = clean.slice(0, -7);
  const n = Number(lastSeven);
  const parts = [];
  if (croresPart) parts.push(`${integerToWords(croresPart)} Crore`);
  const lakh = Math.floor(n / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

/** Converts an amount string such as "1234.5" to "Rupees ... and ... Paise Only". */
export function amountToWords(value) {
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(String(value ?? '').trim());
  if (!match || (!match[1] && !match[2])) return '';
  const rupees = (match[1] || '0').replace(/^0+(?=\d)/, '');
  const paise = Number((match[2] || '').padEnd(2, '0'));
  if (rupees === '0' && !paise) return 'Zero Rupees Only';
  const result = [];
  if (rupees !== '0') result.push(`${integerToWords(rupees)} ${rupees === '1' ? 'Rupee' : 'Rupees'}`);
  if (paise) result.push(`${twoDigits(paise)} Paise`);
  return `${result.join(' and ')} Only`;
}

/** Keeps digits and a single decimal point, with at most two decimals. */
export function sanitizeAmount(raw) {
  const cleaned = String(raw ?? '').replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned.slice(0, MAX_INTEGER_DIGITS);
  const integer = cleaned.slice(0, dot).slice(0, MAX_INTEGER_DIGITS);
  const decimals = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return `${integer}.${decimals}`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;
  const id = input.id || fieldJson.id;

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

  const words = document.createElement('div');
  words.className = 'inr-input-words';
  const wordsId = `${id}-words`;
  const wordsLabel = document.createElement('label');
  wordsLabel.className = 'inr-input-words-label';
  wordsLabel.htmlFor = wordsId;
  wordsLabel.textContent = fieldJson.properties?.wordsLabel || 'Amount (in words)';
  const output = document.createElement('output');
  output.id = wordsId;
  output.className = 'inr-input-words-value';
  output.setAttribute('aria-live', 'polite');
  const readOnly = document.createElement('span');
  readOnly.className = 'inr-input-readonly';
  readOnly.textContent = 'Read-only';
  words.append(wordsLabel, output, readOnly);
  group.after(words);
  input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), wordsId].filter(Boolean).join(' '));

  const update = () => {
    output.textContent = amountToWords(input.value);
  };

  input.addEventListener('input', () => {
    const sanitized = sanitizeAmount(input.value);
    if (sanitized !== input.value) input.value = sanitized;
    update();
  });

  subscribe(fieldDiv, formId, (_el, model, event, payload) => {
    if (event === 'register') {
      update();
    } else if (event === 'change') {
      const change = payload?.changes?.find((c) => c.propertyName === 'value');
      if (change) {
        const next = sanitizeAmount(change.currentValue);
        if (next !== input.value) input.value = next;
        update();
      }
    }
  }, { listenChanges: true });

  update();
  return fieldDiv;
}
