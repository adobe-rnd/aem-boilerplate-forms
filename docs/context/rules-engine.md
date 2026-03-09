# Rules Engine Architecture

This document describes the rules-based form engine in `blocks/form/rules/`, how it evaluates expressions, manages state, and integrates custom functions.

## Generated Bundles — Do Not Edit

These files are generated from upstream packages and must not be edited manually:

| File | Source Package | Update Command |
|------|---------------|----------------|
| rules/model/afb-runtime.js | @aemforms/af-core | npm run update:core |
| rules/model/afb-events.js | @aemforms/af-core | npm run update:core |
| rules/model/afb-formatters.js | @aemforms/af-formatters | npm run update:formatters |
| rules/formula/* | @adobe/json-formula | npm run update:formula |
| rules/functions.js | @aemforms/af-custom-functions | npm run update:functions |

**Note:** Rollup configurations are in `rollup/`. Each bundle also has a .min.js variant generated.

## Form Model Class Hierarchy

```
Scriptable
  └── Container
        ├── Form          — Root form node. Manages submission, data import/export, event queue, validation.
        └── (panels)      — Fieldsets, repeatable panels, wizard steps, accordions.
  └── Field               — Individual form inputs
        ├── FileObject     — File upload fields
        ├── Captcha        — CAPTCHA fields
        └── (checkboxes, radios, dropdowns — all use Field)
```

**Scriptable** provides rule evaluation capabilities.
**Container** provides child management (items, add/remove for repeatables).

## Factory Functions

### createFormInstance(formDef, callback, logLevel)

Creates a new form model from a form definition.

- **Used in:** RuleEngineWorker.js (worker thread), rules/index.js (no-worker fallback)
- **Returns:** Form instance with full rule evaluation capabilities

### restoreFormInstance(formDef, data, options)

Recreates a form instance from serialized state.

- **Used in:** rules/index.js (main thread restoration via `loadRuleEngine`)
- **Purpose:** Cheaper than re-evaluating. Call `getState(true)` to serialize full model for later restore.

## Event System

### Event Types

| Event | Trigger | Payload |
|-------|---------|---------|
| fieldChanged | Field property changes | { field, changes: [{propertyName, currentValue, prevValue}] } |
| change | Form property changes | { changes: [{propertyName, currentValue}] } |
| submitSuccess | Successful submission | Submission response |
| submitFailure | Failed submission | Error details |
| submitError | Submission error | Error object |
| valid | Field becomes valid | Field model |
| invalid | Field becomes invalid | Field model |

### EventQueue

- Queues events during rule evaluation
- Cycle detection (MAX_EVENT_CYCLE_COUNT=10)
- Processes events in order after evaluation completes

### Subscription Pattern

```javascript
form.subscribe((event) => {
  const { payload } = event;
  // Handle event
}, 'fieldChanged');
```

**Used in:**
- RuleEngineWorker.js (worker thread subscriptions)
- rules/index.js (main thread subscriptions in `loadRuleEngine`)

## Rule Evaluation

### Dependency Tracking
When a rule reads field A, A is recorded as a dependency.

### Auto-trigger
When field A changes, dependent rules automatically re-evaluate.

### Execution Context
Rules execute in a worker thread (if available), isolating expensive calculations from the main UI thread.

### Result Propagation
Changed properties → fieldChanged events → relayed to main thread via `applyFieldChanges` → DOM updates.

## Custom Functions

### Registration Flow (functionRegistration.js)

1. Import OOTB functions from `rules/functions.js`
2. Import custom functions from path if set
3. Call `registerFunctions()` from afb-runtime

### Preloading (functionRegistration.js)

Modulepreload links are inserted early in `initAdaptiveForm` to ensure scripts are cached before both main and worker threads import them.

### How to Add Custom Functions

1. Create or edit file at `customFunctionsPath` (specified in form JSON)
2. Export named functions from the file
3. Functions are auto-registered on form initialization
4. Functions work in both worker and main thread contexts

## Document-Based Forms

`rules-doc/` provides a separate code path for document-based forms (e.g., from spreadsheets).

- **No worker thread:** All evaluation happens on the main thread
- **Loaded from:** form.js `decorate()` document path
- **Isolated:** Changes to `rules/` do not affect `rules-doc/` and vice versa

## Key Files Reference

| File | Purpose |
|------|---------|
| rules/model/afb-runtime.js | **DO NOT EDIT.** Core form model, rule evaluation, factory functions. |
| rules/model/afb-events.js | **DO NOT EDIT.** Event queue, cycle detection. |
| rules/RuleEngineWorker.js | Worker thread entry point. Creates form, subscribes to events, posts messages to main. |
| rules/index.js | Main thread controller. Spawns worker, handles restore flow, applies field changes to DOM. |
| rules/functionRegistration.js | Preloads and registers OOTB + custom functions in both threads. |
| rules/functions.js | **DO NOT EDIT.** OOTB custom functions from @aemforms/af-custom-functions. |

## Related Documentation

- [architecture.md](architecture.md) — MVC pattern and initialization flow
- [worker-sync-protocol.md](worker-sync-protocol.md) — Worker message protocol details
- [form-block-components.md](form-block-components.md) — Component rendering and view updates
