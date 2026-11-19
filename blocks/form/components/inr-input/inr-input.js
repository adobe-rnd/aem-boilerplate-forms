import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
  'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
// Indian numbering: the last three digits, then groups of two
const SCALES = [
  [10000000, 'Crore'],
  [100000, 'Lakh'],
  [1000, 'Thousand'],
  [100, 'Hundred'],
];

function belowHundred(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function toWords(n) {
  if (n === 0) return 'Zero';
  let rest = n;
  const parts = [];
  SCALES.forEach(([size, name]) => {
    const count = Math.floor(rest / size);
    if (count > 0) {
      parts.push(`${toWords(count)} ${name}`);
      rest %= size;
    }
  });
  if (rest > 0) parts.push(belowHundred(rest));
  return parts.join(' ');
}

/**
 * Converts an amount to words in the Indian numbering system.
 * @param {string|number} value amount in rupees; two decimal places (paise) are used
 * @returns {string} e.g. "Rupees One Lakh Twenty Three Thousand and Fifty Paise Only"
 */
export function amountToWords(value) {
  const text = String(value ?? '').trim().replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(text) || text === '' || text === '.') return '';
  const [intPart = '', fraction = ''] = text.split('.');
  const rupees = Number(intPart || 0);
  const paise = Number(`${fraction}00`.slice(0, 2));
  if (!Number.isSafeInteger(rupees)) return '';
  if (rupees === 0 && paise === 0) return '';
  const result = [];
  if (rupees > 0) result.push(`Rupees ${toWords(rupees)}`);
  if (paise > 0) result.push(`${toWords(paise)} Paise`);
  return `${result.join(' and ')} Only`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;
  fieldDiv.classList.add('inr-input-wrapper');
  if (!input.step || input.step === 'any') input.step = '0.01';
  input.inputMode = 'decimal';

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
  wordsWrapper.append(wordsLabel, words);
  group.after(wordsWrapper);
  input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), wordsId].filter(Boolean).join(' '));

  const update = (value) => {
    words.value = amountToWords(value);
  };

  // live update while typing; model.value is still committed on change (blur)
  input.addEventListener('input', () => update(input.value));
  update(input.value);

  subscribe(fieldDiv, formId, (_fieldDiv, model, eventType, payload) => {
    if (eventType === 'register') {
      update(model.value);
    } else if (eventType === 'change'
      && payload?.changes?.some((c) => c.propertyName === 'value')) {
      update(model.value);
    }
  }, { listenChanges: true });

  return fieldDiv;
}
