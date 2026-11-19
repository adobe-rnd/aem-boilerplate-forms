# Image Choice

Pick one or several options by clicking images (for example team logos) instead of text checkboxes. Selection can be single or multiple.

## How to Use

Insert **Image Choice** in a form. Set the option values (`enum`), display names (`enumNames`, used as the accessible name and tooltip) and the images, in the same order as the options.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `selectionMode` | `single` (default) allows one image; `multiple` allows any number |
| `images` | Image URL per option, in option order |
| `columns` | Images per row (default 4; capped at 3 on small screens) |

## Model Subscriptions

Subscribes to `enum` / `enumNames` changes and re-applies the images to the rebuilt options.

## Model Properties Set

Writes `value` through the standard checkbox-group `change` handling: once per click, as an array (`string[]` by default). In single mode the value is an array with at most one item (empty when deselected).

## Usage Notes

- Base type `checkbox-group`, `fd:viewType` = `image-choice`.
- Native checkboxes stay in the DOM (visually hidden), so keyboard (Tab/Space), required/min/max validation and read-only/disabled work as usual.
- Options without an image fall back to their text.
