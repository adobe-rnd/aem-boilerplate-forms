# Architecture

This document describes the MVC architecture of AEM Forms with Web Worker-based rule engine.

## MVC Roles

| Role | Thread | Files | Responsibility |
|------|--------|-------|----------------|
| Model | Web Worker | `rules/RuleEngineWorker.js`, `rules/model/afb-runtime.js` | Form instance, rule evaluation, validation, prefill |
| View | Main thread | `form.js` | DOM rendering, field renderers, input decoration |
| Controller | Main thread | `rules/index.js` | Worker lifecycle, message relay, model sync, event subscriptions |

## Entry Point

`form.js:decorate()` at line 510 determines initialization path based on form type.

### Three Code Paths

**1. Document-Based Forms** (`':type' === 'sheet'`, lines 537-546)
- Transforms spreadsheet definition via `DocBasedFormToAF`
- Renders form with `createForm()`
- Loads `rules-doc/` engine (no worker, synchronous rules)

**2. Adaptive Forms** (lines 547-556)
- Imports `rules/index.js`
- Calls `initAdaptiveForm()`
- Full MVC architecture with Web Worker

**3. Authoring Mode** (`block.classList.contains('edit-mode')`, line 554)
- Static render via `createFormForAuthoring()`
- No rules engine
- Preview-only display

## Initialization Sequence

```
Main Thread (rules/index.js)          Web Worker (RuleEngineWorker.js)
        |                                          |
        | 1. initAdaptiveForm() (line 499)       |
        |    - Register custom functions          |
        |    - initializeRuleEngineWorker()       |
        |                                          |
        |----------- postMessage('init') --------->|
        |                                          |
        |                           2. init handler (line 105)
        |                              - new RuleEngine(formDef)
        |                              - createFormInstance()
        |                              - Subscribe to events
        |                                          |
        |<------- postMessage('init', state) ------|
        |                                          |
  3. init handler (line 438)                      |
     - createForm() (form.js:336)                 |
     - generateFormRendition() (form.js:279)      |
     - Add .loading class to form                 |
        |                                          |
        |------- postMessage('decorated') -------->|
        |                                          |
        |                      4. decorated handler (line 125)
        |                         - fetchData if prefill URL
        |                         - importData()
        |                         - waitForPromises()
        |                                          |
        |<---- postMessage('restoreState') --------|
        |                                          |
  5. restoreState handler (line 452)              |
     - loadRuleEngine() (line 361)                |
     - restoreFormInstance() creates              |
       main-thread model copy                     |
     - Subscribe to field change events           |
     - applyRuleEngine() wires DOM events         |
     - Apply initial fieldChanges                 |
        |                                          |
        |<- postMessage('applyRestoreBatched...') -|
        |<----- postMessage('sync-complete') ------|
        |                                          |
  6. Apply batched changes                        |
     Remove .loading class                        |
     Form ready for interaction                   |
```

## Dual-Model Pattern

The form maintains two synchronized model instances:

**Worker Model (Authoritative)**
- Created by `createFormInstance()` in RuleEngineWorker.js:57
- Runs all rule evaluation, validation, calculations
- Source of truth for form state

**Main-Thread Model (Synchronized Copy)**
- Created by `restoreFormInstance()` in rules/index.js:363
- Enables synchronous UI interaction without worker latency
- Updated via `applyFieldChangeToFormModel()` when worker sends changes

**Synchronization Flow**
- User input → main thread dispatches event → worker processes → worker sends fieldChanges
- Worker applies batched changes via `applyFieldChangeToFormModel()`
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
- Entry: `decorate()` document path in form.js:537-546

### Authoring Mode
- Static rendering for preview
- No rule engine or interactivity
- Used in AEM authoring environment
- Entry: `createFormForAuthoring()` in form.js

## Key Functions Reference

| Function | File | Line | Purpose |
|----------|------|------|---------|
| `decorate()` | form.js | 510 | Entry point, determines form type and initialization path |
| `createForm()` | form.js | 336 | Creates form DOM structure from JSON definition |
| `generateFormRendition()` | form.js | 279 | Generates DOM elements for all form fields |
| `initAdaptiveForm()` | rules/index.js | 499 | Initializes MVC architecture for Adaptive Forms |
| `initializeRuleEngineWorker()` | rules/index.js | 407 | Creates Web Worker and sets up message handlers |
| `loadRuleEngine()` | rules/index.js | 361 | Restores form instance and wires up event handlers |
| `RuleEngine` constructor | RuleEngineWorker.js | 55 | Creates rule engine instance in worker |
| `createFormInstance()` | RuleEngineWorker.js | 57 | Creates authoritative form model in worker |
| `restoreFormInstance()` | rules/index.js | 363 | Creates synchronized main-thread model copy |
| `applyRuleEngine()` | rules/index.js | 270 | Wires DOM events to dispatch to worker |
| `applyFieldChangeToFormModel()` | rules/index.js | 323 | Syncs worker changes to main-thread model |

## Architecture Benefits

- **Responsive UI**: Rule evaluation in worker prevents UI blocking
- **Separation of Concerns**: Model logic isolated from rendering
- **Testability**: Worker can be tested independently
- **Progressive Enhancement**: Document-based forms work without worker complexity
- **Authoring Support**: Static mode for AEM authoring environment
