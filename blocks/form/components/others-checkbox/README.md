# Others Checkbox Component

The `others-checkbox` component extends the standard checkbox group functionality by adding an "Others" option that, when checked, reveals a text input field for custom values.

## Features

- **Standard checkbox group**: Displays multiple checkbox options as defined in the form configuration
- **Others checkbox**: Automatically adds an "Others" checkbox as the last option
- **Dynamic text input**: When "Others" is checked, a text input field appears for custom values
- **Combined values**: The final field value includes all checked checkbox values plus any custom text from the "Others" input
- **Validation**: Ensures that if "Others" is checked, a value must be provided in the text input
- **Configurable**: Customizable labels, placeholders, and error messages

## Configuration Properties

The component supports the following authorable properties:

- **`othersLabel`** (string): Label text for the "Others" checkbox (default: "Others")
- **`othersPlaceholder`** (string): Placeholder text for the others input field (default: "Please specify")
- **`othersRequiredMessage`** (string): Error message shown when others is checked but input is empty (default: "Please specify what others means")

## Usage

1. Add the "Others Checkbox" component to your form
2. Configure the checkbox options using the standard enum/enumNames properties
3. Optionally customize the others label, placeholder, and error message
4. The component will automatically handle the "Others" functionality

## Behavior

- When users check regular options, they are included in the field value
- When users check "Others", a text input appears below the checkboxes
- If "Others" is checked but no text is provided, a validation error is shown
- The final submitted value is an array containing all checked values plus any custom "others" text
- The component handles both user interactions and programmatic value updates

## Example

If a user checks "Option 1" and "Others" (with "Custom Value" entered), the final field value would be:
```json
["option1", "Custom Value"]
```

## Technical Details

- Extends: `checkbox-group`
- Field Type: `checkbox-group`
- View Type: `others-checkbox`
- Data Type: `string[]` (array of strings)
- Requires: Custom component registration in mappings.js and _form.json
