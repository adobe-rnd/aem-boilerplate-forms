# INR Input

An editable Indian Rupee (₹) amount field with a read-only amount-in-words display below it that updates live as the user types.

## How to Use

Add the **INR Input** component in the Universal Editor, or set `fd:viewType` to `inr-input` on a `number-input` field.

## Authoring Properties

All `number-input` properties are supported, plus:

| Property | Description |
|----------|-------------|
| `wordsLabel` | Label of the amount-in-words field. Defaults to `Amount (in words)`. |

## Model Subscriptions

Subscribes to the field's own `value` changes (and the initial value on register) to keep the input and the words in sync, e.g. when a rule sets the value.

## Model Properties Set

Sets `model.value` (a number, or `null` when empty) on every keystroke via the `input` event, so change rules fire per keystroke. The native `change` on blur re-writes the same value. The words field is display-only and is not part of the model.

## Usage Notes

- Base type: `number-input`; `fd:viewType`: `inr-input`.
- Only digits and one decimal point are accepted, with at most two decimal places (Paise).
- Words use the Indian system (Thousand, Lakh, Crore), e.g. `123456.5` → `One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Fifty Paise Only`.
- `amountToWords` is exported from `inr-input.js`.
