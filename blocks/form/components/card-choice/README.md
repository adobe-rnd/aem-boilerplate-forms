# Card Choice

Horizontally scrollable carousel of cards. Card data is pushed in by a rule; the card the customer picks is written to the model.

## How to Use

Add a Text Input, set its component type to **Card Choice**, and add a rule that sets `properties.cards` (e.g. `setProperty(cardChoice, { properties: { cards: [...] } })`). The field label is used as the heading and the help text as the sub-heading.

## Authoring Properties

Standard text-input properties (name, title, visibility, enabled, read-only, required, help text). No custom properties.

### Card data shape (`properties.cards`)

| Key | Description |
|-----|-------------|
| `id` | Optional unique id (falls back to `title`) |
| `title`, `subtitle` | Card heading and tagline |
| `image` | http(s) image URL; `imageAlt` optional |
| `features` | Array of strings or `{ text, icon }` |
| `linkText`, `linkUrl` | "All Features & Benefits" link |
| `minAmountLabel`, `minAmount` | Amount row (label defaults to "Min. FD Amount") |
| `buttonText` | Select button label (default "Get This Card") |
| `category` | Optional; with 2+ categories, filter chips are shown |

## Model Subscriptions

`properties.cards` / `properties` (re-render), `value` (sync selected card), `enabled`, `readOnly`.

## Model Properties Set

On clicking a card's button, `model.value` is set to the **JSON string of the selected card object** via a single native `change` event, so change rules fire once per selection. Parse it with `JSON.parse` in rules.

## Usage Notes

Base type `text-input`, `fd:viewType` = `card-choice`. Scrolling uses CSS scroll-snap with prev/next arrows, pagination dots and Arrow-key support on the focused viewport. Text is rendered via `textContent` and URLs are restricted to http(s).
