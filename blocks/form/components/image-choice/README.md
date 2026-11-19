# Image Choice

A checkbox group rendered as a grid of selectable images, with configurable single or multiple selection.

## How to Use

Add an **Image choice** component to the form. Define the options (data value and display value) and, in the **Image Choice** tab, one image URL/path per line in the same order as the options.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `selectionMode` | `single` (default) allows one image; `multi` allows several. |
| `images` | Image URL or path for each option, in option order. Options without an image render as text tiles. |
| `columns` | Fixed number of images per row. Empty fits as many as possible. |
| `showLabels` | Show the option display value below each image. Labels are always available to screen readers. |

All other fields (options, required, min/max items, help text) come from the checkbox group.

## Model Subscriptions

- `value` changes: in `single` mode, if a rule sets more than one value, only the first is kept.

## Model Properties Set

- `value` is an array (single mode: zero or one item). It is committed by the form block on each native `change` of a checkbox, i.e. once per click, so change rules fire once per selection.
- In single mode the component unchecks the other options before the form block reads the group, so the committed value never contains more than one item.
- Selected state is driven by the native `:checked` state, so rule-driven value changes are reflected automatically.

## Usage Notes

- Base type: `checkbox-group`, `fd:viewType`: `image-choice`.
- Clicking the selected image again deselects it.
- Keyboard: Tab to an option, Space toggles it. Focus is shown on the tile.
