# Loan Slider

A loan amount slider with a draggable head, equal-split tick marks and a synced text box showing the current amount (e.g. `₹5,00,000`).

## How to Use

Add the **Loan Slider** component to a form in the Universal Editor and set the properties below. Dragging the head updates the text box; typing an amount in the text box (commit with Enter or blur) moves the head. Typed values are clamped to the min/max.

## Authoring Properties

| Property | Description | Default |
|----------|-------------|---------|
| `minAmount` | Lowest amount | `50000` |
| `maxAmount` | Highest amount | `1250000` |
| `splits` | Number of equal parts the range is divided into (ticks are drawn at each split; the head snaps to them while sliding) | `10` |

Tick labels use Indian short notation (`50K`, `2L`, `12.5L`) and are thinned to at most 6.

## Model Subscriptions

- `value` changes on the field (e.g. set by a rule) update the slider and text box.

## Model Properties Set

`model.value` is a number. It is committed through a bubbling `change` event on the hidden number input: on every snapped step while sliding, and on blur/Enter for the text box. Change rules fire once per distinct value.

## Usage Notes

- Base type: `number-input`; `fd:viewType`: `loan-slider`.
- The original number input is hidden and acts as the value carrier.
- Typed amounts are not snapped to a split; the head is placed at the exact position.
