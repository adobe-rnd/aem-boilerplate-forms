# Subscribe API Reference

## Overview

The `subscribe` function (exported from `blocks/form/rules/index.js`) connects a custom component's DOM element to its form field model. It is the primary bridge between the view layer and the runtime model.

All new custom components should use `{ listenChanges: true }`.

## Function signature

```js
subscribe(fieldDiv, formId, callback, { listenChanges: true })
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `fieldDiv` | `HTMLElement` | The field's DOM wrapper. Must have `dataset.id` matching the field model's id (every rendered field wrapper has this automatically). |
| `formId` | `string` | The form's identifier (`htmlForm.dataset.id`). |
| `callback` | `Function` | See callback signatures below. |
| `options` | `Object` | Always pass `{ listenChanges: true }` for new components. |

## Callback signatures

The callback receives different arguments depending on the event type:

### Register event (always delivered, once)

```js
callback(fieldDiv, fieldModel, 'register')
```

Called once when the form model is ready. Use this for one-time setup: storing the model reference, reading initial state, attaching DOM event listeners.

### Change event (delivered on every model property change)

```js
callback(fieldDiv, fieldModel, 'change', payload)
```

Called on every `fieldChanged` event for this field. `payload.changes` is an array of:

```js
{ propertyName: string, currentValue: any, prevValue: any }
```

Common `propertyName` values: `value`, `enum`, `enumNames`, `visible`, `enabled`, `valid`, `label`, `properties`.

---

## Standard pattern (recommended for all new components)

```js
import { subscribe } from '../../rules/index.js';

export default function decorate(fieldDiv, fieldJson, container, formId) {
  let model = null;

  const handleModelChange = (changes) => {
    changes?.forEach((change) => {
      if (change?.propertyName === 'value') {
        // sync DOM with new value
      } else if (change?.propertyName === 'enum' || change?.propertyName === 'enumNames') {
        // re-render options
      }
    });
  };

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      // one-time setup: prefill, DOM listeners, etc.
    } else if (eventType === 'change') {
      handleModelChange(payload?.changes);
    }
  }, { listenChanges: true });

  return fieldDiv;
}
```

---

## Child component subscriptions (panel/container components)

For panel or container components that need to watch child items, use `subscribe()` on each child's DOM wrapper element. Do **not** use `model.subscribe()` -- use the same `subscribe()` function from `rules/index.js`.

### How to find child models

Children can be found by `fieldType` (OOTB type) or by `':type'` (custom component name set via `fd:viewType` in JSON schema). The `:type` property is how the runtime identifies which custom component to load -- it matches against the `customComponents` / `OOTBComponentDecorators` arrays in `mappings.js`.

```js
// By fieldType (OOTB field type):
const checkbox = model.items?.find((item) => item.fieldType === 'checkbox');

// By :type (custom component or fd:viewType):
const modal = model.items?.find((item) => item[':type'] === 'modal');
```

### How to find child DOM elements

Each child field in the DOM has a wrapper with `data-id` matching the model's `id`. Use `[data-id="..."]` selector (not `#id`, which selects the inner input element).

```js
import { subscribe } from '../../rules/index.js';

export default function decorate(element, fd, container, formId) {
  subscribe(element, formId, (_element, model, eventType, payload) => {
    if (eventType === 'register') {
      // Find child models by fieldType or :type
      const checkbox = model.items?.find((item) => item.fieldType === 'checkbox');
      const modal = model.items?.find((item) => item[':type'] === 'modal');
      const textInput = model.items?.find((item) => item.fieldType === 'text-input');

      // Subscribe to child changes using their DOM wrapper elements
      if (checkbox) {
        const checkboxWrapper = element.querySelector(`[data-id="${checkbox.id}"]`);
        subscribe(checkboxWrapper, formId, (_el, _childModel, childEvent, childPayload) => {
          if (childEvent === 'register') {
            // child one-time setup
          } else if (childEvent === 'change') {
            childPayload?.changes?.forEach((change) => {
              if (change?.propertyName === 'value') {
                // react to checkbox value change
              }
            });
          }
        }, { listenChanges: true });
      }

      if (textInput) {
        const textWrapper = element.querySelector(`[data-id="${textInput.id}"]`);
        subscribe(textWrapper, formId, (_el, _childModel, childEvent, childPayload) => {
          if (childEvent === 'register') {
            // child one-time setup
          } else if (childEvent === 'change') {
            // handle text input changes
          }
        }, { listenChanges: true });
      }
    } else if (eventType === 'change') {
      // handle parent panel property changes (e.g., properties, visible)
    }
  }, { listenChanges: true });
}
```

### Why this works

1. Every field wrapper in the DOM has `data-id` matching its model id (set by `createFieldWrapper` in `util.js`)
2. `subscribe()` uses `fieldDiv.dataset.id` to register and `form.getElement(id)` to resolve the model -- works for children at any depth
3. The `fieldChanged` handler matches `e.payload.field.id` against the subscription map -- each child gets its own events

### Important: use `[data-id="..."]` not `#id`

```js
// CORRECT: selects the field wrapper (has dataset.id)
const childEl = element.querySelector(`[data-id="${child.id}"]`);

// WRONG: selects the inner input/button element (no dataset.id)
const childEl = element.querySelector(`#${child.id}`);
```

---

## How `:type` works (component identification)

When `fd:viewType` is set in a component's JSON schema, the runtime stores it as the field's `:type` property. The `componentDecorator` function in `mappings.js` extracts `fd[':type']` and checks it against `customComponents` and `OOTBComponentDecorators` arrays to decide which component JS to load.

This means:
- **Parent finding children by `:type`**: `model.items?.find(item => item[':type'] === 'modal')` -- used when a child is itself a custom component (like consent-popup's modal sub-panel)
- **Parent finding children by `fieldType`**: `model.items?.find(item => item.fieldType === 'checkbox')` -- used when a child is a standard OOTB field

Both patterns are valid for finding children to subscribe to.

---

## Going deeper into nested children

You can traverse `model.items` to any depth to find nested children:

```js
// Find a checkbox inside a nested panel
const nestedPanel = model.items?.find((item) => item.fieldType === 'panel');
const deepChild = nestedPanel?.items?.find((item) => item.fieldType === 'checkbox');
if (deepChild) {
  const deepWrapper = element.querySelector(`[data-id="${deepChild.id}"]`);
  subscribe(deepWrapper, formId, callback, { listenChanges: true });
}

// Find a child custom component by :type
const modal = model.items?.find((item) => item[':type'] === 'modal');
if (modal) {
  const modalWrapper = element.querySelector(`[data-id="${modal.id}"]`);
  subscribe(modalWrapper, formId, callback, { listenChanges: true });
}
```

Or use a filter to find by field type across the tree:

```js
const allCheckboxes = model.items?.filter((item) => item.fieldType === 'checkbox');
allCheckboxes?.forEach((cb) => {
  const wrapper = element.querySelector(`[data-id="${cb.id}"]`);
  subscribe(wrapper, formId, callback, { listenChanges: true });
});
```

---

## Legacy pattern (still works, not recommended for new code)

The older pattern without `{ listenChanges: true }` uses `fieldModel.subscribe()` inside the register callback. This still works for backward compatibility but should not be used in new components.

```js
// LEGACY -- do not use for new components
subscribe(fieldDiv, formId, (_fieldDiv, fieldModel) => {
  model = fieldModel;

  fieldModel.subscribe((e) => {
    e.payload?.changes?.forEach((change) => {
      // handle property changes
    });
  }, 'change');
});
```

---

## Concrete example: dynamic-dropdown migration

### Before (legacy):

```js
subscribe(fieldDiv, formId, (_fieldDiv, fieldModel) => {
  model = fieldModel;
  // prefill logic...

  fieldModel.subscribe((e) => {
    const { payload } = e;
    payload?.changes?.forEach((change) => {
      if (change?.propertyName === 'enumNames') { /* ... */ }
      else if (change?.propertyName === 'value') { /* ... */ }
    });
  }, 'change');
});
```

### After (recommended):

```js
const handleModelChange = (changes) => {
  changes?.forEach((change) => {
    if (change?.propertyName === 'enumNames') { /* ... */ }
    else if (change?.propertyName === 'value') { /* ... */ }
  });
};

subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
  if (eventType === 'register') {
    model = fieldModel;
    // prefill logic...
  } else if (eventType === 'change') {
    handleModelChange(payload?.changes);
  }
}, { listenChanges: true });
```
