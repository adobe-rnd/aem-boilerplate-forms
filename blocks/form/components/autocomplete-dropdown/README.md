# Autocomplete Dropdown Component

The Autocomplete Dropdown is a custom form component that extends the standard dropdown functionality with search and filtering capabilities. Users can type to search through available options, making it easier to find and select values from large lists.

## Features

- **Real-time filtering**: Options are filtered as the user types
- **Keyboard navigation**: Full keyboard support with arrow keys, Enter, and Escape
- **Highlighted matches**: Matching text is highlighted in suggestions
- **Configurable search**: Minimum search length, case sensitivity, and maximum suggestions
- **Accessibility**: ARIA attributes and keyboard navigation support
- **Responsive design**: Works on desktop and mobile devices
- **Dark mode support**: Automatic dark mode styling

## Usage

### In Form Builder

1. Add an "Autocomplete Dropdown" component to your form
2. Configure the basic properties (label, required, etc.)
3. Set up the autocomplete-specific properties:
   - **Minimum search length**: Number of characters required before showing suggestions (default: 1)
   - **Maximum suggestions**: Maximum number of suggestions to display (default: 10)
   - **Case sensitive search**: Whether search should be case sensitive (default: false)
   - **Highlight matches**: Whether to highlight matching text (default: true)
   - **No results message**: Message shown when no suggestions are found

### Configuration Options

#### Basic Properties
- **Label**: Display label for the field
- **Required**: Whether the field is required
- **Placeholder**: Placeholder text shown in the input field
- **Help text**: Additional help text for users

#### Autocomplete Properties
- **Minimum search length**: Minimum characters needed to trigger search
- **Maximum suggestions**: Limit on number of suggestions displayed
- **Case sensitive search**: Toggle case sensitivity
- **Highlight matches**: Toggle text highlighting
- **No results message**: Custom message for empty results

#### Validation Properties
- Standard validation options (required, custom validation messages, etc.)

## Technical Details

### Component Structure
- **Base component**: Extends `drop-down` field type
- **Custom view type**: `autocomplete-dropdown`
- **Files**: 
  - `_autocomplete-dropdown.json` - Component definition and properties
  - `autocomplete-dropdown.js` - JavaScript logic
  - `autocomplete-dropdown.css` - Styling

### Integration
- Registered in `mappings.js` as a custom component
- Added to form configuration in `_form.json`
- Follows AEM Forms custom component patterns

### Accessibility Features
- ARIA attributes for screen readers
- Keyboard navigation support
- Focus management
- Proper labeling and descriptions

## Example Configuration

```json
{
  "fieldType": "drop-down",
  "fd:viewType": "autocomplete-dropdown",
  "enum": ["apple", "banana", "cherry", "date", "elderberry"],
  "enumNames": ["Apple", "Banana", "Cherry", "Date", "Elderberry"],
  "properties": {
    "minSearchLength": 1,
    "maxSuggestions": 10,
    "caseSensitive": false,
    "highlightMatches": true,
    "noResultsMessage": "No results found",
    "placeholder": "Type to search..."
  }
}
```

## Browser Support

- Modern browsers with ES6+ support
- Mobile browsers (iOS Safari, Chrome Mobile)
- Responsive design for various screen sizes
