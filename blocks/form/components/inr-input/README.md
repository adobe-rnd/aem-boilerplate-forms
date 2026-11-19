# INR Input

Rupee (₹) amount field with a read-only "amount in words" field below it that updates as the user types.

## How to Use

Insert **INR Input** in the Universal Editor, or set `fd:viewType` to `inr-input` on a `number-input` field.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `wordsLabel` | Label of the read-only words field. Defaults to `Amount (in words)`. |

All other properties are the standard number-input properties (label, required, min/max, etc.).

## Model Subscriptions

Subscribes to the field's `value` changes (e.g. set by a rule) and refreshes the words.

## Model Properties Set

None directly. `model.value` is committed by the native `change` event (on blur), so change rules fire once per edit. The words are derived in the view and update on every keystroke (`input` event).

## Usage Notes

- Base type: `number-input`; `fd:viewType`: `inr-input`. The step defaults to `0.01`.
- Words use the Indian system (Thousand, Lakh, Crore), e.g. `1,23,456.50` → "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Fifty Paise Only".
- Amounts are rounded half-up to paise; empty, negative, or values above 15 integer digits show nothing.
- The words field is a decorative read-only input, not a form model field, and is not submitted.
