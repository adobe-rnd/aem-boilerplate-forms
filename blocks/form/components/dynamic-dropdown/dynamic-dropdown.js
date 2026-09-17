import { subscribe } from '../../rules/index.js';
import { createSearchableDropdown } from './searchable-dropdown.js';

// Searchable dropdown built on {listenChanges: true}. Model captured on register;
// view reflects model only — no request/fetch here. Options are set externally via a static enum
// or a listener/change rule that calls setProperty on the enum.

/**
 * @param {HTMLElement} fieldDiv - field wrapper containing the OOTB select
 * @param {Object} fieldJson - field model json
 * @param {HTMLElement} parentElement - parent element
 * @param {string} formId - owning form id
 * @returns {HTMLElement} the decorated field wrapper
 */
export default function decorate(fieldDiv, fieldJson, parentElement, formId) {
  let widget = null;
  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      widget = createSearchableDropdown(fieldDiv, fieldModel);
    } else if (eventType === 'change') {
      const relevant = payload?.changes?.some(
        (c) => c?.propertyName === 'value' || c?.propertyName === 'enum' || c?.propertyName === 'enumNames',
      );
      if (relevant) {
        widget?.syncFromModel();
      }
    }
  }, { listenChanges: true });
  return fieldDiv;
}
