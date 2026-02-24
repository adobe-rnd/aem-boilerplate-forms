# Architecture

This document describes the MVC architecture of AEM Forms with Web Worker-based rule engine.

## MVC Roles

| Role | Thread | Files | Responsibility |
|------|--------|-------|----------------|
| Model | Web Worker | `rules/RuleEngineWorker.js`, `rules/model/afb-runtime.js` | Form instance, rule evaluation, validation, prefill |
| View | Main thread | `form.js` | DOM rendering, field renderers, input decoration |
| Controller | Main thread | `rules/index.js` | Worker lifecycle, message relay, model sync, event subscriptions |

## Entry Point

`form.js` `decorate()` determines initialization path based on form type.

### Three Code Paths

**1. Document-Based Forms** (`':type' === 'sheet'`)
- Transforms spreadsheet definition via `DocBasedFormToAF`
- Renders form with `createForm()`
- Loads `rules-doc/` engine (no worker, synchronous rules)

**2. Adaptive Forms**
- Imports `rules/index.js`
- Calls `initAdaptiveForm()`
- Full MVC architecture with Web Worker

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

## Dual-Model Pattern

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

## Architecture Benefits

- **Responsive UI**: Rule evaluation in worker prevents UI blocking
- **Separation of Concerns**: Model logic isolated from rendering
- **Testability**: Worker can be tested independently
- **Progressive Enhancement**: Document-based forms work without worker complexity
- **Authoring Support**: Static mode for AEM authoring environment
