import { subscribe } from '../../rules/index.js';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

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

export function numberToIndianWords(n) {
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

export function amountToWords(value) {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return '';
  const totalPaise = Math.round(num * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const rupeeWords = rupees || !paise ? `${numberToIndianWords(rupees)} Rupees` : '';
  const paiseWords = paise ? `${belowHundred(paise)} Paise` : '';
  return `${[rupeeWords, paiseWords].filter(Boolean).join(' and ')} Only`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) return fieldDiv;
  fieldDiv.classList.add('inr-input-wrapper');
  const id = input.id || fieldJson.id;
  if (!input.getAttribute('step')) input.step = '0.01';

  const group = document.createElement('div');
  group.className = 'inr-input-group';
  const prefix = document.createElement('span');
  prefix.className = 'inr-input-prefix';
  prefix.setAttribute('aria-hidden', 'true');
  prefix.textContent = '₹';
  input.before(group);
  group.append(prefix, input);

  const words = document.createElement('div');
  words.className = 'inr-input-words';
  const wordsId = `${id}-in-words`;
  const label = document.createElement('label');
  label.className = 'field-label inr-input-words-label';
  label.htmlFor = wordsId;
  label.textContent = 'Amount (in words)';
  const output = document.createElement('input');
  output.type = 'text';
  output.readOnly = true;
  output.id = wordsId;
  output.className = 'inr-input-words-field';
  output.tabIndex = -1;
  const hint = document.createElement('small');
  hint.className = 'inr-input-words-hint';
  hint.textContent = 'Read-only';
  words.append(label, output, hint);
  group.after(words);

  const update = (value) => {
    const text = amountToWords(value);
    if (output.value !== text) output.value = text;
  };

  input.addEventListener('input', () => update(input.value));
  update(input.value);

  subscribe(fieldDiv, formId, (_el, model, eventType, payload) => {
    if (eventType === 'register') {
      update(model.value);
    } else {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') update(change.currentValue);
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
