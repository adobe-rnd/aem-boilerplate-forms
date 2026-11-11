# Live Amount Input

An Indian rupee amount field with a live, read-only amount-in-words preview.

## How to Use

Insert **Live Amount Input** in the Universal Editor, or use this field definition:

```json
{
  "id": "amount",
  "name": "amount",
  "fieldType": "text-input",
  ":type": "live-amount-input",
  "type": "string",
  "label": { "value": "Amount" },
  "required": true,
  "pattern": "^(?:(?:\\d{1,9}|[1-9]\\d{0,2}(?:,\\d{3}){1,2}|[1-9]\\d?(?:,\\d{2}){0,2},\\d{3})(?:\\.\\d{0,2})?|\\.\\d{1,2})$",
  "properties": {
    "heading": "live-amount-input",
    "wordsLabel": "Amount (in words)"
  }
}
```

## Authoring Properties

| Property | Default | Purpose |
|----------|---------|---------|
| `heading` | `live-amount-input` | Card heading |
| `wordsLabel` | `Amount (in words)` | Accessible label for the read-only text field |

Standard label, placeholder, default value, required, validation and help properties
are inherited from text-input. Keep the template's amount pattern (included above
for JSON-based forms) so model-level validation also rejects invalid amounts.
Do not configure a display format: the component
preserves the customer's text and caret while editing.

## Model Subscriptions

Uses `subscribe(..., { listenChanges: true })` for initialization and subsequent
model changes. Prefill, rules and resets update the preview; enabled/read-only
changes also disable the clear button.

## Model Properties Set

`model.value` is committed **per keystroke** through the native `input` event,
only when the text differs from the current value. Change rules therefore run
once per changed input, not just on blur. Clearing also commits immediately.
Native blur/change does not duplicate an already committed value.

The value is the entered **string**, including any grouping or incomplete decimal
point, not a floating-point number. Rules needing arithmetic must convert it
after removing commas. The derived text has no name or independent model value
and is not submitted as a separate field.

## Usage Notes

- Base type: `text-input`; `fd:viewType`: `live-amount-input`.
- Uses Indian number names (Thousand, Lakh, Crore) and rupees/paise.
- Supports 0 through 99,99,99,999.99, including zero and leading-decimal amounts.
- Accepts ungrouped digits and correctly grouped Indian or Western notation.
  It does not insert grouping while typing or move the caret.
- Decimal amounts are converted using their digits without floating-point rounding.
  For example, `12,345.67` becomes
  `Rupees Twelve Thousand Three Hundred Forty Five and Sixty Seven Paise Only`.
- Empty input clears the preview. Invalid, negative, out-of-range or overprecision
  input clears the preview and displays an inline validation error; it is never
  silently rounded or shown as zero. Standard required validation still applies.
- The words field is focusable and selectable but read-only. A polite live region
  announces updates. The clear button supports keyboard activation.
