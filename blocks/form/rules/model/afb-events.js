/*************************************************************************
* ADOBE CONFIDENTIAL
* ___________________
*
* Copyright 2022 Adobe
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
*************************************************************************/

/*
 *  Package: @aemforms/af-core
 *  Version: 1.0.9
 */
const ConstraintType = Object.freeze({
    PATTERN_MISMATCH: 'patternMismatch',
    TOO_SHORT: 'tooShort',
    TOO_LONG: 'tooLong',
    RANGE_OVERFLOW: 'rangeOverflow',
    RANGE_UNDERFLOW: 'rangeUnderflow',
    TYPE_MISMATCH: 'typeMismatch',
    VALUE_MISSING: 'valueMissing',
    STEP_MISMATCH: 'stepMismatch',
    FORMAT_MISMATCH: 'formatMismatch',
    ACCEPT_MISMATCH: 'acceptMismatch',
    FILE_SIZE_MISMATCH: 'fileSizeMismatch',
    UNIQUE_ITEMS_MISMATCH: 'uniqueItemsMismatch',
    MIN_ITEMS_MISMATCH: 'minItemsMismatch',
    MAX_ITEMS_MISMATCH: 'maxItemsMismatch',
    EXPRESSION_MISMATCH: 'expressionMismatch',
    EXCLUSIVE_MAXIMUM_MISMATCH: 'exclusiveMaximumMismatch',
    EXCLUSIVE_MINIMUM_MISMATCH: 'exclusiveMinimumMismatch',
    ENUM_MISMATCH: 'enumMismatch'
});
const constraintKeys = Object.freeze({
    pattern: ConstraintType.PATTERN_MISMATCH,
    minLength: ConstraintType.TOO_SHORT,
    maxLength: ConstraintType.TOO_LONG,
    maximum: ConstraintType.RANGE_OVERFLOW,
    minimum: ConstraintType.RANGE_UNDERFLOW,
    type: ConstraintType.TYPE_MISMATCH,
    required: ConstraintType.VALUE_MISSING,
    step: ConstraintType.STEP_MISMATCH,
    format: ConstraintType.FORMAT_MISMATCH,
    accept: ConstraintType.ACCEPT_MISMATCH,
    maxFileSize: ConstraintType.FILE_SIZE_MISMATCH,
    uniqueItems: ConstraintType.UNIQUE_ITEMS_MISMATCH,
    minItems: ConstraintType.MIN_ITEMS_MISMATCH,
    maxItems: ConstraintType.MAX_ITEMS_MISMATCH,
    validationExpression: ConstraintType.EXPRESSION_MISMATCH,
    exclusiveMinimum: ConstraintType.EXCLUSIVE_MINIMUM_MISMATCH,
    exclusiveMaximum: ConstraintType.EXCLUSIVE_MAXIMUM_MISMATCH,
    enum: ConstraintType.ENUM_MISMATCH
});
const defaultConstraintTypeMessages = Object.freeze({
    [ConstraintType.PATTERN_MISMATCH]: 'Please match the format requested.',
    [ConstraintType.TOO_SHORT]: 'Please lengthen this text to ${0} characters or more.',
    [ConstraintType.TOO_LONG]: 'Please shorten this text to ${0} characters or less.',
    [ConstraintType.RANGE_OVERFLOW]: 'Value must be less than or equal to ${0}.',
    [ConstraintType.RANGE_UNDERFLOW]: 'Value must be greater than or equal to ${0}.',
    [ConstraintType.TYPE_MISMATCH]: 'Please enter a valid value.',
    [ConstraintType.VALUE_MISSING]: 'Please fill in this field.',
    [ConstraintType.STEP_MISMATCH]: 'Please enter a valid value. The two nearest valid values are ${0} and ${1}.',
    [ConstraintType.FORMAT_MISMATCH]: 'Specify the value in allowed format : ${0}.',
    [ConstraintType.ACCEPT_MISMATCH]: 'The specified file type not supported.',
    [ConstraintType.FILE_SIZE_MISMATCH]: 'File too large. Reduce size and try again.',
    [ConstraintType.UNIQUE_ITEMS_MISMATCH]: 'All the items must be unique.',
    [ConstraintType.MIN_ITEMS_MISMATCH]: 'Specify a number of items equal to or greater than ${0}.',
    [ConstraintType.MAX_ITEMS_MISMATCH]: 'Specify a number of items equal to or less than ${0}.',
    [ConstraintType.EXPRESSION_MISMATCH]: 'Please enter a valid value.',
    [ConstraintType.EXCLUSIVE_MINIMUM_MISMATCH]: 'Value must be greater than ${0}.',
    [ConstraintType.EXCLUSIVE_MAXIMUM_MISMATCH]: 'Value must be less than ${0}.',
    [ConstraintType.ENUM_MISMATCH]: 'Please select a value from the allowed options.'
});
let customConstraintTypeMessages = {};
const getConstraintTypeMessages = () => {
    return {
        ...defaultConstraintTypeMessages,
        ...customConstraintTypeMessages
    };
};
var EventSource;
(function (EventSource) {
    EventSource["CODE"] = "code";
    EventSource["UI"] = "ui";
})(EventSource || (EventSource = {}));
class ValidationError {
    fieldName;
    errorMessages;
    constructor(fieldName = '', errorMessages = []) {
        this.errorMessages = errorMessages;
        this.fieldName = fieldName;
    }
}
var FocusOption;
(function (FocusOption) {
    FocusOption["NEXT_ITEM"] = "nextItem";
    FocusOption["PREVIOUS_ITEM"] = "previousItem";
})(FocusOption || (FocusOption = {}));
var CaptchaDisplayMode;
(function (CaptchaDisplayMode) {
    CaptchaDisplayMode["INVISIBLE"] = "invisible";
    CaptchaDisplayMode["VISIBLE"] = "visible";
})(CaptchaDisplayMode || (CaptchaDisplayMode = {}));
const isSelfChange = (ev) => ev?.originalAction == null && ev?.target === ev?.currentTarget;
const isDependencyChange = (ev) => ev?.originalAction != null || ev?.target !== ev?.currentTarget;
const isUserChange = (ev) => ev?.payload?.eventSource === EventSource.UI && isSelfChange(ev);
class BaseAction {
    get isSelfChange() {
        return isSelfChange(this);
    }
    get isDependencyChange() {
        return isDependencyChange(this);
    }
    get isUserChange() {
        return isUserChange(this);
    }
    get changedProperties() {
        const changes = this.payload?.changes;
        return (Array.isArray(changes) ? changes : [])
            .map((c) => c?.propertyName)
            .filter((p) => typeof p === 'string' && p.length > 0);
    }
    hasPropertyChanged(propertyName) {
        return this.changedProperties.indexOf(propertyName) !== -1;
    }
}
class ActionImpl extends BaseAction {
    _metadata;
    _type;
    _payload;
    _target;
    _currentTarget;
    constructor(payload, type, _metadata) {
        super();
        this._metadata = _metadata;
        this._payload = payload;
        this._type = type;
    }
    get type() {
        return this._type;
    }
    get payload() {
        return this._payload;
    }
    get metadata() {
        return this._metadata;
    }
    get target() {
        return this._target;
    }
    get currentTarget() {
        return this._currentTarget;
    }
    get originalAction() {
        return this._originalAction;
    }
    get correlationId() {
        return this._correlationId;
    }
    _setTrace(originalAction, correlationId) {
        Object.defineProperty(this, '_originalAction', { value: originalAction, enumerable: false, writable: true, configurable: true });
        Object.defineProperty(this, '_correlationId', { value: correlationId, enumerable: false, writable: true, configurable: true });
    }
    get isCustomEvent() {
        return false;
    }
    payloadToJson() {
        return this.payload;
    }
    toJson() {
        return {
            payload: this.payloadToJson(),
            type: this.type,
            isCustomEvent: this.isCustomEvent
        };
    }
    toString() {
        return JSON.stringify(this.toJson());
    }
}
class Change extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'change', { dispatch });
    }
    withAdditionalChange(change) {
        return new Change(this.payload.changes.concat(change.payload.changes), this.metadata);
    }
}
class UIChange extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'uiChange', { dispatch });
    }
}
class Invalid extends ActionImpl {
    constructor(payload = {}) {
        super(payload, 'invalid', {});
    }
}
class Valid extends ActionImpl {
    constructor(payload = {}) {
        super(payload, 'valid', {});
    }
}
class ExecuteRule extends ActionImpl {
    constructor(payload = {}, dispatch = false) {
        super(payload, 'executeRule', { dispatch });
    }
}
const propertyChange = (propertyName, currentValue, prevValue, eventSource = EventSource.CODE) => {
    return new Change({
        changes: [
            {
                propertyName,
                currentValue,
                prevValue
            }
        ],
        eventSource
    });
};
class Initialize extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'initialize', { dispatch });
    }
}
class FormLoad extends ActionImpl {
    constructor() {
        super({}, 'load', { dispatch: false });
    }
}
class Click extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'click', { dispatch });
    }
}
class Blur extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'blur', { dispatch });
    }
}
class ValidationComplete extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'validationComplete', { dispatch });
    }
}
class Focus extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'focus', { dispatch });
    }
}
class Submit extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'submit', { dispatch });
    }
}
class Save extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'save', { dispatch });
    }
}
class SubmitSuccess extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'submitSuccess', { dispatch });
    }
}
class SubmitFailure extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'submitFailure', { dispatch });
    }
}
class SubmitError extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'submitError', { dispatch });
    }
}
class Reset extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'reset', { dispatch });
    }
}
class FieldChanged extends ActionImpl {
    constructor(changes, field, eventSource = EventSource.CODE) {
        super({
            field,
            changes,
            eventSource
        }, 'fieldChanged');
    }
}
class CustomEvent extends ActionImpl {
    constructor(eventName, payload = {}, dispatch = false) {
        super(payload, eventName, { dispatch });
    }
    get isCustomEvent() {
        return true;
    }
}
class AddItem extends ActionImpl {
    constructor(payload) {
        super(payload, 'addItem');
    }
}
class RemoveItem extends ActionImpl {
    constructor(payload) {
        super(payload, 'removeItem');
    }
}
class AddInstance extends ActionImpl {
    constructor(payload) {
        super(payload, 'addInstance');
    }
}
class RemoveInstance extends ActionImpl {
    constructor(payload) {
        super(payload, 'removeInstance');
    }
}
class RequestSuccess extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'requestSuccess', { dispatch });
    }
}
class RequestFailure extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'requestFailure', { dispatch });
    }
}
class ScriptError extends ActionImpl {
    constructor(payload, dispatch = false) {
        super(payload, 'scriptError', { dispatch });
    }
}

export { AddInstance, AddItem, BaseAction, Blur, CaptchaDisplayMode as C, Change, Click, CustomEvent, EventSource as E, ExecuteRule, FocusOption as F, FieldChanged, Focus, FormLoad, Initialize, Invalid, RemoveInstance, RemoveItem, RequestFailure, RequestSuccess, Reset, Save, ScriptError, Submit, SubmitError, SubmitFailure, SubmitSuccess, UIChange, ValidationError as V, Valid, ValidationComplete, constraintKeys as c, getConstraintTypeMessages as g, isDependencyChange, isSelfChange, isUserChange, propertyChange };
