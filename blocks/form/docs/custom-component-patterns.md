
### Basic Template
```javascript
export default function decorate(element, fd, container, formId) {
}
```
This would render the form fields as it is without any customisation

## 🎯 Common Patterns

### 1. Input Enhancement

```javascript
export default function decorate(element, fd, container, formId) {
  const input = element.querySelector('input');
    input.addEventListener('change', (e) => {
        e.stopPropagation(); // overriding the OOTB input change handler
        // logic for input enhancement
    });
}
```

### 2. UI Extension

Modifying the view of the form field, In this case appending a button to the field element.

```javascript
export default function decorate(element, fd, container, formId) {
  const { buttonText } = fd?.properties || {};

  element.classList.add('custom-button'); // this class is added for styling 
  const customButton = document.createElement('button');
  customButton.textContent = buttonText;
  element.appendChild(customButton);
}
```

```css
main .form form .custom-button {
    border-color: rgb(90 92 96);
} 

```

### 3. Populating Data

Most cases we need to start rendering view when data is populated in the component. 
The view can subscribe to value change or enum change in case of a radio, checkbox or dropdown components.

  ```javascript
  import { subscribe } from '../../rules/index.js';

  export default function decorate(element, fd, container, formId) {

    subscribe(element, formId, (_fieldDiv, fieldModel) => {
      fieldModel.subscribe((e) => {
        e?.payload?.changes.forEach((change) => {
            const {propertyName, currentValue} = change;
            // for radio, checkbox group and dropdown look for enum updates for other check for value updates
            if(propertyName === 'enum' || propertyName === 'value') {
                // logic to update the view 
                updateView(element, currentValue);
            }
        })
      }, 'change');
    });
  }
  ```

**Note**: The `fieldModel` object is an instance of the `Field` class from `afb-runtime.js`. You can access field properties like `fieldModel.value`, `fieldModel.enum`, `fieldModel.visible`, etc., and call methods like `fieldModel.markAsInvalid()`, `fieldModel.focus()`, etc. See the [FieldModel API Reference](../custom-components.md#fieldmodel-api-reference) for complete details.

**Important**: The callback passed to `subscribe()` is **only invoked during form initialization**. The `fieldModel` parameter is the live model instance that persists throughout the form's lifecycle. If you need to update any model property, it should be done directly on this `fieldModel` object.


  ### 4. Custom Event

User can dispatch a custom event on the fieldModel and expect the view to be updated.
In such cases listen to the custom event using subscribe as shown below:

  ```javascript
  import { subscribe } from '../../rules/index.js';

  export default function decorate(element, fd, container, formId)  {
    subscribe(element, formId, (_fieldDiv, fieldModel) => {
      fieldModel.subscribe((e) => {
        // logic to update the view here
      }, 'custom-event');
    });
  }
  ```

**Note**: You can also dispatch custom events using `fieldModel.dispatch(action)` or programmatically control the field using methods like `fieldModel.markAsInvalid()`, `fieldModel.focus()`, etc. See the [FieldModel API Reference](../custom-components.md#fieldmodel-api-reference) for complete details.

**Important**: The callback passed to `subscribe()` is **only invoked during form initialization**. The `fieldModel` parameter is the live model instance that persists throughout the form's lifecycle. If you need to update any model property, it should be done directly on this `fieldModel` object.


## API Reference

### Function Parameters
- `element`: Base HTML element to enhance
- `fd`: Field definition with properties
- `container`: Parent container element  
- `formId`: Unique form identifier

### Common Properties
- `fd.properties.*`: Custom component properties
- `fd.fieldType`: Base component type
- `fd[':type']`: Custom component identifier

### FieldModel Object
The `fieldModel` parameter in subscribe callbacks is an instance of the `Field` class from `afb-runtime.js`. It provides:

**Properties**: `value`, `visible`, `enabled`, `readOnly`, `required`, `valid`, `enum`, `enumNames`, `maximum`, `minimum`, `placeholder`, `tooltip`, `description`, `label`, `errorMessage`, `id`, `name`, `fieldType`, `type`, `properties`

**Methods**: `subscribe()`, `dispatch()`, `queueEvent()`, `focus()`, `reset()`, `validate()`, `markAsInvalid()`, `getDataNode()`, `updateDataNodeAndTypedValue()`

For complete API details, see the [FieldModel API Reference](../custom-components.md#fieldmodel-api-reference).

## 🎲 Decision Tree

**What do you want to achieve?**
- **Enhance input behavior** → Use Input Enhancement Pattern
- **Add new UI elements** → Use UI Extension Pattern
- **Populating fields with data** → Use Populate Data Pattern
- **Listen to Custom Events** → Use Custom Events Pattern

