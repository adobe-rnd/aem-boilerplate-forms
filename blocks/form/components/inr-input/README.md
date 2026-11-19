# INR Input

Editable Indian Rupee (₹) amount field with a read-only amount-in-words field below it that updates as the user types.

## How to Use

Insert the **INR Input** component in the Universal Editor, or set `":type": "inr-input"` in a form definition.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `wordsLabel` | Label of the read-only words field (default `Amount (in words)`) |

All standard text-input properties (label, placeholder, default value, required, etc.) apply.

## Model Subscriptions

Subscribes to the field's `value` changes (e.g. from rules or prefill) and refreshes the words.

## Model Properties Set

Nothing beyond the OOTB behaviour: `model.value` is committed on the native `change` event (blur), so rules on the field run once per edit. The words field is updated on every `input` event without touching the model. Input is restricted to digits and one decimal point with at most two decimals (paise).

## Usage Notes

- Base type `text-input`, `fd:viewType` `inr-input`.
- Words use the Indian system (Thousand, Lakh, Crore), e.g. `123456.5` → `Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only`. Amounts above a hundred Crore are expressed in Crores.
- The words field is a display-only input and is not part of the form model.
