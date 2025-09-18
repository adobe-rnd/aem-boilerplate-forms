import {
  readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync,
} from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import enquirer from 'enquirer';
import { updateMappings } from './update-mappings.js';
import { logger, createSpinner } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Command line argument detection
const args = process.argv.slice(2);
const isSimpleMode = args[0] === '--simple';
const isCompositeMode = args[0] === '--composite';
const isProgrammatic = isSimpleMode || isCompositeMode;

// Validate arguments for programmatic modes
if (isProgrammatic) {
  if (isSimpleMode && args.length !== 3) {
    console.error('Usage: node forms-scaffolder.js --simple component-name base-component');
    process.exit(1);
  }
  if (isCompositeMode && args.length < 3) {
    console.error('Usage: node forms-scaffolder.js --composite component-name component1,component2,...');
    console.error('   or: node forms-scaffolder.js --composite component-name component1 component2 ...');
    console.error('   or: node forms-scaffolder.js --composite component-name "component1:Custom Name" component2');
    console.error('   or: node forms-scaffolder.js --composite component-name "comp1:Name1,comp2:Name2"');
    process.exit(1);
  }
}

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
};

const emojis = {
  rocket: '🚀',
  sparkles: '✨',
  aem: '🅰️',
  gear: '⚙️',
  check: '✅',
  error: '❌',
  warning: '⚠️',
  folder: '📁',
  file: '📄',
  magic: '🪄',
  celebration: '🎉',
};

export const COMPONENT_TYPES = {
  SIMPLE: 'simple',
  COMPOSITE: 'composite'
};

export const ERROR_MESSAGES = {
  NO_COMPONENTS_SIMPLE: 'No suitable base components found for simple extension!',
  NO_COMPONENTS_COMPOSITE: 'No suitable components found for composite creation!',
  COMPONENT_EXISTS: (name) => `Component '${name}' already exists. Please choose a different name.`,
  COMPONENT_NOT_FOUND: (name) => `Component '${name}' already exists!`,
  MISSING_BASE_COMPONENT: (name) => `Base component '${name}' not found in available simple components`,
  MISSING_SELECTED_COMPONENTS: (names) => `Selected components not found: ${names.join(', ')}`
};

const componentCache = new Map();

function handleFatalError(message, context = null) {
  const errorMsg = context ? `Failed to ${context}: ${message}` : message;
  logError(errorMsg);
  process.exit(1);
}


function colorize(text, color) {
  return `${color}${text}${colors.reset}`;
}

function log(text, color = colors.white) {
  console.log(colorize(text, color));
}

function logTitle(text) {
  log(`\n${emojis.aem} ${text}`, colors.cyan + colors.bright);
}

function logSuccess(text) {
  logger.success(text);
}

function logError(text) {
  logger.error(text);
}

function logWarning(text) {
  logger.warning(text);
}

// Format component name for display (kebab-case to Title Case)
function formatComponentName(componentName) {
  return componentName.charAt(0).toUpperCase() + componentName.slice(1).replace(/-/g, ' ');
}

// Create scroll indicators for prompts
function createScrollIndicators(hasAbove, hasBelow) {
  return {
    header: hasAbove ? `${colors.dim}  ↑ More options above. Use ↑/↓ to scroll.${colors.reset}` : '',
    footer: hasBelow ? `${colors.dim}  ↓ More options below. Use ↑/↓ to scroll.${colors.reset}` : ''
  };
}

// Map component names to component objects
function mapComponentNames(componentNames, availableComponents) {
  const mappedComponents = [];
  const missingComponents = [];
  
  componentNames.forEach(componentName => {
    const component = availableComponents.find(comp => comp.name === componentName);
    if (component) {
      mappedComponents.push(component);
    } else {
      missingComponents.push(componentName);
    }
  });
  
  return { mappedComponents, missingComponents };
}

function generateJSContent(componentName) {
  return `/**
 * Custom ${componentName} component
 */

/**
 * Decorates a custom component
 * @param {HTMLElement} fieldDiv - The DOM element containing the field wrapper. Refer to the documentation for its structure for each component.
 * @param {Object} fieldJson - The form json object for the component.
 * @param {HTMLElement} parentElement - The parent element of the field.
 * @param {string} formId - The unique identifier of the form.
 */
export default async function decorate(fieldDiv, fieldJson, parentElement, formId) {
  console.log('⚙️ Decorating ${componentName} component:', fieldDiv, fieldJson, parentElement, formId);
  
  // TODO: Implement your custom component logic here
  // You can access the field properties via fieldJson.properties
  
  return fieldDiv;
}
`;
}

// Transform relative paths for components
function transformComponentPaths(obj) {
  if (Array.isArray(obj)) {
    return obj.map(transformComponentPaths);
  }
  if (obj && typeof obj === 'object') {
    const transformed = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === '...' && typeof value === 'string') {
        // Transform relative paths from base components to components directory
        // From: ../form-common/file.json (base component path)
        // To: ../../models/form-common/file.json (component path)
        transformed[key] = value.replace(/^\.\.\/form-common\//, '../../models/form-common/');
      } else {
        transformed[key] = transformComponentPaths(value);
      }
    }
    return transformed;
  }
  return obj;
}

/**
 * Load component definition by ID or filename
 * @param {string} identifier - Component ID (e.g., 'panel', 'text-input') or filename (e.g., '_panel.json')
 * @returns {Object} Complete component data with definitions and models
 */
export async function getComponentDefinition(identifier) {
  if (componentCache.has(identifier)) {
    return componentCache.get(identifier);
  }
  
  const formComponentsDir = path.join(__dirname, '../blocks/form/models/form-components');
  
  let filename;
  if (identifier.startsWith('_') && identifier.endsWith('.json')) {
    filename = identifier;
  } else {
    // Convert ID to filename (e.g., 'panel' -> '_panel.json', 'text-input' -> '_text-input.json')
    filename = `_${identifier}.json`;
  }
  
  const filePath = path.join(formComponentsDir, filename);
  
  try {
    const componentData = JSON.parse(readFileSync(filePath, 'utf-8'));
    
    if (!componentData.definitions || !Array.isArray(componentData.definitions)) {
      throw new Error(`Invalid component structure in ${filename}: missing definitions array`);
    }
    
    if (componentData.definitions.length === 0) {
      throw new Error(`Invalid component structure in ${filename}: definitions array is empty`);
    }
    
    const result = {
      filename,
      identifier: identifier,
      definitions: componentData.definitions,
      models: componentData.models || [],
      definition: componentData.definitions[0],
      model: componentData.models?.[0]
    };
    
    componentCache.set(identifier, result);
    
    return result;
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Component definition not found: ${filename}`);
    }
    throw new Error(`Could not load component definition ${filename}: ${error.message}`);
  }
}

/**
 * Get all available form components with their definitions
 * @returns {Array} Array of component objects with full definitions
 */
export async function getAllFormComponents() {
  const formComponentsDir = path.join(__dirname, '../blocks/form/models/form-components');
  
  try {
    const files = readdirSync(formComponentsDir)
      .filter(file => file.startsWith('_') && file.endsWith('.json'));
    
    const components = [];
    const skippedFiles = [];
    
    for (const filename of files) {
      try {
        const componentData = await getComponentDefinition(filename);
        
        if (!componentData.definition) {
          skippedFiles.push({ filename, reason: 'Missing or invalid definition' });
          continue;
        }
        
        const definition = componentData.definition;
        const template = definition.plugins?.xwalk?.page?.template;
        
        if (definition.title && definition.id) {
          components.push({
            name: definition.title,
            id: definition.id,
            filename: filename,
            fieldType: template?.fieldType || definition.id,
            resourceType: definition.plugins?.xwalk?.page?.resourceType,
            template: template || {},
            ...componentData
          });
        } else {
          skippedFiles.push({ filename, reason: 'Missing title or id' });
        }
        
      } catch (error) {
        skippedFiles.push({ filename, reason: error.message });
        continue;
      }
    }
    
    
    return components.sort((a, b) => a.name.localeCompare(b.name));
    
  } catch (error) {
    throw new Error(`Could not read form-components directory: ${error.message}`);
  }
}

async function selectComponentType() {
  const result = await enquirer.prompt({
    type: 'select',
    name: 'componentType',
    message: ` What type of custom component would you like to create?`,
    choices: [
      {
        name: 'Simple',
        value: COMPONENT_TYPES.SIMPLE,
        hint: 'Extends a single base component with custom styling and logic.'
      },
      {
        name: 'Composite', 
        value: COMPONENT_TYPES.COMPOSITE,
        hint: 'Combines multiple base components into a single reusable and customizable component.'
      }
    ]
  });
  
  return result.componentType;
}

async function selectBaseComponent(availableComponents) {
  const result = await enquirer.prompt({
    type: 'select',
    name: 'baseComponent', 
    message: `${emojis.magic} Which base component should this extend?\n`,
    hint: 'Use ↑/↓ to navigate, Enter to confirm.',
    choices: availableComponents.map((comp) => ({
      name: comp.name,
      value: comp
    })),
    limit: 7,
    footer() {
      const hasBelow = this.index + this.limit < this.choices.length;
      return createScrollIndicators(false, hasBelow).footer;
    }
  });
  
  return result;
}

// Multi-select for composite components
async function selectCompositeComponents(availableComponents) {
  // Track chronological selection order manually
  let selectionOrder = [];
  
  const result = await enquirer.prompt({
    type: 'multiselect',
    name: 'selectedComponents',
    message: `${emojis.sparkles} Select base components for your composite custom component: \n`,
    hint: 'Order matters! Use ↑/↓ to navigate, Spacebar to select/deselect, Enter to confirm.',
    limit: 7,
    choices: availableComponents.map(comp => ({
      name: comp.name,
      value: comp, // Note: enquirer returns comp.name (string) regardless of value
      short: comp.name
    })),
    
    indicator(state, choice) {
      return choice.enabled ? '● ' : '○ ';
    },
    
    validate: (selected) => {
      if (selected.length === 0) {
        return 'Please select at least one component';
      }
      if (selected.length > 10) {
        return 'Maximum 10 components allowed in a composite';
      }
      return true;
    },

    keypress(input, key) {
      const wasEnabled = this.focused.enabled;
      
      const result = this.constructor.prototype.keypress.call(this, input, key);
      
      if (key && key.name === 'space') {
        const choiceName = this.focused.name;
        
        if (!wasEnabled && this.focused.enabled) {
          if (!selectionOrder.includes(choiceName)) {
            selectionOrder.push(choiceName);
          }
        } else if (wasEnabled && !this.focused.enabled) {
          selectionOrder = selectionOrder.filter(name => name !== choiceName);
        }
      }
      
      return result;
    },

    footer() {
      let footer = '';
      
      const hasBelow = this.index + this.limit < this.choices.length;
      const scrollFooter = createScrollIndicators(false, hasBelow).footer;
      if (scrollFooter) {
        footer += scrollFooter;
      }
      
      if (footer) footer += '\n\n';
      footer += `${colors.dim}💡 Tip: You can add multiple instances of the same component later by editing the generated JSON file.${colors.reset}`;
      
      if (selectionOrder.length > 0) {
        const selectionLines = selectionOrder
          .map((choiceName, index) => 
            `  ${colors.cyan}${(index + 1).toString().padStart(2)}.${colors.reset} ${colors.bright}${choiceName}${colors.reset}`
          );
        
        footer += '\n\n';
        footer += `${colors.bright}Selection Order:${colors.reset}\n${selectionLines.join('\n')}`;
      }
      
      return footer;
    }
  });
  
  return selectionOrder;
}

// Prompt for custom component names with better UX
async function promptForComponentNames(selectedComponents) {
  log(`\n${emojis.gear} Customize Display Names for Selected Components:`, colors.cyan + colors.bright);
  log(`┌${'─'.repeat(37)}┐`, colors.dim);
  log(`│ Use ↑/↓ to navigate between fields  │`, colors.dim);
  log(`│ Press Enter when all names are set  │`, colors.dim);  
  log(`└${'─'.repeat(37)}┘\n`, colors.dim);
  
  const choices = selectedComponents.map((component, index) => ({
    name: `component_${index}`,
    message: `${colorize(component.name.padEnd(20), colors.bright)}`,
    initial: component.name,
    hint: colors.dim + 'Press Tab to navigate' + colors.reset
  }));
  
  const result = await enquirer.prompt({
    type: 'form',
    name: 'componentNames',
    message: colorize('Component Display Names:', colors.cyan),
    choices,
    validate(answers) {
      const emptyEntries = Object.entries(answers)
        .filter(([_, value]) => !value || !value.trim())
        .map(([key]) => {
          const index = parseInt(key.replace('component_', ''));
          return selectedComponents[index].name;
        });
        
      if (emptyEntries.length > 0) {
        return `Please provide names for: ${colorize(emptyEntries.join(', '), colors.yellow)}`;
      }
      return true;
    }
  });
  
  // Map the answers back to component objects with custom names
  const namedComponents = selectedComponents.map((component, index) => {
    const customName = result.componentNames[`component_${index}`].trim();
    return {
      component,
      customName: customName || component.name
    };
  });
  
  return namedComponents;
}

// Parse component specifications with optional custom names for programmatic mode
export function parseComponentSpecs(args, allComponents) {
  const specs = args.slice(2);
  const selectedComponents = [];
  
  // Handle comma-separated format
  let componentSpecs;
  if (specs.length === 1 && specs[0].includes(',')) {
    componentSpecs = specs[0].split(',').map(s => s.trim());
  } else {
    componentSpecs = specs;
  }
  
  for (const spec of componentSpecs) {
    let componentId, customName;
    
    if (spec.includes(':')) {
      const [id, ...nameParts] = spec.split(':');
      componentId = id.trim();
      customName = nameParts.join(':').trim(); // Handle colons in names
    } else {
      componentId = spec.trim();
      customName = null;
    }
    
    // Validate component exists
    const component = allComponents.find(comp => 
      comp.name === componentId || comp.id === componentId
    );
    
    if (!component) {
      const availableIds = allComponents.map(c => c.id).sort().join(', ');
      throw new Error(`Component '${componentId}' not found. Available: ${availableIds}`);
    }
    
    // Validate custom name is not empty if provided
    if (customName !== null && customName === '') {
      throw new Error(`Custom name cannot be empty for component '${componentId}'. Use 'component:name' or just 'component'.`);
    }
    
    selectedComponents.push({
      component,
      customName: customName || component.name
    });
  }
  
  return selectedComponents;
}

// Generate composite JSON structure
export async function generateCompositeJSON(componentName, selectedComponents) {
  const panelComponentData = await getComponentDefinition('panel');
  const basePanelDefinition = panelComponentData.definition;
  const basePanelModel = panelComponentData.model;
  
  const template = {
    ...basePanelDefinition.plugins.xwalk.page.template,
    "jcr:title": componentName.charAt(0).toUpperCase() + componentName.slice(1).replace(/-/g, ' '),
    "fd:viewType": componentName
  };
  
  selectedComponents.forEach((element, index) => {
    const baseElementName = element.component.id.replace(/-/g, '_');
    const elementName = selectedComponents.length > 1 ? `${baseElementName}${index + 1}` : baseElementName;
    
    template[elementName] = {
      "sling:resourceType": element.component.resourceType,
      "fieldType": element.component.fieldType,
      ...element.component.template, // merge any existing template properties first
      "jcr:title": element.customName || element.component.name
    };
  });
  
  // Create composite definition using panel as base
  const compositeDefinition = JSON.parse(JSON.stringify(basePanelDefinition));
  compositeDefinition.title = componentName.charAt(0).toUpperCase() + componentName.slice(1).replace(/-/g, ' ');
  compositeDefinition.id = componentName;
  compositeDefinition.plugins.xwalk.page.template = template;
  
  const compositeModel = transformComponentPaths({
    ...JSON.parse(JSON.stringify(basePanelModel)),
    id: componentName
  });
  
  return {
    "definitions": [compositeDefinition],
    "models": [compositeModel]
  };
}


// Check if component directory already exists
export function checkComponentExists(componentName) {
  const targetDir = path.join(__dirname, '../blocks/form/components', componentName);
  return existsSync(targetDir);
}

// Unified component name transformation - single source of truth
function transformComponentName(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return '';
  }
  
  return rawName.trim()
    .toLowerCase()
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/[^a-z0-9-_]/g, '') // Remove invalid characters (allow underscores)
    .replace(/-+/g, '-')       // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

// Component name validation for transformed names
export function validateComponentName(name) {
  if (!name || typeof name !== 'string') {
    return 'Component name is required';
  }

  if (!name.trim()) {
    return 'Component name must contain at least one letter or number';
  }

  if (!/^[a-z]/.test(name)) {
    return 'Component name must start with a letter';
  }

  // Check if component already exists
  if (checkComponentExists(name)) {
    return ERROR_MESSAGES.COMPONENT_EXISTS(name);
  }

  return true;
}

// Create component files
export async function createComponentFiles(componentName, componentData, targetDir) {
  const files = {
    js: `${componentName}.js`,
    css: `${componentName}.css`,
    json: `_${componentName}.json`,
  };

  // Generate JS content using generic template
  const jsContent = generateJSContent(componentName);

  let jsonContent;
  
  if (componentData.type === COMPONENT_TYPES.SIMPLE) {
    const baseComponent = componentData.baseComponent;
    
    if (!baseComponent) {
      throw new Error(`Base component not found for simple component '${componentName}'`);
    }
    
    try {
      const baseComponentData = await getComponentDefinition(baseComponent.filename || baseComponent.id);
      
      if (!baseComponentData || !baseComponentData.definitions || !baseComponentData.models) {
        throw new Error(`Invalid base component data for '${baseComponent.name}' (${baseComponent.id})`);
      }


    const customJson = {
        definitions: baseComponentData.definitions.map((def) => ({
        ...def,
          title: formatComponentName(componentName),
        id: componentName,
        plugins: {
          ...def.plugins,
          xwalk: {
            ...def.plugins.xwalk,
            page: {
              ...def.plugins.xwalk.page,
              template: {
                ...def.plugins.xwalk.page.template,
                  'jcr:title': formatComponentName(componentName),
                'fd:viewType': componentName,
              },
            },
          },
        },
      })),
        models: baseComponentData.models.map((model) => transformComponentPaths({
        ...model,
        id: componentName,
      })),
    };

    jsonContent = JSON.stringify(customJson, null, 2);
      
  } catch (error) {
      throw new Error(`Failed to create simple component '${componentName}' based on '${baseComponent.name}': ${error.message}`);
    }
    
  } else {
    const selectedComponents = componentData.selectedComponents;
    
    if (!selectedComponents || selectedComponents.length === 0) {
      throw new Error(`No components selected for composite component '${componentName}'`);
    }
    
    try {
      const compositeJson = await generateCompositeJSON(componentName, selectedComponents);
      jsonContent = JSON.stringify(compositeJson, null, 2);
    } catch (error) {
      throw new Error(`Failed to create composite component '${componentName}': ${error.message}`);
    }
  }

  const cssContent = `/* ${componentName.charAt(0).toUpperCase() + componentName.slice(1)} component styles */
/* Add your custom styles here */
`;

  writeFileSync(path.join(targetDir, files.js), jsContent);
  writeFileSync(path.join(targetDir, files.css), cssContent);
  writeFileSync(path.join(targetDir, files.json), jsonContent);

  return files;
}

// Update _form.json to include the new component in filters
export function updateFormJson(componentName) {
  const formJsonPath = path.join(__dirname, '../blocks/form/_form.json');
  
  try {
    let formJsonContent = readFileSync(formJsonPath, 'utf-8');
    
    const filtersRegex = /"filters":\s*\[\s*\{\s*"id":\s*"form",\s*"components":\s*\[([^\]]*)\]/;
    const match = formJsonContent.match(filtersRegex);
    
    if (match) {
      const componentsString = match[1];
      const currentComponents = componentsString
        .split(',')
        .map(comp => comp.trim().replace(/['"]/g, ''))
        .filter(comp => comp.length > 0);
      
      if (!currentComponents.includes(componentName)) {
        currentComponents.push(componentName);
        
        const newComponentsString = currentComponents
          .map(comp => `\n        "${comp}"`)
          .join(',');
        
        const newFiltersSection = `"filters": [
    {
      "id": "form",
      "components": [${newComponentsString}
      ]`;
        
        formJsonContent = formJsonContent.replace(
          /"filters":\s*\[\s*\{\s*"id":\s*"form",\s*"components":\s*\[([^\]]*)\]/,
          newFiltersSection
        );
        
        writeFileSync(formJsonPath, formJsonContent);
        
        logSuccess(`Updated _form.json to include '${componentName}' in form filters`);
        return true;
      } else {
        log(`Component '${componentName}' already exists in _form.json filters`, colors.dim);
        return true;
      }
    } else {
      logWarning('Could not find form filters section in _form.json');
      return false;
    }
  } catch (error) {
    logWarning(`Could not update _form.json: ${error.message}`);
    return false;
  }
}

// Update _component-definition.json to include the new custom component
export function updateComponentDefinition(componentName) {
  const componentDefPath = path.join(__dirname, '../models/_component-definition.json');
  
  try {
    const componentDef = JSON.parse(readFileSync(componentDefPath, 'utf-8'));
    
    const customGroup = componentDef.groups.find(group => group.id === 'custom-components');
    
    if (customGroup) {
      const newComponentEntry = {
        "...": `../blocks/form/components/${componentName}/_${componentName}.json#/definitions`
      };
      
      const existingEntry = customGroup.components.find(comp => 
        comp["..."] === newComponentEntry["..."]
      );
      
      if (!existingEntry) {
        customGroup.components.push(newComponentEntry);
        
        writeFileSync(componentDefPath, JSON.stringify(componentDef, null, 2));
        
        logSuccess(`Added '${componentName}' to _component-definition.json`);
        return true;
      } else {
        log(`Component '${componentName}' already exists in _component-definition.json`, colors.dim);
        return true;
      }
    } else {
      logWarning('Could not find custom-components group in _component-definition.json');
      return false;
    }
  } catch (error) {
    logWarning(`Could not update _component-definition.json: ${error.message}`);
    return false;
  }
}

async function runInteractive() {
  console.clear();

  log(`
  █████╗  ███████╗ ███╗   ███╗     ███████╗  ██████╗  ██████╗  ███╗   ███╗ ███████╗
 ██╔══██╗ ██╔════╝ ████╗ ████║     ██╔════╝ ██╔═══██╗ ██╔══██╗ ████╗ ████║ ██╔════╝
 ███████║ █████╗   ██╔████╔██║     █████╗   ██║   ██║ ██████╔╝ ██╔████╔██║ ███████╗
 ██╔══██║ ██╔══╝   ██║╚██╔╝██║     ██╔══╝   ██║   ██║ ██╔══██╗ ██║╚██╔╝██║ ╚════██║
 ██║  ██║ ███████╗ ██║ ╚═╝ ██║     ██║      ╚██████╔╝ ██║  ██║ ██║ ╚═╝ ██║ ███████║
 ╚═╝  ╚═╝ ╚══════╝ ╚═╝     ╚═╝     ╚═╝       ╚═════╝  ╚═╝  ╚═╝ ╚═╝     ╚═╝ ╚══════╝
  `, colors.cyan + colors.bright);

  logTitle(' AEM Forms Custom Component Scaffolding Tool');
  log(`${emojis.magic}  This tool will help you set up all the necessary files to create a new custom component.`, colors.green);
  log(`${emojis.rocket} Let's create a new custom component!\n`, colors.cyan);


  try {
    const componentType = await selectComponentType();

    log('');
      
    const { rawComponentName } = await enquirer.prompt({
      type: 'input',
      name: 'rawComponentName',
      message: `${emojis.gear} What would you like to name the custom component?`,
      hint: 'Enter any name (spaces and capitals are fine)',
      validate: (input) => {
        if (!input || typeof input !== 'string' || !input.trim()) {
          return 'Component name is required';
        }
        return true;
      },
    });

    // Transform the component name and show the result
    const componentName = transformComponentName(rawComponentName);
    
    // Show the transformed name
    if (rawComponentName !== componentName) {
      log(`${emojis.magic} Transformed component name: ${colorize(componentName, colors.green + colors.bright)}`, colors.white);
    } else {
      log(`${emojis.check} Component name: ${colorize(componentName, colors.green + colors.bright)}`, colors.white);
    }

    // Validate the final component name
    const nameValidation = validateComponentName(componentName);
    if (nameValidation !== true) {
      handleFatalError(nameValidation);
    }

    log(''); // Add spacing

    let componentData;
    if (componentType.toLowerCase() === COMPONENT_TYPES.SIMPLE) {
      let simpleComponents;
      try {
        simpleComponents = await getAllFormComponents();
        
        if (simpleComponents.length === 0) {
          handleFatalError(ERROR_MESSAGES.NO_COMPONENTS_SIMPLE);
        }
      } catch (error) {
        handleFatalError(error.message, 'load simple components');
      }
      
      const baseComponentResult = await selectBaseComponent(simpleComponents);
      const baseComponentName = baseComponentResult.baseComponent;
      
      const baseComponent = simpleComponents.find(comp => comp.name === baseComponentName);
      
      if (!baseComponent) {
        handleFatalError(ERROR_MESSAGES.MISSING_BASE_COMPONENT(baseComponentName));
      }
      
      componentData = { 
        type: COMPONENT_TYPES.SIMPLE, 
        baseComponent 
      };
      
    } else {
      let compositeComponents;
      try {
        compositeComponents = await getAllFormComponents();
        
        if (compositeComponents.length === 0) {
          handleFatalError(ERROR_MESSAGES.NO_COMPONENTS_COMPOSITE);
        }
      } catch (error) {
        handleFatalError(error.message, 'load composite components');
      }
      
      const selectedComponentNames = await selectCompositeComponents(compositeComponents);
      
      const { mappedComponents: selectedComponents, missingComponents } = 
        mapComponentNames(selectedComponentNames, compositeComponents);
      
      if (missingComponents.length > 0) {
        handleFatalError(ERROR_MESSAGES.MISSING_SELECTED_COMPONENTS(missingComponents));
      }
      
      // Prompt for custom component names
      const namedComponents = await promptForComponentNames(selectedComponents);
      
      componentData = { 
        type: COMPONENT_TYPES.COMPOSITE, 
        selectedComponents: namedComponents 
      };
    }

    log('');

    log(`${emojis.sparkles} Summary:`, colors.cyan + colors.bright);
    log(`   Component name: ${colorize(componentName, colors.green)}`, colors.white);
    
    if (componentData.type === COMPONENT_TYPES.SIMPLE) {
      log(`   Type: ${colorize('Simple Custom Component', colors.green)}`, colors.white);
      log(`   Base component: ${colorize(componentData.baseComponent.name, colors.green)}`, colors.white);
    } else {
      log(`   Type: ${colorize('Composite Custom Component', colors.green)}`, colors.white);
      log(`   Component Names:`, colors.white);
      componentData.selectedComponents.forEach((item, i) => {
        const hasCustomName = item.customName !== item.component.name;
        if (hasCustomName) {
          log(`     ${i + 1}. ${colorize(item.component.name, colors.dim)} → ${colorize(item.customName, colors.green)}`);
        } else {
          log(`     ${i + 1}. ${colorize(item.component.name, colors.green)}`);
        }
      });
    }

    log(''); 

    const { confirm } = await enquirer.prompt({
      type: 'confirm',
      name: 'confirm',
      message: `${emojis.check} Create this custom component?`,
      prefix: '',
      initial: true,
    });

    if (!confirm) {
      logWarning(`Operation cancelled.`);
      return;
    }

   
    const creationSpinner = createSpinner('Creating component structure...');
    let files;

    try {
   
    const targetDir = path.join(__dirname, '../blocks/form/components', componentName);

    if (checkComponentExists(componentName)) {
      creationSpinner.stop('❌ Component creation failed');
      handleFatalError(ERROR_MESSAGES.COMPONENT_NOT_FOUND(componentName));
    }

    mkdirSync(targetDir, { recursive: true });

   
      files = await createComponentFiles(componentName, componentData, targetDir);
    creationSpinner.stop('✅ Component files created successfully');
    } catch (error) {
      creationSpinner.stop('❌ Component creation failed');
      throw new Error(`Failed to create component files: ${error.message}`);
    }

    // Update _component-definition.json to include the new custom component
    const componentDefSpinner = createSpinner('Updating component definitions...');
    updateComponentDefinition(componentName);
    componentDefSpinner.stop('✅ Custom component definition updated successfully');

    // Update mappings.js to include the new custom component
    const mappingSpinner = createSpinner('Updating mappings.js...');
    updateMappings();
    mappingSpinner.stop('✅ Mappings updated successfully');

    // Update _form.json to include the new component in filters
    const formSpinner = createSpinner('Updating _form.json...');
    updateFormJson(componentName);
    formSpinner.stop('✅ Form filters configuration updated successfully');

    // Enhanced success message based on component type
    logSuccess(`Successfully created custom component '${componentName}'!`);
    log(`\n${emojis.folder} File structure created:`, colors.cyan);
    log('blocks/form/', colors.dim);
    log('└── components/', colors.dim);
    log(`    └── ${componentName}/`, colors.dim);
    log(`        ├── ${files.js}`, colors.dim);
    log(`        ├── ${files.css}`, colors.dim);
    log(`        └── ${files.json}`, colors.dim);

   
    log(`\n${emojis.sparkles} Next steps:`, colors.bright);
    
    log(`1. Edit ${files.js} to implement your component logic`, colors.white);
    log(`2. Add styles in ${files.css}`, colors.white);
    log(`3. Update properties in ${files.json} as needed`, colors.white);

    log(`\n${emojis.celebration} Enjoy building with your new component!`, colors.green + colors.bright);
  } catch (error) {
    log('');
    logWarning('Operation cancelled.');
    process.exit(0);
  }
}

async function runProgrammatic() {
  const rawComponentName = args[1];
  
  try {
    // Transform component name for consistency
    const componentName = transformComponentName(rawComponentName);
    
    // Show transformation if it occurred
    if (rawComponentName !== componentName) {
      log(`🪄 Transformed '${rawComponentName}' to '${componentName}'`);
    }
    
    // Validate component name using existing function
    const validation = validateComponentName(componentName);
    if (validation !== true) {
      throw new Error(validation);
    }

    let componentData;
    const allComponents = await getAllFormComponents();

    if (isSimpleMode) {
      // Handle simple component
      const baseComponentSpec = args[2];
      const baseComponent = allComponents.find(comp => 
        comp.name === baseComponentSpec || comp.id === baseComponentSpec
      );
      if (!baseComponent) {
        const availableIds = allComponents.map(c => c.id).sort().join(', ');
        throw new Error(`Base component '${baseComponentSpec}' not found. Available: ${availableIds}`);
      }
      componentData = { type: COMPONENT_TYPES.SIMPLE, baseComponent };
      
    } else {
      const selectedComponents = parseComponentSpecs(args, allComponents);
      componentData = { type: COMPONENT_TYPES.COMPOSITE, selectedComponents };
    }

    // Create component files using existing functions
    const targetDir = path.join(__dirname, '../blocks/form/components', componentName);
    
    if (checkComponentExists(componentName)) {
      throw new Error(ERROR_MESSAGES.COMPONENT_EXISTS(componentName));
    }
    
    mkdirSync(targetDir, { recursive: true });
    const files = await createComponentFiles(componentName, componentData, targetDir);
    
    // Update configurations using existing functions
    updateComponentDefinition(componentName);
    updateMappings();
    updateFormJson(componentName);
    
    log(`✅ Successfully created '${componentName}' component`);
    return { success: true, component: componentName, files };
    
  } catch (error) {
    logError(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function scaffoldComponent() {
  if (isProgrammatic) {
    return await runProgrammatic();
  } else {
    return await runInteractive();
  }
}

// Run the scaffolding tool
scaffoldComponent().catch((error) => {
  handleFatalError(error.message, 'run scaffolding tool');
});
