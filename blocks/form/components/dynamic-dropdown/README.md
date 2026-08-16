# Dynamic Dropdown

A searchable, typeahead dropdown that replaces the native `<select>` element with a text input and a filtered option list. The user can type to narrow down options; selecting an item syncs the value back to the underlying native select for standard form submission.

The view is implemented in `searchable-dropdown.js` (a shared helper); `dynamic-dropdown.js` is the thin AEM Forms decorator that wires it up.

## Features

- Typeahead filtering — options are filtered case-insensitively as the user types
- Clear button — appears when the input has a value; clears model and input on click
- Shows configurable "No results" text when no options match
- Syncs with the native `<select>` on selection, so standard form submission works unchanged
- Responds to dynamic option updates (`enum`/`enumNames` changes) — the dropdown repopulates automatically when options are loaded asynchronously
- Responds to programmatic value changes (e.g. prefill or rule-driven value set) by displaying the correct option label in the text input
- Optional async typeahead via `searchEndpoint` — on each keystroke (≥ `searchMinLength`) a `change` rule can fetch results and update the enum
- Closes on outside click; reopens on focus if the input already has a value

## Model Subscriptions

Uses `{ listenChanges: true }` — the decorator receives a `change` event with `payload.changes` whenever the model updates:

| Property change | Behavior |
|---|---|
| `enum` / `enumNames` | Repopulates the dropdown list |
| `value` | Updates the text input to display the label for the new value |

## Authoring Properties

| Property | Type | Description |
|---|---|---|
| `placeholder` | string | Placeholder text in the search input |
| `searchEndpoint` | string | URL template for async typeahead (`{term}` = typed value, `{varName}` = a form variable). Leave blank for client-side filter only. |
| `optionLabelKey` | string | Result-row field used as each option's label when using `searchEndpoint` |
| `searchMinLength` | number | Minimum characters before the option list opens / search fires |
| `searchMaxLength` | number | Maximum characters accepted in the search input |
| `noResultMessage` | string | Text shown when the filter/search returns no options (default: "No results found") |

## Usage Notes

- Based on `drop-down` resource type with `fd:viewType: dynamic-dropdown`.
- The native `<select>` is hidden but remains in the DOM — its value is kept in sync and is what gets submitted with the form.
- Clearing the text input resets the selected value and clears the model value.
- A 150 ms blur delay allows `mousedown` option clicks to register before the dropdown closes.
- For async typeahead, wire a `change` rule on the field that calls a custom function to fetch options and set the `enum` via `setProperty`.
