# Loan Slider

Loan amount slider with equal splits, tick marks, compact labels (50K, 2L, 1.5Cr) and a synced INR amount text box.

## How to Use

Add a **Loan Slider** field in the Universal Editor and set Minimum and Maximum (Validation tab). The range is divided into equal splits; the slider head snaps to each split. Typing in the text box moves the slider to the nearest split, and moving the slider updates the text box.

## Authoring Properties

| Property | Description |
|----------|-------------|
| Minimum / Maximum | Range bounds (defaults 50,000 / 10,00,000). Typed values are clamped to it |
| `splits` | Number of equal parts between min and max (default 10) |

## Model Subscriptions

Listens to `value` (re-renders slider and text box) and `enabled` changes.

## Model Properties Set

Sets `value` (the exact amount, number) via a native `change` event on the hidden input: when the slider is released, or when the text box is committed (blur/Enter). Dragging or typing does not fire rules; each commit fires change rules once.

## Usage Notes

Base type `number-input`, `fd:viewType` `loan-slider`. Text box accepts plain or formatted input (`₹5,00,000`).
