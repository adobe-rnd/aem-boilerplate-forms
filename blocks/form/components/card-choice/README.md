# Card Choice

Horizontally scrollable carousel of product cards. A rule supplies the card data; the card the customer picks is written to the model.

## How to Use

Add a **Card choice** component to the form. Use a rule on another field (or on form init) to push the cards:

```js
dispatchEvent(cardChoiceField, 'custom:setCards', [
  {
    id: 'freedom',
    name: 'Freedom',
    description: 'Best Card for Rewards & Offers',
    image: '/images/freedom.png',
    features: ['Upto 10X CashPoints', { icon: '/icons/fuel.svg', text: '₹150 spent = 1 Fuel Point' }],
    linkText: 'All Features & Benefits',
    linkUrl: '/freedom',
    minAmount: '₹ 15,000/-',
    category: 'Retail Cards'
  }
]);
```

Alternatively set `properties.cards` on the field (initially or via a rule).

Card fields: `id`, `name`, `description`, `image`, `imageAlt`, `features` (strings or `{ icon, text }`), `linkText`, `linkUrl`, `minAmountLabel`, `minAmount`, `ctaLabel`, `category`. Filter pills are shown when cards have two or more distinct `category` values.

## Authoring Properties

| Property | Description |
|----------|-------------|
| Label | Heading shown above the carousel |
| `subtitle` | Text under the heading |
| `ctaLabel` | Default select button label (default `Get This Card`) |
| `minAmountLabel` | Default label for the minimum amount (default `Min. FD Amount`) |

## Model Subscriptions

- Custom event `setCards`: payload is the card array (or `{ cards }`).
- `properties.cards` changes.
- `value` changes (highlights the matching card, matched by `id`, then `name`).

## Model Properties Set

`value` is set to the JSON string of the selected card object when the customer clicks the card's select button, once per click, and only if it differs from the current value. Change rules fire once per selection.

## Usage Notes

Base type `text-input`, `fd:viewType` `card-choice`. The text input is hidden. Scrolling uses CSS scroll snap, with arrow buttons and pagination dots.
