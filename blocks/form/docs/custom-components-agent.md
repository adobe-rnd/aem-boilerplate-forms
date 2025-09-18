# Custom component creation instructions.

**Rule Zero**: Never make assumptions. If something is unclear or unspecified in user prompt, ask clarifying questions and then proceed.


## Initial setup:

1. From the user prompt identify the *custom_component_name* and *base_type*. *base_type* can take value only from the array given below:
```
base_type = [
    'Button',
    'Checkbox',
    'Checkbox Group',
    'Date Input',
    'Drop Down',
    'Email',
    'File Input',
    'Image',
    'Number Input',
    'Panel',
    'Radio Group',
    'Reset Button',
    'Submit Button',
    'Telephone Input',
    'Text',
    'Text Input',
  ]
```

2. Ask the user to specify the name of the custom event that need to be listened to update view. This would be *custom_event_name*. This is optional.

3. Again propmt the user to specify the property changes that need to be listened to update view. This would be *property_changes*. If there are multiple events specified by the user *property_changes* would be a comma separated string. This is optional.

3. Run the scaffolder tool with *custom_component_name*, *base_type*, *custom_event_name* and *property_changes* as command line arguments as shown below: 

```sh
npm run create:custom-component -- --component-name={custom_component_name} --base-type={base_type} --custom-event-name={custom_event_name} --property-changes={property_changes}
```
4. Register the json component json file change by running the following command
```sh
npm run build:json
```
> ***Important Note**: Above command needs to be run everytime any component json file is updated*

## Defining custom authoring properties

To capture custom properties in authoring for the custom components, use below steps:

1. Identify what field type can capture your custom property,choose the appropriate one by referring this [documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/universal-editor/field-types#fields). 
Say you want to capture the date in authoring then you should be looking for `date-time` component.
2. Add the field to the `models` section of the corresponding `_{custom_component_name}.json` file.
3. Run the `build:json` command to register your changes.


## Creating component runtime

The component runtime follows an MVC (Model-View-Controller) architecture.
- **Model:** Defined by the JSON schema for each field/component. Authorable properties are specified in the corresponding JSON file (see `blocks/form/models/form-components`).
- **View:** The HTML structure for each field type is described in [form-field-component-structure](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/universal-editor/field-types#fields). This is the base structure your component will extend or modify.
- **Controller/Component Logic:** Implemented in JavaScript, either as OOTB (out-of-the-box) or custom components.

The component logic resides in `/blocks/form/components/{custom_component_name}/{custom_component_name}.js`.



## Anatomy of `component.js`

The scaffolder creates the following boilerplate code inside `component.js`.

```js
/* eslint-disable no-unused-vars */
import { subscribe } from '../../rules/index.js';

// configuration
const propertyChanges = []; // comma separated list of fieldModel properties that needs to be listened.
const customEvent = ''; // the name of the custom event if any to listen to

let fieldModel = null;

/**
 * Update form field html based on current state
 * @param {HTMLElement} element - The DOM element to update
 * @param {Object} state - The current state data containing field values and properties
 */
function updateView(element, state) {
  if (element && state) {
    // logic to update view goes here..
  }
}

/**
 * Utility function to attach event listeners to the form model
 * Listens to property changes and custom events and updates the view accordingly.
 * @param {Object} model - The form field model instance
 * @param {HTMLElement} fieldDiv - The DOM element containing the field wrapper
 */
function attachEventListeners(model, fieldDiv) {
  model.subscribe((event) => {
    event?.payload?.changes?.forEach((change) => {
      if (propertyChanges.includes(change?.propertyName)) {
        updateView(fieldDiv, model.getState()); // updating the view on property change
      }
    });
  }, 'change');

  if (customEvent) {
    model.subscribe(() => {
      updateView(fieldDiv, model.getState()); // updating the view on custom event trigger
    }, customEvent);
  }
}

/**
 * Decorates a custom form field component
 * @param {HTMLElement} fieldDiv - The DOM element containing the field wrapper.
 * @param {Object} fieldJson - The form json object for the component.
 * @param {HTMLElement} parentElement - The parent element of the field.
 * @param {string} formId - The unique identifier of the form.
 */
export default async function decorate(fieldDiv, fieldJson, parentElement, formId) {
  updateView(fieldDiv, fieldJson); // updating the view on initalise
  subscribe(fieldDiv, formId, (element, model) => {
    fieldModel = model; // persisting the field model in global scope
    attachEventListeners(model, fieldDiv);
  });
}

```

### 1. `decorate` 

The `component.js` file must export a default method usually called `decorate`.  
Arguments:
  - `fieldDiv` is the default html rendition of the base component that needs to be extended.
  - `fieldJson` contains all the properties configured in authoring, including the custom properties.
  - `parentElement` and `formId` which should be obvious from the jsdocs.

Functionality:
  - This method is the starting point of component initalisation. 
  - It invokes the `updateView` method initially to provide the initial rendering.
  - It invokes the `subscribe` method and registers 









### Listening to `fieldModel` changes

- The `subscribe` method allows you to access the `fieldModel` inside `decorate`.
- The callback passed to subscribe gets invoked only when the `fieldModel` is initalised. View is initalised before `fieldModel`.
- `fieldModel` has its own `subscribe` method which can be used to listen to changes in field value, properties or events. 
- Refer the following code example to understand the usage:

  ```js
  import { subscribe } from '../../rules/index.js';

  export default function decorate(fieldDiv, fieldJson, container, formId) {

    // ... setup logic ...
    subscribe(fieldDiv, formId, (_fieldDiv, fieldModel) => {
      fieldModel.subscribe((event) => {
        
      }, 'change');
    });
  }
  ```

- The `event` object passed in the fieldModel `subscribe` has the following structure:
  ```js
    {
        "payload": {
            "changes": [
            {
                "propertyName": "visible",
                "currentValue": true,
                "prevValue": false
            }
        ]
        },
    "type": "change",
    "isCustomEvent": false
    }
  ```

###  `fieldModel` API reference

The `fieldModel` object passed to your `subscribe` callback is an instance of the `Field` class from `blocks/form/rules/model/afb-runtime.js`. It provides access to the field's state and methods for programmatic control.



### Core Properties 

#### Field State Properties
- **`value`** -  field's current value
- **`visible`** - field visibility (boolean)
- **`enabled`** - field enabled state (boolean)
- **`readOnly`** - field read-only state (boolean)
- **`required`** - field required state (boolean)
- **`valid`** - field validation state (boolean)

#### Field Configuration Properties
- **`enum`** - available options for dropdown/radio/checkbox groups
- **`enumNames`** - display names for enum options
- **`maximum`** - maximum value (for number/date fields)
- **`minimum`** - minimum value (for number/date fields)
- **`placeholder`** - placeholder text
- **`tooltip`** - tooltip text
- **`description`** - field description/help text
- **`label`** -  field label object `{ value: Name, richText: true }`.
- **`errorMessage`** - custom error message
- **`constraintMessage`** -  constraint-specific error messages

#### Field Metadata Properties
- **`id`** - Field's unique identifier
- **`name`** - Field's name attribute
- **`fieldType`** - Type of field (e.g., 'text-input', 'drop-down')
- **`type`** - Data type (e.g., 'string', 'number', 'boolean', 'object')
- **`properties`** - Custom properties object (access via `fieldModel.properties.customProperty`)

### Core Methods

#### Event Handling
- **`subscribe(callback, eventName)`** - Subscribe to field changes or custom events
- **`dispatch(action)`** - Dispatch custom events or actions

#### Field Control
- **`focus()`** - Set focus to the field
- **`reset()`** - Reset field to default state
- **`validate()`** - Trigger field validation
- **`markAsInvalid(message, constraint)`** - Mark field as invalid with custom message

### Important Notes

1. **Property Access**: All properties are reactive - updating them will trigger a `change` event and update the form model.
2. **Custom Properties**: Access custom properties defined in your JSON schema via `fieldModel.properties.propertyName`.
3. **Event Subscription**: The `subscribe` method returns an object with an `unsubscribe()` method for cleanup.
4. **Validation**: Use `markAsInvalid()` to set custom error messages, or modify `errorMessage` property.


## Best Practices

- **Keep your component logic focused**: Only add/override what is necessary for your custom behavior.
- **Leverage the base structure**: Use the OOTB HTML as your starting point.
- **Use authorable properties**: Expose configurable options via the JSON schema.
- **Namespace your CSS**: Avoid style collisions by using unique class names.
- **Reuse existing utility functions**: Always check `util.js` and `form.js` for existing functions before implementing custom logic.



 










