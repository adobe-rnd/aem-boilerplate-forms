
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
            if(propertyName === 'enum|value') {
                // logic to update the view 
                updateView(element, currentValue);
            }
        })
      }, 'change');
    });
  }
  ```


  ### 3. Custom Event

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

## 🎲 Decision Tree

**What do you want to achieve?**
- **Enhance input behavior** → Use Input Enhancement Pattern
- **Add new UI elements** → Use UI Extension Pattern
- **Populating fields with data** → Use Populate Data Pattern
- **Listen to Custom Events** → Use Custom Events Pattern

