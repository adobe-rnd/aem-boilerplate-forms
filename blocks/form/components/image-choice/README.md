# Image Choice

A choice field where each option is shown as a clickable image (for example "Select your team" logos). Authors decide whether one or several images can be selected.

## How to Use

Add the **Image Choice** component to a form, define the options (data values and display names) and provide one image URL per option, in the same order as the options.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `selectionMode` | `single` (default) allows one image; `multiple` allows several. |
| `images` | Image URLs, matched to the options by position. |
| `columns` | Images per row (default 4, max 3 on small screens). |
| `showLabels` | Show the option display name under each image. Otherwise it is only used as alt text/tooltip. |

All checkbox-group properties (options, required, min/max items, description, ...) are also available.

## Model Subscriptions

- `enum` / `enumNames` changes: the options are re-rendered by the form block and re-decorated with images.

## Model Properties Set

`value` is an array of the selected option values (also in single mode, where it holds at most one entry). It is committed on the native `change` event of the underlying checkbox, i.e. once per click, so change rules run once per selection.

## Usage Notes

- Base type `checkbox-group`, `fd:viewType` = `image-choice`.
- In single mode, selecting an image unchecks the others; clicking the selected image again clears it.
- Inputs stay in the DOM (visually hidden), so keyboard (Tab, Space) and screen readers work.
