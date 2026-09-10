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
        const mc = usable(typeof transport === 'function' ? transport() : undefined);
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
    const handles = tools.map((tool) => modelContext.registerTool({
        ...tool,
        execute: async (args) => {
            try {
                return await tool.execute(args);
            }
            catch (err) {
                return { success: false, error: err instanceof Error ? err.message : String(err) };
            }
        }
    }));
    return () => {
        handles.forEach((handle, i) => {
            if (handle && typeof handle.unregister === 'function') {
                handle.unregister();
            }
            else if (typeof modelContext.unregisterTool === 'function') {
                modelContext.unregisterTool(tools[i].name);
            }
        });
    };
};

export { registerFormWebMCP };
