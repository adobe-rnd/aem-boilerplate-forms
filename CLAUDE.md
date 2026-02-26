# AEM Edge Delivery Services - Adaptive Forms Boilerplate

A lightweight, high-performance boilerplate for rendering Adobe Adaptive Forms on Edge Delivery Services without runtime bundling.

## Tech Stack

- **ES6 Modules**: Native browser modules, no webpack/rollup/vite
- **No Runtime Bundler**: Direct script imports via `<script type="module">`
- **Web Workers**: Model layer runs in separate thread for non-blocking UI
- **Pure CSS**: 4-space indents, unix linebreaks, no preprocessors
- **Testing**: Mocha (unit) + Playwright (e2e)

## Architecture at a Glance

This is an **MVC** architecture with a **dual-model pattern**: the **Model** runs in two places—an authoritative instance in a Web Worker (`RuleEngineWorker.js` + `afb-runtime.js`) handles all business logic, validation, and rule evaluation, while a synchronized copy in the main thread enables direct property access for DOM updates. The **View** (`form.js`) renders the form DOM, and the **Controller** (`rules/index.js`) orchestrates message passing and keeps both models in sync. The worker posts `applyFieldChanges` events to update both the DOM and the main thread model copy.

For detailed architecture, see [`docs/context/architecture.md`](./docs/context/architecture.md).

## File Map

```
blocks/form/
├── form.js                           — Main block entry, renders form DOM
├── form.css                          — Base form styling
├── mappings.js                       — Component decorator registry (OOTBComponentDecorators)
├── util.js                           — DOM creation helpers (createLabel, createInput, etc.)
├── constant.js                       — Shared constants (LOG_LEVEL, emailPattern, etc.)
├── submit.js                         — Form submission handlers
├── transform.js                      — Document-based form transformer
├── rules/
│   ├── index.js                      — Controller: worker init, sync logic
│   ├── RuleEngineWorker.js           — Web Worker entry point
│   ├── functionRegistration.js      — Custom function loader
│   ├── functions.js                  — Default custom functions
│   ├── model/
│   │   ├── afb-runtime.js            — [DO NOT EDIT] Core runtime from Adobe
│   │   ├── afb-runtime.min.js        — Minified runtime
│   │   ├── afb-events.js             — Event system
│   │   ├── afb-formatters.js         — Display formatters (date, number, etc.)
│   │   └── afb-formatters.min.js     — Minified formatters
│   └── formula/
│       ├── index.js                  — [DO NOT EDIT] Formula engine from Adobe
│       └── index.min.js              — Minified formula engine
├── rules-doc/                        — Legacy document-based rule engine (non-worker)
├── components/                       — Custom component decorators
│   ├── accordion/
│   ├── file/
│   ├── modal/
│   ├── password/
│   ├── rating/
│   ├── range/
│   ├── repeat/                       — Repeatable panel logic
│   ├── tnc/
│   ├── toggleable-link/
│   └── wizard/
├── integrations/
│   └── recaptcha.js                  — Google reCAPTCHA integration
└── models/                           — JSON schema fragments for authoring
```

## Detailed Context Files

| File | Purpose | When to Read |
|------|---------|--------------|
| [`architecture.md`](docs/context/architecture.md) | MVC pattern, initialization flow, dual-model pattern | Understanding init flow, MVC roles, or form source types |
| [`worker-sync-protocol.md`](docs/context/worker-sync-protocol.md) | Message types, field change phases, sync mechanism | Debugging sync issues, adding message types, field change phases |
| [`form-block-components.md`](docs/context/form-block-components.md) | Renderers, component decorator, subscription system | Adding or modifying components, rendering pipeline |
| [`rules-engine.md`](docs/context/rules-engine.md) | Model internals, afb-runtime, event system, custom functions | Debugging rule evaluation, model state, custom functions |

## Coding Conventions

- **Linter**: Airbnb ESLint config
- **Imports**: Always use `.js` extensions in import paths
- **Indentation**: 2 spaces for JavaScript, 4 spaces for CSS
- **Linebreaks**: Unix (`\n`), not Windows (`\r\n`)
- **Pre-commit Hook**: Runs lint + unit tests automatically
- **Keep docs in sync**: When changing architecture, message protocols, rendering pipeline, or component systems in `blocks/form/`, update the corresponding files in `docs/context/` and this file. Do not use line numbers in documentation — they go stale.
- **CLAUDE.md length limit**: This file MUST NOT exceed 200 lines. If it reaches 200 lines, split content into topic-specific files in `docs/` and reference them from CLAUDE.md.

### Pre-Commit Checklist

**ALWAYS run before committing:**

1. `npm run lint` — Fix all errors before committing
2. `npm run test:unit` — Ensure all tests pass
3. `npm run coverage:unit` — Verify coverage is above 85% threshold
4. Review changes with `git diff` — Verify no unintended modifications
5. Check `wc -l CLAUDE.md` — If over 200 lines, split content into `docs/` before committing

### Test-Driven Development (TDD) Practices

When following TDD workflow:

1. **RED Phase**: Write failing tests that demonstrate the bug or missing feature
2. **GREEN Phase**: Write minimal code to make tests pass
3. **REFACTOR Phase**: Clean up implementation

**Test organization principles:**
- Test descriptions should describe what the code SHOULD do
- Keep all tests that verify correct behavior, including regression tests
- Tests serve as documentation and prevent future regressions

**Example of correct test organization:**
```javascript
describe('Feature Name', () => {
  describe('Standard behavior', () => {
    it('should handle valid input correctly', () => { ... });
    it('should show error for invalid input', () => { ... });
  });

  describe('Edge cases', () => {
    it('should handle empty values', () => { ... });
    it('should handle undefined values', () => { ... });
  });
});
```

## Common Commands

```bash
npm run lint                          # Run ESLint
npm run lint:fix                      # Auto-fix lint errors
npm run test:unit                     # Run Mocha unit tests
npm run test:e2e                      # Run Playwright e2e tests
npm run update:core                   # Update afb-runtime.js from upstream
npm run update:formatters             # Update afb-formatters.js from upstream
npm run update:formula                # Update formula engine from upstream
npm run create:custom-component       # Scaffold new custom component
```

## Common Agent Tasks

### 1. Add a New Custom Component

**Example**: Add a "slider" component for numeric input

1. Run `npm run create:custom-component` (or manually create `blocks/form/components/slider/`)
2. Add component to `customComponents` array in `mappings.js`
3. Implement `slider.js` default export: `async function(element, fd, container, formId)`
4. Test by setting `:type: slider` in a form definition

### 2. Modify How a Field Type Renders

**Example**: Change how `drop-down` fields render

1. Read `form.js` to see `fieldRenderers` registry
2. Locate current renderer function (e.g., `createSelect`)
3. Modify renderer or add new one to registry
4. Ensure `inputDecorator` still applies correctly

### 3. Change Worker-Main Thread Sync Behavior

**Example**: Debounce `fieldChanged` events to reduce DOM thrashing

1. Read [`docs/context/worker-sync-protocol.md`](docs/context/worker-sync-protocol.md) for message protocol
2. Modify `handleRuleEngineEvent` in `rules/index.js`
3. If changing worker side, edit `RuleEngineWorker.js` message handlers
4. Test with complex forms (e.g., repeatable panels + rules)

### 4. Update Core Runtime (afb-runtime.js)

**Example**: Pull latest Adobe runtime changes

1. Run `npm run update:core` to fetch from upstream
2. Review diff in `blocks/form/rules/model/afb-runtime.js`
3. Run full test suite: `npm run test:unit && npm run test:e2e`
4. Commit with message: `"chore: update afb-runtime to vX.Y.Z"`

---

**Entry point for human devs**: `form.js` `decorate()` function
**Entry point for rule engine**: `rules/index.js` `initializeRuleEngineWorker()` function
