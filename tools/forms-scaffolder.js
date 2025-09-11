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

// CLI Colors and Emojis
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

// Component types
const COMPONENT_TYPES = {
  SIMPLE: 'simple',
  COMPOSITE: 'composite'
};

// File templates (removed - using direct strings instead)

// Error messages
const ERROR_MESSAGES = {
  NO_COMPONENTS_SIMPLE: 'No suitable base components found for simple extension!',
  NO_COMPONENTS_COMPOSITE: 'No suitable components found for composite creation!',
  COMPONENT_EXISTS: (name) => `Component '${name}' already exists. Please choose a different name.`,
  COMPONENT_NOT_FOUND: (name) => `Component '${name}' already exists!`,
  MISSING_BASE_COMPONENT: (name) => `Base component '${name}' not found in available simple components`,
  MISSING_SELECTED_COMPONENTS: (names) => `Selected components not found: ${names.join(', ')}`
};

// Component definition cache
const componentCache = new Map();

// Error handling utilities
function handleFatalError(message, context = null) {
  const errorMsg = context ? `Failed to ${context}: ${message}` : message;
  logError(errorMsg);
  process.exit(1);
}


// Utility functions
function colorize(text, color) {
  return `${color}${text}${colors.reset}`;
}

function log(text, color = colors.white) {
  console.log(colorize(text, color));
}

function logTitle(text) {
  console.log(`\n${colorize(`${emojis.aem} ${text}`, colors.cyan + colors.bright)}`);
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

// Generate JS template metadata (removed - using generic template instead)

// Generate JS file content (simplified - generic template)
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

// Generic component definition loader functions
/**
 * Load component definition by ID or filename
 * @param {string} identifier - Component ID (e.g., 'panel', 'text-input') or filename (e.g., '_panel.json')
 * @returns {Object} Complete component data with definitions and models
 */
async function getComponentDefinition(identifier) {
  // Check cache first
  if (componentCache.has(identifier)) {
    return componentCache.get(identifier);
  }
  
  const formComponentsDir = path.join(__dirname, '../blocks/form/models/form-components');
  
  // Determine filename from identifier
  let filename;
  if (identifier.startsWith('_') && identifier.endsWith('.json')) {
    // Already a filename
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
      // Convenience accessors for first definition (most common case)
      definition: componentData.definitions[0],
      model: componentData.models?.[0]
    };
    
    // Cache for future use
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
async function getAllFormComponents() {
  const formComponentsDir = path.join(__dirname, '../blocks/form/models/form-components');
  
  try {
    const files = readdirSync(formComponentsDir)
      .filter(file => file.startsWith('_') && file.endsWith('.json'));
    
    const components = [];
    const skippedFiles = [];
    
    for (const filename of files) {
      try {
        const componentData = await getComponentDefinition(filename);
        
        // Skip files with invalid structure but don't block the entire process
        if (!componentData.definition) {
          skippedFiles.push({ filename, reason: 'Missing or invalid definition' });
          continue;
        }
        
        const definition = componentData.definition;
        const template = definition.plugins?.xwalk?.page?.template;
        
        // Only add components with valid structure
        if (definition.title && definition.id) {
          components.push({
            // Basic info
            name: definition.title,
            id: definition.id,
            filename: filename,
            
            // Type info
            fieldType: template?.fieldType || definition.id,
            resourceType: definition.plugins?.xwalk?.page?.resourceType,
            
            // Full data
            ...componentData // includes definitions, models, definition, model
          });
        } else {
          skippedFiles.push({ filename, reason: 'Missing title or id' });
        }
        
      } catch (error) {
        // Skip this file and continue with others
        skippedFiles.push({ filename, reason: error.message });
        continue;
      }
    }
    
    
    return components.sort((a, b) => a.name.localeCompare(b.name));
    
  } catch (error) {
    throw new Error(`Could not read form-components directory: ${error.message}`);
  }
}

// Load all components for both simple and composite usage (no filtering)
async function getAvailableComponents() {
  return await getAllFormComponents();
}

// Component type selection function
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

// Single-select for simple components
// Note: enquirer always returns component names as strings, not full objects
async function selectBaseComponent(availableComponents) {
  const result = await enquirer.prompt({
    type: 'select',
    name: 'baseComponent', 
    message: `${emojis.magic} Which base component should this extend?\n`,
    hint: 'Use arrow keys to navigate, Enter to confirm.',
    choices: availableComponents.map((comp) => ({
      name: comp.name,
      value: comp // Note: enquirer returns comp.name (string) regardless of value
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
    hint: 'Order matters! Use arrow keys to navigate, Spacebar to select/deselect, Enter to confirm.',
    limit: 7,
    choices: availableComponents.map(comp => ({
      name: comp.name,
      value: comp, // Note: enquirer returns comp.name (string) regardless of value
      short: comp.name
    })),
    
    // Custom indicator function (official Enquirer.js way)  
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

    // Override keypress to track chronological selection order
    keypress(input, key) {
      const wasEnabled = this.focused.enabled;
      
      // Call the original keypress handler first
      const result = this.constructor.prototype.keypress.call(this, input, key);
      
      // Track selection changes on space key
      if (key && key.name === 'space') {
        const choiceName = this.focused.name;
        
        if (!wasEnabled && this.focused.enabled) {
          // Item was just selected - add to end of selection order
          if (!selectionOrder.includes(choiceName)) {
            selectionOrder.push(choiceName);
          }
        } else if (wasEnabled && !this.focused.enabled) {
          // Item was just deselected - remove from selection order
          selectionOrder = selectionOrder.filter(name => name !== choiceName);
        }
      }
      
      return result;
    },

    footer() {
      let footer = '';
      
      // Add scroll indicator at top of footer
      const hasBelow = this.index + this.limit < this.choices.length;
      const scrollFooter = createScrollIndicators(false, hasBelow).footer;
      if (scrollFooter) {
        footer += scrollFooter;
      }
      
      // Add selection order if any selections exist
      if (selectionOrder.length > 0) {
        const selectionLines = selectionOrder
          .map((choiceName, index) => 
            `  ${colors.cyan}${(index + 1).toString().padStart(2)}.${colors.reset} ${colors.bright}${choiceName}${colors.reset}`
          );
        
        if (footer) footer += '\n\n'; // Add spacing between scroll indicator and selection
        footer += `${colors.bright}Selection Order:${colors.reset}\n${selectionLines.join('\n')}`;
      }
      
      return footer;
    }
  });
  
  // Return chronological order directly as array
  return selectionOrder;
}

// Generate composite JSON structure
async function generateCompositeJSON(componentName, selectedComponents) {
  // Load panel definition dynamically using generic loader
  const panelComponentData = await getComponentDefinition('panel');
  const basePanelDefinition = panelComponentData.definition;
  const basePanelModel = panelComponentData.model;
  
  // Create template based on panel structure
  const template = {
    ...basePanelDefinition.plugins.xwalk.page.template,
    "jcr:title": componentName.charAt(0).toUpperCase() + componentName.slice(1).replace(/-/g, ' '),
    "fd:viewType": componentName
    // Keep all panel template properties like minOccur, etc.
  };
  
  // Add each selected element to template with sensible defaults
  selectedComponents.forEach((element, index) => {
    // Generate element name from component ID and index
    const elementName = selectedComponents.length > 1 ? `${element.id}${index + 1}` : element.id;
    
    template[elementName] = {
      "jcr:title": element.name,
      "sling:resourceType": element.resourceType,
      "fieldType": element.fieldType,
      ...element.template // merge any existing template properties
    };
  });
  
  // Create composite definition using panel as base (deep clone to avoid mutations)
  const compositeDefinition = JSON.parse(JSON.stringify(basePanelDefinition));
  compositeDefinition.title = componentName.charAt(0).toUpperCase() + componentName.slice(1).replace(/-/g, ' ');
  compositeDefinition.id = componentName;
  compositeDefinition.plugins.xwalk.page.template = template;
  
  // Use full panel model with ALL features (repeatable, minOccur, maxOccur, etc.)
  const compositeModel = JSON.parse(JSON.stringify(basePanelModel));
  compositeModel.id = componentName;
  
  return {
    "definitions": [compositeDefinition],
    "models": [compositeModel]
  };
}


// Check if component directory already exists
function checkComponentExists(componentName) {
  const targetDir = path.join(__dirname, '../blocks/form/components', componentName);
  return existsSync(targetDir);
}

// Component name validation (simplified)
function validateComponentName(name) {
  if (!name || typeof name !== 'string') {
    return 'Component name is required';
  }

  // Convert and clean the name first
  const cleanName = name.toLowerCase()
    .replace(/\s+/g, '-')  // Replace spaces with hyphens
    .replace(/[^a-z0-9-_]/g, '') // Remove invalid characters (allow underscores)
    .replace(/-+/g, '-')   // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  if (!cleanName) {
    return 'Component name must contain at least one letter or number';
  }

  if (!/^[a-z]/.test(cleanName)) {
    return 'Component name must start with a letter';
  }

  // Check if component already exists
  if (checkComponentExists(cleanName)) {
    return ERROR_MESSAGES.COMPONENT_EXISTS(cleanName);
  }

  return true;
}

// Create component files
async function createComponentFiles(componentName, componentData, targetDir) {
  const files = {
    js: `${componentName}.js`,
    css: `${componentName}.css`,
    json: `_${componentName}.json`,
  };

  // Generate JS content using generic template
  const jsContent = generateJSContent(componentName);

  let jsonContent;
  
  if (componentData.type === COMPONENT_TYPES.SIMPLE) {
    // Simple component: Use base component definition with error handling
    const baseComponent = componentData.baseComponent;
    
    if (!baseComponent) {
      throw new Error(`Base component not found for simple component '${componentName}'`);
    }
    
    try {
      const baseComponentData = await getComponentDefinition(baseComponent.id || baseComponent.filename);
      
      if (!baseComponentData || !baseComponentData.definitions || !baseComponentData.models) {
        throw new Error(`Invalid base component data for '${baseComponent.name}' (${baseComponent.id})`);
      }


    // Modify the base component configuration
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
    // Composite component: Generate panel-based structure with error handling
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

  // Create CSS file (same for both types)
  const cssContent = `/* ${componentName.charAt(0).toUpperCase() + componentName.slice(1)} component styles */
/* Add your custom styles here */
`;

  // Write files
  writeFileSync(path.join(targetDir, files.js), jsContent);
  writeFileSync(path.join(targetDir, files.css), cssContent);
  writeFileSync(path.join(targetDir, files.json), jsonContent);

  return files;
}

// Update _form.json to include the new component in filters
function updateFormJson(componentName) {
  const formJsonPath = path.join(__dirname, '../blocks/form/_form.json');
  
  try {
    // Read current _form.json as text
    let formJsonContent = readFileSync(formJsonPath, 'utf-8');
    
    // Find the filters section with regex
    const filtersRegex = /"filters":\s*\[\s*\{\s*"id":\s*"form",\s*"components":\s*\[([^\]]*)\]/;
    const match = formJsonContent.match(filtersRegex);
    
    if (match) {
      // Parse the current components array
      const componentsString = match[1];
      const currentComponents = componentsString
        .split(',')
        .map(comp => comp.trim().replace(/['"]/g, ''))
        .filter(comp => comp.length > 0);
      
      // Check if component already exists
      if (!currentComponents.includes(componentName)) {
        // Add component to the array
        currentComponents.push(componentName);
        
        // Create new components string (keep original formatting)
        const newComponentsString = currentComponents
          .map(comp => `\n        "${comp}"`)
          .join(',');
        
        // Replace only the components array
        const newFiltersSection = `"filters": [
    {
      "id": "form",
      "components": [${newComponentsString}
      ]`;
        
        formJsonContent = formJsonContent.replace(
          /"filters":\s*\[\s*\{\s*"id":\s*"form",\s*"components":\s*\[([^\]]*)\]/,
          newFiltersSection
        );
        
        // Write back to file
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
function updateComponentDefinition(componentName) {
  const componentDefPath = path.join(__dirname, '../models/_component-definition.json');
  
  try {
    // Read current component definition
    const componentDef = JSON.parse(readFileSync(componentDefPath, 'utf-8'));
    
    // Find the custom components group
    const customGroup = componentDef.groups.find(group => group.id === 'custom-components');
    
    if (customGroup) {
      // Create the new component entry
      const newComponentEntry = {
        "...": `../blocks/form/components/${componentName}/_${componentName}.json#/definitions`
      };
      
      // Check if this component path already exists to avoid duplicates
      const existingEntry = customGroup.components.find(comp => 
        comp["..."] === newComponentEntry["..."]
      );
      
      if (!existingEntry) {
        // Append the new component to the existing array
        customGroup.components.push(newComponentEntry);
        
        // Write back to file with proper formatting
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

// Main scaffolding function
async function scaffoldComponent() {
  console.clear();

  // ASCII Art Banner - Ocean theme colors
  console.log(colorize(`
  █████╗  ███████╗ ███╗   ███╗     ███████╗  ██████╗  ██████╗  ███╗   ███╗ ███████╗
 ██╔══██╗ ██╔════╝ ████╗ ████║     ██╔════╝ ██╔═══██╗ ██╔══██╗ ████╗ ████║ ██╔════╝
 ███████║ █████╗   ██╔████╔██║     █████╗   ██║   ██║ ██████╔╝ ██╔████╔██║ ███████╗
 ██╔══██║ ██╔══╝   ██║╚██╔╝██║     ██╔══╝   ██║   ██║ ██╔══██╗ ██║╚██╔╝██║ ╚════██║
 ██║  ██║ ███████╗ ██║ ╚═╝ ██║     ██║      ╚██████╔╝ ██║  ██║ ██║ ╚═╝ ██║ ███████║
 ╚═╝  ╚═╝ ╚══════╝ ╚═╝     ╚═╝     ╚═╝       ╚═════╝  ╚═╝  ╚═╝ ╚═╝     ╚═╝ ╚══════╝
  `, colors.cyan + colors.bright));

  // Welcome message
  logTitle(' AEM Forms Custom Component Scaffolding Tool');
  log(`${emojis.magic}  This tool will help you set up all the necessary files to create a new custom component.`, colors.green);
  log(`${emojis.rocket} Let's create a new custom component!\n`, colors.cyan);


  try {
    // Step 1: Component type selection  
    const componentType = await selectComponentType();

    console.log(''); // Add spacing
      
    const { componentName } = await enquirer.prompt({
      type: 'input',
      name: 'componentName',
      message: `${emojis.gear} What would you like to name the custom component?`,
      validate: validateComponentName,
      format: (value) => {
        // Auto-convert input to proper format
        return value.trim()
          .toLowerCase()
          .replace(/\s+/g, '-')      // Replace spaces with hyphens
          .replace(/[^a-z0-9-_]/g, '') // Remove invalid characters (allow underscores)
      },
    });

    console.log(''); // Add spacing

    let componentData;
    if (componentType.toLowerCase() === COMPONENT_TYPES.SIMPLE) {
      // Simple component flow - load only simple-extendable components
      let simpleComponents;
      try {
        simpleComponents = await getAvailableComponents();
        
        if (simpleComponents.length === 0) {
          handleFatalError(ERROR_MESSAGES.NO_COMPONENTS_SIMPLE);
        }
      } catch (error) {
        handleFatalError(error.message, 'load simple components');
      }
      
      const baseComponentResult = await selectBaseComponent(simpleComponents);
      const baseComponentName = baseComponentResult.baseComponent; // Always a string
      
      // Convert string name to full component object
      const baseComponent = simpleComponents.find(comp => comp.name === baseComponentName);
      
      if (!baseComponent) {
        handleFatalError(ERROR_MESSAGES.MISSING_BASE_COMPONENT(baseComponentName));
      }
      
      componentData = { 
        type: COMPONENT_TYPES.SIMPLE, 
        baseComponent 
      };
      
    } else {
      // Composite component flow - load only composite-compatible components
      let compositeComponents;
      try {
        compositeComponents = await getAvailableComponents();
        
        if (compositeComponents.length === 0) {
          handleFatalError(ERROR_MESSAGES.NO_COMPONENTS_COMPOSITE);
        }
      } catch (error) {
        handleFatalError(error.message, 'load composite components');
      }
      
      const selectedComponentNames = await selectCompositeComponents(compositeComponents); // Chronological order as strings
      
      // Convert chronological order to full component objects (preserving order)
      const { mappedComponents: selectedComponents, missingComponents } = 
        mapComponentNames(selectedComponentNames, compositeComponents);
      
      if (missingComponents.length > 0) {
        handleFatalError(ERROR_MESSAGES.MISSING_SELECTED_COMPONENTS(missingComponents));
      }
      
      componentData = { 
        type: COMPONENT_TYPES.COMPOSITE, 
        selectedComponents 
      };
    }

    console.log(''); // Add spacing

    // Show summary and confirm
    log(`${emojis.sparkles} Summary:`, colors.cyan + colors.bright);
    log(`   Component name: ${colorize(componentName, colors.green)}`, colors.white);
    
    if (componentData.type === COMPONENT_TYPES.SIMPLE) {
      log(`   Type: ${colorize('Simple Custom Component', colors.green)}`, colors.white);
      log(`   Base component: ${colorize(componentData.baseComponent.name, colors.green)}`, colors.white);
    } else {
      log(`   Type: ${colorize('Composite Custom Component', colors.green)}`, colors.white);
      log(`   Contains:`, colors.white);
      componentData.selectedComponents.forEach((comp, i) => {
        log(`     ${i + 1}. ${colorize(comp.name, colors.green)}`);
      });
    }

    log(''); // Add spacing

    const { confirm } = await enquirer.prompt({
      type: 'confirm',
      name: 'confirm',
      message: `${emojis.check} Create this custom component?`,
      prefix: '', // Remove question mark prefix
      initial: true,
    });

    if (!confirm) {
      logWarning('Operation cancelled');
      return;
    }

    // Create component files with spinner
    const creationSpinner = createSpinner('Creating component structure...');

    // Create directory structure
    const targetDir = path.join(__dirname, '../blocks/form/components', componentName);

    if (checkComponentExists(componentName)) {
      creationSpinner.stop('❌ Component creation failed');
      handleFatalError(ERROR_MESSAGES.COMPONENT_NOT_FOUND(componentName));
    }

    mkdirSync(targetDir, { recursive: true });

    // Create files
    const files = await createComponentFiles(componentName, componentData, targetDir);
    creationSpinner.stop('✅ Component files created successfully');

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

    // Type-specific guidance
    log(`\n${emojis.sparkles} Next steps:`, colors.bright);
    
    log(`1. Edit ${files.js} to implement your component logic`, colors.white);
    log(`2. Add styles in ${files.css}`, colors.white);
    log(`3. Update properties in ${files.json} as needed`, colors.white);

    log(`\n${emojis.celebration} Enjoy building with your new component!`, colors.green + colors.bright);
  } catch (error) {
    console.log(''); // Add spacing
    logWarning('Operation cancelled by user');
    process.exit(0);
  }
}

// Run the scaffolding tool
scaffoldComponent().catch((error) => {
  handleFatalError(error.message, 'run scaffolding tool');
});
