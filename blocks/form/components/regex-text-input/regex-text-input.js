import { subscribe } from '../../rules/index.js';

/**
 * regex-text-input — a text input that blocks disallowed characters AS TYPED.
 *
 * Design:
 *  - VIEW ONLY. It filters keystrokes/paste, caps length, and applies an optional case transform —
 *    a UX nicety on top of the model.
 *  - It owns NO validity. Char-class / length validity is the field's NATIVE `pattern` /
 *    `minLength` / `maxLength` constraints. The component NEVER calls markFieldAsInvalid /
 *    updateOrCreateInvalidMsg — that hand-manages the validity slot the runtime already owns.
 *  - It REUSES the OOTB `pattern` (no duplicate `regexPattern` property): the keystroke filter is
 *    derived from the pattern's leading character class, so there is a single source of truth.
 *  - **Case transform** (`textCase: 'upper' | 'lower' | 'none'`, authored, default `none`) — a
 *    view transform applied as-typed / on paste / to prefilled+imported values, on top of the char
 *    filter. e.g. codes that should be stored in uppercase.
 *  - It COMMITS the cleaned value via `model.value` (runtime propagates + runs rules, works
 *    headless), never a synthetic DOM `change` event.
 *  - `{ listenChanges: true }` — reflects a value set from ANY source (prefill / importData).
 */

/**
 * Derives a "strip disallowed characters" RegExp from a validation pattern's leading character
 * class (e.g. `^[A-Za-z0-9]{4,10}$` → /[^A-Za-z0-9]/g). Returns null when the pattern has no
 * character class (then no keystroke filtering — native validity still applies).
 * @param {string} pattern - the field's OOTB validation pattern
 * @returns {RegExp|null} a global strip regex, or null
 */
function deriveCharFilter(pattern) {
  if (!pattern) {
    return null;
  }
  const match = /\[(\^?[^\]]+)\]/.exec(pattern);
  if (!match) {
    return null;
  }
  const cls = match[1].replace(/^\^/, '');
  try {
    return new RegExp(`[^${cls}]`, 'g');
  } catch (e) {
    return null;
  }
}

/**
 * The single resolve core: removes characters outside the field's OOTB `pattern` char-class, caps
 * to its `maxLength`, and applies an optional case transform (`properties.textCase: 'upper'|'lower'`
 * — e.g. codes that should be stored in uppercase). Pure and source-agnostic — the same result
 * whether the value arrived by typing, paste, prefill, importData, or a rule.
 * Exported so tests can assert every source's resolve deterministically.
 * @param {*} value - the raw value from any source
 * @param {{pattern?: string, maxLength?: number, properties?: {textCase?: string}}} fieldJson
 * @returns {string} the cleaned value
 */
export function cleanValue(value, fieldJson) {
  const charFilter = deriveCharFilter(fieldJson?.pattern);
  const maxLen = Number(fieldJson?.maxLength) || 0;
  let next = charFilter ? String(value == null ? '' : value).replace(charFilter, '') : String(value == null ? '' : value);
  if (maxLen > 0 && next.length > maxLen) {
    next = next.slice(0, maxLen);
  }
  const textCase = fieldJson?.properties?.textCase;
  if (textCase === 'upper') {
    next = next.toUpperCase();
  } else if (textCase === 'lower') {
    next = next.toLowerCase();
  }
  return next;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  if (!input) {
    return fieldDiv;
  }

  const clean = (value) => cleanValue(value, fieldJson);

  // The live field model, captured on register — the commit target.
  let model = null;

  // Filter as typed. Restore the caret to the same logical position so removing a mid-string
  // char doesn't jump the cursor to the end.
  input.addEventListener('input', () => {
    const raw = input.value;
    const next = clean(raw);
    if (next === raw) {
      return;
    }
    const removedBeforeCaret = raw.slice(0, input.selectionStart || 0).length
      - clean(raw.slice(0, input.selectionStart || 0)).length;
    const caret = Math.max(0, (input.selectionStart || 0) - removedBeforeCaret);
    input.value = next;
    input.setSelectionRange(caret, caret);
    if (model) {
      model.dispatch({ type: 'uiChange', payload: { value: next } });
    }
  });

  // Paste: clean the pasted result before it lands.
  input.addEventListener('paste', (e) => {
    const pasted = e.clipboardData?.getData('text');
    if (pasted == null) {
      return;
    }
    e.preventDefault();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = clean(input.value.slice(0, start) + pasted + input.value.slice(end));
    input.value = next;
    if (model) {
      model.value = next;
    }
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      if (fieldModel?.value != null) {
        input.value = clean(fieldModel.value);
      }
      return;
    }
    if (eventType !== 'change') {
      return;
    }
    payload?.changes?.forEach((change) => {
      if (change?.propertyName === 'value') {
        const next = clean(change.currentValue == null ? '' : change.currentValue);
        if (next !== input.value) {
          input.value = next;
        }
      }
    });
  }, { listenChanges: true });

  return fieldDiv;
}
