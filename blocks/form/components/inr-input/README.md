# INR Input

Editable Indian Rupee (₹) amount field with a read-only amount-in-words field below it that updates live as the user types.

## How to Use

Insert **INR Input** from the Custom Form Components group, or set `fd:viewType` to `inr-input` on a number input.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `wordsLabel` | Label of the amount-in-words field (default `Amount (in words)`) |

All number-input properties (label, required, min/max, default value, …) also apply.

## Model Subscriptions

Subscribes to the field's own `value` changes (rules, reset, default values) and refreshes the words.

## Model Properties Set

Nothing is written by the component. `model.value` is committed by the OOTB `change` handler, on blur, so rules fire once per edit. The words field is display-only and not part of the model or the submission; it updates on every `input` event.

## Usage Notes

- Base type: `number-input`; `fd:viewType`: `inr-input`.
- The input is switched to `type="text"` with `inputmode="decimal"`; only digits and one `.` with up to 2 decimals are accepted.
- Words use the Indian system (Thousand, Lakh, Crore), e.g. `123456.50` → `One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Fifty Paise Only`.
- `amountToWords(value)` is exported for reuse.
