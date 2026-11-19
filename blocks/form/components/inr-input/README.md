# INR Input

Indian Rupee (₹) amount field with a read-only amount-in-words field below it that updates live as the user types.

## How to Use

Insert the **INR Input** component in a form. Base type is `number-input`; all number validations (min/max, required) apply.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `wordsLabel` | Label of the amount-in-words field. Default: `Amount (in words)` |

## Model Subscriptions

Subscribes to the field's `value` changes (e.g. set by rules) and refreshes the words.

## Model Properties Set

None written. `model.value` is committed on blur/`change` (OOTB default); the words are updated per keystroke from the `input` event, so change rules fire once per edit. The words field is display-only and not part of the model.

## Usage Notes

- `fd:viewType`: `inr-input`.
- Uses the Indian numbering system (Hundred, Thousand, Lakh, Crore). Example: `123456.5` → `Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only`.
- Up to two decimals (paise) are used; extra digits are truncated.
