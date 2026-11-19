# INR Input

Indian Rupee (₹) amount field with a read-only "amount in words" field below it that updates as the user types.

## How to Use

Add an **INR Input** component to a form in the Universal Editor. The words field uses the Indian numbering system (Thousand, Lakh, Crore) and supports Rupees and Paise, e.g. `1234567.5` → `Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Fifty Paise Only`.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `wordsLabel` | Label of the read-only words field (default `Amount (in words)`) |

All standard number-input properties (placeholder, default, validation, help) are available.

## Model Subscriptions

Subscribes to `value` changes so the words update when rules or prefill set the value.

## Model Properties Set

None directly. `model.value` is committed by the OOTB `change` event (on blur), so change rules fire once per edit. The words field is display-only and is not part of the model; it is refreshed on each `input` event locally.

## Usage Notes

- Base type: `number-input`; `fd:viewType`: `inr-input`.
- Digits beyond two decimals are truncated in the words; negative or empty values show nothing.
- Values of 100 Crore and above read e.g. "One Hundred Crore".
