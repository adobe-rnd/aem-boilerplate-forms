# Image Choice

Renders a checkbox group as a grid of selectable images (for example logos). Authors choose whether one or many images can be selected.

## How to Use

Add the **Image choice** component to a form. Define the options (data values and display names) as for a checkbox group, then list one image URL per option in the same order.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `enum` / `enumNames` | Option values and display names (display name is used as image alt text) |
| `images` | Image URL or path for each option, in the same order as the options |
| `selectionMode` | `single` (default) or `multi` |
| `columns` | Images per row (default 4; 2 on small screens) |
| `showLabels` | Show the display name below each image |

## Model Subscriptions

Subscribes to its own `value` with `{ listenChanges: true }`. In single mode, if a rule or prefill sets more than one value, only the last one is kept.

## Model Properties Set

`model.value` is an array of the selected option values. It is committed on the native `change` event of the checkbox clicked, so change rules fire once per click. In single mode, selecting an image unchecks the others before the commit; clicking the selected image again clears the selection.

## Usage Notes

- Base type: `checkbox-group`; `fd:viewType`: `image-choice`.
- Options without a matching image keep the standard checkbox and label.
- The native checkboxes stay in the DOM (visually hidden), so keyboard use (Tab, Space) and required validation work as usual.
