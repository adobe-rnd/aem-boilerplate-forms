# INR Input

Number input with a "₹" prefix and a read-only "Amount (in words)" field that spells the amount in Indian numbering (Thousand, Lakh, Crore) with Rupees and Paise.

## How to Use

Insert **INR Input** from the Custom Form Components group. It has the same properties as Number Input; no extra authoring properties.

## Authoring Properties

None beyond the Number Input properties. `step` defaults to `0.01` (paise).

## Model Subscriptions

Subscribes to its own `value` changes; the words are refreshed when the value changes externally (e.g. by a rule).

## Model Properties Set

None set by the component. `model.value` (a number, up to 2 decimals) is committed the OOTB way, on `change`/blur. The words update live on every `input` event without touching the model, so rules on the field fire once per edit.

## Usage Notes

- Base type: `number-input`; `fd:viewType`: `inr-input`.
- Words example: `123456.78` → "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Seventy Eight Paise Only"; empty input → empty.
- The words element is an `<input readonly>` labelled "Amount (in words)", with a "Read-only" hint.
