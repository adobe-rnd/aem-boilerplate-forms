# Card Choice

Horizontally scrollable carousel of selectable cards, populated by a rule.

## How to Use

Insert the "Card Choice" component. A rule sets the cards on the field's `properties.cards`
(for example `setProperty(field, { properties: { cards: [...] } })`). Each card is an object:

| Key | Description |
|-----|-------------|
| `id` | Unique key (falls back to `name`) |
| `name` | Card title |
| `tagline` | Sub heading |
| `image`, `imageAlt` | Card image |
| `features` | Array of strings |
| `linkText`, `linkUrl` | "All Features & Benefits" link |
| `minAmountLabel`, `minAmount` | Min. FD amount box (numbers formatted as ₹ en-IN) |
| `buttonLabel` | Button text (default "Get This Card") |

## Model Subscriptions

`properties.cards` (the entry re-renders the carousel) and `value` (highlights the selected card).

## Model Properties Set

`value` is set to the JSON string of the selected card object when the user clicks a card or its
button. It is committed once per selection.

## Usage Notes

Base type `text-input`, `fd:viewType` `card-choice`. The carousel uses CSS scroll snapping, prev/next
buttons, pagination dots and arrow-key navigation.
