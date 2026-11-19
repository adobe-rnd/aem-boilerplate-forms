/* global BigInt */
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

/** Converts a non-negative integer (BigInt) to words using the Indian numbering system. */
export function integerToWords(value) {
  let n = BigInt(value);
  if (n === 0n) return 'Zero';
  const parts = [];
  const hundreds = Number(n % 1000n);
  n /= 1000n;
  const thousands = Number(n % 100n);
  n /= 100n;
  const lakhs = Number(n % 100n);
  n /= 100n;
  // everything above lakhs is expressed in crores, which may itself be large
  if (n > 0n) parts.push(`${integerToWords(n)} Crore`);
  if (lakhs) parts.push(`${belowThousand(lakhs)} Lakh`);
  if (thousands) parts.push(`${belowThousand(thousands)} Thousand`);
  if (hundreds) parts.push(belowThousand(hundreds));
  return parts.join(' ');
}

/** Converts an amount string like "1234.5" to "Rupees ... and ... Paise Only". */
export function amountToWords(amount) {
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(String(amount ?? '').replace(/,/g, '').trim());
  if (!match || (!match[1] && !match[2])) return '';
  const rupees = BigInt(match[1] || '0');
  const paise = Number(`${match[2] || ''}00`.slice(0, 2));
  if (rupees === 0n && paise === 0) return 'Zero Rupees Only';
  const parts = [];
  if (rupees > 0n) parts.push(`${integerToWords(rupees)} ${rupees === 1n ? 'Rupee' : 'Rupees'}`);
  if (paise > 0) parts.push(`${integerToWords(paise)} Paise`);
  return `${parts.join(' and ')} Only`;
}

function sanitize(text) {
  const cleaned = text.replace(/[^\d.]/g, '');
  const [whole, ...fraction] = cleaned.split('.');
  return fraction.length ? `${whole}.${fraction.join('').slice(0, 2)}` : whole;
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
  wordsLabel.textContent = fieldJson.properties?.wordsLabel || 'Amount (in words)';
  const words = document.createElement('output');
  words.className = 'inr-input-words';
  words.id = wordsId;
  words.setAttribute('aria-live', 'polite');
  const hint = document.createElement('span');
  hint.className = 'inr-input-readonly';
  hint.textContent = 'Read-only';
  wordsWrapper.append(wordsLabel, words, hint);
  fieldDiv.append(wordsWrapper);

  const render = (value) => {
    words.textContent = amountToWords(value);
  };

  // commit the model on every keystroke so the words stay live
  let model;
  input.addEventListener('input', () => {
    const clean = sanitize(input.value);
    if (clean !== input.value) input.value = clean;
    render(clean);
    if (model && model.value !== clean) model.value = clean;
  });

  subscribe(fieldDiv, formId, (_element, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      render(fieldModel.value);
    } else if (eventType === 'change') {
      const changed = payload?.changes?.some((c) => c.propertyName === 'value');
      if (changed) render(fieldModel.value);
    }
  }, { listenChanges: true });

  render(input.value);
  return fieldDiv;
}
