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

/**
 * SampleComponent - A class-based implementation of a sample component extending Checkbox Group
 * This class encapsulates all the functionality for managing a form field's state,
 * view updates, and event handling.
 */
class SampleComponent {
  /**
   * Creates an instance of SampleComponent
   * @param {HTMLElement} fieldDiv - The DOM element containing the field wrapper
   * @param {Object} fieldJson - The form json object for the component
   * @param {HTMLElement} parentElement - The parent element of the field
   * @param {string} formId - The unique identifier of the form
   */
  constructor(fieldDiv, fieldJson, parentElement, formId) {
    this.fieldDiv = fieldDiv;
    this.fieldJson = fieldJson;
    this.parentElement = parentElement;
    this.formId = formId;
    this.fieldModel = null;

    // Configuration properties
    this.propertyChanges = []; // comma separated list of fieldModel properties that needs to be listened.
    this.customEvent = ''; // the name of the custom event if any to listen to for updating view
  }

  /**
   * This method is where you can update the fieldModel based on view changes.
   */
  updateModel() {
    // here you can listen to view changes and update the fieldModel
  }

  /**
   * Updates the form field HTML based on current state
   */
  updateView(state) {
    if (state) {
      // logic to update view goes here..
    }
  }

  /**
   * Attaches event listeners to the form model
   * Listens to property changes and custom events and updates the view accordingly
   */
  attachEventListeners() {
    if (!this.fieldModel) {
      return;
    }

    // Listen for property changes
    this.fieldModel.subscribe((event) => {
      event?.payload?.changes?.forEach((change) => {
        if (this.propertyChanges.includes(change?.propertyName)) {
          this.updateView(this.fieldModel.getState());
        }
      });
    }, 'change');

    // Listen for custom events
    if (this.customEvent) {
      this.fieldModel.subscribe(() => {
        this.updateView(this.fieldModel.getState());
      }, this.customEvent);
    }
  }

  /**
   * Initializes the form field component
   * Sets up the initial view and subscribes to form model changes
   */
  async initialize() {
    // Update the view with initial data
    this.updateView(this.fieldJson);

    // Subscribe to form model changes
    subscribe(this.fieldDiv, this.formId, (element, model) => {
      this.fieldModel = model;
      this.attachEventListeners();
    });
  }
}

/**
 * Decorates a custom form field component
 * @param {HTMLElement} fieldDiv - The DOM element containing the field wrapper
 * @param {Object} fieldJson - The form json object for the component
 * @param {HTMLElement} parentElement - The parent element of the field
 * @param {string} formId - The unique identifier of the form
 */
export default async function decorate(fieldDiv, fieldJson, parentElement, formId) {
  const field = new SampleComponent(fieldDiv, fieldJson, parentElement, formId);
  await field.initialize();
}

```

## Architecture

The component runtime follows an MVC pattern. 

- **Model**: The fieldModel object that holds the field's state, properties, and data
- **View**: The HTML DOM elements (fieldDiv) that users see and interact with
- **Controller**: This Component class defined orchestrates between model and view.


## Order of Execution 


### 1. `decorate` 

- The `component.js` file must export a default method usually called `decorate`.  
- This method is the starting point of component initalisation.


### 2. `initialize`

- It creates the view with the inital fieldJson properties configured by the user.
- Invokes `subscribe` to receieve the `fieldModel` in a callback whenever its ready.
- The callback is triggered when `fieldModel` is finally initalised.
- Once `fieldModel` is available we store it globally and attachEventListeners.

### 3. `attachEventListeners`
- Here we subscribe to `change` on `fieldModel` which is triggered every time a field property value changes and then update the view with the new state.
- If a custom event is configured by the user we add a listener for that as well to update view.

### 4. `updateView`
- This is where the view is extended/updated for the custom component.
- **Important:** always use the state passed to this method for updating the view. Don't rely on the class variables.

### 5. `updateModel`
- If there is a usecase to update the model based on an input recieved from view that code needs to be updated here. 
- If you are attaching an event listener to update field model its advised to override the ootb change listener in view as shown below:

```js
const input = element.querySelector('input');
input.addEventListener('change', (e) => {
  e.stopPropagation();
})
```
*Reasoning: there is a `change` listener at the form level, which again tries to upadate the fieldModel. This needs to be prevented.*



**Note:** `updateView` and `updateModel` is the code that you need to update based on the user prompt. Other methods need not be touched for most of the usecases


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
- **`markAsInvalid(message)`** - Mark field as invalid with custom message

### Important Notes

1. **Property Access**: All properties are reactive - updating them will trigger a `change` event and update the form model.
2. **Custom Properties**: Access custom properties defined in your JSON schema via `fieldModel.properties.propertyName`.
3. **Validation**: Use `markAsInvalid()` to set custom error messages, or modify `errorMessage` property.


## Best Practices

- **Keep your component logic focused**: Only add/override what is necessary for your custom behavior.
- **Leverage the base structure**: Use the OOTB HTML as your starting point.
- **Use authorable properties**: Expose configurable options via the JSON schema.
- **Namespace your CSS**: Avoid style collisions by using unique class names.
- **Reuse existing utility functions**: Always check `util.js` and `form.js` for existing functions before implementing custom logic.


## Custom component styling 

The component styling goes inside `/blocks/form/components/{custom_component_name}/{custom_component_name}.css`.

Refer [Form Field HTML Structure and Styling](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/build-forms/getting-started-edge-delivery-services-forms/style-theme-forms#components-structure) to understand styling guidelines fields.



 










