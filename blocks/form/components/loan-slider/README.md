# Loan Slider

A snapping amount slider paired with an editable amount text box. Both stay in sync.

## How to Use

Insert a **Loan Slider** component, set the lowest/highest number and the number of splits.
The range between them is divided into equal splits; the slider head snaps to each split and ticks mark them.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `minimum` | Lowest amount (Validation tab) |
| `maximum` | Highest amount (Validation tab) |
| `splits` | Number of equal splits between min and max (default 10) |
| `currencySymbol` | Symbol shown before the amount (default `₹`) |

## Model Subscriptions

Listens to `value` (updates slider and text box) and `enabled` changes.

## Model Properties Set

Sets `model.value` to the raw number (no symbol or grouping). It is committed once per interaction: when the slider head is released or a key press ends, and when the text box is blurred or Enter is pressed. Typed values are clamped to min/max and snapped to the nearest split.

## Usage Notes

- Base type: `number-input`, `fd:viewType`: `loan-slider`.
- The original input is kept hidden as the model-bound carrier; the visible text box is a separate input.
- Amounts are formatted with the `en-IN` locale; axis labels use `K`, `L`, `Cr`.
