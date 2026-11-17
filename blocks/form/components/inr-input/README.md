# INR Input

Amount field with a "₹" prefix and a read-only "Amount (in words)" field showing the amount in the Indian numbering system.

## How to Use

Add an "INR Input" component to a form. It has the same authoring properties as Number Input (no custom properties).

## Model Subscriptions

Subscribes to the field's own `value` changes (`listenChanges: true`) and refreshes the words on `register` and on every external value change (rules, prefill).

## Model Properties Set

None directly. `model.value` (a number, up to 2 decimals) is committed the OOTB way, on the native `change` (blur) event, so rules on the field run once per edit. The words are updated live on every `input` event without touching the model.

## Usage Notes

- Base type: `number-input`; `fd:viewType`: `inr-input`.
- The words element is an `<input readonly>` labelled "Amount (in words)".
- Format: Thousand/Lakh/Crore, "Rupees" and "Paise", Title Case, e.g. `123456.78` → "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Seventy Eight Paise Only". Empty input gives an empty string.
