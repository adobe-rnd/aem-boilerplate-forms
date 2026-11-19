# INR Input

Indian Rupee (₹) amount field with a read-only amount-in-words field below it that updates live as the user types.

## How to Use

Insert **INR Input** from the Custom Form Components group. Typing `1234567.5` shows
"Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only".

## Authoring Properties

| Property | Description |
|----------|-------------|
| `amountInWordsLabel` | Label of the words field (default "Amount (in words)") |

Standard text-input properties (label, placeholder, required, default value, help) apply.

## Model Subscriptions

Subscribes to the field's `value` changes (rules, prefill) and refreshes the words.

## Model Properties Set

Sets nothing. `model.value` holds the raw amount string (e.g. `"1234.50"`, no ₹ or commas) and is committed on blur/`change` (OOTB default), so rules run once per edit. Only the words are updated on every keystroke; the words field is not a model field and is not submitted.

## Usage Notes

- Base type `text-input`, `fd:viewType` `inr-input`.
- Input is restricted to digits and one decimal point with at most two decimals (Paise).
- Uses the Indian numbering system (Thousand, Lakh, Crore); the exported `amountToWords` helper does the conversion.
