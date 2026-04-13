# PAN Input Component

A custom text input component for collecting and validating Indian PAN (Permanent Account Number) values. It enforces the PAN character structure in real time as the user types and shows inline validation messages.

## PAN format

A valid PAN is exactly 10 characters:

```
A A A P X 1 2 3 4 Y
1 2 3 4 5 6 7 8 9 10
```

| Position | Allowed characters |
|---|---|
| 1–3 | Uppercase letters (A–Z) |
| 4 | A single configurable uppercase letter (default: `P`) |
| 5 | Uppercase letter (A–Z) |
| 6–9 | Digits (0–9) |
| 10 | Uppercase letter (A–Z) |

## Registration

Add `'pan-input'` to the `customComponents` array in `blocks/form/mappings.js`:

```js
let customComponents = ['pan-input', /* other components */];
```

## Authoring (Universal Editor)

Set the field type to `pan-input`:

```
fd:viewType: pan-input
```

The following properties are configurable via the component's property sheet:

| Property | Type | Default | Description |
|---|---|---|---|
| `fourthChar` | string (1 uppercase letter) | `"P"` | The character required in position 4. Common values: `P` (individual), `H` (HUF), `C` (company), `F` (firm), `A` (AOP/BOI), `T` (trust), `B` (BOI), `L` (local authority), `J` (artificial juridical person), `G` (government). |

## Validation behaviour

Validation runs on every keystroke and again on `blur`.

**On input:**
- Characters are converted to uppercase.
- Only characters valid for each position are accepted; invalid characters are removed immediately.
- The field is capped at 10 characters (`maxlength` attribute is set by the component).
- If the input is 10 characters and does not match the full PAN regex, an error message is shown.
- If the input is between 1 and 9 characters, a "PAN must be 10 characters long" message is shown.
- If the field is empty, no error is shown.

**On blur:**
- The same formatting and validation rules are applied.
- The field value is updated to the formatted result.

**Error messages:**

| Condition | Message |
|---|---|
| Input is 1–9 characters | `PAN must be 10 characters long` |
| Input is 10 characters but fails pattern | `Invalid PAN format. Fourth character must be <fourthChar>` |

## CSS styling

The decorator adds the `pan-input-wrapper` class on the field wrapper. `pan-input.css` applies the following styles to the input inside that wrapper:

- `text-transform: uppercase` — the input always displays in uppercase
- `font-family: monospace` — consistent character width
- `letter-spacing: 1px` — improved readability

The placeholder text is exempt from these styles so it renders normally.

## Rule engine integration

The component listens for two custom events that your form rules can dispatch to drive a visual validation state on the field.

A common use case: your form calls an external PAN verification API from a rule. When the API confirms the PAN is valid, you dispatch `fieldValidated` on the field — the component adds the `fieldValidated` CSS class to the field wrapper, which you can style to show a green check or similar indicator. If the user then edits the field (invalidating the API result), your rule dispatches `removeFieldValidatedProperty` to remove the class and the indicator.

| Event | Effect on the field wrapper |
|---|---|
| `fieldValidated` | Adds the `fieldValidated` CSS class |
| `removeFieldValidatedProperty` | Removes the `fieldValidated` CSS class |

Styling the `fieldValidated` state is left to the consuming form's CSS — the component only manages the class.
