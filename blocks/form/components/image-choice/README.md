# Image Choice

Checkbox group rendered as a grid of selectable image tiles (e.g. "Select your team").

## How to Use

Insert the *Image Choice* component, define the options with `enum` / `enumNames`, and set `optionImages`.

## Authoring Properties

| Property | Type | Description |
|----------|------|-------------|
| `optionImages` | text | Comma-separated image URLs, in the same order as the options. The option label becomes the image `alt`. Options without a URL keep their text label. |
| `selectionMode` | select | `multiple` (default) or `single`. |

## Model Subscriptions

Listens to `value` (re-applies single-mode limit) and `enum` / `enumNames` (re-renders tiles).

## Model Properties Set

Uses the native checkbox `change` event of the form block: `model.value` is an array of selected option values, committed once per click. In `single` mode it holds at most one value; selecting another tile replaces it, and clicking the selected tile keeps it selected (no change fired). An external value with several entries in `single` mode is trimmed to the first.

## Usage Notes

- Base type `checkbox-group`, `fd:viewType` `image-choice`.
- Tiles are native, visually hidden checkboxes labelled by the option text (accessible name), so Tab/Space work; selected tiles get a `selected` class and highlight.
