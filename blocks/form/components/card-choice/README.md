# Card Choice

Horizontal carousel of product cards that extends `text-input`. Selecting a card stores its `id` as the field value.

## How to Use

Add a Text Input with `fd:viewType` `card-choice`. Provide the card data at runtime with a rule (Set Property action on the field, property `cards`).

## Authoring Properties

| Property | Description |
|----------|-------------|
| `properties.cards` | Set at runtime by a rule. Array of `{ id, title, subtitle, image, features[], detailsUrl, minAmount, ctaLabel }` |

`minAmount` is shown as Indian Rupees (e.g. `₹15,000/-`).

## Model Subscriptions

- `properties` change (`cards`): re-renders all cards (also read on register if already set).
- `value` change: marks the card with the matching `id` as selected.

## Model Properties Set

- `value`: the selected card's `id`, committed on click of the card's call-to-action (one change per selection).

## Usage Notes

- Base type `text-input`, `fd:viewType` `card-choice`; the text input is hidden.
- Cards sit in a horizontally scrollable track with Previous/Next buttons and pagination dots.
- Each call-to-action is a `<button type="button">` exposing `aria-pressed`; only one card is selected.
