# INR Input

Rupee (₹) amount field with a read-only amount-in-words display that updates as the user types.

## How to Use

Insert **INR Input** from the custom components group in the Universal Editor, or set `fd:viewType` to `inr-input` on a `text-input` field. Typing is restricted to digits and one decimal point (max 2 decimals, 15 integer digits).

## Authoring Properties

| Property | Description |
|----------|-------------|
| `amountInWordsLabel` | Label of the words field (default `Amount (in words)`) |

Standard text-input placeholder, default value, validation and help properties are also available.

## Model Subscriptions

Subscribes to `value` changes (e.g. set by rules) to resync the input and the words.

## Model Properties Set

Does not set model properties. `model.value` holds the plain numeric string (e.g. `123456.50`) and is committed by the native `change` event, i.e. on blur. The words update on every keystroke and are display-only.

## Usage Notes

- Base type: `text-input`; `fd:viewType`: `inr-input`.
- Words use the Indian system: Thousand, Lakh, Crore; e.g. `1,23,456.50` → `Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only`.
- `amountToWords` is exported for reuse and testing.
