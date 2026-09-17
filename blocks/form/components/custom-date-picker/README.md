# Custom Date Picker

A date input that replaces the native browser date picker with three separate keyboard inputs (DD / MM / YYYY) for a consistent cross-browser experience, plus a calendar button that opens the native date picker for mouse and touch users.

## Features

- Three numeric inputs (day, month, year) with auto-advance on fill
- Paste support — pasting a full date string into any sub-input populates all three fields automatically
- Calendar icon button that opens the native date picker — works on desktop (`showPicker()`) and mobile Safari (transparent overlay technique)
- Floating label support via `data-active` / `data-empty` attributes on the field wrapper
- Validation errors shown only after the user has interacted with the field; programmatic errors (set by rules) are always shown immediately
- Responds to `minAge` / `maxAge` properties to automatically compute and apply `minimum` / `maximum` date constraints
- Responds to `minimumErrorMessage` / `maximumErrorMessage` properties for custom constraint error messages
- Resets cleanly when the form is reset

## Required Assets

The CSS references three SVG icons that must exist at `blocks/form/styles/icons/`:

| File | Used for |
|---|---|
| `date_picker_cal_icon_default.svg` | Default (unfocused) calendar button state |
| `date_picker_cal_icon_select.svg` | Focused / active calendar button state |
| `date_picker_cal_icon_red.svg` | Error state |

## Authoring Properties

| Property | Type | Description |
|---|---|---|
| `placeholder` | string | Placeholder text shown before the user interacts with the field |
| `minimum` | string | Minimum allowed date in `YYYY-MM-DD` format |
| `maximum` | string | Maximum allowed date in `YYYY-MM-DD` format |
| `minAge` | number | Minimum age in years — computes `maximum` dynamically from today's date |
| `maxAge` | number | Maximum age in years — computes `minimum` dynamically from today's date |
| `minimumErrorMessage` | string | Error message shown when the entered date is before `minimum` |
| `maximumErrorMessage` | string | Error message shown when the entered date is after `maximum` |

`minAge` / `maxAge` take precedence over manually authored `minimum` / `maximum` when both are present.

## Model Subscriptions

Subscribes to the `change` event on `fieldModel`:

| Property change | Behavior |
|---|---|
| `value` | Populates the three inputs and syncs the calendar picker |
| `enabled` | Enables / disables all three inputs and the calendar button |
| `readOnly` | Applies read-only state to all three inputs and disables the calendar button |
| `visible` | Shows or hides the entire field wrapper |
| `validationMessage` | Displays or clears the validation error message |

Also subscribes to `reset` to clear all inputs and the hidden native input.

## Usage Notes

- Based on `date-input` resource type with `fd:viewType: custom-date-picker`.
- The internal value format is always `YYYY-MM-DD` (ISO 8601), matching the AEM Forms model convention.
- The three visible inputs use `type="tel"` with `inputMode="numeric"` so mobile keyboards show the numeric pad without the browser's built-in date picker UI.
- A hidden `<input type="date">` is kept off-screen for native form submission and for syncing with the calendar picker.
- Day and month inputs auto-correct single-digit values to two digits on blur (e.g. `5` → `05`).
- If any of the three fields is empty when the user leaves the component, all fields are cleared.
- Paste recognises these formats: `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`, `DD MM YYYY`, `MM/DD/YYYY`, `MM-DD-YYYY`, `YYYY-MM-DD` (ISO), `YYYY/MM/DD`, `DDMMYYYY`, `YYYYMMDD`. When day and month are both ≤ 12 and the format is ambiguous, DD/MM order is assumed. Any other pasted text is treated as a partial digit string for the focused sub-input.
