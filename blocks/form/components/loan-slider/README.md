# Loan Slider

A loan amount slider with a synchronised, editable amount text box and equally spaced tick marks with compact labels (50K, 2L, 1.5Cr).

## How to Use

Add the **Loan Slider** component in the Universal Editor, or set `fd:viewType` to `loan-slider` on a `number-input` field. Set the minimum and maximum amounts in the Validation tab.

## Authoring Properties

| Property | Description | Default |
|----------|-------------|---------|
| `minimum` / `maximum` | Amount range (Validation tab) | 0 / 100000 |
| `splits` | Number of equal splits between min and max; one tick per split | 10 |
| `stepValue` | Amount the slider moves by; typed values snap to it | 1 |
| `currencySymbol` | Symbol shown before the amount | ₹ |
| `default` | Initial amount | minimum |

## Model Subscriptions

- `value`: updates the slider and text box when a rule or other code changes the value.
- `enabled` / `readOnly`: disables the slider and text box.

## Model Properties Set

`value` is committed through the hidden number input's `change` event: when the slider is released, or when the text box is committed (blur or Enter). Dragging and typing update the other control live without firing change rules. Typed values are clamped to min/max and snapped to the step.

## Usage Notes

- Base type: `number-input`, `fd:viewType`: `loan-slider`.
- The original number input is hidden and kept as the source of truth for the model.
- The text box displays the amount in Indian digit grouping (`5,00,000`).
