# Card Choice

Horizontally scrollable carousel of selectable cards, populated from data set by a rule.

## How to Use

Add the **Card choice** component to a form. Use a rule (or custom function) to set the card data on the field:

```js
setProperty($form.cardChoice, { properties: { cards: [ /* card objects */ ] } });
```

`properties.cards` may be an array or a JSON string. Each card:

| Key | Description |
|-----|-------------|
| `id` | Unique id (falls back to `name`, `title`, then index) |
| `title`, `subtitle` | Heading and tagline |
| `image`, `imageAlt` | Card image |
| `features` | Array of `{ icon?, text }` (or plain strings) |
| `featuresUrl`, `featuresLinkText` | Optional "All Features & Benefits" link |
| `minAmount`, `minAmountLabel` | Amount row (numbers are formatted as `₹ 15,000/-`) |
| `ctaText` | Button text override |

## Authoring Properties

| Property | Description |
|----------|-------------|
| `ctaText` | Default button text (`Get This Card`) |
| `featuresLinkText` | Default features link text |
| `minAmountLabel` | Default amount label (`Min. FD Amount`) |

## Model Subscriptions

`properties` (re-renders when `cards` changes) and `value` (updates the highlighted card).

## Model Properties Set

On clicking a card's button, `properties.selectedCard` is set to the full card object and `value` to the card id (committed immediately on click, so change rules fire once per selection). If new cards no longer contain the selected id, the selection is cleared.

## Usage Notes

Base type `text-input` (input hidden), `fd:viewType` `card-choice`. Scroll via touch/trackpad, arrows, dots or keyboard left/right arrows.
