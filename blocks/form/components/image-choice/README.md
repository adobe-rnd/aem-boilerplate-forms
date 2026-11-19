# Image Choice

A grid of selectable images (e.g. "Select your team" logos) with configurable single or multiple selection.

## How to Use

Insert **Image Choice** in the Universal Editor. Define the options (`Options (Data Value)` / `Options (Display Value)`) and, in the same order, the image URL/path for each option.

## Authoring Properties

| Property | Name | Description |
|----------|------|-------------|
| Option images | `imageUrls` | Multi-value; image URL/path for the option at the same index |
| Selection mode | `selectionMode` | `single` (default) or `multiple` |
| Columns | `columns` | Grid columns (default 4, max 3 on narrow screens) |
| Show option labels | `showLabels` | Show the display value under each image. Otherwise it is visually hidden but still read by screen readers and shown as tooltip |

Standard checkbox-group properties (required, min/max items, etc.) apply.

## Model Subscriptions

- `properties` changes re-apply columns, labels and images.

## Model Properties Set

`value` is an array (`string[]`) in both modes; in single mode it holds at most one entry. It is committed on the native `change` event of the underlying checkbox, so change rules fire once per click (selecting a new image in single mode swaps the selection in one change). Clicking a selected image deselects it.

## Usage Notes

- Base type: `checkbox-group`; `fd:viewType`: `image-choice`.
- The native checkboxes remain in the DOM (visually hidden) so keyboard operation (Tab, Space), validation and model sync are provided by the core form block.
