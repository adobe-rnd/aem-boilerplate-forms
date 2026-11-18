# NPS Rating

A responsive 0–10 recommendation scale with three color-coded ranges and a raised selected score.

## How to Use

Insert **NPS Rating** from the Universal Editor's Custom Form Components group.
Set the title to the survey question. Standard properties include name, binding,
title visibility, column span, visibility, enabled/read-only state, optional default
score, required validation and error message, help text, and tooltip.
Leave the default score empty to avoid preselecting a response; set it to `9` to
reproduce the reference image.

For JSON forms, use `fieldType: "number-input"`, `type: "integer"`,
`":type": "nps-rating"`, `minimum: 0`, `maximum: 10`, and `step: 1`.
Put custom settings in `properties`.

## Authoring Properties

| Property | Default | Purpose |
|----------|---------|---------|
| `lowMax` | `6` | Inclusive end of the low range. |
| `middleMax` | `8` | Inclusive end of the middle range. |
| `lowLabel` | `Not likely` | Low range caption. |
| `middleLabel` | `May be` | Middle range caption. |
| `highLabel` | `Very likely` | High range caption. |
| `lowColor` | `#f2546b` | Low range bar and selected score CSS color. |
| `middleColor` | `#ffa12f` | Middle range bar and selected score CSS color. |
| `highColor` | `#25b783` | High range bar and selected score CSS color. |

Thresholds must be integers satisfying `0 <= lowMax < middleMax <= 9`.
Invalid thresholds or CSS colors raise a component configuration error.
Choose colors with sufficient white-text contrast for selected scores.

## Model Subscriptions

Uses `subscribe(..., { listenChanges: true })` to initialize from the model and
update selection, required/invalid semantics, and enabled/read-only state on changes.
The standard renderer handles visibility, title, help text, and validation messages.
Range properties are read at decoration time; changing them requires re-rendering.

## Model Properties Set

Writes a numeric `model.value` immediately when a different score is clicked or
chosen by keyboard. Each new selection commits once and triggers one value change;
clicking the selected score does not recommit. Model-driven clearing removes the
selection without substituting zero.

## Usage Notes

Extends `number-input`; `fd:viewType` is `nps-rating`. Keeps the native input for
the form block's value, submission, and validation handling.
The scale is a labeled radio group with a single tab stop. Arrow keys move and
select, Home/End select 0/10, and Space/Enter activate the focused score.
Disabled and read-only fields cannot be edited.
