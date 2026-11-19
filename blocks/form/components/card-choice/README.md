# Card Choice

Carousel of selectable cards (title, image, features, minimum amount, call-to-action) populated by a rule; the chosen card is written to the model.

## How to Use

Add a **Card choice** component (text-input based) to the form. A rule (e.g. on form initialize or another field's change) sets the card data on the component's `cards` property:

```js
setProperty(cardChoice, { properties: { cards: [ /* card objects */ ] } });
```

A `custom:setCards` event whose payload is the array is also supported.

Card object:

| Key | Description |
|-----|-------------|
| `id` | Unique key (falls back to `name`/`title`) |
| `title`, `subtitle` | Heading and tagline |
| `image`, `imageAlt` | Card artwork |
| `features` | Array of strings or `{ text, icon }` |
| `featuresLabel`, `featuresLink` | "All Features & Benefits" link |
| `minAmountLabel`, `minAmount` | Minimum amount row (value displayed as given, e.g. `₹ 15,000/-`) |
| `ctaLabel` | Select button label (default `Get This Card`) |

## Authoring Properties

Standard text-input basic, validation and help fields. Cards are data-driven, not authored.

## Model Subscriptions

- `properties` change → re-renders cards from `properties.cards`
- `value` change → highlights the matching card
- custom event `setCards` → re-renders from payload

## Model Properties Set

`value` is set to `JSON.stringify(card)` of the selected card immediately on click (rules on change fire once per selection).

## Usage Notes

Base type `text-input`, `fd:viewType` = `card-choice`. Cards scroll horizontally (scroll-snap, touch, arrow buttons, ←/→ keys) with page dots. The selected card is matched by `id`. Disabled/read-only fields ignore clicks.
