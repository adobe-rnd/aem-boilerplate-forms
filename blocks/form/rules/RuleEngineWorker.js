/** ***********************************************************************
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 * Copyright 2024 Adobe
 * All Rights Reserved.
 *
 * NOTICE: All information contained herein is, and remains
 * the property of Adobe and its suppliers, if any. The intellectual
 * and technical concepts contained herein are proprietary to Adobe
 * and its suppliers and are protected by all applicable intellectual
 * property laws, including trade secret and copyright laws.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe.

 * Adobe permits you to use and modify this file solely in accordance with
 * the terms of the Adobe license agreement accompanying it.
 ************************************************************************ */
import { createFormInstance } from './model/afb-runtime.js';
import registerCustomFunctions from './functionRegistration.js';
import { fetchData } from '../util.js';
import { getLogLevelFromURL } from '../constant.js';

let customFunctionRegistered = false;

/**
 * Worker → main thread messages (restore flow):
 *
 * - restoreState: Sent after 'decorated'. Payload: { state, fieldChanges }.
 *   Main thread runs loadRuleEngine(state, ..., fieldChanges).
 *
 * - applyRestoreBatchedFieldChanges: Sent after restoreState. Payload: { fieldChanges }.
 *   Main thread applies each after formViewInitialized.
 *
 * - applyLiveFieldChange:     Sent per field change (live phase). Payload: single field change.
 *                             Main thread runs fieldChanged + applyFieldChangeToFormModel.
 *
 * - applyLiveFormChange:      Sent per form-level 'change' (live phase). Payload: form change.
 *                             Main thread updates form properties (e.g. polling success).
 */
export default class RuleEngine {
  rulesOrder = {};

  fieldChanges = [];

  postRestoreFieldChanges = [];

  /** True after we send applyRestoreBatchedFieldChanges; then post each field/form change. */
  postRestoreCompleteSent = false;

  /** True after restoreState until applyRestoreBatchedFieldChanges; collect field changes. */
  restoreSent = false;

  constructor(formDef, url) {
    const logLevel = getLogLevelFromURL(url);
    this.form = createFormInstance(formDef, undefined, logLevel);
    this.form.subscribe((e) => {
      const { payload } = e;
      this.handleFieldChanged(payload);
    }, 'fieldChanged');

    this.form.subscribe((e) => {
      const { payload } = e;
      if (this.postRestoreCompleteSent) {
        postMessage({
          name: 'applyLiveFormChange',
          payload,
        });
      }
    }, 'change');
  }

  handleFieldChanged(payload) {
    if (this.postRestoreCompleteSent) {
      postMessage({
        name: 'applyLiveFieldChange',
        payload,
      });
    } else if (this.restoreSent) {
      this.postRestoreFieldChanges.push(payload);
    } else {
      this.fieldChanges.push(payload);
    }
  }

  getState() {
    return this.form.getState(true);
  }

  getFieldChanges() {
    return this.fieldChanges;
  }

  getCustomFunctionsPath() {
    return this.form?.properties?.customFunctionsPath || '../functions.js';
  }
}

let ruleEngine;
let initPayload;
onmessage = async (e) => {
  async function handleMessageEvent(event) {
    switch (event.data.name) {
      case 'init': {
        const { search, ...formDef } = event.data.payload;
        initPayload = event.data.payload;
        ruleEngine = new RuleEngine(formDef, event.data.url);
        const state = ruleEngine.getState();
        postMessage({
          name: 'init',
          payload: state,
        });
        ruleEngine.dispatch = (msg) => {
          postMessage(msg);
        };
        break;
      }
      default:
        break;
    }
  }

  // Prefill form data, wait for async ops, then restore state and sync field changes to main.
  if (e.data.name === 'decorated') {
    const { search, ...formDef } = initPayload;
    const needsPrefill = formDef?.properties?.['fd:formDataEnabled'] === true;
    const data = needsPrefill ? await fetchData(formDef.id, search) : null;
    if (data) {
      ruleEngine.form.importData(data);
    }
    await ruleEngine.form.waitForPromises();
    postMessage({
      name: 'restoreState',
      payload: {
        state: ruleEngine.getState(),
        fieldChanges: ruleEngine.getFieldChanges(),
      },
    });
    ruleEngine.restoreSent = true;
    await new Promise((r) => {
      setTimeout(r, 0);
    });
    postMessage({
      name: 'applyRestoreBatchedFieldChanges',
      payload: { fieldChanges: ruleEngine.postRestoreFieldChanges },
    });
    ruleEngine.postRestoreCompleteSent = true;
    ruleEngine.restoreSent = false;
    ruleEngine.postRestoreFieldChanges = [];
    postMessage({
      name: 'sync-complete',
    });
  }

  if (!customFunctionRegistered) {
    const codeBasePath = e?.data?.codeBasePath;
    const customFunctionPath = e?.data?.payload?.properties?.customFunctionsPath;
    registerCustomFunctions(customFunctionPath, codeBasePath).then(() => {
      customFunctionRegistered = true;
      handleMessageEvent(e);
    });
  }
};
