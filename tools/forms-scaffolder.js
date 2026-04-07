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

// Parse CLI arguments (--name, --base)
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--name' && argv[i + 1]) {
      args.name = argv[++i];
    } else if (argv[i] === '--base' && argv[i + 1]) {
      args.base = argv[++i];
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      args.help = true;
    }
  }
  return args;
}

function printUsage() {
  log('\nUsage: node tools/forms-scaffolder.js [options]\n', colors.bright);
  log('Options:', colors.cyan);
  log('  --name <name>    Component name (kebab-case, e.g. icon-radio)', colors.white);
  log('  --base <base>    Base component to extend (e.g. "Text Input")', colors.white);
  log('  -h, --help       Show this help message\n', colors.white);
  log('When options are omitted, interactive prompts are used.', colors.dim);
  log('When both --name and --base are provided, runs non-interactively.\n', colors.dim);
  log('Available base components:', colors.cyan);
  getBaseComponents().forEach((comp) => {
    log(`  - ${comp.name}`, colors.white);
  });
  console.log('');
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

// Create component files
function createComponentFiles(componentName, baseComponent, targetDir) {
  const files = {
    js: `${componentName}.js`,
    css: `${componentName}.css`,
    json: `_${componentName}.json`,
  };

  // Create JS file
  const jsContent = `/**
 * Custom ${componentName} component
 * Based on: ${baseComponent.name}
 */

/**
 * Decorates a custom form field component
 * @param {HTMLElement} fieldDiv - The DOM element containing the field wrapper. Refer to the documentation for its structure for each component.
 * @param {Object} fieldJson - The form json object for the component.
 * @param {HTMLElement} parentElement - The parent element of the field.
 * @param {string} formId - The unique identifier of the form.
 */
export default async function decorate(fieldDiv, fieldJson, parentElement, formId) {
  console.log('${emojis.gear} Decorating ${componentName} component:', fieldDiv, fieldJson, parentElement, formId);
  
  // TODO: Implement your custom component logic here
  // You can access the field properties via fieldJson.properties
  
  return fieldDiv;
}
`;

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

// Resolve component name from CLI arg, applying same formatting as interactive prompt
function cleanComponentName(raw) {
  return raw.trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Resolve base component from a CLI string (case-insensitive, matches name or kebab value)
function resolveBaseComponent(baseArg, baseComponents) {
  const normalized = baseArg.trim().toLowerCase();
  return baseComponents.find(
    (comp) => comp.name.toLowerCase() === normalized || comp.value === normalized,
  );
}

// Main scaffolding function
async function scaffoldComponent() {
  const cliArgs = parseArgs(process.argv);

  if (cliArgs.help) {
    printUsage();
    return;
  }

  const nonInteractive = cliArgs.name && cliArgs.base;

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

  try {
    // Resolve component name from CLI arg or prompt
    let componentName;
    if (cliArgs.name) {
      componentName = cleanComponentName(cliArgs.name);
      const validation = validateComponentName(componentName);
      if (validation !== true) {
        logError(validation);
        process.exit(1);
      }
      log(`\n${emojis.gear} Component name: ${colorize(componentName, colors.green)}`, colors.white);
    } else {
      ({ componentName } = await enquirer.prompt({
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
      }));
    }

    console.log(''); // Add spacing

    // Resolve base component from CLI arg or prompt
    let baseComponent;
    if (cliArgs.base) {
      baseComponent = resolveBaseComponent(cliArgs.base, baseComponents);
      if (!baseComponent) {
        logError(`Unknown base component '${cliArgs.base}'. Run with --help to see available base components.`);
        process.exit(1);
      }
      log(`${emojis.magic} Base component: ${colorize(baseComponent.name, colors.green)}`, colors.white);
    } else {
      ({ baseComponent } = await enquirer.prompt({
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
      }));
    }

    console.log(''); // Add spacing

    // Show summary and confirm (skip confirmation in non-interactive mode)
    log(`${emojis.sparkles} Summary:`, colors.cyan + colors.bright);
    log(`   Custom Component name: ${colorize(componentName, colors.green)}`, colors.white);
    log(`   Base component: ${colorize(baseComponent.name, colors.green)}`, colors.white);

    if (!nonInteractive) {
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
    const files = createComponentFiles(componentName, baseComponent, targetDir);
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
    logWarning('Operation cancelled by user');
    process.exit(0);
  }
}

// Export functions for testing
export {
  parseArgs, cleanComponentName, resolveBaseComponent,
  getBaseComponents, validateComponentName,
};

// Run the scaffolding tool when executed directly
const isDirectRun = process.argv[1]
  && (process.argv[1].endsWith('forms-scaffolder.js')
    || process.argv[1].endsWith('forms-scaffolder'));

if (isDirectRun) {
  scaffoldComponent().catch((error) => {
    logError(`\nUnexpected error: ${error.message}`);
    process.exit(1);
  });
}
