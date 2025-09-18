import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
} from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import enquirer from 'enquirer';
import { updateMappings } from './update-mappings.js';
import { logger, createSpinner } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Command line argument parsing
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const options = {
    componentName: null,
    baseType: null,
    customEventName: null,
    propertyChanges: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--component-name' || arg === '-c') {
      options.componentName = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (arg === '--base-type' || arg === '-b') {
      options.baseType = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (arg === '--custom-event-name' || arg === '-e') {
      options.customEventName = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (arg === '--property-changes' || arg === '-p') {
      options.propertyChanges = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (arg.startsWith('--component-name=')) {
      options.componentName = arg.split('=')[1];
    } else if (arg.startsWith('--base-type=')) {
      options.baseType = arg.split('=')[1];
    } else if (arg.startsWith('--custom-event-name=')) {
      options.customEventName = arg.split('=')[1];
    } else if (arg.startsWith('--property-changes=')) {
      options.propertyChanges = arg.split('=')[1];
    }
  }

  return options;
}

// Display help information
function displayHelp() {
  console.log(colorize(`
${emojis.aem} AEM Forms Custom Component Scaffolding Tool

${colors.bright}Usage:${colors.reset}
  node tools/forms-scaffolder.js [options]
  npm run create:custom-component -- [options]

${colors.bright}Options:${colors.reset}
  -c, --component-name <name>    Name of the custom component (required)
  -b, --base-type <type>         Base component type to extend (required)
  -e, --custom-event-name <name> Custom event name for the component (optional)
  -p, --property-changes <list>  Comma-separated list of properties to monitor (optional)
  -h, --help                     Display this help message

${colors.bright}Examples:${colors.reset}
  node tools/forms-scaffolder.js --component-name icon-radio --base-type "Radio Group"
  npm run create:custom-component -- -c my-custom-input -b "Text Input" -e "custom-change"
  node tools/forms-scaffolder.js --component-name=rating-stars --base-type="Rating" --custom-event-name="rating-updated"
  node tools/forms-scaffolder.js --component-name=smart-input --base-type="Text Input" --property-changes="value,visible,enabled"

${colors.bright}Available Base Types:${colors.reset}
  Button, Checkbox, Checkbox Group, Date Input, Drop Down, Email,
  File Input, Image, Number Input, Panel, Radio Group, Reset Button,
  Submit Button, Telephone Input, Text, Text Input

${colors.bright}Available Property Changes:${colors.reset}
  value, visible, enabled, readOnly, required, valid, enum, enumNames,
  maximum, minimum, placeholder, tooltip, description, label,
  errorMessage, constraintMessage

${colors.bright}Interactive Mode:${colors.reset}
  If no arguments are provided, the tool will run in interactive mode
  and prompt for component name, base type, and property changes selection.
`, colors.cyan));
}

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

// Field properties that can be monitored for changes
const FIELD_PROPERTIES = [
  'value',
  'visible',
  'enabled',
  'readOnly',
  'required',
  'valid',
  'enum',
  'enumNames',
  'maximum',
  'minimum',
  'placeholder',
  'tooltip',
  'description',
  'label',
  'errorMessage',
  'constraintMessage',
];

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

// Get base components from defined array
function getBaseComponents() {
  const baseComponents = [
    'Button',
    'Checkbox',
    'Checkbox Group',
    'Date Input',
    'Drop Down',
    'Email',
    'File Input',
    'Image',
    'Number Input',
    'Panel',
    'Radio Group',
    'Reset Button',
    'Submit Button',
    'Telephone Input',
    'Text',
    'Text Input',
  ];

  return baseComponents.map((name) => ({
    name,
    value: name.toLowerCase().replace(/\s+/g, '-'),
    filename: `_${name.toLowerCase().replace(/\s+/g, '-')}.json`,
  }));
}

// Find base component by name (case-insensitive)
function findBaseComponentByName(baseTypeName) {
  const baseComponents = getBaseComponents();
  
  // Try exact match first
  let baseComponent = baseComponents.find(comp => 
    comp.name.toLowerCase() === baseTypeName.toLowerCase()
  );
  
  // If no exact match, try partial match
  if (!baseComponent) {
    baseComponent = baseComponents.find(comp => 
      comp.name.toLowerCase().includes(baseTypeName.toLowerCase()) ||
      baseTypeName.toLowerCase().includes(comp.name.toLowerCase())
    );
  }
  
  return baseComponent;
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
    return `Component '${cleanName}' already exists. Please choose a different name.`;
  }

  return true;
}

// Custom event name validation
function validateCustomEventName(name) {
  if (!name || typeof name !== 'string') {
    return 'Custom event name is required';
  }

  // Convert and clean the name first
  const cleanName = name.toLowerCase()
    .replace(/\s+/g, '-')  // Replace spaces with hyphens
    .replace(/[^a-z0-9-_]/g, '') // Remove invalid characters (allow underscores)
    .replace(/-+/g, '-')   // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  if (!cleanName) {
    return 'Custom event name must contain at least one letter or number';
  }

  if (!/^[a-z]/.test(cleanName)) {
    return 'Custom event name must start with a letter';
  }

  return true;
}


// Parse property changes from CLI argument
function parsePropertyChanges(propertyChangesString) {
  if (!propertyChangesString || typeof propertyChangesString !== 'string') {
    return [];
  }

  // Split by comma and clean up
  const properties = propertyChangesString
    .split(',')
    .map(prop => prop.trim())
    .filter(prop => prop.length > 0);

  // Validate each property
  const invalidProperties = properties.filter(prop => !FIELD_PROPERTIES.includes(prop));
  
  if (invalidProperties.length > 0) {
    throw new Error(`Invalid properties: ${invalidProperties.join(', ')}. Available properties: ${FIELD_PROPERTIES.join(', ')}`);
  }

  return properties;
}

// Get all available properties as choices for interactive mode
function getPropertyChoices() {
  return FIELD_PROPERTIES.map(prop => ({
    name: prop,
    value: prop,
  }));
}

// Create component files
function createComponentFiles(componentName, baseComponent, targetDir, customEventName = '', propertyChanges = []) {
  const files = {
    js: `${componentName}.js`,
    css: `${componentName}.css`,
    json: `_${componentName}.json`,
  };

  // Create JS file - read template from js-content.txt
  const jsTemplatePath = path.join(__dirname, 'js-content.txt');
  const jsTemplate = readFileSync(jsTemplatePath, 'utf8');
  
  // Format property changes array for JS
  const propertyChangesString = propertyChanges.length > 0 
    ? `['${propertyChanges.join("', '")}']`
    : '[]';
  
  // Generate component class name (PascalCase)
  const componentClassName = componentName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  // Replace template variables
  const jsContent = jsTemplate
    .replace(/\$\{componentName\}/g, componentName)
    .replace(/\$\{componentClassName\}/g, componentClassName)
    .replace(/\$\{baseComponent\.name\}/g, baseComponent.name)
    .replace(/\$\{custom_event_name\}/g, customEventName)
    .replace(/\$\{propertyChanges\}/g, propertyChangesString)
    .replace(/\$\{emojis\.gear\}/g, '⚙️');

  // Create CSS file (empty)
  const cssContent = `/* ${componentName.charAt(0).toUpperCase() + componentName.slice(1)} component styles */
  /* Add your custom styles here */
`;

  // Create JSON file based on base component
  let jsonContent;
  try {
    const baseComponentPath = path.join(__dirname, '../blocks/form/models/form-components', baseComponent.filename);
    const baseJson = JSON.parse(readFileSync(baseComponentPath, 'utf-8'));

    // Function to transform relative paths for components
    const transformPaths = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(transformPaths);
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
            transformed[key] = transformPaths(value);
          }
        }
        return transformed;
      }
      return obj;
    };

    // Modify the base component configuration
    const customJson = {
      ...baseJson,
      definitions: baseJson.definitions.map((def) => ({
        ...def,
        title: componentName.charAt(0).toUpperCase() + componentName.slice(1).replace(/-/g, ' '),
        id: componentName,
        plugins: {
          ...def.plugins,
          xwalk: {
            ...def.plugins.xwalk,
            page: {
              ...def.plugins.xwalk.page,
              template: {
                ...def.plugins.xwalk.page.template,
                'jcr:title': componentName.charAt(0).toUpperCase() + componentName.slice(1).replace(/-/g, ' '),
                'fd:viewType': componentName,
              },
            },
          },
        },
      })),
      models: baseJson.models.map((model) => transformPaths({
        ...model,
        id: componentName,
      })),
    };

    jsonContent = JSON.stringify(customJson, null, 2);
  } catch (error) {
    logWarning(`Could not read base component ${baseComponent.filename}, creating basic JSON structure`);
    jsonContent = `{
  "definitions": [
    {
      "title": "${componentName.charAt(0).toUpperCase() + componentName.slice(1)}",
      "id": "${componentName}",
      "plugins": {
        "xwalk": {
          "page": {
            "resourceType": "core/fd/components/form/textinput/v1/textinput",
            "template": {
              "jcr:title": "${componentName.charAt(0).toUpperCase() + componentName.slice(1)}",
              "fieldType": "text-input",
              "fd:viewType": "${componentName}"
            }
          }
        }
      }
    }
  ],
  "models": [
    {
      "id": "${componentName}",
      "fields": [
        {
          "component": "container",
          "name": "basic",
          "label": "Basic",
          "collapsible": false,
          "...": "../../models/form-common/_basic-input-fields.json"
        },
        {
          "...": "../../models/form-common/_help-container.json"
        }
      ]
    }
  ]
}`;
  }

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
async function scaffoldComponent(cliOptions = null) {
  // Parse command line arguments if not provided
  const options = cliOptions || parseCommandLineArgs();
  
  // Handle help option
  if (options.help) {
    displayHelp();
    return;
  }

  // Validate CLI arguments if provided
  if (options.componentName && !options.baseType) {
    logError('Error: --base-type is required when --component-name is provided');
    console.log('\nUse --help for usage information.');
    process.exit(1);
  }
  
  if (options.baseType && !options.componentName) {
    logError('Error: --component-name is required when --base-type is provided');
    console.log('\nUse --help for usage information.');
    process.exit(1);
  }

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
  logTitle('AEM Forms Custom Component Scaffolding Tool');
  log(`${emojis.magic}  This tool will help you set up all the necessary files to create a new custom component.\n`, colors.green);
  log(`${emojis.rocket} Let's create a new custom component!`, colors.cyan);

  const baseComponents = getBaseComponents();
  let componentName, baseComponent, customEventName, propertyChanges;

  try {
    // Handle CLI mode vs Interactive mode
    if (options.componentName && options.baseType) {
      // CLI mode - validate and use provided arguments
      componentName = options.componentName.trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Validate component name
      const validationResult = validateComponentName(componentName);
      if (validationResult !== true) {
        logError(`Invalid component name: ${validationResult}`);
        process.exit(1);
      }

      // Find base component
      baseComponent = findBaseComponentByName(options.baseType);
      if (!baseComponent) {
        logError(`Base component '${options.baseType}' not found.`);
        log(`Available base components: ${baseComponents.map(c => c.name).join(', ')}`, colors.dim);
        process.exit(1);
      }

      // Handle custom event name if provided
      if (options.customEventName) {
        const customEventValidation = validateCustomEventName(options.customEventName);
        if (customEventValidation !== true) {
          logError(`Invalid custom event name: ${customEventValidation}`);
          process.exit(1);
        }
        customEventName = options.customEventName.trim()
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-_]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '');
      } else {
        customEventName = '';
      }

      // Handle property changes if provided
      propertyChanges = [];
      if (options.propertyChanges) {
        try {
          propertyChanges = parsePropertyChanges(options.propertyChanges);
        } catch (error) {
          logError(`Invalid property changes: ${error.message}`);
          process.exit(1);
        }
      }

      log(`${emojis.gear} Using CLI arguments:`, colors.cyan);
      log(`   Component name: ${colorize(componentName, colors.green)}`, colors.white);
      log(`   Base component: ${colorize(baseComponent.name, colors.green)}`, colors.white);
      if (customEventName) {
        log(`   Custom event name: ${colorize(customEventName, colors.green)}`, colors.white);
      }
      if (propertyChanges.length > 0) {
        log(`   Property changes: ${colorize(propertyChanges.join(', '), colors.green)}`, colors.white);
      }
      console.log(''); // Add spacing

    } else {
      // Interactive mode - prompt for inputs
      // Prompt for component name
      const componentNameResponse = await enquirer.prompt({
        type: 'input',
        name: 'componentName',
        message: `${emojis.gear} What's the name of your custom component?`,
        hint: 'lowercase, no spaces (e.g., icon-radio)',
        validate: validateComponentName,
        format: (value) => {
          // Auto-convert input to proper format
          return value.trim()
            .toLowerCase()
            .replace(/\s+/g, '-')      // Replace spaces with hyphens
            .replace(/[^a-z0-9-_]/g, '') // Remove invalid characters (allow underscores)
        },
      });

      componentName = componentNameResponse.componentName;
      console.log(''); // Add spacing

      // Prompt for base component
      const baseComponentResponse = await enquirer.prompt({
        type: 'select',
        name: 'baseComponent',
        message: `${emojis.magic} Which base component should this extend?`,
        hint: 'Use arrow keys to navigate through the list, Enter to select',
        limit: 8,
        choices: baseComponents.map((comp) => ({
          name: `${comp.name}`,
          value: comp,
        })),
        result() {
          return this.focused.value;
        },
      });

      baseComponent = baseComponentResponse.baseComponent;
      console.log(''); // Add spacing

      // Prompt for property changes
      const propertyChangesResponse = await enquirer.prompt({
        type: 'multiselect',
        name: 'propertyChanges',
        message: `${emojis.gear} Which field property changes should your component monitor for view updates?`,
        hint: 'Use arrow keys to navigate, space to select/deselect, Enter to confirm',
        limit: 10,
        choices: getPropertyChoices(),
        validate: (value) => {
          // Allow empty selection
          return true;
        },
      });

      propertyChanges = propertyChangesResponse.propertyChanges || [];
      console.log(''); // Add spacing

      // Prompt for custom event name
      const customEventNameResponse = await enquirer.prompt({
        type: 'input',
        name: 'customEventName',
        message: `${emojis.sparkles} Enter the name of the custom event if any dispatched from Rule Editor?`,
        hint: 'This is optional - skip by pressing Enter',
        validate: (value) => {
          if (!value || value.trim() === '') {
            return true; // Allow empty values
          }
          return validateCustomEventName(value);
        },
        format: (value) => {
          if (!value || value.trim() === '') {
            return '';
          }
          // Auto-convert input to proper format
          return value.trim()
            .toLowerCase()
            .replace(/\s+/g, '-')      // Replace spaces with hyphens
            .replace(/[^a-z0-9-_]/g, '') // Remove invalid characters (allow underscores)
            .replace(/-+/g, '-')       // Replace multiple hyphens with single hyphen
            .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
        },
      });

      customEventName = customEventNameResponse.customEventName;
      console.log(''); // Add spacing

      // Show summary and confirm
      log(`${emojis.sparkles} Summary:`, colors.cyan + colors.bright);
      log(`   Custom Component name: ${colorize(componentName, colors.green)}`, colors.white);
      log(`   Base component: ${colorize(baseComponent.name, colors.green)}`, colors.white);
      if (customEventName) {
        log(`   Custom event name: ${colorize(customEventName, colors.green)}`, colors.white);
      }
      if (propertyChanges.length > 0) {
        log(`   Property changes: ${colorize(propertyChanges.join(', '), colors.green)}`, colors.white);
      }

      const { confirm } = await enquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: `${emojis.check} Create this custom component?`,
        initial: true,
      });

      if (!confirm) {
        logWarning('Operation cancelled');
        return;
      }
    }

    // Create component files with spinner
    const creationSpinner = createSpinner('Creating component structure...');

    // Create directory structure
    const targetDir = path.join(__dirname, '../blocks/form/components', componentName);

    if (checkComponentExists(componentName)) {
      creationSpinner.stop('❌ Component creation failed');
      logError(`Component '${componentName}' already exists!`);
      process.exit(1);
    }

    mkdirSync(targetDir, { recursive: true });

    // Create files
    const files = createComponentFiles(componentName, baseComponent, targetDir, customEventName, propertyChanges);
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

    // Success message
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
    log(`2. Add styles to ${files.css}`, colors.white);
    log(`3. Configure component properties in ${files.json}`, colors.white);

    log(`\n${emojis.celebration} Enjoy customizing your component!`, colors.green + colors.bright);
  } catch (error) {
    console.log(''); // Add spacing
    if (error.name === 'ExitPrompt') {
      logWarning('Operation cancelled by user');
      process.exit(0);
    } else {
      logError(`Unexpected error: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run the scaffolding tool
scaffoldComponent().catch((error) => {
  logError(`\nUnexpected error: ${error.message}`);
  process.exit(1);
});
