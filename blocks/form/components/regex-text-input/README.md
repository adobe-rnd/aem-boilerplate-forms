# Regex Text Input

A text input with configurable regex-based validation. Invalid characters are rejected in real-time as the user types, and the regex pattern can be updated dynamically at runtime.

## Authoring Properties

| Property | Type | Description |
|----------|------|-------------|
| placeholder | string | Placeholder text |
| regexPattern | string | Regular expression pattern to validate input (e.g., `^[A-Za-z0-9]+$`) |
| regexErrorMessage | string | Error message shown when input doesn't match the pattern |
| minLength | number | Minimum character length (from validation config) |
| maxLength | number | Maximum character length (from validation config) |

Inherits standard string validation fields.

## Model Subscriptions

Subscribes to the `change` event on `fieldModel`:

| Property Change | Behavior |
|-----------------|----------|
| `properties` → `regexPattern` | Re-initializes the regex validation with the new pattern |
| `properties` → `regexErrorMessage` | Updates the validation error message for the new pattern |

## Usage Notes

- Based on `textinput` resource type with `fd:viewType: regex-text-input`.
- Invalid characters are rejected immediately — the last typed character is removed if the full value fails the regex test.
- The regex is applied to the entire value, not individual characters.
- Pattern can be changed dynamically via rules (e.g., switching between alphabetic and alphanumeric patterns based on form state).
- Also applies `minLength`/`maxLength` constraints via the `setConstraints` utility.
