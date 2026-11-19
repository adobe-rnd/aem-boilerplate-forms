# Image Choice

A checkbox group rendered as a grid of selectable images (e.g. "Select your team"), in single or multiple choice mode.

## How to Use

Add **Image choice** in the Universal Editor, define the options (data values and display values), and list one image URL per option, in the same order.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `images` | Image URL per option, same order as the options. Options without an image render as text. |
| `selectionMode` | `single` (default): selecting an option deselects the others. `multi`: any number of options. |
| `imageSize` | Image width/height in px (default 80). |

## Model Subscriptions

Subscribes to `value` changes. In single mode, if a rule sets more than one value, only the first is kept.

## Model Properties Set

`model.value` is an array of selected option values (`string[]`; one item at most in single mode). It is committed on each click via the native `change` event, so change rules fire once per click.

## Usage Notes

- Base type: `checkbox-group`; `fd:viewType`: `image-choice`.
- Option display values are used as the accessible name and tooltip of each image.
- Keyboard: Tab to move, Space to toggle.
