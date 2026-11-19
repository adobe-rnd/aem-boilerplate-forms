# Image Choice

A grid of selectable images (e.g. "Select your team") that works as a single-choice or multiple-choice field, configurable by the author.

## How to Use

Add an **Image choice** component to a form. Define options in **Options (Data Value)** / **Options (Display Value)**, then list one image URL per option, in the same order, under **Image Choice → Option images (URLs)**.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `selectionMode` | `single` (default) or `multiple` |
| `imageUrls` | Image URL per option, in option order |
| `columns` | Images per row (default 4) |
| `showLabels` | Show option display values below images (default hidden, kept as accessible text) |

Standard checkbox-group properties (options, required, min/max items, help text) also apply.

## Model Subscriptions

Subscribes to its own `value` changes. In single mode, if a rule or prefill sets more than one value, only the last is kept.

## Model Properties Set

`value` is an array (`string[]` by default) — one entry in single mode, any number in multiple mode. It is committed on each `change` event of an option, i.e. once per click, so change rules fire once per click.

## Usage Notes

- Base type: `checkbox-group`; `fd:viewType`: `image-choice`.
- Single mode unchecks the other options before the form model reads the selection.
- Options are visually hidden native checkboxes, so keyboard (Tab, Space) and screen readers work. Images are decorative; the option label is the accessible name.
