import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
} from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import enquirer from 'enquirer';

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
  console.log(colorize(`${emojis.check} ${text}`, colors.green));
}

function logError(text) {
  console.log(colorize(`${emojis.error} ${text}`, colors.red));
}

function logWarning(text) {
  console.log(colorize(`${emojis.warning} ${text}`, colors.yellow));
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

// Read customComponents array from mappings.js
function readCustomComponents() {
  const mappingsPath = path.join(__dirname, '../blocks/form/mappings.js');

  try {
    const mappingsContent = readFileSync(mappingsPath, 'utf-8');
    const customComponentsRegex = /let customComponents = \[([^\]]*)\];/;
    const match = mappingsContent.match(customComponentsRegex);

    if (match) {
      return match[1]
        .split(',')
        .map((comp) => comp.trim().replace(/['"]/g, ''))
        .filter((comp) => comp.length > 0);
    }
    return [];
  } catch (error) {
    return [];
  }
}

// Component name validation
function validateComponentName(name) {
  if (!name || typeof name !== 'string') {
    return 'Component name is required';
  }

  if (name !== name.toLowerCase()) {
    return 'Component name must be lowercase';
  }

  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    return 'Component name must start with a letter and can only contain lowercase letters, numbers, and hyphens';
  }

  if (name.startsWith('-') || name.endsWith('-')) {
    return 'Component name cannot start or end with a hyphen';
  }

  if (name.includes('__') || name.includes('_')) {
    return 'Component name cannot contain underscores';
  }

  // Check if component already exists
  const existingComponents = readCustomComponents();
  if (existingComponents.includes(name)) {
    return `Component '${name}' already exists. Please choose a different name.`;
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
export default async function decorate(fieldDiv, fieldJson) {
  console.log('${emojis.gear} Decorating ${componentName} component:', fieldDiv, fieldJson);
  
  // TODO: Implement your custom component logic here
  // You can access the field properties via fieldJson.properties
  
  return fieldDiv;
}
`;

  // Create CSS file (empty)
  const cssContent = `/* ${componentName.charAt(0).toUpperCase() + componentName.slice(1)} component styles */

.${componentName} {
  /* Add your custom styles here */
}
`;

  // Create JSON file based on base component
  let jsonContent;
  try {
    const baseComponentPath = path.join(__dirname, '../blocks/form/models/form-components', baseComponent.filename);
    const baseJson = JSON.parse(readFileSync(baseComponentPath, 'utf-8'));

    // Function to transform relative paths for custom components
    const transformPaths = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(transformPaths);
      }
      if (obj && typeof obj === 'object') {
        const transformed = {};
        for (const [key, value] of Object.entries(obj)) {
          if (key === '...' && typeof value === 'string') {
            // Transform relative paths from base components to custom components
            // From: ../form-common/file.json (base component path)
            // To: ../../models/form-common/file.json (custom component path)
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
        title: componentName.charAt(0).toUpperCase() + componentName.slice(1),
        id: componentName,
        plugins: {
          ...def.plugins,
          xwalk: {
            ...def.plugins.xwalk,
            page: {
              ...def.plugins.xwalk.page,
              template: {
                ...def.plugins.xwalk.page.template,
                'jcr:title': componentName.charAt(0).toUpperCase() + componentName.slice(1),
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

// Update mappings.js to include the new custom component
function updateMappingsFile(componentName) {
  const mappingsPath = path.join(__dirname, '../blocks/form/mappings.js');

  try {
    // Read the current mappings.js file
    const mappingsContent = readFileSync(mappingsPath, 'utf-8');

    // Find the customComponents array and add the new component
    const customComponentsRegex = /let customComponents = \[([^\]]*)\];/;
    const match = mappingsContent.match(customComponentsRegex);

    if (match) {
      // Get existing components using the reusable function
      const existingComponents = readCustomComponents();

      // Add the new component to the array
      existingComponents.push(componentName);

      // Create the new array string
      const newArrayContent = existingComponents.map((comp) => `'${comp}'`).join(', ');
      const newLine = `let customComponents = [${newArrayContent}];`;

      // Replace the line in the file content
      const updatedContent = mappingsContent.replace(customComponentsRegex, newLine);

      // Write the updated content back to the file
      writeFileSync(mappingsPath, updatedContent);

      logSuccess(`Updated mappings.js to include '${componentName}' in customComponents array`);
    } else {
      logWarning('Could not find customComponents array in mappings.js');
    }
  } catch (error) {
    logWarning(`Could not update mappings.js: ${error.message}`);
  }
}

// Main scaffolding function
async function scaffoldComponent() {
  console.clear();

  // Welcome message
  logTitle('AEM Forms Custom Component Scaffolding Tool');
  log(`${emojis.magic}  This tool will help you set up all the necessary files to create a new custom component.\n`, colors.green);
  log(`${emojis.rocket} Let's create a new custom component!`, colors.cyan);

  const baseComponents = getBaseComponents();

  try {
    // Prompt for component name
    const { componentName } = await enquirer.prompt({
      type: 'input',
      name: 'componentName',
      message: `${emojis.gear} What's the name of your custom component?`,
      hint: 'lowercase, no spaces (e.g., cancel-button, icon-checkbox)',
      validate: validateComponentName,
      format: (value) => value.trim(),
    });

    console.log(''); // Add spacing

    // Prompt for base component
    const { baseComponent } = await enquirer.prompt({
      type: 'select',
      name: 'baseComponent',
      message: `${emojis.magic} Which base component should this extend?`,
      hint: 'Use arrow keys to navigate through the list, Enter to select',
      limit: 8,
      choices: baseComponents.map((comp) => ({
        name: `${comp.name} - ${comp.name.toLowerCase()} based component`,
        value: comp,
      })),
      result() {
        return this.focused.value;
      },
    });

    console.log(''); // Add spacing

    // Show summary and confirm
    log(`${emojis.sparkles} Summary:`, colors.cyan + colors.bright);
    log(`   Custom Component name: ${colorize(componentName, colors.green)}`, colors.white);
    log(`   Base component: ${colorize(baseComponent.name, colors.green)}`, colors.white);

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

    // Show loading
    process.stdout.write(colorize(`\n${emojis.gear} Creating component structure...`, colors.yellow));

    // Create directory structure
    const targetDir = path.join(__dirname, '../blocks/form/custom-components', componentName);

    if (existsSync(targetDir)) {
      logError(`\nComponent '${componentName}' already exists!`);
      process.exit(1);
    }

    mkdirSync(targetDir, { recursive: true });

    // Create files
    const files = createComponentFiles(componentName, baseComponent, targetDir);

    // Clear loading message
    process.stdout.write(`\r${' '.repeat(50)}\r`);

    // Update mappings.js to include the new custom component
    log(`${emojis.gear} Updating mappings.js...`, colors.dim);
    updateMappingsFile(componentName);

    // Success message
    logSuccess(`Successfully created custom component '${componentName}'!`);
    log(`\n${emojis.folder} File structure created:`, colors.cyan);
    log('blocks/form/', colors.dim);
    log('└── custom-components/', colors.dim);
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

// Run the scaffolding tool
scaffoldComponent().catch((error) => {
  logError(`\nUnexpected error: ${error.message}`);
  process.exit(1);
});
