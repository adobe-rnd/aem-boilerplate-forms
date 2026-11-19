# INR Input

Rupee (₹) amount field with a read-only, live "amount in words" output below it (Indian numbering: Thousand, Lakh, Crore; Rupees and Paise).

## How to Use

Insert **INR Input** from the Custom Form Components group. Typing accepts digits and one decimal point (max 2 decimals); other characters are stripped.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `wordsLabel` | Label for the amount-in-words output (default `Amount (in words)`) |

All text-input properties (label, placeholder, default value, validation, help) are available.

## Model Subscriptions

Subscribes to its own `value` changes (`listenChanges: true`) to refresh the words, e.g. when rules or the default value set the amount.

## Model Properties Set

`model.value` is committed **on every keystroke** (component-handled `input` event) as a plain numeric string (e.g. `"1234.5"`), so rules on the field's change fire per keystroke. The words output is display-only and not part of the model.

## Usage Notes

- Base type: `text-input`; `fd:viewType`: `inr-input`.
- Example: `1,23,45,678.05` → "Twelve Crore ... " style output, e.g. `150025.50` → "One Lakh Fifty Thousand Twenty Five Rupees and Fifty Paise Only".
