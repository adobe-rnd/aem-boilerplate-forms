# Image Choice

Image-based option picker (e.g. "Select your team"): each option is shown as a clickable image, and the author chooses whether one or many can be selected.

## How to Use

Add an **Image choice** field in the Universal Editor. Set the options in *Options (Data Value)* / *Options (Display Value)*, then list one image URL per option, in the same order, in *Option images*. The display value is used as the image `alt` text and tooltip. Options without an image fall back to showing their text.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `selectionMode` | `single` (default) selects one image at a time; `multiple` allows several (use Min/Max items validation to constrain) |
| `images` | Image URL/path per option, in option order |
| `columns` | Images per row (default 4; 2 on narrow screens) |

All standard checkbox-group properties (label, required, enum, enumNames, default, help text, etc.) are available.

## Model Subscriptions

Listens to its own `value` changes. In `single` mode, if a rule sets more than one value, only the last one is kept.

## Model Properties Set

Sets `value` (an array) via the native `change` event of the underlying checkbox, i.e. once per click; change rules fire once per selection change. In single mode the other checkboxes are cleared before the model is read, and clicking the selected image again deselects it.

## Usage Notes

- Base type: `checkbox-group`; `fd:viewType`: `image-choice`.
- The native checkboxes stay in the DOM (visually hidden over the image), so keyboard (Tab/Space), required validation and disabled/read-only state keep working.
- If options are re-rendered by the form block (enum changes), the image decoration is re-applied.
