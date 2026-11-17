# Loan Slider

Loan amount slider extending `number-input`: label and a rupee-formatted amount box on top, a range slider with tick marks and compact Indian labels below.

## How to Use

Insert the "Loan Slider" component. Set `minimum` and `maximum` in the Validation tab (defaults 50000 and 1250000) and `splits` in Custom Properties.

## Authoring Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `minimum` | number | 50000 | Slider minimum (standard number constraint) |
| `maximum` | number | 1250000 | Slider maximum (standard number constraint) |
| `splits` | number | 5 | Equal intervals between min and max; `splits + 1` ticks/labels are rendered |

## Model Subscriptions

Subscribes to the field's `value` (and `enabled`/`readOnly`) changes; the slider and amount box follow external changes such as rules.

## Model Properties Set

Sets `model.value` (a number) on every slider `input` event and when the amount box is committed (blur/Enter/change). Rules on the field's change event therefore fire on each slider movement. Amount values are clamped to the range; `₹` and commas are ignored when parsing; unparsable input reverts.

## Usage Notes

- Base type `number-input`, `fd:viewType` `loan-slider`.
- The slider is a native `<input type="range">` (Home/End/arrows work); the amount box is a visible text `<input>`. The original number input stays in the DOM, visually hidden.
- Labels use compact Indian notation (K, L, Cr).
