/**
 * Scopes the Adaptive Forms package stylesheet to the provider root.
 *
 * `packages/aem-forms-block/dist/form.css` is authored for an Edge Delivery page and scopes every
 * rule under the `main` landmark (e.g. `main .form form`). Rather than fabricate a `main` landmark
 * inside the host chat (an invalid, duplicate landmark), we rewrite the sheet so its outer
 * `main`/`:root` scope becomes the provider's own root element. This also prevents the sheet's
 * unscoped rules (`*`, `:root`, bare `form …`) from leaking onto the host page.
 *
 * Framework-free JS port of the web agent's `sdk/adaptive-form/styles.ts`. The web agent inlined
 * the CSS at build time via Vite's `?inline`; without a bundler we fetch the sibling built sheet
 * relative to this module at runtime.
 */

/** Splits on a separator while ignoring separators inside `()`/`[]` (e.g. `:not(a, b)`). */
function splitTopLevel(value, separator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === separator && depth === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

/** Rewrites a single complex selector so it lives under `scope`. */
function scopeSelector(selector, scope) {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;
  // The sheet's root-scoped custom properties belong on the provider root.
  if (trimmed === ':root' || trimmed.startsWith(':root')) {
    return `${scope}${trimmed.slice(':root'.length)}`;
  }
  // Replace a leading `main` type selector (its page landmark) with the provider root.
  if (/^main([\s.#:[>+~]|$)/.test(trimmed)) {
    return `${scope}${trimmed.slice('main'.length)}`;
  }
  return `${scope} ${trimmed}`;
}

function scopeSelectorList(selectors, scope) {
  return splitTopLevel(selectors, ',')
    .map((selector) => scopeSelector(selector, scope))
    .join(',');
}

const NESTED_AT_RULES = new Set(['media', 'supports', 'container']);

/** Scopes every style rule in a block body, recursing into conditional at-rules. */
function scopeBlock(css, scope) {
  let result = '';
  let index = 0;
  while (index < css.length) {
    let cursor = index;
    while (cursor < css.length && css[cursor] !== '{' && css[cursor] !== '}' && css[cursor] !== ';') {
      cursor += 1;
    }
    const prelude = css.slice(index, cursor).trim();
    const delimiter = css[cursor];
    if (delimiter === '{') {
      let depth = 1;
      let end = cursor + 1;
      while (end < css.length && depth > 0) {
        if (css[end] === '{') depth += 1;
        else if (css[end] === '}') depth -= 1;
        if (depth === 0) break;
        end += 1;
      }
      const body = css.slice(cursor + 1, end);
      if (prelude.startsWith('@')) {
        const name = prelude.slice(1).split(/[\s(]/)[0].toLowerCase();
        result += NESTED_AT_RULES.has(name)
          ? `${prelude}{${scopeBlock(body, scope)}}`
          : `${prelude}{${body}}`;
      } else {
        result += `${scopeSelectorList(prelude, scope)}{${body}}`;
      }
      index = end + 1;
    } else if (delimiter === ';') {
      // Statement at-rules (e.g. @import) pass through unchanged.
      result += css.slice(index, cursor + 1);
      index = cursor + 1;
    } else {
      result += css.slice(index);
      break;
    }
  }
  return result;
}

export function scopeAdaptiveFormStyles(css, scope) {
  return scopeBlock(css, scope);
}

// The built package stylesheet sits beside the provider in the deployed block tree.
const PACKAGE_STYLES_URL = new URL('../../packages/aem-forms-block/dist/form.css', import.meta.url);
let scopedStylesCache;

/**
 * Fetches the package stylesheet once (relative to this module) and returns it scoped under
 * `scope`. Resolves to an empty string if the sheet cannot be fetched so the form still renders
 * with native HTML styling rather than failing to render at all.
 */
export function loadScopedAdaptiveFormStyles(scope) {
  scopedStylesCache ??= fetch(PACKAGE_STYLES_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load Adaptive Forms styles (${response.status}).`);
      return response.text();
    })
    .catch((error) => {
      console.error('[bc-forms] Adaptive Form provider failed to load styles', error);
      return '';
    });
  return scopedStylesCache.then((css) => (css ? scopeAdaptiveFormStyles(css, scope) : ''));
}
