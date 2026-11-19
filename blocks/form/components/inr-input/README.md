# INR Input

Rupee (₹) amount field with a read-only, live "amount in words" display below it.

## How to Use

Insert **INR Input** in the form. Typing `1234567.50` shows
`Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only`.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `wordsLabel` | Label of the amount-in-words field (default `Amount (in words)`) |

All text-input properties (placeholder, default value, validation, help) are also available.

## Model Subscriptions

Subscribes to its own `value` changes (`listenChanges: true`) so values set by rules update the input and the words.

## Model Properties Set

Only `model.value` (the raw amount string, e.g. `1234.5`, no commas), committed on blur through the native `change` event, so change rules fire once per edit. The words update on every keystroke (`input` event) without touching the model.

## Usage Notes

- Base type `text-input`, `fd:viewType` `inr-input`.
- Input is restricted to digits and one `.` with at most two decimals (max 15 integer digits).
- Words use the Indian system (Thousand, Lakh, Crore); the words field is not a model field and is not submitted.
