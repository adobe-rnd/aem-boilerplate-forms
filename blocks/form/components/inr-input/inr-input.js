import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n) {
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) {
    parts.push(rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` ${ONES[rest % 10]}` : ''}`);
  }
  return parts.join(' ');
}

/** Words for a non-negative integer given as a digit string, Indian numbering system. */
function integerToWords(digits) {
  const clean = digits.replace(/^0+/, '');
  if (!clean) return 'Zero';
  const lastThree = Number(clean.slice(-3));
  let rest = clean.slice(0, -3);
  const groups = [];
  if (lastThree) groups.push(below1000(lastThree));
  ['Thousand', 'Lakh'].forEach((unit) => {
    if (!rest) return;
    const n = Number(rest.slice(-2));
    rest = rest.slice(0, -2);
    if (n) groups.unshift(`${below1000(n)} ${unit}`);
  });
  if (rest) {
    // everything above 99,99,999 is expressed in Crores, which may itself be large
    groups.unshift(`${integerToWords(rest)} Crore`);
  }
  return groups.join(' ');
}

/**
 * Converts an amount string (e.g. "1234.5") to Indian Rupees and Paise in words.
 * Returns '' for empty or invalid input.
 */
export function amountToWords(value) {
  const str = String(value ?? '').replace(/[,\s₹]/g, '');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(str)) return '';
  const [intPart = '', decPart = ''] = str.split('.');
  const paise = Number(`${decPart}00`.slice(0, 2));
  const rupees = intPart.replace(/^0+/, '');
  if (!rupees && !paise) return 'Zero Rupees Only';
  const parts = [];
  if (rupees) parts.push(`${integerToWords(rupees)} ${rupees === '1' ? 'Rupee' : 'Rupees'}`);
  if (paise) parts.push(`${below1000(paise)} Paise`);
  return `${parts.join(' and ')} Only`;
}

// keeps digits and a single decimal point with at most two decimals
function sanitize(raw) {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  fieldDiv.classList.add('inr-input-wrapper');

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
  wordsWrapper.className = 'inr-input-words';
  const wordsLabel = document.createElement('label');
  wordsLabel.className = 'field-label';
  wordsLabel.htmlFor = wordsId;
  wordsLabel.textContent = fieldJson?.properties?.amountInWordsLabel || 'Amount (in words)';
  const words = document.createElement('input');
  words.type = 'text';
  words.id = wordsId;
  words.className = 'inr-input-words-field';
  words.readOnly = true;
  words.tabIndex = -1;
  words.setAttribute('aria-live', 'polite');
  const readOnlyHint = document.createElement('div');
  readOnlyHint.className = 'inr-input-readonly';
  readOnlyHint.textContent = 'Read-only';
  wordsWrapper.append(wordsLabel, words, readOnlyHint);
  const description = fieldDiv.querySelector('.field-description');
  if (description) description.before(wordsWrapper);
  else fieldDiv.append(wordsWrapper);

  const update = (value = input.value) => {
    words.value = amountToWords(value);
  };

  // the model value is committed by the native change event (on blur); only the words are live
  input.addEventListener('input', () => {
    const clean = sanitize(input.value);
    if (clean !== input.value) input.value = clean;
    update();
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      update(fieldModel.value ?? input.value);
    } else if (eventType === 'change'
      && payload?.changes?.some((c) => c?.propertyName === 'value')) {
      update(fieldModel.value);
    }
  }, { listenChanges: true });

  update();
  return fieldDiv;
}
