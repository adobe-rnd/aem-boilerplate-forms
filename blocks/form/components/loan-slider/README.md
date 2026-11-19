# Loan Slider

A loan amount slider (INR) with a draggable head, equal splits with tick labels, and a text box that stays in sync with the slider.

## How to Use

Add a **Loan Slider** component to the form in the Universal Editor and set the minimum, maximum and number of splits.

## Authoring Properties

| Property | Description | Default |
|----------|-------------|---------|
| Minimum (`minimum`) | Lowest amount | 50000 |
| Maximum (`maximum`) | Highest amount | 1250000 |
| Number of Splits (`splits`) | Number of equal splits between min and max; the slider head snaps to them | 10 |

## Model Subscriptions

Listens to `value` (updates slider and text box, e.g. from rules) and `enabled` changes.

## Model Properties Set

`model.value` is committed when the slider is released (`change`) and when the text box is blurred or Enter is pressed. While dragging or typing, the slider and text box update live without firing change rules. Typed values are clamped to min/max and are not snapped to a split.

## Usage Notes

- Base type: `number-input`, `fd:viewType`: `loan-slider`.
- The original input is hidden and carries the committed value.
- Amounts are shown in the Indian format (`₹5,00,000`); tick labels use `K`, `L` and `Cr`, with at most 7 labels shown.
