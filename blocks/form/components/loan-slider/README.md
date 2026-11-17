# Loan Slider

Loan amount slider extending `number-input`: label and a rupee-formatted amount box (`₹5,00,000`) above a range slider with tick marks labelled in compact Indian notation (K, L, Cr).

## How to Use

Insert the **Loan Slider** component. Set the standard **Minimum** and **Maximum** validation properties (defaults 50000 and 1250000) and optionally **Splits**.

## Authoring Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `minimum` | number | 50000 | Slider minimum (standard number-input constraint) |
| `maximum` | number | 1250000 | Slider maximum (standard number-input constraint) |
| `splits` | number | 5 | Equal intervals between min and max; `splits + 1` ticks/labels are rendered |

## Model Subscriptions

`value` (updates slider and amount box), `enabled` and `readOnly` (disable controls).

## Model Properties Set

`value` (number). Committed on every slider `input` (drag or arrow/Page/Home/End keys), and for the amount box on blur or Enter. Out-of-range amounts are clamped; non-numeric characters (`₹`, commas) are ignored. Field change rules fire once per committed change. Slider and amount-box `input`/`change` events do not propagate to the form-level handler, so the formatted text never reaches the model.

## Usage Notes

- Base type `number-input`, `fd:viewType` `loan-slider`.
- The original number input stays in the DOM, hidden, for the form block's model sync and validation messages.
- The slider is a native `<input type="range">` (step 1); arrow keys move by 1% of the range, PageUp/PageDown by 10%, Home/End jump to min/max.
- With no value, the slider rests at the minimum and the amount box is empty.
