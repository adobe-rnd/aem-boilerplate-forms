# Worker Sync Protocol

Communication protocol between main thread and RuleEngine web worker.

## 1. Message Protocol

### Main → Worker Messages

| Message | When Sent | Payload | Handler |
|---------|-----------|---------|---------|
| `createFormInstance` | Worker created | `{ ...formDef, search, codeBasePath, url }` | RuleEngineWorker.js `handleMessageEvent` |
| `decorated` | HTML rendered | (none) | RuleEngineWorker.js `decorated` handler |

### Worker → Main Messages

| Message | When Sent | Payload | Handler |
|---------|-----------|---------|---------|
| `renderForm` | Model created | `{ state }` (serialized form model) | `initializeRuleEngineWorker` in index.js |
| `restoreState` | Prefill complete | `{ state }` | `initializeRuleEngineWorker` in index.js |
| `applyFieldChanges` | Restore batch or live field change | `{ fieldChanges }` — array (batched) or single object (live) | `initializeRuleEngineWorker` in index.js |
| `applyLiveFormChange` | Runtime form-level change | Form change payload with `changes[]` | `initializeRuleEngineWorker` in index.js |
| `sync-complete` | All restore phases done | (none) | `initializeRuleEngineWorker` in index.js |

## 2. Field Change Phases

The RuleEngine class in RuleEngineWorker.js manages three distinct phases for field changes:

### Phase 1: Initial (before restoreState sent)

**Flags:**
- `restoreSent = false`
- `postRestoreCompleteSent = false`

**Behavior:**
- Changes pushed to `fieldChanges[]`

### Phase 2: Post-Restore (between restoreState and sync-complete)

**Flags:**
- `restoreSent = true`
- `postRestoreCompleteSent = false`

**Behavior:**
- Changes pushed to `postRestoreFieldChanges[]`

### Combined Delivery

After the `setTimeout(0)` yield, Phase 1 and Phase 2 changes are merged into a single `applyFieldChanges` message with the combined array as payload. This is only sent if there are changes to apply.

**Main Thread Handling:**
- Applied sequentially with `fieldChanged()` (DOM update) + `applyFieldChangeToFormModel()` (model sync)

### Phase 3: Live (after sync-complete)

**Flags:**
- `postRestoreCompleteSent = true`

**Behavior:**
- Each change immediately posted as `applyFieldChanges` with a single object payload (not an array)

**Main Thread Handling:**
- `fieldChanged()` updates DOM
- `applyFieldChangeToFormModel()` syncs model

## 3. Phase Transitions

```
Initial Phase
  restoreSent = false
  postRestoreCompleteSent = false
  Changes → fieldChanges[]
           ↓
    restoreState sent (state only, no fieldChanges)
           ↓
  restoreSent = true
           ↓
Post-Restore Phase
  setTimeout(0) yield
  Changes → postRestoreFieldChanges[]
           ↓
    applyFieldChanges sent (combined Phase 1 + Phase 2 array)
           ↓
    sync-complete sent
           ↓
  postRestoreCompleteSent = true
           ↓
Live Phase
  Each change → immediate applyFieldChanges (single object)
```

## 4. Model Synchronization

### applyFieldChangeToFormModel()

Iterates changes and sets properties on main-thread model.

**_onlyViewNotify Flag:**
- Prevents feedback loops
- Set to true during sync
- Suppresses re-emission of changes that originated from worker

**FIELD_CHANGE_PROPERTIES:**
- `activeChild`, `checked`, `description`, `enabled`, `enum`, `enumNames`
- `errorMessage`, `items`, `label`, `maximum`, `minimum`, `readOnly`
- `required`, `valid`, `validationMessage`, `validity`, `value`, `visible`

## 5. No-Worker Fallback

When web workers unavailable (in `initializeRuleEngineWorker`):
- `createFormInstance()` on main thread
- `setTimeout` for `loadRuleEngine` in form.js

## 6. Loading State

Form loading indicator:
- `.loading` class added after init response
- `.loading` class removed on `sync-complete`

## 7. Form-Level Changes

### applyLiveFormChange Handler

Handles form-level property changes from worker:
- Uses `getPropertiesManager().updateSimpleProperty()`
- Updates form-level state without field-specific logic

## Implementation Notes

- Worker posts changes asynchronously
- Main thread applies changes synchronously
- Phase separation prevents UI thrashing during initialization
- `setTimeout(0)` yield allows browser to render between phases
