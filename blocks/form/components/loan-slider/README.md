# Loan Slider

A loan amount slider with equal splits, a draggable head and a text box that stay in sync.

## How to Use

Add the **Loan Slider** component in the Universal Editor (or set `fd:viewType` to `loan-slider` on a number input).

## Authoring Properties

| Property | Description | Default |
|----------|-------------|---------|
| Minimum (`minimum`) | Lowest amount | 50000 |
| Maximum (`maximum`) | Highest amount | 1250000 |
| Number of splits (`splits`) | Equal splits between min and max; a tick is drawn at each | 12 |
| Currency symbol (`currencySymbol`) | Prefix shown in the text box | ₹ |

Tick labels use Indian compact notation (`50K`, `2L`, `1Cr`); only about seven are shown so they never overlap.

## Model Subscriptions

`value`, `enabled` and `readOnly` changes update the slider and text box.

## Model Properties Set

- Dragging snaps to the nearest split. `model.value` is committed when the drag ends (native `change`).
- Typing in the text box moves the slider live. `model.value` is committed on blur/Enter, clamped to min/max.
- If the model has no value, it is set to the minimum on register.
- Writes are skipped when the value is unchanged, so no loops.

## Usage Notes

Base type `number-input`, `fd:viewType` `loan-slider`. The original input is hidden and holds the raw number; the visible text box shows the formatted amount (`en-IN` grouping).
