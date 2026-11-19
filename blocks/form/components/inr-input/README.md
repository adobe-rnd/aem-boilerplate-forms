# INR Input

Editable Indian Rupee (₹) amount field with a read-only amount-in-words field below it.

## How to Use

Insert **INR Input** from the Custom Form Components group. Typing `1234567.5` shows "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only".

## Authoring Properties

| Property | Description |
|----------|-------------|
| `wordsLabel` | Label of the words field (default "Amount (in words)") |

All text-input properties (placeholder, default value, validation, help) are also available.

## Model Subscriptions

Subscribes to the field's `value` changes and refreshes the words when the model value is set externally (rules, prefill).

## Model Properties Set

The component sets nothing itself. `model.value` holds the plain amount string (e.g. `"1234.50"`) and is committed on blur/`change` (OOTB default), so change rules fire once per edit. The words field updates on every keystroke from the `input` event and is not part of the model.

## Usage Notes

Base type `text-input`, `fd:viewType` `inr-input`. Input is restricted to digits, one decimal point, up to 2 decimals and 13 integer digits. Uses the Indian system (Thousand, Lakh, Crore); amounts of 100 Crore and above read e.g. "One Hundred Crore".
