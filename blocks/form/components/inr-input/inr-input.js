import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowThousand(n) {
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(ONES[hundreds], 'Hundred');
  if (rest >= 20) {
    parts.push(TENS[Math.floor(rest / 10)]);
    if (rest % 10) parts.push(ONES[rest % 10]);
  } else if (rest) {
    parts.push(ONES[rest]);
  }
  return parts.join(' ');
}

function integerToWords(n) {
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

/**
 * Converts an amount (number or numeric string) to Indian-system words.
 * @param {number|string} amount
 * @returns {string} words, or '' when the amount is empty or invalid
 */
export function amountToWords(amount) {
  if (amount === '' || amount === null || amount === undefined) return '';
  const num = Number(amount);
  if (!Number.isFinite(num)) return '';
  const totalPaise = Math.round(Math.abs(num) * 100);
  if (!Number.isSafeInteger(totalPaise)) return '';
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const parts = [];
  if (num < 0 && totalPaise > 0) parts.push('Minus');
  if (rupees || !paise) parts.push(integerToWords(rupees), rupees === 1 ? 'Rupee' : 'Rupees');
  if (rupees && paise) parts.push('and');
  if (paise) parts.push(integerToWords(paise), 'Paise');
  parts.push('Only');
  return parts.join(' ');
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  const label = fieldDiv.querySelector('.field-label');
  if (!input) return fieldDiv;
  fieldDiv.classList.add('inr-input-wrapper');
  if (!input.step || input.step === '1') input.step = '0.01';
  input.inputMode = 'decimal';

  const group = document.createElement('div');
  group.className = 'inr-input-group';
  const prefix = document.createElement('span');
  prefix.className = 'inr-input-prefix';
  prefix.setAttribute('aria-hidden', 'true');
  prefix.textContent = '₹';
  input.before(group);
  group.append(prefix, input);

  const wordsId = `${input.id}-words`;
  const wordsWrapper = document.createElement('div');
  wordsWrapper.className = 'inr-input-words';
  const wordsLabel = document.createElement('label');
  wordsLabel.className = 'field-label inr-input-words-label';
  wordsLabel.htmlFor = wordsId;
  wordsLabel.textContent = 'Amount (in words)';
  const words = document.createElement('input');
  words.type = 'text';
  words.id = wordsId;
  words.readOnly = true;
  words.tabIndex = -1;
  words.className = 'inr-input-words-field';
  words.setAttribute('data-inr-words', '');
  const hint = document.createElement('div');
  hint.className = 'inr-input-readonly-hint';
  hint.textContent = 'Read-only';
  wordsWrapper.append(wordsLabel, words, hint);
  const description = fieldDiv.querySelector('.field-description');
  if (description) description.before(wordsWrapper);
  else fieldDiv.append(wordsWrapper);
  if (label && !label.htmlFor) label.htmlFor = input.id;

  const update = (value) => {
    words.value = amountToWords(value);
  };

  input.addEventListener('input', () => {
    update(input.value);
  });
  update(input.value);

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      update(fieldModel?.value);
    } else if (eventType === 'change') {
      const change = payload?.changes?.find((c) => c.propertyName === 'value');
      if (change) update(change.currentValue);
    }
  }, { listenChanges: true });

  return fieldDiv;
}
