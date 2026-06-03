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
 * Preloads script URLs so the browser fetches them once; main and worker
 * then get cache on import(). Call as soon as formDef is available (runtime).
 * customFunctionsPath comes from form JSON (formDef.properties.customFunctionsPath).
 * @param {string} [customFunctionsPath] - From formDef.properties.customFunctionsPath
 * @param {string} [codeBasePath] - e.g. window.hlx?.codeBasePath
 */
export function preloadFunctionScripts(customFunctionsPath, codeBasePath) {
  if (typeof document === 'undefined' || !document?.head) return;
  const base = (typeof codeBasePath === 'string' && codeBasePath !== '')
    ? codeBasePath.replace(/\/$/, '')
    : '';
  const prefix = base ? `${base}/` : '/';
  // blocks/form/functions.min.js is imported transitively by eager bundles via
  // '../functions.min.js'. Preloading it eliminates a serial RTT cascade on slow networks.
  const paths = [
    `${prefix}blocks/form/rules/functions.min.js`,
    `${prefix}blocks/form/functions.min.js`,
  ];
  if (typeof customFunctionsPath === 'string' && customFunctionsPath.trim() !== '') {
    const normalised = customFunctionsPath.replace(/^\//, '').trim();
    const dir = normalised.replace(/[^/]+$/, ''); // e.g. 'blocks/form/mydir/'
    const filename = normalised.split('/').pop(); // e.g. 'myfn.js'
    const basename = filename.replace(/\.js$/, ''); // e.g. 'myfn'

    paths.push(`${prefix}${normalised}`); // shim modulepreload
    paths.push(`${prefix}${dir}${basename}-bundle-eager.min.js`); // eager bundle modulepreload

    // Speculative prefetch for the lazy bundle — silent 404 if no split exists.
    // prefetch ≠ modulepreload: no parse/eval at page load, no LCP bandwidth competition.
    try {
      const lazyHref = `${prefix}${dir}${basename}-bundle-lazy.min.js`;
      const lazyUrl = lazyHref.startsWith('http')
        ? lazyHref
        : new URL(lazyHref, window.location.origin).href;
      if (!preloadedUrls.has(lazyUrl)) {
        preloadedUrls.add(lazyUrl);
        const lazyLink = document.createElement('link');
        lazyLink.rel = 'prefetch';
        lazyLink.as = 'script';
        lazyLink.href = lazyUrl;
        document.head.appendChild(lazyLink);
      }
    } catch {
      // Skip on invalid URL or Worker context
    }
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
        const key = keys[i];
        const funcDef = module[key];
        if (typeof funcDef === 'function') {
          const functions = [];
          functions[key] = funcDef;
          registerFunctions(functions);
        }
      }
    }

    // Use an absolute path so this resolves correctly whether called from the
    // main thread (base URL = blocks/form/) or from inside a Worker (base URL = rules/).
    const base = (codeBasePath != null && codeBasePath !== undefined)
      ? codeBasePath.replace(/\/$/, '')
      : '';
    // eslint-disable-next-line prefer-template
    const ootbFunctionsPath = base + '/blocks/form/rules/functions.min.js';
    const imports = [import(/* @vite-ignore */ ootbFunctionsPath)];
    if (codeBasePath != null && codeBasePath !== undefined
      && customFunctionsPath != null && customFunctionsPath !== undefined) {
      imports.push(import(`${codeBasePath}${customFunctionsPath}`));
    }

    const results = await Promise.allSettled(imports);
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        registerFunctionsInRuntime(result.value);
      } else {
        console.warn(`failed to load functions module: ${result.reason?.message}`);
      }
    });

    // If the custom functions module exports loadLazyBundle, the eager/lazy split
    // is active. Store the warmer on window.hlx so scripts.js can call it at the
    // 3s mark — before typical first user interaction. Guard for Worker context.
    if (typeof window !== 'undefined') {
      const eagerModule = results.find(
        (r) => r.status === 'fulfilled' && typeof r.value?.loadLazyBundle === 'function',
      );
      if (eagerModule) {
        window.hlx = window.hlx || {};
        window.hlx.loadLazyBundle = eagerModule.value.loadLazyBundle;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`error occured while registering custom functions in web worker ${e.message}`);
  }
}
