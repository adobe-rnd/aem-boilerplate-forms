# Loan Slider

Number-input widget with a draggable slider head, equal-split tick marks and an editable ₹ textbox, kept in sync both ways.

## How to Use

Insert **Loan Slider** from the Custom Form Components group, or set `"fd:viewType": "loan-slider"` on a `number-input`.

## Authoring Properties

| Property | Description | Default |
|----------|-------------|---------|
| `minimum` (Validation tab) | Minimum amount | 50000 |
| `maximum` (Validation tab) | Maximum amount | 1250000 |
| `splits` | Number of equal splits between min and max; the slider snaps to each split | 12 |

## Model Subscriptions

`value` and `enabled` changes of the field (via `subscribe` with `listenChanges`) update the slider and textbox.

## Model Properties Set

`model.value` is committed when the slider head is moved (release or keyboard step), or when the textbox is committed (blur/Enter). Typing in the textbox moves the slider live but does not commit per keystroke. Textbox values are clamped to min/max; values between splits are kept as typed while the slider head shows the nearest split.

## Usage Notes

Base type `number-input`, `fd:viewType` `loan-slider`. The original input is hidden and feeds the model; the textbox and slider are helper controls whose native `change` events are stopped from reaching the form handler. The only synthetic `change` without bubbling is the textbox's Enter-key commit, which is intentionally internal. Amounts use the `en-IN` format; tick labels use K / L / Cr.
