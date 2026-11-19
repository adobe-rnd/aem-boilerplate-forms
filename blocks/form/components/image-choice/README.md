# Image Choice

A checkbox-group rendered as a grid of selectable images (e.g. "Select your team"), configurable as single or multiple choice.

## How to Use

Add an **Image Choice** component, define the options (`enum` / `enumNames`), and provide one image URL per option, in the same order.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `selectionMode` | `single` (default) or `multiple` |
| `imageUrls` | Image URL for each option, same order as the options |
| `imageSize` | `small`, `medium` (default) or `large` |
| `showLabels` | Show the option text under the image (otherwise it is visually hidden but kept as the image alt text/accessible name) |

## Model Subscriptions

None. Model → UI sync (checked state, enum changes) is handled by the form block; the component only enhances the rendered options.

## Model Properties Set

`value` is an array (`string[]` by default), committed on each native `change` of an option, so change rules fire once per click. In single mode the array holds at most one item; clicking the selected image again clears it.

## Usage Notes

- Base type: `checkbox-group`; `fd:viewType`: `image-choice`.
- Options remain native, visually hidden checkboxes, so keyboard (Tab, Space) and screen readers work. Required/min/max validation of the base type still applies.
- Options re-render correctly when `enum`/`enumNames` change.
