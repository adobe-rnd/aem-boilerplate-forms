# INR Input

Text input for Indian Rupee amounts with a live, read-only amount-in-words field below it.

## How to Use

Insert **INR Input** from the Universal Editor, or set `fd:viewType` to `inr-input` on a `text-input` field.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `wordsLabel` | Label of the amount-in-words field (default `Amount (in words)`) |

All standard text-input properties (required, placeholder, default value, validation, help) apply.

## Model Subscriptions

Listens to `value` changes on the field and refreshes the input and the words.

## Model Properties Set

Sets `model.value` to the plain numeric string (no `₹`, no commas, e.g. `123456.5`) **on every keystroke** (component-handled `input` event), so change rules fire per keystroke. Writes are guarded by comparing with the current value. The words field is DOM-only and is not part of the model.

## Usage Notes

- Base type `text-input`, `fd:viewType` `inr-input`.
- The display is grouped in the Indian system (`12,34,567.50`); only digits and one decimal point with up to two decimals are accepted.
- Words use Thousand, Lakh and Crore, e.g. `Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only`.
