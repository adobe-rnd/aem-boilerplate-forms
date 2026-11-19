# INR Input

Indian Rupee amount field with a read-only amount-in-words field that updates live as the user types.

## How to Use

Insert **INR Input** from the Custom Form Components group. It extends a text input; the user types an amount (digits and an optional decimal with up to 2 digits), and the words field below shows e.g. `One Lakh Twenty Three Thousand Rupees and Fifty Paise Only` using Thousand, Lakh and Crore.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `wordsLabel` | Label of the read-only words field (default `Amount (in words)`) |

Other properties are those of the text input (placeholder, default value, validation, help).

## Model Subscriptions

Listens to `value` changes on its own field and updates the input and words.

## Model Properties Set

Sets `model.value` to the sanitized numeric string on every keystroke (component-handled `input` event), so change rules fire per keystroke. The words field is display-only and not part of the model.

## Usage Notes

- Base type: `text-input`; `fd:viewType`: `inr-input`.
- Non-numeric characters and commas are stripped; decimals are capped at 2 (Paise).
