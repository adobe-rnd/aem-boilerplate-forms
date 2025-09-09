# Dynamic Text Component

The Dynamic Text component allows you to create text content with placeholders that get replaced with actual property values when set programmatically. This is useful for creating personalized messages, dynamic content, or conditional text based on form data.

## Features

- **Property Substitution**: Replace placeholders in the format `{{propertyName}}` with actual values
- **Rich Text Support**: Option to enable HTML formatting in text templates
- **Real-time Updates**: Text updates automatically when properties change programmatically
- **Custom Events**: Listen for custom events to trigger text updates
- **Empty State Handling**: Display custom message when no text template is provided

## Usage

### Basic Setup

1. Add the Dynamic Text component to your form
2. Set the text template with placeholders: `Hello {{name}}, welcome to {{company}}!`
3. Programmatically set properties on the field model to see the text update

### Text Template Format

Use double curly braces to define placeholders:
```
Hello {{name}}, your order {{orderId}} is ready for pickup at {{location}}.
```

### Authorable Properties

- **Text Template**: The text with placeholders to be substituted
- **Placeholder Format**: Customize the placeholder format (default: `{{propertyName}}`)
- **Enable Rich Text**: Allow HTML formatting in the text template
- **Empty Text Message**: Message to display when no template is provided
- **Custom Update Event**: Event name to listen for text updates

### Programmatic Usage

```javascript
// Get the field model (this would be done in a custom component or rule)
const fieldModel = /* get field model */;

// Set properties programmatically
fieldModel.properties = {
  name: 'John Doe',
  company: 'Acme Corp',
  orderId: '12345',
  location: 'Store Location A'
};

// Or dispatch a custom event
fieldModel.dispatch({ type: 'updateText' });
```

### Example Scenarios

1. **Welcome Message**: `Welcome back, {{firstName}}! You have {{unreadCount}} unread messages.`

2. **Order Confirmation**: `Thank you {{customerName}}! Your order #{{orderNumber}} totaling ${{totalAmount}} has been confirmed.`

3. **Dynamic Instructions**: `Please complete {{remainingSteps}} more steps to finish your {{formType}} application.`

4. **Conditional Content**: `{{status}} - {{message}}` (where status could be "Success" or "Error")

### Rich Text Support

When "Enable Rich Text" is turned on, you can use HTML in your templates:

```
Hello <strong>{{name}}</strong>,<br>
Your order <em>{{orderId}}</em> is ready!
```

### Custom Events

You can trigger text updates by dispatching custom events:

```javascript
// In a rule or custom component
fieldModel.dispatch({ type: 'updateText' });
```

## Technical Details

- Extends the `plain-text` field type
- Uses the `subscribe` function to listen for property changes
- Automatically updates when `fieldModel.properties` changes
- Handles different data types (strings, numbers, objects, arrays)
- Escapes special regex characters in placeholder names
- Supports both `textContent` and `innerHTML` updates based on rich text setting
