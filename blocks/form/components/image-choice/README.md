# Image Choice

A checkbox group rendered as a grid of selectable images. Authors choose whether users can pick a single image or several.

## How to Use

Add the **Image choice** component from the *Custom Form Components* group, define the options (data value and display value) and give each option an image URL in the same order.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `selectionMode` | `single` (default) allows one image at a time; `multi` allows several. |
| `imageUrls` | Image URL per option, in the same order as the options. |
| `columns` | Images per row. Empty fits as many as possible. |
| `showLabels` | Shows the display value under each image. It is always used as the image `alt`. |

All other properties come from the checkbox group (options, default, required, `minItems`/`maxItems`, help text, ...).

## Model Subscriptions

- `enum` / `enumNames`: the form block re-renders the options, so the images are applied again.

## Model Properties Set

`value` is an array of the selected option values (as with a checkbox group), committed from the native checkbox `change` event, once per click. In `single` mode the other checkboxes are unchecked before the event reaches the form, so the model changes once and only holds one value. Clicking the selected image again clears the selection unless the field is required.

## Usage Notes

- Base type: `checkbox-group`; `fd:viewType`: `image-choice`.
- The native checkboxes stay in the DOM (visually transparent over the image), so keyboard (Space, Tab) and validation behave as usual.
- An option without an image URL falls back to its text label.
