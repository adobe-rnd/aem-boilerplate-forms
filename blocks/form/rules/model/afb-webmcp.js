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
 *  Package: @aemforms/af-webmcp
 *  Version: 1.0.4
 */
import { buildFormTools } from './afb-runtime.js';

const registries = new WeakMap();
const FORM_ID_PROPERTY = 'form_id';
const interactionCheckpoints = {
    set_field_value: 'fill',
    apply_prefill: 'fill',
    add_repeatable_instance: 'fill',
    remove_repeatable_instance: 'fill',
    focus_field: 'click',
    navigate_to_panel: 'click',
    submit_form: 'formsubmit'
};
const trackInteraction = (name, result) => {
    const checkpoint = Object.prototype.hasOwnProperty.call(interactionCheckpoints, name)
        ? interactionCheckpoints[name] : undefined;
    const partialPrefill = name === 'apply_prefill' && Array.isArray(result.results)
        && result.results.some((entry) => entry.applied && entry.changed !== false);
    if (!checkpoint || result.changed === false || (!result.success && !partialPrefill) || result.pending) {
        return;
    }
    const host = typeof window === 'undefined' ? undefined : window;
    const sampleRUM = host?.hlx?.sampleRUM || host?.hlx?.rum?.sampleRUM;
    if (typeof sampleRUM === 'function') {
        try {
            sampleRUM(checkpoint, { source: 'af-webmcp', target: name });
        }
        catch (err) {
            console.error(`[af-webmcp] failed to track tool '${name}'`, err);
        }
    }
};
const usable = (mc) => (mc && typeof mc.registerTool === 'function') ? mc : undefined;
const resolveModelContext = (options) => {
    const explicit = usable(options.modelContext);
    if (explicit) {
        return explicit;
    }
    const doc = typeof document !== 'undefined' ? document : undefined;
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const native = usable(doc && doc.modelContext) || usable(nav && nav.modelContext);
    if (native) {
        return native;
    }
    for (const transport of options.transports || []) {
        try {
            const modelContext = usable(transport());
            if (modelContext) {
                return modelContext;
            }
        }
        catch (err) {
            console.error('[af-webmcp] a transport factory threw; trying the next transport', err);
        }
    }
    return undefined;
};
const normalizeOrigins = (origins) => [...(origins || [])].sort();
const sameOrigins = (left, right) => JSON.stringify(normalizeOrigins(left)) === JSON.stringify(normalizeOrigins(right));
const toolDescriptor = (tool) => JSON.stringify({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations
});
const validateTools = (tools) => {
    const names = new Set();
    for (const tool of tools) {
        if (!tool || typeof tool.name !== 'string' || !tool.name.trim()
            || typeof tool.description !== 'string' || !tool.inputSchema
            || typeof tool.execute !== 'function') {
            return 'additionalTools returned an invalid WebMCP tool';
        }
        if (names.has(tool.name)) {
            return `duplicate WebMCP tool name: ${tool.name}`;
        }
        if (tool.name === 'list_forms') {
            return 'additionalTools cannot use the reserved WebMCP tool name: list_forms';
        }
        if (tool.inputSchema.properties?.[FORM_ID_PROPERTY]) {
            return `tool '${tool.name}' cannot define the reserved input property: ${FORM_ID_PROPERTY}`;
        }
        names.add(tool.name);
    }
    return undefined;
};
const schemaWithFormId = (schema) => ({
    ...schema,
    properties: {
        [FORM_ID_PROPERTY]: {
            type: 'string',
            description: 'Adaptive Form id. Optional when only one form is available; required to disambiguate multiple forms.'
        },
        ...(schema.properties || {})
    }
});
const listFormsTool = (registry) => ({
    name: 'list_forms',
    description: 'List the active WebMCP-enabled Adaptive Forms on this page. Use when more than one form is present to obtain the form_id required by the other form tools.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
    async execute() {
        return {
            success: true,
            forms: Array.from(registry.forms.entries()).map(([id, registration]) => ({
                id,
                title: registration.form.title || id
            }))
        };
    }
});
const resolveForm = (registry, args) => {
    const formId = args?.[FORM_ID_PROPERTY];
    const toolArgs = args ? { ...args } : {};
    delete toolArgs[FORM_ID_PROPERTY];
    if (formId != null) {
        const registration = registry.forms.get(String(formId));
        return registration
            ? { registration, args: toolArgs }
            : { error: { success: false, error: `form not found: ${formId}` } };
    }
    if (registry.forms.size === 1) {
        return { registration: registry.forms.values().next().value, args: toolArgs };
    }
    return {
        error: {
            success: false,
            error: 'multiple forms are available; specify form_id',
            forms: Array.from(registry.forms.keys())
        }
    };
};
const unregisterSharedTool = (registry, name) => {
    const registration = registry.registrations.get(name);
    if (!registration || registration.cleaned) {
        return;
    }
    registration.cleaned = true;
    try {
        registration.controller?.abort();
    }
    catch (err) {
        console.error(`[af-webmcp] abort during cleanup failed for tool '${name}'`, err);
    }
    try {
        if (registration.handle && typeof registration.handle.unregister === 'function') {
            registration.handle.unregister();
        }
        else if (registration.unregisterByName && typeof registry.modelContext.unregisterTool === 'function') {
            registry.modelContext.unregisterTool(name);
        }
    }
    catch (err) {
        console.error(`[af-webmcp] failed to unregister tool '${name}'`, err);
    }
    registry.registrations.delete(name);
    registry.tools.delete(name);
};
const unregisterRegistry = (registry) => {
    Array.from(registry.registrations.keys()).forEach((name) => unregisterSharedTool(registry, name));
    registry.forms.clear();
    if (registries.get(registry.modelContext) === registry) {
        registries.delete(registry.modelContext);
    }
};
const failRegistration = (registry, name, registration, error) => {
    if (registration.cleaned || registry.registrations.get(name) !== registration) {
        return;
    }
    console.error(`[af-webmcp] failed to register tool '${name}'; rolling back affected forms`, error);
    for (const [id, formRegistration] of registry.forms) {
        if (name === 'list_forms' || formRegistration.tools.has(name)) {
            registry.forms.delete(id);
        }
    }
    Array.from(registry.registrations.keys()).forEach((toolName) => {
        if (toolName === name || !toolStillProvided(registry, toolName)) {
            unregisterSharedTool(registry, toolName);
        }
    });
    if (registry.forms.size === 0) {
        unregisterRegistry(registry);
    }
};
const executeRoutedTool = async (registry, name, args) => {
    const resolved = resolveForm(registry, args);
    if (resolved.error) {
        return resolved.error;
    }
    const registration = resolved.registration;
    const tool = registration.tools.get(name);
    if (!tool) {
        return { success: false, error: `tool '${name}' is unavailable for form: ${registration.form.id}` };
    }
    try {
        if (tool.annotations?.consequentialHint && registration.onRequestApproval) {
            let approved = false;
            try {
                approved = !!(await registration.onRequestApproval({ name, args }));
            }
            catch (err) {
                console.error(`[af-webmcp] onRequestApproval threw for tool '${name}'; denying`, err);
            }
            if (!approved) {
                return { success: false, error: 'user consent required' };
            }
        }
        if (registry.forms.get(String(registration.form.id).trim()) !== registration) {
            return { success: false, error: 'form tools have been unregistered' };
        }
        const result = await tool.execute(resolved.args);
        trackInteraction(name, result);
        return result;
    }
    catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
};
const registerSharedTool = (registry, tool) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const registration = { controller, unregisterByName: false, cleaned: false };
    const options = controller
        ? { signal: controller.signal, ...(registry.exposedTo?.length ? { exposedTo: registry.exposedTo } : {}) }
        : (registry.exposedTo?.length ? { exposedTo: registry.exposedTo } : undefined);
    const exposedTool = tool.name === 'list_forms' ? tool : {
        ...tool,
        inputSchema: schemaWithFormId(tool.inputSchema),
        execute: (args) => executeRoutedTool(registry, tool.name, args)
    };
    registry.tools.set(tool.name, tool);
    registry.registrations.set(tool.name, registration);
    try {
        const handle = registry.modelContext.registerTool(exposedTool, options);
        if (handle && typeof handle.then === 'function') {
            Promise.resolve(handle).then((resolvedHandle) => {
                registration.handle = resolvedHandle || undefined;
                registration.unregisterByName = typeof resolvedHandle?.unregister !== 'function';
                if (registration.cleaned && resolvedHandle?.unregister) {
                    try {
                        resolvedHandle.unregister();
                    }
                    catch (err) {
                        console.error(`[af-webmcp] failed to unregister tool '${tool.name}'`, err);
                    }
                }
                else if (registration.cleaned && registration.unregisterByName
                    && typeof registry.modelContext.unregisterTool === 'function'
                    && !registries.get(registry.modelContext)?.registrations.has(tool.name)) {
                    try {
                        registry.modelContext.unregisterTool(tool.name);
                    }
                    catch (err) {
                        console.error(`[af-webmcp] failed to unregister tool '${tool.name}'`, err);
                    }
                }
            }, (err) => failRegistration(registry, tool.name, registration, err));
        }
        else {
            registration.handle = handle;
            registration.unregisterByName = typeof registration.handle?.unregister !== 'function';
        }
    }
    catch (err) {
        registration.cleaned = true;
        try {
            controller?.abort();
        }
        catch (abortError) {
            console.error(`[af-webmcp] abort during failed registration cleanup for tool '${tool.name}'`, abortError);
        }
        registry.registrations.delete(tool.name);
        registry.tools.delete(tool.name);
        throw err;
    }
};
const toolStillProvided = (registry, name) => name === 'list_forms' || Array.from(registry.forms.values()).some((registration) => registration.tools.has(name));
const releaseForm = (registry, formId, form) => {
    const current = registry.forms.get(formId);
    if (!current || current.form !== form) {
        return;
    }
    current.owners -= 1;
    if (current.owners > 0) {
        return;
    }
    registry.forms.delete(formId);
    Array.from(registry.registrations.keys()).forEach((name) => {
        if (!toolStillProvided(registry, name)) {
            unregisterSharedTool(registry, name);
        }
    });
    if (registry.forms.size === 0) {
        unregisterRegistry(registry);
    }
};
const registerFormWebMCP = (form, options = {}) => {
    const enabled = options.enabled ?? form.webMcpEnabled;
    if (!enabled) {
        return () => { };
    }
    const modelContext = resolveModelContext(options);
    if (!modelContext) {
        return () => { };
    }
    const formId = String(form.id || '').trim();
    if (!formId) {
        console.error('[af-webmcp] cannot register a form without an id');
        return () => { };
    }
    let additionalTools = [];
    try {
        const providedTools = options.additionalTools?.(form) || [];
        if (!Array.isArray(providedTools)) {
            console.error(`[af-webmcp] additionalTools must return an array for form '${formId}'`);
            return () => { };
        }
        additionalTools = providedTools;
    }
    catch (err) {
        console.error(`[af-webmcp] additionalTools failed for form '${formId}'`, err);
        return () => { };
    }
    const formTools = [...buildFormTools(form, options.onFocusRequest), ...additionalTools];
    const validationError = validateTools(formTools);
    if (validationError) {
        console.error(`[af-webmcp] ${validationError}`);
        return () => { };
    }
    let registry = registries.get(modelContext);
    if (!registry) {
        registry = {
            modelContext,
            forms: new Map(),
            tools: new Map(),
            registrations: new Map(),
            exposedTo: options.exposedTo ? [...options.exposedTo] : undefined
        };
        registries.set(modelContext, registry);
    }
    else if (!sameOrigins(registry.exposedTo, options.exposedTo)) {
        console.error(`[af-webmcp] form '${formId}' uses an exposedTo policy that differs from the active document catalog`);
        return () => { };
    }
    const existing = registry.forms.get(formId);
    if (existing) {
        if (existing.form !== form) {
            console.error(`[af-webmcp] duplicate form id '${formId}' on the same modelContext`);
            return () => { };
        }
        if (existing.onFocusRequest !== options.onFocusRequest) {
            console.error(`[af-webmcp] form '${formId}' is already registered with a different renderer focus bridge`);
            return () => { };
        }
        existing.owners += 1;
        let cleaned = false;
        return () => {
            if (!cleaned) {
                cleaned = true;
                releaseForm(registry, formId, form);
            }
        };
    }
    const toolsByName = new Map(formTools.map((tool) => [tool.name, tool]));
    for (const tool of formTools) {
        const sharedTool = registry.tools.get(tool.name);
        if (sharedTool && toolDescriptor(sharedTool) !== toolDescriptor(tool)) {
            console.error(`[af-webmcp] tool '${tool.name}' has an incompatible definition across forms`);
            return () => { };
        }
    }
    const registration = {
        form,
        tools: toolsByName,
        onRequestApproval: options.onRequestApproval,
        onFocusRequest: options.onFocusRequest,
        owners: 1
    };
    registry.forms.set(formId, registration);
    const newlyRegistered = [];
    try {
        if (!registry.registrations.has('list_forms')) {
            registerSharedTool(registry, listFormsTool(registry));
            newlyRegistered.push('list_forms');
        }
        for (const tool of formTools) {
            if (!registry.registrations.has(tool.name)) {
                registerSharedTool(registry, tool);
                newlyRegistered.push(tool.name);
            }
        }
    }
    catch (err) {
        registry.forms.delete(formId);
        newlyRegistered.reverse().forEach((name) => unregisterSharedTool(registry, name));
        if (registry.forms.size === 0) {
            if (registries.get(modelContext) === registry) {
                registries.delete(modelContext);
            }
        }
        console.error(`[af-webmcp] failed to register form '${formId}'`, err);
        return () => { };
    }
    let cleaned = false;
    return () => {
        if (cleaned) {
            return;
        }
        cleaned = true;
        releaseForm(registry, formId, form);
    };
};

export { registerFormWebMCP };
