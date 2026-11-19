# Card Choice

Carousel of selectable cards (image, features, minimum amount, call to action) populated by a rule. Selecting a card stores its details in the model.

## How to Use

Add the **Card Choice** component to a form. The label is rendered as the heading. A rule supplies the cards, either by:

- `setProperty(field, { properties: { cards: [...] } })`, or
- dispatching the custom event `setCards` on the field with the array as payload.

Card shape (all keys optional except `title`; `id` identifies the card, falling back to `title`):

```json
{
  "id": "freedom",
  "category": "Retail Cards",
  "title": "Freedom",
  "subtitle": "Best Card for Rewards & Offers",
  "image": "/images/freedom.png",
  "imageAlt": "Freedom card",
  "features": ["Upto 10X CashPoints", { "text": "Joining Fees - ₹500/-" }],
  "featuresLink": { "label": "All Features & Benefits", "url": "https://example.com" },
  "minAmount": 15000
}
```

When cards carry two or more distinct `category` values, filter pills are shown. The track scrolls horizontally (touch, arrows, keyboard left/right, dots).

## Authoring Properties

| Property | Description |
|----------|-------------|
| `subtitle` | Text under the heading |
| `minAmountLabel` | Label of the amount row (default `Min. FD Amount`) |
| `ctaLabel` | Select button label (default `Get This Card`) |

## Model Subscriptions

- `value` changes: selection is synced to the matching card (by `id`/`title`).
- `properties.cards` / `properties` changes: cards are re-rendered.
- Custom event `setCards`: payload is the cards array.

## Model Properties Set

`value` is set to `JSON.stringify(selectedCard)` when the customer clicks a card's select button, via a bubbling `change` event on the hidden input (committed once per selection; change rules fire once). Re-selecting the same card does nothing.

## Usage Notes

Base type `text-input`, `fd:viewType` `card-choice`. A rule can read the selection with `JSON.parse(field.$value)`, and can preselect a card by setting the value to a card's JSON.
