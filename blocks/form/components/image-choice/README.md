# Image Choice

A grid of selectable images (for example team logos). Authors choose whether users can pick a single image or several.

## How to Use

Add an **Image choice** component to the form in the Universal Editor, list the options (data value and display value), and provide one image URL/path per option, in the same order.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `enum` / `enumNames` | Option values and names (names are used as image `alt` text and optional captions) |
| `images` | Image URL or path for each option, in option order |
| `selectionMode` | `single` (default) or `multi` |
| `columns` | Choices per row (default 4; 2 on small screens) |
| `showCaptions` | `show` displays the option name under the image; `hide` (default) keeps it for screen readers only |

Standard validation (`required`, `minItems`, `maxItems`) and help properties are inherited from the checkbox group.

## Model Subscriptions

Subscribes to its own `value` changes. In single mode, if the model is set to several values (e.g. by a rule), only the first is kept.

## Model Properties Set

`model.value` is an array of the selected option values (`string[]`, `number[]` or `boolean[]` per "Save value as"). In single mode the array has at most one item. The value is committed on the native checkbox `change` event, i.e. once per click, so change rules fire once per selection change. In single mode, selecting an image deselects the previous one before the value is committed; clicking the selected image again clears it.

## Usage Notes

- Base type: `checkbox-group`; `fd:viewType`: `image-choice`.
- Options remain native, visually hidden checkboxes, so keyboard (Tab, Space) and screen readers work.
