# Card Choice

Carousel of selectable cards (e.g. credit cards) built on a text input. Cards are supplied by a rule; the selected card is written to the model.

## How to Use

Add the **Card Choice** component to the form. Use a rule (or custom function) to supply the cards by setting the `cards` property, e.g. `dispatchEvent($form.cardChoice, 'custom:setProperty', {properties: {cards: [...]}})`. The cards are re-rendered whenever the property changes.

Card shape (all optional except `name`):

```json
{
  "name": "Freedom",
  "tagline": "Best Card for Rewards & Offers",
  "image": "/images/freedom.png",
  "imageAlt": "Freedom card",
  "features": ["Upto 10X CashPoints", "₹150 spent = 1 Fuel Point", "Joining Fees - ₹500/-"],
  "detailsLabel": "All Features & Benefits",
  "detailsUrl": "https://example.com/freedom",
  "minAmountLabel": "Min. FD Amount",
  "minAmount": "₹ 15,000/-",
  "buttonLabel": "Get This Card"
}
```

Extra keys are kept and returned in the selected value.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `selectLabel` | Default button label when a card has no `buttonLabel` (default `Get This Card`) |

## Model Subscriptions

- `properties.cards` change — re-renders the cards.
- `value` change — updates the selected card highlight.

## Model Properties Set

`value` is set to the JSON string of the selected card object when the card's button is clicked (a single `value` change per selection, no `change` DOM event required).

## Usage Notes

Base type `text-input`, `fd:viewType` `card-choice`. Cards scroll horizontally (scroll-snap, touch, arrow buttons, dots, ArrowLeft/ArrowRight on the track). Use `JSON.parse($field.$value)` in rules to read the selection.
