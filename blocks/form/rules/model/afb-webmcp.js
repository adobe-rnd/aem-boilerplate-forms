import { buildFormTools } from './afb-runtime.js';

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
        let mc;
        try {
            mc = usable(typeof transport === 'function' ? transport() : undefined);
        }
        catch (err) {
            console.error('[af-webmcp] a transport factory threw; trying the next transport', err);
            continue;
        }
        if (mc) {
            return mc;
        }
    }
    return undefined;
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
    const tools = buildFormTools(form);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const regOpts = controller
        ? { signal: controller.signal, ...(options.exposedTo ? { exposedTo: options.exposedTo } : {}) }
        : (options.exposedTo ? { exposedTo: options.exposedTo } : undefined);
    const handles = tools.map((tool) => modelContext.registerTool({
        ...tool,
        execute: async (args) => {
            try {
                if (tool.annotations?.consequentialHint && options.onRequestApproval) {
                    let approved = false;
                    try {
                        approved = !!(await options.onRequestApproval({ name: tool.name, args }));
                    }
                    catch (err) {
                        console.error(`[af-webmcp] onRequestApproval threw for tool '${tool.name}'; denying`, err);
                        approved = false;
                    }
                    if (!approved) {
                        return { success: false, error: 'user consent required' };
                    }
                }
                return await tool.execute(args);
            }
            catch (err) {
                return { success: false, error: err instanceof Error ? err.message : String(err) };
            }
        }
    }, regOpts));
    return () => {
        try {
            controller?.abort();
        }
        catch (err) {
            console.error('[af-webmcp] abort during cleanup failed', err);
        }
        handles.forEach((handle, i) => {
            try {
                if (handle && typeof handle.unregister === 'function') {
                    handle.unregister();
                }
                else if (typeof modelContext.unregisterTool === 'function') {
                    modelContext.unregisterTool(tools[i].name);
                }
            }
            catch (err) {
                console.error(`[af-webmcp] failed to unregister tool '${tools[i].name}'`, err);
            }
        });
    };
};

export { registerFormWebMCP };
