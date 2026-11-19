# Loan Slider

Loan amount slider with a draggable head, equal-split tick marks and a synced ₹ text box.

## How to Use

Add a **Loan Slider** to the form. Set the Minimum, Maximum and Number of Splits. The range is divided into equal splits; the slider snaps to them.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `minimum` | Lowest amount (default 50000) |
| `maximum` | Highest amount (default 1250000) |
| `splits` | Number of equal parts between min and max (default 12) |

## Model Subscriptions

`value` (re-renders slider and text box) and `enabled` (disables both controls).

## Model Properties Set

`value` (number). Committed when the slider is released, or when the text box loses focus / Enter is pressed. Typed values are clamped to min/max and snapped to the nearest split. Dragging updates the text box live without touching the model.

## Usage Notes

Base type `number-input`, `fd:viewType` `loan-slider`. The native input is hidden; the slider and text box are extra controls whose `change` events do not propagate to the form handler. Tick labels use Indian short format (K, L, Cr).
