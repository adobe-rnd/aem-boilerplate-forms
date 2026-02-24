# Design: Agent Context Files for Form Block

## Goal

Create context files optimized for AI coding agents (Claude Code, Cursor, Copilot) that help them understand the form block's MVC + Web Worker architecture and make correct code changes.

## Audience

AI coding agents working on the form block codebase.

## File Structure

| File | Location | ~Lines | Purpose |
|------|----------|--------|---------|
| `CLAUDE.md` | repo root | 120 | Entry point: project identity, file map, conventions, common tasks |
| `architecture.md` | `docs/context/` | 170 | MVC pattern, initialization flow, dual-model pattern, form sources |
| `worker-sync-protocol.md` | `docs/context/` | 160 | Message types, field change phases, sync mechanism, loading state |
| `form-block-components.md` | `docs/context/` | 170 | Renderers, component decorator, subscription system, view updates |
| `rules-engine.md` | `docs/context/` | 150 | Model internals, afb-runtime, event system, custom functions |

All files stay under 200 lines.

## File Details

### 1. CLAUDE.md (repo root, ~120 lines)

The agent's first point of contact. Auto-loaded by Claude Code.

**Contents:**
- Project identity: AEM Edge Delivery Services boilerplate for Adobe Adaptive Forms
- Tech stack: ES6 modules, no bundler at runtime, Rollup for library bundles only
- Form block architecture at a glance: MVC with Web Worker for model, main thread for view
- File layout map for `blocks/form/`
- Pointers to detailed docs in `docs/context/`
- Key conventions: Airbnb ESLint, 2-space JS indent, ES module imports with `.js` extensions
- Common agent tasks: add a component, modify field rendering, change sync behavior, update runtime libraries

### 2. docs/context/architecture.md (~170 lines)

How the form initializes and what talks to what.

**Contents:**
- MVC roles mapped to files:
  - Model = `RuleEngineWorker.js` + `afb-runtime.js` (worker thread)
  - View = `form.js` (main thread DOM rendering)
  - Controller = `rules/index.js` (orchestration + sync)
- Initialization sequence (6 steps):
  1. `decorate()` extracts/fetches form definition
  2. Worker receives `init`, creates model via `createFormInstance()`, posts initial state
  3. Main thread renders HTML via `createForm()` + `generateFormRendition()`
  4. Main thread sends `decorated` to worker
  5. Worker fetches prefill data, sends `restoreState` with field changes
  6. Main thread calls `loadRuleEngine()`, applies changes, form becomes interactive
- Dual-model pattern: Worker holds authoritative model; main thread holds synchronized copy via `restoreFormInstance()` for UI interactions
- Two form sources:
  - Adaptive Forms: Full MVC + worker path
  - Document-based forms: `transform.js` converts spreadsheet data to AF format, uses `rules-doc/index.js` (no worker)
- Authoring mode: Bypasses rules, renders static HTML via `createFormForAuthoring()`

### 3. docs/context/worker-sync-protocol.md (~160 lines)

The message protocol between worker and main thread.

**Contents:**
- Message protocol table: All 7 message types with direction, payload shape, and trigger conditions:
  - `init` (both directions), `decorated` (main→worker), `restoreState` (worker→main), `applyRestoreBatchedFieldChanges` (worker→main), `applyLiveFieldChange` (worker→main), `applyLiveFormChange` (worker→main), `sync-complete` (worker→main)
- Three phases of field changes:
  1. Initial: Collected in `fieldChanges[]` before `restoreSent` flag
  2. Post-restore: Collected in `postRestoreFieldChanges[]` while `restoreSent && !postRestoreCompleteSent`
  3. Live: Immediately posted via `applyLiveFieldChange` after `postRestoreCompleteSent`
- Phase state flags in `RuleEngineWorker.js`: `restoreSent`, `postRestoreCompleteSent`
- Model synchronization: `applyFieldChangeToFormModel()` keeps main thread copy in sync. `_onlyViewNotify` flag prevents feedback loops. `FIELD_CHANGE_PROPERTIES` set defines which properties trigger updates
- No-worker fallback: When `typeof Worker === 'undefined'`, creates model directly on main thread
- Loading state: `.loading` class added after `init` response, removed on `sync-complete`

### 4. docs/context/form-block-components.md (~170 lines)

The component system and how to extend it.

**Contents:**
- Field renderer registry: `fieldRenderers` object in `form.js:131-143` maps field types to render functions. Unlisted types fall through to `createInput()` default
- Rendering pipeline: `generateFormRendition()` → `renderField()` → `inputDecorator()` → `componentDecorator()`
- Component decorator pattern in `mappings.js`:
  - Two lists: `OOTBComponentDecorators` and `customComponents`
  - Lazy-loads `components/{name}/{name}.js` + `.css`
  - Tracks loading via `dataset.componentStatus` (loading → loaded)
- Subscription system: `subscribe(fieldDiv, formId, callback)` in `rules/index.js` — custom components register to receive field model references
- View update handler: `fieldChanged()` switch statement for property-to-DOM updates (value, visible, enabled, readOnly, label, description, enum/enumNames, items, valid, validationMessage)
- How to add a new component: directory structure, mappings registration, decorator function signature `(element, fd, container, formId) => void`

### 5. docs/context/rules-engine.md (~150 lines)

The model layer internals.

**Contents:**
- `afb-runtime.js`: Bundled from `@aemforms/af-core`. Not hand-edited. Updated via `npm run update:core`
- Class hierarchy: Form → Container → Field (with specializations: Button, Captcha, FileObject)
- Data model: `DataValue` (leaf) and `DataGroup` (nested) with bidirectional field binding
- Event system: `afb-events.js` action types. `EventQueue` with cycle detection
- Rule evaluation: Dependency tracking, auto-triggered expressions, worker thread execution
- Factory functions: `createFormInstance()` for initial creation, `restoreFormInstance()` for main thread copy
- Custom functions: `functionRegistration.js`, configurable path, `preloadFunctionScripts()` for performance
- Document-based forms: `rules-doc/index.js` as simpler alternative (no worker)
- Do-not-edit warnings for generated bundles

## Design Decisions

1. **Layered by topic, not MVC layer**: Cross-cutting concerns (like initialization) span M, V, and C. Topic-based files let agents load only what's relevant to their task.

2. **CLAUDE.md as router**: Keeps the auto-loaded file lightweight. Agents get orientation fast, then follow pointers to detailed docs.

3. **Under 200 lines per file**: Prevents context window bloat. Agents can load 1-2 files for most tasks instead of a single large document.

4. **Line number references**: Context files reference specific line numbers in source code so agents can jump directly to relevant code.

5. **Form block scope only**: The form block is the most architecturally complex part. AEM EDS patterns, test infrastructure, and build tooling are well-documented in existing README and are more conventional.
