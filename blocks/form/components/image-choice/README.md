# Image Choice

A tile picker where each option is an image (for example team logos); the author chooses whether one or several can be selected.

## How to Use

Add an **Image Choice** component, enter the options (data value and display value) and list one image URL per line in **Image URLs**, in the same order as the options.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `enum` / `enumNames` | Option values and names. Names are used as the accessible label |
| `selectionMode` | `single` (default) or `multi` |
| `imageUrls` | One image URL per line, matching the option order |
| `columns` | Number of tiles per row (default 4; capped at 3 on narrow screens) |
| `showLabels` | Show the option name under the image. Hidden visually (still read by screen readers) when off |

## Model Subscriptions

Listens to `value` changes. In `single` mode, if a rule sets more than one value, only the first is kept.

## Model Properties Set

`value` is always an array (`string[]` or `number[]`). In `single` mode it holds at most one entry; clicking the selected tile again clears it. The value is committed on the native `change` of the clicked option, so field change rules fire once per click.

## Usage Notes

- Base type: `checkbox-group`, `fd:viewType`: `image-choice`.
- The native checkboxes stay in the DOM (visually hidden over the tile), so keyboard (Tab, Space) and screen readers work. In single mode they expose `role="radio"` inside a `radiogroup`.
