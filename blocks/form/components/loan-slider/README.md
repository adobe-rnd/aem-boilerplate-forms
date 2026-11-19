# Loan Slider

Loan amount slider with a draggable head, equal-split tick marks and a synchronized text box.

## How to Use

Add a **Loan slider** to a form. Set the **Minimum** and **Maximum** (Validation tab) to the loan range and **Number of splits** to the number of equal segments; tick marks and compact labels (`50K`, `2L`, `12.5L`, `1Cr`) are generated from them. Dragging the head updates the text box; typing an amount in the text box moves the head. Out-of-range text is clamped to the min/max.

## Authoring Properties

| Property | Description | Default |
|----------|-------------|---------|
| `minimum` | Lowest amount | `0` |
| `maximum` | Highest amount | `100000` |
| `properties.splits` | Number of equal splits (ticks = splits + 1) | `10` |
| `properties.stepValue` | Amount the head moves by | `1` |
| `properties.currencySymbol` | Symbol shown before the amount | `₹` |

## Model Subscriptions

`value` (re-renders head, fill and text box), `enabled`, `readOnly`.

## Model Properties Set

`model.value` (number). It is committed when the user releases the head, uses the keyboard on the head, or leaves/presses Enter in the text box — not on every drag or keystroke, so change rules fire once per edit. On load, an empty or out-of-range value is set to the nearest bound (the minimum if empty).

## Usage Notes

- Base type: `number-input`; `fd:viewType`: `loan-slider`.
- The original input becomes `type="hidden"` and carries the committed value; the slider and the formatted text box (Indian digit grouping) are display-only and stop their `change` events from reaching the form.
