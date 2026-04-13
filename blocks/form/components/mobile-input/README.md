# Mobile Input Component

A panel-based custom component that combines a searchable country code selector with a phone number input field. The country code list is fetched from a configurable API endpoint at runtime.

## How it works

This component decorates a panel that contains three child fields:

- `countryCode` — a drop-down field that holds the selected ISD code (e.g. `+91`)
- `countryCodeSearch` — a hidden text field used as the search input for filtering country codes
- `mobileInput` — a number input for the phone number digits

On load, the component fetches a JSON array of countries from `countryCodesUrl`, builds a filterable `<ul>` dropdown, and wires up click and keyboard search listeners. The phone number input is restricted to digits only, and capped at `phoneMaxLength` characters.

## Registration

Add `'mobile-input'` to the `customComponents` array in `blocks/form/mappings.js`:

```js
let customComponents = ['mobile-input', /* other components */];
```

## Authoring (Universal Editor)

Set the field type on the panel to `mobile-input`:

```
fd:viewType: mobile-input
```

The following properties are configurable via the component's property sheet:

| Property | Type | Default | Description |
|---|---|---|---|
| `countryCodesUrl` | string | — | URL returning a JSON array of country objects. Required for the country code list to populate. |
| `phoneMinLength` | number | `7` | Minimum digit count for the phone number. Not enforced by the component at runtime (use form-level validation for enforcement). |
| `phoneMaxLength` | number | `15` | Maximum digit count. Characters beyond this limit are stripped on input. |

## Country codes API contract

The URL must return a JSON array where each object has the following fields:

```json
[
  { "ISDCODE": "91",  "DESCRIPTION": "India" },
  { "ISDCODE": "1",   "COUNTRYNAME": "United States" }
]
```

- `ISDCODE` — the numeric ISD/country calling code (without the `+`)
- `DESCRIPTION` or `COUNTRYNAME` — the display name (the component checks `DESCRIPTION` first, then falls back to `COUNTRYNAME`)

Duplicate ISD codes in the response are deduplicated; only the first occurrence is kept.

## Panel structure

The component expects the following child field names inside the panel. These are defined in `_mobile-input.json` and are provisioned automatically when you insert the component via Universal Editor:

| Child field name | Field type | Purpose |
|---|---|---|
| `countryCode` | `drop-down` | Stores and displays the selected ISD code |
| `countryCodeSearch` | `text-input` | Search input, toggled visible/hidden by the component |
| `mobileInput` | `number-input` | The phone number digits |

## Known limitations

- **`countryCodesUrl` is required.** If the property is not set, a warning is logged and the country list will be empty. The phone number field still renders and accepts input.
- **`phoneMinLength` is informational only.** The component does not enforce a minimum length at the input level; use form-level constraints or rules for minimum length validation.
