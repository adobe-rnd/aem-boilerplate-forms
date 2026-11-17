# Card Choice

Horizontal carousel of product cards extending `text-input`. Selecting a card stores its `id` as the field value.

## How to Use

Insert a **Card Choice** component, then set `properties.cards` from a rule (rule editor "Set Property", which dispatches `custom:setProperty`).

## Authoring Properties

No custom authoring properties; it inherits the `text-input` fields. Card data comes from the runtime property `cards`:

| Key | Description |
|-----|-------------|
| `id` | Value written to the model when selected |
| `title`, `subtitle` | Card heading texts |
| `image` | Card image URL |
| `features` | Array of feature strings (each with an icon) |
| `detailsUrl` | Target of the "All Features & Benefits" link |
| `minAmount` | Number, shown as Indian Rupees, e.g. `₹15,000/-` |
| `ctaLabel` | Label of the call-to-action button |

## Model Subscriptions

- `properties` / `properties.cards` changes: re-render all cards (also on register if already set).
- `value` changes: mark the matching card selected.

## Model Properties Set

`model.value` is set to the card `id` immediately when a call-to-action is clicked (one `value` change per selection).

## Usage Notes

- Base type `text-input`, `fd:viewType` `card-choice`. The text input is hidden.
- Track is horizontally scrollable; "Previous"/"Next" buttons and pagination dots scroll it.
- CTA buttons expose `aria-pressed`; only one card is selected at a time.
