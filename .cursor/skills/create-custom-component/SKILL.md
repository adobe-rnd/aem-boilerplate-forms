---
name: create-custom-component
description: Step-by-step playbook for creating a custom form component that extends an OOTB field type, with scaffolding, subscribe wiring, registration, and validation.
---

# Create Custom Component

## Purpose

Guide a developer through creating a custom form component end-to-end: scaffolding the folder structure, implementing the `decorate` function, wiring up model subscriptions, registering the component, and validating it on a running form.

## Dependencies

- **`knowledge/custom-form-components.md`** -- full architecture guide (MVC, folder structure, JSON schema, registration steps)
- **`knowledge/form-field-types.md`** -- HTML structure and properties for every OOTB field type
- **`knowledge/subscribe-api.md`** -- subscribe function API reference, three subscription patterns, migration examples
- **`tools/scaffold-component.sh`** -- generates skeleton files
- **`tools/validate-registration.js`** -- browser MCP diagnostic to verify the component loads
- **Browser MCP tools** (optional) -- `cursor-ide-browser` or `cursor-browser-extension` for validation step

---

## Workflow

### Step 1: Gather requirements

Ask the developer:

| Question | Why |
|----------|-----|
| What should the component be called? | Determines folder name, file names, and viewType |
| Which OOTB field type does it extend? | Determines the base HTML structure and AEM resource type |
| What custom properties does it need? | Determines what to add to the JSON schema |
| Does it need to react to model changes (value, enum, visible)? | Always yes for new components -- use `{ listenChanges: true }` |
| Is it a panel/container that watches child items? | Use `subscribe()` on each child wrapper element (see subscribe-api.md child pattern) |
| Do you have a running form URL for validation? (optional) | Used in Step 7 to verify the component loads correctly via browser MCP |

### Step 2: Scaffold

Run the scaffolding tool from the project root:

```bash
bash .cursor/skills/create-custom-component/tools/scaffold-component.sh <name> <base-type>
```

Supported base types: `text-input`, `number-input`, `drop-down`, `button`, `checkbox`, `radio-group`, `checkbox-group`, `panel`, `date-input`, `multiline-input`, `file-input`, `email`, `telephone-input`.

This creates:
- `blocks/form/components/<name>/<name>.js` -- `decorate` function with `subscribe` boilerplate
- `blocks/form/components/<name>/<name>.css` -- empty stylesheet
- `blocks/form/components/<name>/_<name>.json` -- JSON schema extending the base type

### Step 3: Add custom properties to JSON schema

Read `knowledge/custom-form-components.md` section "Defining New Properties for Custom Components".

Edit `_<name>.json` to add custom fields in the `models[0].fields` array. Reference shared field containers where possible:

```json
{ "...": "../../models/form-common/_basic-validation-fields.json#/fields" }
```

Add only fields unique to this component explicitly.

### Step 4: Implement the `decorate` function

Read `knowledge/form-field-types.md` to understand the base HTML structure the component receives in the `element` parameter.

Read `knowledge/subscribe-api.md` to choose the right subscription pattern:

| If the component... | Use |
|---------------------|-----|
| Only needs model for one-time setup | Register-only (legacy, still works) |
| Reacts to own field value/enum/visible changes | `{ listenChanges: true }` (recommended for all new components) |
| Watches child items inside a panel | `{ listenChanges: true }` on parent + `subscribe()` on each child wrapper element |

**All new components should use `{ listenChanges: true }`.** The generated JS already includes this boilerplate. For panel/container components with children, call `subscribe(childWrapper, formId, cb, { listenChanges: true })` for each child inside the parent's `'register'` callback. See `knowledge/subscribe-api.md` for the child pattern with selector guidance.

Key implementation points:
- Access custom properties via `fieldJson.properties.<propName>`
- Modify the `element` (DOM node) passed to `decorate` -- it already contains the OOTB HTML
- Dispatch `new Event('change', { bubbles: true })` on the underlying input when value changes programmatically
- Return `fieldDiv` from `decorate`

### Step 5: Register the component

#### 5a. Update `blocks/form/mappings.js`

Add the component name to the appropriate array:

```js
// For custom components (loaded by :type match from fd:viewType):
let customComponents = ['range', '<name>'];

// OR for OOTB-style decorators:
const OOTBComponentDecorators = ['accordion', ..., '<name>'];
```

The runtime loads components by matching `fd[':type']` (set via `fd:viewType` in the JSON schema) against these arrays. The component name must exactly match the `fd:viewType` value in `_<name>.json`.

#### 5b. Update `_form.json` (if needed)

The `_form.json` automatically includes `./components/*/_*.json#/definitions` via glob, so new components with a `_<name>.json` are picked up automatically. Only update `_form.json` if the component needs custom filter rules.

### Step 6: Build

```bash
npm run build:json
```

This compiles and merges all component JSON definitions into the served schema.

### Step 7: Validate (optional, requires browser MCP)

Ask the developer: **"Do you have a running form URL where this component is being used? I can validate that it loads correctly."**

If the developer provides a form URL:

1. Navigate to the form URL using `browser_navigate`
2. Wait for the form to finish loading (look for the form element in the DOM)
3. Read `tools/validate-registration.js` and inject it via `evaluate_script`, passing the component name as argument:
   ```js
   // In evaluate_script, call the function with the component name:
   const validate = <contents of tools/validate-registration.js>;
   validate('<component-name>');
   ```
4. Interpret results:

| Check | Pass | Fail action |
|-------|------|-------------|
| Form model | Form loaded | Ensure form URL is correct |
| Field using component | Field found with matching `:type` | Add the component to `mappings.js` and set `fd:viewType` in JSON |
| DOM component loaded | `componentStatus=loaded` | Check browser console for import errors |

---

## Quick reference: file locations

| File | Purpose |
|------|---------|
| `blocks/form/components/<name>/<name>.js` | Component logic |
| `blocks/form/components/<name>/<name>.css` | Component styles |
| `blocks/form/components/<name>/_<name>.json` | Authorable properties schema |
| `blocks/form/mappings.js` | Component registration |
| `blocks/form/_form.json` | Form-level definitions (auto-includes components) |
| `blocks/form/rules/index.js` | `subscribe` function source |

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Component folder name doesn't match JS filename | Must be identical: `my-comp/my-comp.js` |
| Forgot to add to `customComponents` in `mappings.js` | Component JS/CSS won't be loaded |
| Using `model.subscribe()` on children instead of `subscribe(childEl, formId, cb, { listenChanges: true })` | Legacy pattern -- use `subscribe()` from `rules/index.js` for children too |
| Forgetting `npm run build:json` after adding JSON schema | New properties won't appear in authoring |
| Dispatching change on custom input without `{ bubbles: true }` | Change won't propagate to form model |
| Setting `model.value` inside a value change handler | Infinite loop -- guard with value comparison |

---

## Example workflow

**User**: "Create a custom slider component based on number-input that has min, max, and step properties"

1. Scaffold: `bash tools/scaffold-component.sh custom-slider number-input`
2. Edit `_custom-slider.json`: add `min`, `max`, `step` fields
3. Edit `custom-slider.js`: create `<input type="range">`, wire `subscribe` to sync value
4. Edit `custom-slider.css`: style the range input
5. Add `'custom-slider'` to `customComponents` in `mappings.js`
6. Run `npm run build:json`
7. Validate on running form
