# Card Choice

Horizontally scrollable carousel of cards populated by a rule; the card the user picks is written to the field's model value.

## How to Use

Insert **Card Choice** in a form. A rule (e.g. on form initialize) supplies the cards:

```js
dispatchEvent($form.cardChoice, 'custom:setProperty', {properties: {cards: `[{"title": "Freedom"}]`}})
```

Card object (all keys optional):

| Key | Description |
|-----|-------------|
| `title`, `subtitle` | Card heading and tagline |
| `image`, `imageAlt` | Card artwork |
| `features` | Array of strings or `{ text, icon }` |
| `link`, `linkText` | "All Features & Benefits" link |
| `amountLabel`, `amount` | Boxed label/value row (e.g. Min. FD Amount) |
| `buttonText` | Select button label (default "Get This Card") |
| `category` | When 2+ categories exist, pill tabs filter the cards |

## Authoring Properties

| Property | Description |
|----------|-------------|
| `subtitle` | Text under the field label |

## Model Subscriptions

`properties` (re-renders when `cards` changes), `value` (highlights the matching card), `enabled`/`readOnly`.

## Model Properties Set

`value` is set to `JSON.stringify(card)` of the clicked card, once per click (on `change` rules fire once). Parse it in rules with `JSON.parse`.

## Usage Notes

Base type `text-input`, `fd:viewType` `card-choice`. Scrolling uses CSS scroll-snap, arrow buttons, dots and ←/→ keys.
