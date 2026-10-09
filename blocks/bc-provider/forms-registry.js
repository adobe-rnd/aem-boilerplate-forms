/**
 * Forms Provider registry implementation and installer.
 *
 * BOTH the web agent (host) bundle and this externally-loaded provider must be able to install and
 * use the registry. Whichever bundle evaluates first installs the single registry instance on
 * `window.adobe.concierge.formsProviders`; the other reuses it (`??=`). This makes provider
 * registration independent of script load order.
 *
 * Framework-free JS port of the web agent's `sdk/forms/registry.ts`.
 */

export function createFormProviderRegistry() {
  const providers = new Map();
  const waiters = new Set();

  const flushWaiters = (providerId, provider) => {
    [...waiters].forEach((waiter) => {
      if (waiter.providerId === providerId) {
        waiters.delete(waiter);
        waiter.resolve(provider);
      }
    });
  };

  return {
    register(provider) {
      const existing = providers.get(provider.name);
      if (existing && existing !== provider) {
        // First writer for a name keeps it; a different provider under the same id is
        // rejected so two legitimate copies cannot silently clobber each other.
        console.error(
          `[bc-forms] provider "${provider.name}" is already registered; ignoring a different registration`,
        );
        return () => undefined;
      }
      providers.set(provider.name, provider);
      flushWaiters(provider.name, provider);
      return () => {
        if (providers.get(provider.name) === provider) providers.delete(provider.name);
      };
    },

    get(providerId) {
      return providers.get(providerId);
    },

    whenAvailable(providerId, timeoutMs) {
      const existing = providers.get(providerId);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve) => {
        const waiter = { providerId, resolve };
        waiters.add(waiter);
        setTimeout(() => {
          if (waiters.delete(waiter)) resolve(undefined);
        }, timeoutMs);
      });
    },
  };
}

/**
 * Installs (once) and returns the shared registry on `window.adobe.concierge.formsProviders`.
 * Safe to call from any bundle, in any order; existing namespaces are preserved via `??=`.
 */
export function ensureFormProviderRegistry(win) {
  const host = win;
  if (!host.adobe) host.adobe = {};
  const { adobe } = host;
  if (!adobe.concierge) adobe.concierge = {};
  const { concierge } = adobe;
  if (!concierge.formsProviders) concierge.formsProviders = createFormProviderRegistry();
  return concierge.formsProviders;
}
