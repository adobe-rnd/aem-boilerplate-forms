# PAN Input Component

A custom form component for validating PAN (Permanent Account Number) input with configurable validation rules and automatic formatting.

## Features

- **Configurable Fourth Character**: Default is 'P', but can be customized
- **Automatic Uppercase Conversion**: All input is automatically converted to uppercase
- **Position-Specific Validation**:
  - First 5 characters: Letters (with 4th being configurable)
  - Next 4 characters: Numbers
  - Last character: Letter
- **Custom Error Messages**: Configurable error messages for different validation scenarios
- **Real-time Validation**: Validates input as user types and on blur
- **Visual Feedback**: Shows validation errors with clear messaging

## PAN Format

The PAN follows the format: `ABCDE1234F`
- **A-E**: Letters (first 5 characters)
- **1-4**: Numbers (characters 6-9)
- **F**: Letter (last character)
- **4th Character**: Configurable (default: 'P')

## Usage

### In Form Builder

1. Add the PAN Input component to your form
2. Configure the following properties in the authoring interface:

#### Basic Properties
- **Fourth Character**: The character that must appear in the 4th position (default: P)
- **Placeholder**: Placeholder text shown in the input field (default: ABCDE1234F)

#### Validation Properties
- **Invalid Format Error Message**: Error message for general format issues
- **Invalid Fourth Character Error Message**: Error message when 4th character is invalid
- **Invalid First Five Characters Error Message**: Error message when first 5 characters are not letters
- **Invalid Middle Four Characters Error Message**: Error message when characters 6-9 are not numbers
- **Invalid Last Character Error Message**: Error message when last character is not a letter
- **Length Error Message**: Error message when PAN length is not 10 characters

### Programmatic Usage

```javascript
// The component automatically applies when the field definition includes:
{
  "fieldType": "text-input",
  "fd:viewType": "pan-input",
  "properties": {
    "fourthCharacter": "P",
    "placeholder": "ABCDE1234F"
  }
}
```

## Validation Rules

1. **Length**: Must be exactly 10 characters
2. **First 5 Characters**: Must be letters (A-Z)
3. **4th Character**: Must match the configured character (default: P)
4. **Characters 6-9**: Must be numbers (0-9)
5. **Last Character**: Must be a letter (A-Z)

## Error Messages

The component provides specific error messages for different validation failures:

- **Length Error**: "PAN must be exactly 10 characters long"
- **First Five Characters Error**: "First 5 characters must be letters"
- **Fourth Character Error**: "Fourth character must be 'P'" (or configured character)
- **Middle Four Characters Error**: "Characters 6-9 must be numbers"
- **Last Character Error**: "Last character must be a letter"

## Styling

The component includes CSS classes for styling:

- `.pan-input-wrapper`: Main wrapper class
- `.field-invalid`: Applied when validation fails
- `.field-description`: Error message container

### CSS Customization

```css
.pan-input-wrapper input {
  font-family: 'Courier New', monospace;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.pan-input-wrapper.field-invalid input {
  border-color: #dc3545;
}
```

## Examples

### Valid PAN Numbers
- `ABCPE1234F` (with P as 4th character)
- `ABCDE1234F` (with D as 4th character, if configured)
- `XYZPE9876A` (with P as 4th character)

### Invalid PAN Numbers
- `ABCDE1234F` (4th character should be P)
- `ABCPE123F` (too short)
- `ABCPE12345` (last character should be letter)
- `ABCPEABCD` (middle should be numbers)

## Technical Details

### File Structure
```
blocks/form/components/pan-input/
├── _pan-input.json          # Component definition and properties
├── pan-input.js             # Component logic and validation
└── pan-input.css            # Component styling
```

### Dependencies
- Extends the base `text-input` component
- Uses standard form validation patterns
- Integrates with the form's error handling system

### Browser Support
- Modern browsers with ES6 module support
- Responsive design for mobile devices
- High contrast mode support

## Testing

A test file `pan-input-test.html` is provided to test the component functionality. Open it in a browser to test various validation scenarios.

## Integration

The component is automatically registered in:
- `blocks/form/mappings.js` - Component loading
- `blocks/form/_form.json` - Form builder integration
- Built JSON files - Runtime configuration

Run `npm run build:json` after making changes to update the compiled configuration files.
