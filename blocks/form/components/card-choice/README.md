# Card Choice

Renders an array of card objects as a horizontally scrollable carousel; the card the user picks is stored in the field's model.

## How to Use

Add a **Card choice** component to the form (base type `text-input`, `fd:viewType: card-choice`). A rule (on form initialize, another field's change, etc.) supplies the cards, either by setting the `cards` property or by dispatching a `setCards` custom event:

```js
setProperty($form.cardChoice, { properties: { cards: [ /* ... */ ] } });
// or: dispatchEvent($form.cardChoice, 'custom:setCards', [ /* ... */ ]);
```

Card shape (all optional except `title`):

```json
{
  "id": "freedom",
  "category": "Retail Cards",
  "title": "Freedom",
  "subtitle": "Best Card for Rewards & Offers",
  "image": "https://example.com/freedom.png",
  "imageAlt": "Freedom card",
  "features": ["Upto 10X CashPoints", "₹150 spent = 1 Fuel Point", "Joining Fees - ₹500/-"],
  "linkText": "All Features & Benefits",
  "linkUrl": "https://example.com/freedom",
  "amountLabel": "Min. FD Amount",
  "amount": "₹ 15,000/-",
  "buttonText": "Get This Card"
}
```

If cards have two or more distinct `category` values, category tabs are shown and filter the carousel.

## Authoring Properties

| Property | Description |
|----------|-------------|
| `buttonText` | Default text of the select button (default `Get This Card`) |
| `selectedButtonText` | Button text on the selected card (default `Selected`) |
| `amountLabel` | Default amount label (default `Min. FD Amount`) |

## Model Subscriptions

- `properties` change: re-renders when `properties.cards` is present.
- `value` change: updates the selected card highlight.
- Custom event `setCards`: payload is the cards array.

## Model Properties Set

`model.value` is set to the JSON string of the selected card object when the user clicks the card's button (committed once per selection, not on blur). Change rules fire once per new selection. Re-clicking the selected card does nothing. If `id` is present it is used to match the selection against new card data; otherwise deep equality is used.

## Usage Notes

- Base type: `text-input`; `fd:viewType`: `card-choice`. The text input is hidden.
- Scroll with touch/trackpad, the arrow buttons, or the pagination dots. Cards snap to the start.
- Text is rendered via `textContent`; only `http(s)`/relative URLs are used for images and links.
