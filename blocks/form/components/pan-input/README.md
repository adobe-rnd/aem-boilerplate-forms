# PAN Input Component

A custom form component for validating PAN (Permanent Account Number) input with configurable validation rules and automatic formatting.

## Features

- **Configurable fourth character**: Default is 'P', but can be customized
- **Automatic uppercase conversion**: All input is automatically converted to uppercase
- **Position-specific validation**:
  - First 5 characters: Letters (with 4th being configurable)
  - Next 4 characters: Numbers (positions 6-9)
  - Last character: Letter (position 10)
- **Custom error messages**: Configurable error messages for different validation scenarios
- **Real-time validation**: Validates input as user types, pastes, or leaves the field

## Usage

1. Add the PAN Input component to your form in the AEM Forms Builder
2. Configure the component properties in the "Custom Properties" tab:
   - **Fourth Character**: Set the required 4th character (default: P)
   - **Error Messages**: Customize validation error messages as needed

## Configuration Options

### Basic Properties
- Standard text input properties (label, placeholder, required, etc.)
- Standard validation properties (min/max length, pattern, etc.)

### Custom Properties
- `fourthCharacter`: The character required at position 4 (default: "P")
- `invalidFormatErrorMessage`: General format error message
- `invalidFourthCharacterErrorMessage`: Error when 4th character is wrong
- `invalidLettersErrorMessage`: Error when first 5 characters aren't letters
- `invalidNumbersErrorMessage`: Error when positions 6-9 aren't numbers
- `invalidLastCharacterErrorMessage`: Error when last character isn't a letter
- `lengthErrorMessage`: Error when PAN isn't exactly 10 characters

## Validation Rules

The component validates PAN format as follows:
- **Length**: Must be exactly 10 characters
- **Positions 1-3**: Must be letters (A-Z)
- **Position 4**: Must be the configured character (default: P)
- **Position 5**: Must be a letter (A-Z)
- **Positions 6-9**: Must be numbers (0-9)
- **Position 10**: Must be a letter (A-Z)

## Example PAN Formats

- Valid with default 'P': `ABCDP1234E`
- Valid with custom 'F': `ABCDF1234E`
- Invalid examples:
  - `ABCDP1234` (too short)
  - `ABCDP12345` (too long)
  - `ABCDP1234e` (last character lowercase)
  - `ABCDP1234` (missing last character)

## Styling

The component includes custom CSS classes:
- `.pan-input-wrapper`: Main wrapper
- `.pan-input`: Input field styling
- `.field-invalid`: Applied when validation fails

## Technical Details

- Extends the base `text-input` component
- Uses `fd:viewType: "pan-input"` for identification
- Implements real-time validation with `updateOrCreateInvalidMsg` utility
- Handles input, paste, and blur events
- Automatically converts input to uppercase
