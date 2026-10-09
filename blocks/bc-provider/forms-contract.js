/**
 * Generic Form Provider contract (runtime helpers).
 *
 * The host owns the mount element and generic chat state; the provider owns its UX, validation,
 * submission, and cleanup, and reports a live lifecycle event stream. The host never interprets
 * provider data — `input` and `completed.result` are opaque.
 *
 * This is the framework-free JS port of the web agent's `sdk/forms/contract.ts`. Only the runtime
 * values survive the TypeScript conversion; the interfaces become the JSDoc typedefs below.
 */

/**
 * @typedef {Object} FormProviderEvent
 * @property {"activated"|"in-progress"|"submitted"|"completed"|"cancelled"|"error"} type
 * @property {string} [phase]
 * @property {unknown} [result]
 * @property {string} [transcript]
 * @property {{ code: string, message?: string, retryable?: boolean }} [error]
 */

/**
 * @typedef {Object} FormProviderContext
 * @property {unknown} input Opaque provider-specific data from the backend interaction widget.
 * @property {string} interactionId Identifies this instance across host/provider operations.
 * @property {Record<string, string>} [theme] Allowed host or tenant theme variables.
 * @property {string} [locale] BCP 47 language tag for provider copy and formatting.
 */

/**
 * @typedef {Object} FormProviderInstance
 * @property {() => Promise<void>} [submit]
 * @property {(listener: (event: FormProviderEvent) => void) => (() => void)} onEvent
 * @property {() => void} destroy
 */

/**
 * @typedef {Object} FormProvider
 * @property {string} name Must match the backend interaction's `providerId`.
 * @property {(domElement: HTMLElement, context: FormProviderContext) =>
 *   FormProviderInstance | Promise<FormProviderInstance>} render
 */

/**
 * Terminal event types: each fires at most once, and nothing follows a terminal event.
 * Every rendered instance MUST eventually emit exactly one terminal event (or be destroyed by
 * the host): the host keeps chat input disabled while the provider is active.
 */
export const TERMINAL_EVENT_TYPES = new Set(['completed', 'cancelled', 'error']);

export function isTerminalEvent(event) {
  return TERMINAL_EVENT_TYPES.has(event.type);
}
