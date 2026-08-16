# Regex Text Input

A text input that silently filters disallowed characters as the user types or pastes, using the field's OOTB `pattern` as the single source of truth — no duplicate custom property needed.

## Features

- Keystroke filtering — characters outside the field's `pattern` character class are stripped as typed, preserving caret position
- Paste support — pasted text is cleaned through the same filter before landing in the input
- Length cap — respects the field's OOTB `maxLength`
- Optional case transform (`textCase`) — applied as-typed, on paste, and to prefilled/imported values
- Reflects values from any source (prefill, importData, rules) via `{ listenChanges: true }`
- Owns no validity — native `pattern` / `minLength` / `maxLength` constraints handle that

## Authoring Properties

| Property | Type | Description |
|---|---|---|
| `pattern` | string | OOTB validation pattern. The char-class is extracted from this to derive the keystroke filter (e.g. `^[A-Za-z0-9]+$` → allows alphanumerics only) |
| `maxLength` | number | OOTB max length — caps both the input and the cleaned value |
| `textCase` | `none` / `upper` / `lower` | View-only case transform applied on every input event and on value changes from any source. Default: `none` |

## Model Subscriptions

Uses `{ listenChanges: true }`:

| Event | Behavior |
|---|---|
| `register` | Captures the field model; applies `clean()` to any pre-existing value |
| `change` (value) | Reflects the new value through `clean()` into the input — covers prefill, importData, and rule-driven sets |

## Usage Notes

- Based on `text-input` resource type with `fd:viewType: regex-text-input`.
- The component commits via `model.value` (not a synthetic DOM event), so rules and headless usage work correctly.
- If the `pattern` has no leading character class (e.g. a pure length or email pattern), no keystroke filtering is applied — native validity still enforces the pattern.
- `cleanValue(value, fieldJson)` is exported for unit testing — assert that every source (type, paste, prefill, importData) resolves identically.
