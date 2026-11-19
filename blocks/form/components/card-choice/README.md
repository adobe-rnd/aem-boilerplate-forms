# Card Choice

Horizontally scrollable carousel of cards populated by a rule; the card the user picks is written to the model.

## How to Use

Insert the **Card Choice** component. Use a rule (e.g. on form initialize or another field's change) to set the cards:

```js
setProperty(cardChoice, { properties: { cards: [ /* card objects */ ] } });
```

Card object (all optional except `title`):

| Key | Description |
|-----|-------------|
| `id` | Unique id (defaults to the card index) |
| `title`, `subtitle` | Heading and tagline |
| `image`, `imageAlt` | Card artwork |
| `features` | Array of strings or `{ "text", "icon" }` |
| `linkText`, `linkUrl` | "All Features & Benefits" link |
| `minAmountLabel`, `minAmount` | Amount box, e.g. `Min. FD Amount` / `₹ 15,000/-` |
| `category` | When more than one category exists, filter tabs are shown |

## Authoring Properties

| Property | Description |
|----------|-------------|
| `selectLabel` | Button label, default `Get This Card` |
| `selectedLabel` | Label on selected card, default `Selected` |

## Model Subscriptions

`properties.cards` (re-renders) and `value` (highlights the matching card, by `id` or `title`).

## Model Properties Set

`value` is set to the JSON string of the selected card object when its button is clicked (once per selection).

## Usage Notes

Base type `text-input`, `fd:viewType` `card-choice`. Carousel supports arrow buttons, dots, touch/trackpad scrolling and arrow keys.
