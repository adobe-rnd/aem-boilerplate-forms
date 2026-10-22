import { getId } from './util.js';

export const authoringDefinitions = new WeakMap();

export async function fetchComponentModel(path) {
  const response = await fetch(`${path}.model.json`);
  if (!response.ok) {
    throw new Error(`Unable to load component model for ${path}: HTTP ${response.status}`);
  }
  const model = await response.json();
  if (!model || typeof model.fieldType !== 'string' || typeof model.id !== 'string') {
    throw new Error(`Invalid component model for ${path}`);
  }
  if (model.properties?.['fd:path'] !== path) {
    throw new Error(`Component model does not match the requested resource: ${path}`);
  }
  return model;
}

function getChildren(resource) {
  return Object.entries(resource).filter(([, value]) => value && !Array.isArray(value)
    && typeof value === 'object' && value['sling:resourceType']
    && (value.fieldType || value.aueComponentId));
}

async function recoverChildren(resource, path) {
  const children = getChildren(resource);
  const models = await Promise.all(children.map(async ([name, child]) => {
    const childPath = `${path}/${name}`;
    try {
      return await fetchComponentModel(childPath);
    } catch (error) {
      console.warn('Unable to load component in the authoring repair view', childPath, error);
      return {
        id: getId(`recovery-${childPath}`),
        name,
        fieldType: child.fieldType || (getChildren(child).length ? 'panel' : 'text-input'),
        label: { value: child['jcr:title'] || child.title || name },
        ':type': child['sling:resourceType'],
        properties: {
          'fd:path': childPath,
          'fd:authoringError': true,
        },
        ...await recoverChildren(child, childPath),
      };
    }
  }));
  return {
    ':itemsOrder': children.map(([name]) => name),
    ':items': Object.fromEntries(children.map(([name], index) => [name, models[index]])),
  };
}

export async function recoverFormDefinition(path) {
  const formDef = {
    id: getId(`recovery-${path}`),
    fieldType: 'form',
    properties: {
      'fd:path': path,
      'fd:authoringRecovery': true,
    },
  };
  try {
    const response = await fetch(`${path}.-1.json`);
    if (!response.ok) {
      throw new Error(`Unable to load form content for ${path}: HTTP ${response.status}`);
    }
    const resource = await response.json();
    if (!resource || Array.isArray(resource) || typeof resource !== 'object') {
      throw new Error(`Invalid form content for ${path}`);
    }
    if (!getChildren(resource).length) {
      throw new Error(`No components are available for recovery at ${path}`);
    }
    Object.assign(formDef, await recoverChildren(resource, path));
  } catch (error) {
    console.error('Unable to recover form components for authoring', path, error);
    formDef.properties['fd:recoveryMessage'] = 'The form components could not be retrieved. Reload the editor and try again.';
  }
  return formDef;
}
