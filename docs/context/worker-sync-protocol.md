# Worker Sync Protocol

Communication protocol between main thread and RuleEngine web worker.

## 1. Message Protocol

### Main → Worker Messages

| Message | When Sent | Payload | Handler |
|---------|-----------|---------|---------|
| `init` | Worker created | `{ ...formDef, search, codeBasePath, url }` | RuleEngineWorker.js:105 |
| `decorated` | HTML rendered | (none) | RuleEngineWorker.js:125 |

### Worker → Main Messages

| Message | When Sent | Payload | Handler |
|---------|-----------|---------|---------|
| `init` | Model created | `{ state }` (serialized form model) | rules/index.js:438 |
| `restoreState` | Prefill complete | `{ state, fieldChanges }` | rules/index.js:452 |
| `applyRestoreBatchedFieldChanges` | Post-restore changes collected | `{ fieldChanges }` | rules/index.js:457 |
| `applyLiveFieldChange` | Runtime field change | Single field change payload | rules/index.js:471 |
| `applyLiveFormChange` | Runtime form-level change | Form change payload with `changes[]` | rules/index.js:477 |
| `sync-complete` | All restore phases done | (none) | rules/index.js:492 |

## 2. Field Change Phases

The RuleEngine class (RuleEngineWorker.js:42-98) manages three distinct phases for field changes:

### Phase 1: Initial (before restoreState sent)

**Flags:**
- `restoreSent = false`
- `postRestoreCompleteSent = false`

**Behavior:**
- Changes pushed to `fieldChanges[]` (line 83)
- Delivered as part of `restoreState` payload (line 137)

**Main Thread Handling:**
- Applied sequentially in `loadRuleEngine()` (index.js:384-391)

### Phase 2: Post-Restore (between restoreState and sync-complete)

**Flags:**
- `restoreSent = true`
- `postRestoreCompleteSent = false`

**Behavior:**
- Changes pushed to `postRestoreFieldChanges[]` (line 81)
- Delivered as `applyRestoreBatchedFieldChanges` (lines 144-147)

**Main Thread Handling:**
- Applied with `fieldChanged()` + `applyFieldChangeToFormModel()` (index.js:460-468)

### Phase 3: Live (after sync-complete)

**Flags:**
- `postRestoreCompleteSent = true`

**Behavior:**
- Each change immediately posted via `applyLiveFieldChange` (lines 76-79)

**Main Thread Handling:**
- `fieldChanged()` updates DOM
- `applyFieldChangeToFormModel()` syncs model (index.js:471-474)

## 3. Phase Transitions

```
Initial Phase
  restoreSent = false
  postRestoreCompleteSent = false
  Changes → fieldChanges[]
           ↓
    restoreState sent (line 137)
           ↓
  restoreSent = true
           ↓
Post-Restore Phase
  setTimeout(0) yield (lines 141-143)
  Changes → postRestoreFieldChanges[]
           ↓
    applyRestoreBatchedFieldChanges sent (lines 144-147)
           ↓
    sync-complete sent (line 151)
           ↓
  postRestoreCompleteSent = true
           ↓
Live Phase
  Each change → immediate applyLiveFieldChange
```

## 4. Model Synchronization

### applyFieldChangeToFormModel() (index.js:323-358)

Iterates changes and sets properties on main-thread model.

**_onlyViewNotify Flag (lines 331-333):**
- Prevents feedback loops
- Set to true during sync
- Skips notifying worker of changes that originated from worker

**FIELD_CHANGE_PROPERTIES (lines 316-320):**
- `value`, `valid`, `errorMessage`, `validationMessage`, `validity`
- `checked`, `visible`, `label`, `enabled`, `readOnly`
- `enum`, `enumNames`, `required`, `description`
- `minimum`, `maximum`, `items`, `activeChild`

## 5. No-Worker Fallback

When web workers unavailable (index.js:408-416):
- `createFormInstance()` on main thread
- `setTimeout` for `loadRuleEngine` (form.js:366-370)

## 6. Loading State

Form loading indicator:
- `.loading` class added (index.js:444)
- `.loading` class removed (index.js:493)

## 7. Form-Level Changes

### applyLiveFormChange Handler (index.js:477-490)

Handles form-level property changes from worker:
- Uses `getPropertiesManager().updateSimpleProperty()`
- Updates form-level state without field-specific logic

## Implementation Notes

- Worker posts changes asynchronously
- Main thread applies changes synchronously
- Phase separation prevents UI thrashing during initialization
- `setTimeout(0)` yield allows browser to render between phases
