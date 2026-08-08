# Dynamic Dropdown

A searchable, typeahead dropdown that replaces the native `<select>` element with a text input and a filtered option list. The user can type to narrow down options; selecting an item syncs the value back to the underlying native select for standard form submission.

## Features

- Typeahead filtering — options are filtered case-insensitively as the user types
- Shows "No matching options" when no options match the typed text
- Syncs with the native `<select>` on selection, so standard form submission works unchanged
- Responds to dynamic option updates (`enumNames` changes) — the dropdown repopulates automatically when options are loaded asynchronously
- Responds to programmatic value changes (e.g. prefill or rule-driven value set) by displaying the correct option label in the text input
- Closes on outside click; reopens on focus if the input already has a value

## Model Subscriptions

Subscribes to the `change` event on `fieldModel`:

| Property change | Behavior |
|---|---|
| `enumNames` | Repopulates the dropdown list with the new option labels |
| `value` | Updates the text input to display the label corresponding to the new value |

## Usage Notes

- Based on `drop-down` resource type with `fd:viewType: dynamic-dropdown`.
- The native `<select>` is hidden but remains in the DOM — its value is kept in sync and is what gets submitted with the form.
- Clearing the text input resets the selected value and clears the model value.
- A 150 ms blur delay is used to allow `mousedown` option clicks to register before the dropdown closes.
