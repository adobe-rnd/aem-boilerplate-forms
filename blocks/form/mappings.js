import { loadCSS } from '../../scripts/aem.js';

let customComponents = ['range'];
const OOTBComponentDecorators = ['accordion', 'file', 'modal', 'password', 'rating', 'repeat', 'tnc', 'toggleable-link', 'wizard'];

export function setCustomComponents(components) {
  customComponents = components;
}

export function getOOTBComponents() {
  return OOTBComponentDecorators;
}

export function getCustomComponents() {
  return customComponents;
}

/**
 * Higher-Order Function that creates a component loader for a specific folder path
 * @param folderPath - The folder path relative to /blocks/form/ (e.g., 'custom-components')
 * @returns {Function} A component loader function
 */
function createComponentLoader(folderPath) {
  return async function loadFromPath(componentName, element, fd, container, formId) {
    const status = element.dataset.componentStatus;
    if (status !== 'loading' && status !== 'loaded') {
      element.dataset.componentStatus = 'loading';
      const { blockName } = element.dataset;
      try {
        loadCSS(`${window.hlx.codeBasePath}/blocks/form/${folderPath}/${componentName}/${componentName}.css`);
        const decorationComplete = new Promise((resolve) => {
          (async () => {
            try {
              const mod = await import(
                `${window.hlx.codeBasePath}/blocks/form/${folderPath}/${componentName}/${componentName}.js`
              );
              if (mod.default) {
                await mod.default(element, fd, container, formId);
              }
            } catch (error) {
              // eslint-disable-next-line no-console
              console.log(`failed to load component for ${blockName}`, error);
            }
            resolve();
          })();
        });
        await Promise.all([decorationComplete]);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log(`failed to load component ${blockName}`, error);
      }
      element.dataset.componentStatus = 'loaded';
    }
    return element;
  };
}

// Create specific loaders using the HOF
const loadComponent = createComponentLoader('components');
const loadCustomComponent = createComponentLoader('custom-components');

/**
 * returns a decorator to decorate the field definition
 *
 * */
export default async function componentDecorator(element, fd, container, formId) {
  const { ':type': type = '', fieldType } = fd;
  if (fieldType === 'file-input') {
    await loadComponent('file', element, fd, container, formId);
  }

  if (type.endsWith('wizard')) {
    await loadComponent('wizard', element, fd, container, formId);
  }

  if (getCustomComponents().includes(type)) {
    await loadCustomComponent(type, element, fd, container, formId);
  } else if (getOOTBComponents().includes(type)) {
    await loadComponent(type, element, fd, container, formId);
  }

  return null;
}
