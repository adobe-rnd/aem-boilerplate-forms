# Card Choice

A horizontally scrollable carousel of cards. A rule sets the card data on the field; the customer picks one and its details are stored in the model.

## How to Use

Insert **Card Choice** in the form. Use a rule (or custom function) to set the card data:

```js
dispatchEvent($form.cardChoice, 'custom:setProperty', { properties: { cards: `[ /* card objects */ ]` } });
```

Card object:

| Key | Description |
|-----|-------------|
| `id` | Unique id (falls back to `title`) |
| `title`, `subtitle` | Heading and tagline |
| `image`, `imageAlt` | Card image |
| `features` | Array of strings or `{ icon, text }` |
| `linkText`, `linkUrl` | "All Features & Benefits" link |
| `minAmountLabel`, `minAmount` | Display-ready label and amount (e.g. `₹ 15,000/-`) |
| `ctaLabel` | Overrides the select button label |
| `category` | Optional; when 2+ categories exist, filter chips are shown |

## Authoring Properties

| Property | Description |
|----------|-------------|
| `subtitle` | Text shown above the carousel |
| `selectLabel` | Default select button label (default `Get This Card`) |

## Model Subscriptions

Subscribes to `properties.cards` (data) and `value` (selection) changes.

## Model Properties Set

`value` is set to the JSON string of the selected card object, once per click (committed immediately, not on blur). Rules can `JSON.parse($field.$value)`.

## Usage Notes

Base type `text-input`, `fd:viewType` `card-choice`. Scroll with touch, the next button, dots, or arrow keys on the track.
