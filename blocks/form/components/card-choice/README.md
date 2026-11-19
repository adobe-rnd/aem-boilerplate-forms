# Card Choice

Horizontally scrollable (carousel) list of cards, populated by a rule, where the customer picks one card.

## How to Use

Add a **Card Choice** component. A rule sets the cards on the field's `properties.cards`, e.g. `setProperty($field, {properties: {cards: [...]}})` or `$field.properties = {...}`.

## Authoring Properties

Standard text-input basic and validation properties; no custom properties.

Card shape (all keys optional except `title`):

```json
{
  "id": "freedom",
  "title": "Freedom",
  "subtitle": "Best Card for Rewards & Offers",
  "image": "https://.../freedom.png",
  "features": ["Upto 10X CashPoints", { "text": "Joining Fees - ₹500/-", "icon": "https://.../fee.svg" }],
  "linkText": "All Features & Benefits",
  "linkUrl": "https://...",
  "minAmountLabel": "Min. FD Amount",
  "minAmount": "₹ 15,000/-",
  "ctaLabel": "Get This Card"
}
```

## Model Subscriptions

`properties` (re-renders when `cards` changes) and `value` (highlights the selected card).

## Model Properties Set

`value` is set to the JSON string of the whole selected card object when the user clicks the card's button (once per selection). Rules can `JSON.parse` it.

## Usage Notes

Base type `text-input`, `fd:viewType` `card-choice`. Cards scroll with touch/trackpad, the arrow buttons or the Left/Right keys; the dots show the current page.
