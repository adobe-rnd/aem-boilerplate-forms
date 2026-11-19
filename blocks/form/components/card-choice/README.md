# Card Choice

Horizontally scrollable carousel of cards populated by a rule. Selecting a card stores its details in the field's model value.

## How to Use

Add **Card choice** to a form. In a rule, set the `cards` property of the field, for example `setProperty(field, { properties: { cards: [...] } })`. Cards can also be provided via the field's `properties.cards` in the form JSON. The data may be an array or a JSON string of an array.

## Authoring Properties

Standard text-input properties (label, required, help text). Card data is supplied at runtime, not authored.

| Card key | Description |
|----------|-------------|
| `id` | Unique key used to match the selection (falls back to `name`, then index) |
| `name`, `tagline` | Title and subtitle |
| `image`, `imageAlt` | Card image URL and alt text |
| `features` | Array of strings (or `{ text }`) |
| `linkText`, `linkUrl` | "All Features & Benefits" link (http(s), relative or `#` URLs only) |
| `minAmountLabel`, `minAmount` | Amount box (display text) |
| `buttonLabel` | Select button label (default "Get This Card") |
| `category` | Optional; two or more categories render filter tabs |

## Model Subscriptions

- `properties` change: re-renders cards from `properties.cards`.
- `value` change: highlights the matching card.

## Model Properties Set

`model.value` is the selected card as a JSON string (`JSON.parse` it in rules). It is committed on click via the input's native `change` event, so change rules fire once per selection. Clearing the value clears the highlight.

## Usage Notes

- Base type: `text-input`; `fd:viewType`: `card-choice`.
- Carousel uses CSS scroll-snap with previous/next buttons, page dots and arrow-key scrolling.
