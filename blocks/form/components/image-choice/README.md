# Image Choice

Image-based option picker (e.g. "Select your team" logo grid) supporting single or multiple selection.

## How to Use

Add the **Image Choice** component to a form, define the options (`enum` / `enumNames`), and list one image URL per line in **Image URLs**, in the same order as the options.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `selectionMode` | `single` (default) or `multi` |
| `imageUrls` | One image URL per line, matching the option order |
| `columns` | Images per row (default 4; max 3 on narrow screens) |
| `showLabels` | Show option names under the images (default: visually hidden, still read by screen readers and used as `alt`) |

## Model Subscriptions

- `value`: in single mode, trims a multi-value model to the first entry.
- `enum` / `enumNames`: re-decorates options.

## Model Properties Set

`model.value` is written by the OOTB checkbox-group `change` handling, once per click. In single mode the previously selected image is unchecked before that handler runs, so the value is always an array with at most one item (e.g. `["kc"]`). Clicking the selected image again clears it.

## Usage Notes

- Base type: `checkbox-group`; `fd:viewType`: `image-choice`.
- Native checkboxes stay in the DOM (visually hidden), so keyboard (Tab, Space) and validation (`required`, `minItems`, `maxItems`) work as usual.
