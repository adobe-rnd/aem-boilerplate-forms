# INR Input

Indian Rupee (₹) amount field with a read-only, live "amount in words" field below it.

## How to Use

Add **INR Input** (Custom Form Components) to a form. Typing `123456.5` shows
`Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only`.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `wordsLabel` | Label for the words field (default `Amount (in words)`) |

All standard text-input properties (placeholder, default value, validation, help) apply.

## Model Subscriptions

`value` changes (e.g. set by a rule) update the input and the words.

## Model Properties Set

`model.value` is committed on every keystroke (component-handled `input` event, guarded by a
compare), so change rules fire per keystroke. The value is the sanitized raw string
(digits, optional `.` and up to 2 decimals, max 15 integer digits). The words field is DOM-only.

## Usage Notes

- Base type `text-input`, `fd:viewType` `inr-input`.
- Uses Indian numbering: Thousand, Lakh, Crore (above 99 Crore the crore part is spelled out, e.g. "One Hundred Crore").
- Paise are taken from the first two decimal digits.
