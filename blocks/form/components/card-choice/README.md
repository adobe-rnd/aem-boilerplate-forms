# Card Choice

Horizontally scrollable carousel of cards (name, tagline, image, features, benefits link, minimum amount, call-to-action) that lets the user pick one card.

## How to Use

Add the **Card choice** component to a form. Cards are supplied at runtime by a rule or custom function that sets the `cards` property on the field, e.g. `globals.functions.setProperty(field, { properties: { cards: [...] } })`.

## Authoring Properties

Only the standard text-input properties (name, title, visibility, enabled, read-only, column span, help text). Card data is not authored; it comes from the rule.

## Cards Data Shape

```json
[{
  "id": "freedom",
  "name": "Freedom",
  "tagline": "Best Card for Rewards & Offers",
  "image": "https://.../freedom.png",
  "imageAlt": "Freedom card",
  "features": ["Upto 10X CashPoints", { "icon": "https://.../icon.svg", "text": "Joining Fees - ₹500/-" }],
  "link": { "label": "All Features & Benefits", "url": "https://..." },
  "minAmountLabel": "Min. FD Amount",
  "minAmount": 15000,
  "ctaLabel": "Get This Card"
}]
```

`id` identifies the card (falls back to `name`). A numeric `minAmount` is shown as `₹ 15,000/-`; a string is shown as is. All keys except `name` are optional.

## Model Subscriptions

- `properties.cards` (or `properties`): re-renders the cards.
- `value`: highlights the card matching the model value.
- `enabled` / `readOnly`: enables or disables the select buttons.

## Model Properties Set

On clicking a card's button, the input's `change` event is dispatched once; `model.value` becomes the JSON string of the selected card object (`JSON.parse` it in rules). Change rules fire once per selection. Re-selecting the same card is a no-op.

## Usage Notes

- Base type: `text-input`; `fd:viewType`: `card-choice`.
- Carousel uses CSS scroll-snap: swipe/drag, prev/next buttons, arrow keys on the track, and pagination dots.
