# JavaScript best-practice checks

`npm run lint:js` runs Airbnb and XWalk checks alongside the public
`@aemforms/eslint-plugin`. `npm run lint` also checks CSS. ESLint-enabled editors
use the same `eslint.config.js`; no private CLI or GitHub authentication is needed.
`npm run test:lint` verifies rule execution, file scoping, and base lint compatibility.

These are static checks on source JavaScript, whether written by hand or generated
by an AI/tool. They do not execute the form or prove that generated code is correct.
Lint source files before bundling, not generated/minified bundles.

## Enabled AEM Forms checks

All rule IDs below have the `aem-forms/` prefix. Errors fail lint and CI. Warnings
surface design/reuse concerns without requiring a runtime-code refactor to adopt
the checks. Use `npm run lint:js -- --max-warnings 0` to fail on warnings too.

### Custom functions, fragments, and component rules

Applies to `functions.js`, `functions.source.js`, scripts under `fragment/` or
`fragments/`, and `*-rules.js` / `*.rules.js`. Keep custom functions in these
conventional locations so the checks recognize their role. Generic browser
infrastructure, including the EDS page-content `blocks/fragment/` block, is not
treated as headless custom-function code.

| Rule | Level | What it detects |
|---|---|---|
| `async-value-race` | Error | Reading an API-populated value before the asynchronous write finishes, or clearing data in an error handler. |
| `custom-fn-correctness` | Error | Non-reactive derived-property writes, imperative validity changes, or direct `_jsonModel` reads that bypass dependency tracking. |
| `headless-incompatible-usage` | Error | DOM/window access, browser navigation, or raw HTTP calls in headless custom-function code. |
| `interactive-change-guard` | Error | Focus/auto-advance side effects that also run during prefill or restored-data changes instead of only real user edits. |
| `request-error-handling` | Error | Request chains that omit failure handling or rely only on `.catch` instead of checking a resolved `{ ok: false }` response. |
| `component-rule-form-scope` | Warning | Reusable component rules reaching into form/fragment state instead of using their own field or an event payload. |
| `content-in-code` | Warning | User-facing prose or validation messages hardcoded in JavaScript instead of authored content. |
| `custom-function` | Warning | Direct `$properties` mutation, repeated single-field updates, and custom-event patterns that violate the custom-function contract. |
| `dispatch-target` | Warning | Broadcasting to a field instead of the form, or dispatching a plain object instead of a proper event. |
| `display-format-in-code` | Warning | Display formatting embedded in JavaScript instead of model display-format properties. |
| `field-writes-sibling` | Warning | One field directly changing a named sibling's value/options rather than letting the target own the update. |
| `fragment-globals-scope` | Warning | A fragment depending on its parent form's fields rather than its own reusable scope. |
| `hardcoded-config` | Warning | Hardcoded endpoint URLs instead of authored configuration or an API client. |
| `rule-vs-code` | Warning | Derived values, visibility, or validation expressed as imperative updates instead of reactive model rules. |
| `runtime-cls` | Warning | Load-time style/class changes that can cause layout shifts. |
| `should-be-component` | Warning | Field-value normalization in orchestration code that belongs in a reusable component. |
| `storage-class-namespace` | Warning | Variable names without a `data.` / `uistate.` namespace distinguishing saved data from UI state. |

### Component views

Applies to JavaScript under `components/`, excluding component rule scripts.
DOM access is expected in a view and is not rejected by headless checks.

| Rule | Level | What it detects |
|---|---|---|
| `block-decorator-input-mutation` | Warning | Changing an input's DOM value without committing the corresponding model update. |
| `component-owns-model-concern` | Warning | View code reimplementing model-owned formatting, constraints, or change handling. |
| `component-value-sync` | Warning | Copying a field value once without resynchronizing after later prefill/restoration/model updates. |

## Scope and exceptions

Existing vendored-runtime, test, tooling, and editor-support exclusions remain in
place. AEM Forms rules additionally skip minified and bundled files. Existing
JSON syntax/XWalk authoring checks remain enabled, but this integration adds no
companion-JSON or whole-form/runtime AEM Forms analyzers. Path/reference validation,
orphan-handler detection, component-model validation, and form-graph/performance
checks need additional content/runtime context and are not enabled here.

The plugin's `navigation-in-custom-fn` compatibility alias is not enabled because
its findings are reported by `headless-incompatible-usage`.

For a justified exception, suppress only the relevant line and explain why:

```js
// eslint-disable-next-line aem-forms/rule-vs-code -- One-time editable prefill, not a derived value.
globals.functions.setProperty(globals.field, { value: initialValue });
```
