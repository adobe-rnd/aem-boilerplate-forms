# Image Choice

Image tile grid for choosing one or several options, extending `checkbox-group`.

## How to Use

Add an Image Choice component, define options with the standard `enum` / `enumNames`, and set `optionImages`.

## Authoring Properties

| Property | Type | Description |
|----------|------|-------------|
| `optionImages` | text | Comma-separated image URLs, in option order |
| `selectionMode` | select | `single` or `multiple` (default) |

## Model Subscriptions

Subscribes to its own model (`register`, `change`); in `single` mode a model value with several entries is trimmed to the first one. Option re-renders (enum/enumNames changes) are re-decorated via a `MutationObserver`.

## Model Properties Set

`value` is an array of selected option values, committed on the native `change` of a tile's checkbox (once per click). In `single` mode the other tiles are unchecked first, and clicking the selected tile keeps it selected (no change is fired). External `value` changes are applied by the form block to the checkboxes.

## Usage Notes

- Base type `checkbox-group`, `fd:viewType` `image-choice`.
- Each tile is a visually hidden native checkbox over a label containing the image; the option label is the image `alt` (accessible name). Without an image URL, the label text is shown.
- Space toggles the focused tile; checked tiles are highlighted.
