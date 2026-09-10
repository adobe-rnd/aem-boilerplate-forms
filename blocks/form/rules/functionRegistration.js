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
import { registerFunctions } from './model/afb-runtime.min.js';

const preloadedUrls = new Set();

/**
 * Joins codeBasePath and a path into a single URL, collapsing any overlap where the
 * end of codeBasePath repeats the start of path so a shared mount folder is not
 * duplicated. The overlap is matched at path-segment boundaries and may span one or
 * more segments, e.g.:
 *   resolveFunctionUrl('/a/b/eds-cc', '/eds-cc/blocks/form/functions.js')
 *     -> '/a/b/eds-cc/blocks/form/functions.js'
 * An absolute origin in codeBasePath (e.g. https://host) is preserved as-is. Used for
 * both the modulepreload hint and the actual dynamic import so the two can never
 * resolve to different URLs.
 * @param {string} [codeBasePath] - e.g. window.hlx?.codeBasePath
 * @param {string} path - path to join, with or without a leading slash
 * @returns {string} the joined URL
 */
export function resolveFunctionUrl(codeBasePath, path) {
  const cbp = typeof codeBasePath === 'string' ? codeBasePath : '';
  const cfp = (typeof path === 'string' ? path : '').trim();
  // Keep an absolute origin (scheme://host) out of the segment merge so it is not mangled.
  const originMatch = cbp.match(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i);
  const origin = originMatch ? originMatch[0] : '';
  const base = originMatch ? cbp.slice(origin.length) : cbp;
  const baseSegments = base.split('/').filter(Boolean);
  const pathSegments = cfp.split('/').filter(Boolean);
  // Longest overlap: last `i` segments of codeBasePath === first `i` segments of path.
  let overlap = 0;
  for (let i = Math.min(baseSegments.length, pathSegments.length); i >= 1; i -= 1) {
    let matches = true;
    for (let j = 0; j < i; j += 1) {
      if (baseSegments[baseSegments.length - i + j] !== pathSegments[j]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      overlap = i;
      break;
    }
  }
  const merged = [...baseSegments, ...pathSegments.slice(overlap)].join('/');
  if (origin) return `${origin}/${merged}`;
  // Root-relative unless codeBasePath was itself a bare relative path (e.g. '../..',
  // used by the no-Worker/test harness) - in that case the joined result must stay
  // relative too, or it turns into an invalid "above the origin root" absolute path.
  const rootRelative = base === '' || base.startsWith('/');
  return rootRelative ? `/${merged}` : merged;
}

/**
 * Preloads script URLs so the browser fetches them once; main and worker
 * then get cache on import(). Call as soon as formDef is available (runtime).
 * customFunctionsPath comes from form JSON (formDef.properties.customFunctionsPath).
 * @param {string} [customFunctionsPath] - From formDef.properties.customFunctionsPath
 * @param {string} [codeBasePath] - e.g. window.hlx?.codeBasePath
 */
export function preloadFunctionScripts(customFunctionsPath, codeBasePath) {
  if (typeof document === 'undefined' || !document?.head) return;
  const paths = [resolveFunctionUrl(codeBasePath, 'blocks/form/rules/functions.js')];
  if (typeof customFunctionsPath === 'string' && customFunctionsPath.trim() !== '') {
    paths.push(resolveFunctionUrl(codeBasePath, customFunctionsPath));
  }
  paths.forEach((href) => {
    try {
      const url = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
      if (preloadedUrls.has(url)) return;
      preloadedUrls.add(url);
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = url;
      document.head.appendChild(link);
    } catch {
      // Skip invalid URL or DOM error; do not break form init
    }
  });
}

export default async function registerCustomFunctions(customFunctionsPath, codeBasePath) {
  try {
    // eslint-disable-next-line no-inner-declarations
    function registerFunctionsInRuntime(module) {
      const keys = Object.keys(module);
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < keys.length; i++) {
        const name = keys[i];
        const funcDef = module[keys[i]];
        if (typeof funcDef === 'function') {
          const functions = [];
          functions[name] = funcDef;
          registerFunctions(functions);
        }
      }
    }

    const ootbFunctionModule = await import('./functions.js');
    registerFunctionsInRuntime(ootbFunctionModule);
    if (codeBasePath != null && codeBasePath !== undefined && customFunctionsPath
      && customFunctionsPath !== undefined) {
      const customFunctionUrl = resolveFunctionUrl(codeBasePath, customFunctionsPath);
      const customFunctionModule = await import(customFunctionUrl);
      registerFunctionsInRuntime(customFunctionModule);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`error occured while registering custom functions in web worker ${e.message}`);
  }
}
