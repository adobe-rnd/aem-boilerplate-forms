# Architecture

This document describes the architecture of AEM Forms, which supports two distinct form types:
1. **AEM-based forms** - Full MVC architecture with Web Worker-based rule engine
2. **Sheet-based forms** - Document-based forms with synchronous rule engine

## Critical Architectural Principle

**Sheet-based and AEM-based forms run from the same codebase but have DISTINCT validation and rule engines with NO overlap.**

- **Sheet forms**: NO MODEL, purely DOM-driven validation
- **AEM forms**: MODEL IS SOURCE OF TRUTH, worker-based validation

## MVC Roles (AEM-based forms only)

| Role | Thread | Files | Responsibility |
|------|--------|-------|----------------|
| Model | Web Worker | `rules/RuleEngineWorker.js`, `rules/model/afb-runtime.js` | Form instance, rule evaluation, validation, prefill |
| View | Main thread | `form.js` | DOM rendering, field renderers, input decoration |
| Controller | Main thread | `rules/index.js` | Worker lifecycle, message relay, model sync, event subscriptions |

## Entry Point

`form.js` `decorate()` determines initialization path based on form type.

### Three Code Paths

**1. Sheet-Based Forms** (`':type' === 'sheet'`)
- Transforms spreadsheet definition via `DocBasedFormToAF`
- Renders form with `createForm(formDef, null, 'sheet')`
- Loads `rules-doc/` engine (no worker, synchronous rules)
- **Validation**: DOM-based via `enableValidation()` → `checkValidation()`
- **NO MODEL** - purely DOM-driven
- Sets `form.dataset.rules = false` and `form.dataset.source = 'sheet'`

**2. AEM-Based Forms** (adaptive forms)
- Imports `rules/index.js`
- Calls `initAdaptiveForm()`
- Full MVC architecture with Web Worker
- **Validation**: Worker model sends `validationMessage` via `applyFieldChanges` events
- **MODEL IS SOURCE OF TRUTH**
- Sets `form.dataset.rules = true` and `form.dataset.source = 'aem'`
- **DOM validation is NOT enabled** - worker handles all validation

**3. Authoring Mode** (`block.classList.contains('edit-mode')`)
- Static render via `createFormForAuthoring()`
- No rules engine
- Preview-only display

## Initialization Sequence

```
Main Thread (rules/index.js)          Web Worker (RuleEngineWorker.js)
        |                                          |
        | 1. initAdaptiveForm()                    |
        |    - Register custom functions           |
        |    - initializeRuleEngineWorker()        |
        |                                          |
        |----- postMessage('createFormInstance') ->|
        |                                          |
        |              2. createFormInstance handler
        |                              - new RuleEngine(formDef)
        |                              - createFormInstance()
        |                              - Subscribe to events
        |                                          |
        |<------ postMessage('renderForm') --------|
        |                                          |
  3. renderForm handler                            |
     - createForm() (form.js)                      |
     - generateFormRendition() (form.js)           |
     - Add .loading class to form                  |
        |                                          |
        |------- postMessage('decorated') -------->|
        |                                          |
        |                      4. decorated handler
        |                         - fetchData if prefill URL
        |                         - importData()
        |                         - waitForPromises()
        |                                          |
        |<---- postMessage('restoreState') --------|
        |                                          |
  5. restoreState handler                          |
     - loadRuleEngine()                            |
     - restoreFormInstance() creates               |
       main-thread model copy                      |
     - Subscribe to field change events            |
     - applyRuleEngine() wires DOM events          |
        |                                          |
        |<-- postMessage('applyFieldChanges') -----|
        |<----- postMessage('sync-complete') ------|
        |                                          |
  6. Apply batched field changes                   |
     Remove .loading class                         |
     Form ready for interaction                    |
```

## Validation Architecture

### Two Distinct Validation Paths

**Sheet-Based Forms** (DOM-based validation):
- `enableValidation(form)` called in form.js when `source === 'sheet'`
- Attaches `invalid` and `change` event listeners to all inputs
- `checkValidation(fieldElement)` reads `fieldElement.validity.valid` (browser's ValidityState)
- `getValidationMessage(fieldElement)` generates error message from `validityKeyMsgMap`
- `updateOrCreateInvalidMsg(fieldElement, message)` displays error in DOM
- NO worker involved, NO model

**AEM-Based Forms** (Model-based validation):
- NO DOM validation listeners attached (`enableValidation()` not called)
- User input → event dispatched to model → model validates
  - In browser: model runs in Web Worker
  - In tests: model runs synchronously in main thread (no worker)
- Model sends field changes including `valid` and `validationMessage` properties
- `fieldChanged()` in rules/index.js handles `valid` case:
  - When `valid: true` → clears error message and custom validity
  - When `valid: false` → displays `validationMessage` via `setCustomValidity()` and `updateOrCreateInvalidMsg()`
- DOM validation state is SET BY MODEL, not computed from DOM
- **Async nature**: `fieldChanged()` is async, DOM updates happen in microtasks after model processes events

**File Input Exception (Current Implementation):**

File inputs currently use **DOM-based validation for BOTH form types** as an architectural exception:

- File component (`components/file/file.js`) validates: `required`, `accept`, `maxFileSize`, `minItems`, `maxItems`
- `fileValidation(input, files)` directly calls `setCustomValidity()` and `updateOrCreateInvalidMsg()`
- This bypasses the model validation path for AEM forms

**How conflicts are prevented:**
1. `rules/index.js` `fieldChanged()` skips field changes for `field.type === 'file'` in most cases
2. `util.js` `checkValidation()` has special handling: `if (fieldElement.validity.valid && fieldElement.type !== 'file')`
   - For file inputs, doesn't clear validation messages through DOM validation path
   - File component controls when to clear its own validation messages
3. File component is the **primary validator** for file inputs in both form types

**Important:** afb-runtime (the worker model) DOES support file-specific validation:
- `ACCEPT_MISMATCH` - validates accept constraint
- `FILE_SIZE_MISMATCH` - validates maxFileSize constraint
- `MIN_ITEMS_MISMATCH` - validates minItems constraint
- `MAX_ITEMS_MISMATCH` - validates maxItems constraint
- These constraint types are defined in afb-runtime.js with default error messages

**TODO:** Remove the DOM-based file validation bypass and use afb-runtime's built-in file validation for AEM forms.
This would align file inputs with the model-driven architecture. Sheet forms should continue using DOM-based validation.
The file.js component would only be needed for Sheet forms after this change.

### AEM Validation Flow (Detailed)

When a field value changes in an AEM form:

```
1. User types in field
   ↓
2. DOM 'change' event fires
   ↓
3. applyRuleEngine() listener catches event (rules/index.js)
   ↓
4. Dispatches change to model: form.getElement(id).value = newValue
   ↓
5. Model validates field synchronously via EventQueue
   ↓
6. Model dispatches 'fieldChanged' event with payload:
   {
     changes: [
       { propertyName: 'value', currentValue: '...' },
       { propertyName: 'valid', currentValue: false },
       { propertyName: 'validationMessage', currentValue: 'Error text' }
     ],
     field: { id, name, valid, validationMessage, ... }
   }
   ↓
7. Subscription callback in loadRuleEngine() receives event
   ↓
8. Calls async fieldChanged(payload, form, generateFormRendition)
   ↓
9. fieldChanged() processes each change:
   - case 'value': updates field.value
   - case 'valid':
     * if currentValue === true: clear error message
     * if currentValue === false: display validationMessage
   ↓
10. updateOrCreateInvalidMsg(field, message) updates DOM
    ↓
11. User sees validation error in UI
```

**Key points:**
- All steps are synchronous (EventQueue processes immediately)
- Exception: When field is not present in DOM and is being rendered because its parent is being decorated via `generateFormRendition`, `fieldChanged()` waits for render completion
- `fieldChanged()` is declared async but typically executes synchronously
- Tests must use `await waitForValidation()` to ensure `fieldChanged()` completes before assertions

## Dual-Model Pattern (AEM-based forms only)

The form maintains two synchronized model instances:

**Worker Model (Authoritative)**
- Created by `createFormInstance()` in RuleEngineWorker.js
- Runs all rule evaluation, validation, calculations
- Source of truth for form state

**Main-Thread Model (Synchronized Copy)**
- Created by `restoreFormInstance()` in rules/index.js
- Enables synchronous UI interaction without worker latency
- Updated via `applyFieldChangeToFormModel()` when worker sends changes

**Synchronization Flow**
- User input → main thread dispatches event → worker processes → worker sends `applyFieldChanges`
- Main thread applies changes via `fieldChanged()` (DOM) + `applyFieldChangeToFormModel()` (model)
- Main-thread model stays in sync with authoritative worker state

## Form Sources

### Adaptive Forms
- JSON definition loaded from `formDef` prop
- Full MVC architecture with Web Worker
- Supports rules, validations, calculations, prefill
- Entry: `initAdaptiveForm()` in rules/index.js

### Document-Based Forms
- Spreadsheet transformed by `transform.js` → `DocBasedFormToAF`
- Uses synchronous `rules-doc/` engine (no worker)
- Simpler rule system for basic forms
- Entry: `decorate()` document path in form.js

### Authoring Mode
- Static rendering for preview
- No rule engine or interactivity
- Used in AEM authoring environment
- Entry: `createFormForAuthoring()` in form.js

## Key Functions Reference

| Function | File | Purpose |
|----------|------|---------|
| `decorate()` | form.js | Entry point, determines form type and initialization path |
| `createForm()` | form.js | Creates form DOM structure from JSON definition |
| `generateFormRendition()` | form.js | Generates DOM elements for all form fields |
| `initAdaptiveForm()` | rules/index.js | Initializes MVC architecture for Adaptive Forms |
| `initializeRuleEngineWorker()` | rules/index.js | Creates Web Worker and sets up message handlers |
| `loadRuleEngine()` | rules/index.js | Restores form instance and wires up event handlers |
| `RuleEngine` constructor | RuleEngineWorker.js | Creates rule engine instance in worker |
| `createFormInstance()` | RuleEngineWorker.js | Creates authoritative form model in worker |
| `restoreFormInstance()` | rules/index.js | Creates synchronized main-thread model copy |
| `applyRuleEngine()` | rules/index.js | Wires DOM events to dispatch to worker |
| `applyFieldChangeToFormModel()` | rules/index.js | Syncs worker changes to main-thread model |

## Testing Considerations

### Async Validation in Tests

**Problem:** AEM form validation is asynchronous because `fieldChanged()` is an async function. After calling `setValue()` or triggering validation, the DOM is not immediately updated.

**Solution:** Wait for validation to complete using microtasks:

```javascript
// Helper to wait for model validation to complete
function waitForValidation() {
  return new Promise((resolve) => {
    queueMicrotask(() => {
      queueMicrotask(resolve);
    });
  });
}

// In test expect function
export async function expect(block) {
  setValue(block, '#field', 'value');
  await waitForValidation();  // ← Wait for async validation
  const error = block.querySelector('.field-invalid .field-description');
  assert.equal(error?.textContent, 'Expected error message');
}
```

**Why this works:**
1. `setValue()` triggers validation synchronously via the model's EventQueue
2. Model dispatches `fieldChanged` event to subscription callbacks
3. Subscription callback calls async `fieldChanged()` function
4. `fieldChanged()` updates DOM asynchronously
5. `queueMicrotask()` waits for async function to complete before test assertions

**Test infrastructure:** `testUtils.js` supports async `expect()` functions. Make your expect function async and call `await waitForValidation()` after operations that trigger validation.

### No-Worker Mode in Tests

Tests run with `global.Worker = undefined` (setup-env.js), forcing synchronous afb-runtime instead of Web Worker. This is necessary because:
- jsdom can't properly load ES modules in Worker context
- Synchronous runtime has identical validation behavior
- EventQueue processes events synchronously, but `fieldChanged()` is still async

## Architecture Benefits

- **Responsive UI**: Rule evaluation in worker prevents UI blocking
- **Separation of Concerns**: Model logic isolated from rendering
- **Testability**: Worker can be tested independently
- **Progressive Enhancement**: Document-based forms work without worker complexity
- **Authoring Support**: Static mode for AEM authoring environment
