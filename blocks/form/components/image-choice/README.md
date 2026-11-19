# Image Choice

Selectable grid of images (logos, icons, avatars) where the user picks one or several options.

## How to Use

Insert the **Image Choice** component, define the options (data and display values) and add one image URL per option, in the same order.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `images` | Image URLs, in the same order as the options |
| `selectionMode` | `single` (default) or `multi` |
| `columns` | Images per row (default 4, 2 on narrow screens) |
| `showLabels` | Show the option display values under the images; otherwise they are screen-reader only |

## Model Subscriptions

Subscribes to its own model on `register`. In single mode, a prefilled value with several entries is trimmed to the first one.

## Model Properties Set

`value` is an array (`string[]` by default) built by the form block on the input's native `change` event, so rules fire once per click. In single mode the array holds at most one item; clicking the selected image again clears it.

## Usage Notes

- Base type: `checkbox-group`; `fd:viewType`: `image-choice`.
- Each option is a visually hidden checkbox, so keyboard (Tab, Space), required/min/max validation and enum updates keep working.
