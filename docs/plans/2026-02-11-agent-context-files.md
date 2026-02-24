# Agent Context Files Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create 5 context files that help AI coding agents understand the form block's MVC + Web Worker architecture.

**Architecture:** A root `CLAUDE.md` serves as the lightweight entry point (auto-loaded by Claude Code), pointing to 4 detailed topic files in `docs/context/`. Each file stays under 200 lines and covers one aspect of the form block: overall architecture, worker sync protocol, component system, and rules engine.

**Tech Stack:** Markdown documentation referencing JavaScript source in `blocks/form/`.

---

### Task 1: Create CLAUDE.md (root entry point)

**Files:**
- Create: `CLAUDE.md`

**Step 1: Write CLAUDE.md**

Write the file with these sections (~120 lines total):

- **Header**: Project name and one-line description (AEM EDS boilerplate for Adaptive Forms)
- **Tech Stack**: ES6 modules, no runtime bundler, Web Workers, pure CSS, Mocha + Playwright
- **Architecture at a glance**: One paragraph — Model in worker (`RuleEngineWorker.js` + `afb-runtime.js`), View on main thread (`form.js`), Controller orchestrates (`rules/index.js`). Link to `docs/context/architecture.md`.
- **File map**: Tree-style listing of `blocks/form/` directory with one-line descriptions per file/dir. Mark `rules/model/` and `rules/formula/` as DO NOT EDIT.
- **Detailed context files table**: 4 rows linking to `docs/context/` files with "when to read" guidance.
- **Coding conventions**: Airbnb ESLint, `.js` extensions in imports, 2-space JS / 4-space CSS, unix linebreaks, pre-commit hook.
- **Common commands**: `npm run lint`, `test:unit`, `test:e2e`, `update:core`, `update:formatters`, `update:formula`, `create:custom-component`.
- **Common agent tasks**: 4 tasks (add component, modify field rendering, change sync behavior, update runtime). Each with 3-4 bullet steps and file references with line numbers.

Source references:
- `form.js:510` — `decorate()` entry point
- `form.js:131-143` — `fieldRenderers` registry
- `form.js:164-240` — `inputDecorator()`
- `rules/index.js:407-497` — `initializeRuleEngineWorker()`
- `mappings.js:4` — `OOTBComponentDecorators` list

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md agent context entry point"
```

---

### Task 2: Create docs/context/architecture.md

**Files:**
- Create: `docs/context/architecture.md`

**Step 1: Create directory and write file**

```bash
mkdir -p docs/context
```

Write the file with these sections (~170 lines total):

- **MVC Roles table**: 3-column table mapping Model/View/Controller to thread, files, and responsibility.
- **Entry Point**: `form.js:decorate()` (line 510). Three code paths: document-based (lines 537-546), adaptive form (lines 547-556), authoring mode (line 554).
- **Initialization Sequence diagram**: ASCII sequence diagram showing the 6-step message flow between main thread and worker. Include function names and line references:
  - `initAdaptiveForm()` (index.js:499)
  - Worker `init` handler (RuleEngineWorker.js:105)
  - `createForm()` (form.js:336)
  - `generateFormRendition()` (form.js:279)
  - Worker `decorated` handler (RuleEngineWorker.js:125)
  - `loadRuleEngine()` (index.js:361)
- **Dual-Model Pattern**: Worker model (authoritative, RuleEngineWorker.js:57) vs main-thread model (synchronized copy, index.js:363). Explain `restoreFormInstance()` and `applyFieldChangeToFormModel()`.
- **Form Sources**: Adaptive Forms (full MVC + worker), Document-Based (`transform.js` → `rules-doc/`), Authoring mode (static HTML, no rules).
- **Key Functions Reference table**: Function name, file, line number, purpose.

**Step 2: Commit**

```bash
git add docs/context/architecture.md
git commit -m "docs: add form block architecture context for agents"
```

---

### Task 3: Create docs/context/worker-sync-protocol.md

**Files:**
- Create: `docs/context/worker-sync-protocol.md`

**Step 1: Write file**

Write the file with these sections (~160 lines total):

- **Message Protocol tables**: Two tables (main→worker and worker→main). Columns: message name, when sent, payload shape, handler location.
  - main→worker: `init` (index.js:421-428), `decorated` (index.js:446-448)
  - worker→main: `init` (RuleEngineWorker.js:110-113), `restoreState` (133-139), `applyRestoreBatchedFieldChanges` (144-147), `applyLiveFieldChange` (76-79), `applyLiveFormChange` (66-71), `sync-complete` (151-153)
- **Field Change Phases**: Three phases with flag states, behavior, delivery mechanism, and main-thread handling. Reference `RuleEngine` class (RuleEngineWorker.js:42-98).
  - Phase 1 Initial: `fieldChanges[]` (line 83)
  - Phase 2 Post-restore: `postRestoreFieldChanges[]` (line 81)
  - Phase 3 Live: immediate `postMessage` (line 76-79)
- **Phase Transition diagram**: Show flag state changes and the `setTimeout(0)` yield (line 141-143).
- **Model Synchronization**: `applyFieldChangeToFormModel()` (index.js:323-358), `_onlyViewNotify` flag (line 331-333), `FIELD_CHANGE_PROPERTIES` set (lines 316-320).
- **No-Worker Fallback**: `index.js:408-416` — `createFormInstance()` on main thread, `setTimeout` for `loadRuleEngine` (form.js:366-370).
- **Loading State**: `.loading` class add (index.js:444) and remove (index.js:493).
- **Form-Level Changes**: `applyLiveFormChange` handler (index.js:477-490), `getPropertiesManager().updateSimpleProperty()`.

**Step 2: Commit**

```bash
git add docs/context/worker-sync-protocol.md
git commit -m "docs: add worker sync protocol context for agents"
```

---

### Task 4: Create docs/context/form-block-components.md

**Files:**
- Create: `docs/context/form-block-components.md`

**Step 1: Write file**

Write the file with these sections (~170 lines total):

- **Rendering Pipeline**: One-line flow diagram: `decorate()` → `createForm()` → `generateFormRendition()` → `renderField()` → `inputDecorator()` → `componentDecorator()`
- **generateFormRendition** (form.js:279-307): Step-by-step with line refs. Note parallel rendering via `Promise.all`.
- **renderField** (form.js:259-277): Type lookup, fallback to `createInput()`, help text, `inputDecorator()` call.
- **fieldRenderers Registry table** (form.js:131-143): All 11 entries mapping field type to renderer function and DOM element created.
- **inputDecorator** (form.js:164-240): Key behaviors — ID/name/tooltip, display format handling (lines 179-206), value assignment by type, validation attributes, file constraints.
- **Component Decorator System**: `mappings.js` overview — two lists (`OOTBComponentDecorators` line 4, `customComponents` line 3). `loadComponent()` (lines 27-58) — status tracking, CSS load, dynamic JS import. `componentDecorator()` (lines 64-79) — dispatch logic.
- **Subscription System** (index.js:512-529): `subscribe(fieldDiv, formId, callback)` — code example for custom components. Timing: immediate if model exists, deferred to `loadRuleEngine()` completion otherwise.
- **View Updates (fieldChanged)** (index.js:67-242): Property handler table (value, visible, enabled, readOnly, label, description, enum/enumNames, items, valid, validationMessage, required, activeChild). Note render promises for repeatable panels (line 217, lines 76-84).
- **Adding a New Component**: 5-step checklist with file paths and function signature.

**Step 2: Commit**

```bash
git add docs/context/form-block-components.md
git commit -m "docs: add form block components context for agents"
```

---

### Task 5: Create docs/context/rules-engine.md

**Files:**
- Create: `docs/context/rules-engine.md`

**Step 1: Write file**

Write the file with these sections (~150 lines total):

- **Generated Bundles warning table**: 5 rows — file, source package, update command. Emphasize DO NOT EDIT.
- **Form Model Class Hierarchy**: ASCII tree — Scriptable → Container (Form, panels) → Field (FileObject, Captcha). Brief description of each.
- **Factory Functions**: `createFormInstance()` (worker: RuleEngineWorker.js:57, no-worker: index.js:414) and `restoreFormInstance()` (main thread: index.js:363). Explain `getState(true)` serialization.
- **Event System**: Event types table (fieldChanged, change, submitSuccess, submitFailure, submitError, valid, invalid). EventQueue description (cycle detection, MAX_EVENT_CYCLE_COUNT=10). Subscription pattern code example.
- **Rule Evaluation**: Dependency tracking, auto-trigger, worker execution context, result propagation.
- **Custom Functions**: Registration flow (functionRegistration.js:56-84) — OOTB functions (line 73), custom path (lines 75-78), `registerFunctions()`. Preloading (lines 31-54) — modulepreload links. How to add a custom function (4 steps with code example).
- **Document-Based Forms**: `rules-doc/` as separate code path. No worker. Basic show/hide and validation.
- **Key Files Reference table**: File, lines, purpose for all rules-related files.

**Step 2: Commit**

```bash
git add docs/context/rules-engine.md
git commit -m "docs: add rules engine context for agents"
```

---

### Task 6: Final review and verification

**Step 1: Verify all files exist and are under 200 lines**

```bash
wc -l CLAUDE.md docs/context/architecture.md docs/context/worker-sync-protocol.md docs/context/form-block-components.md docs/context/rules-engine.md
```

Expected: All files under 200 lines.

**Step 2: Verify cross-references**

Check that:
- `CLAUDE.md` links to all 4 `docs/context/` files correctly
- Line number references match current source code
- No broken relative paths

**Step 3: Final commit if fixes needed**

```bash
git add -A docs/context/ CLAUDE.md
git commit -m "docs: finalize agent context files"
```
