#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read directories and return component names
function getComponentsFromDirectory(dirPath) {
  try {
    return readdirSync(dirPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort();
  } catch (error) {
    return [];
  }
}

// Validate component names for illegal characters
function validateComponentNames(components, type) {
  const invalidComponents = components.filter(name => {
    // Check for spaces or illegal file characters
    // Allow only letters, numbers, hyphens, and underscores
    return !/^[a-zA-Z0-9_-]+$/.test(name);
  });
  
  if (invalidComponents.length > 0) {
    console.error('🚨 INVALID COMPONENT NAMES DETECTED!');
    console.error(`❌ ${type} components contain illegal characters:`);
    invalidComponents.forEach(name => {
      console.error(`   • "${name}" - contains spaces or invalid characters`);
    });
    console.error('\n💡 Component names must only contain:');
    console.error('   - Letters (a-z, A-Z)');
    console.error('   - Numbers (0-9)'); 
    console.error('   - Hyphens (-)');
    console.error('   - Underscores (_)');
    console.error('\n🔧 Please rename the component directories and try again.');
    return false;
  }
  
  return true;
}

// Update mappings.js with current component directories
function updateMappings() {
  const mappingsPath = path.join(__dirname, '../blocks/form/mappings.js');
  
  try {
    // Read current mappings.js
    const mappingsContent = readFileSync(mappingsPath, 'utf-8');
    
    // Get current components from directories
    const customComponentsPath = path.join(__dirname, '../blocks/form/custom-components');
    const ootbComponentsPath = path.join(__dirname, '../blocks/form/components');
    
    const customComponents = getComponentsFromDirectory(customComponentsPath);
    const ootbComponents = getComponentsFromDirectory(ootbComponentsPath);
    
    // Validate component names before processing
    if (!validateComponentNames(customComponents, 'Custom')) {
      return false;
    }
    
    if (!validateComponentNames(ootbComponents, 'OOTB')) {
      return false;
    }
    
    // Create new arrays
    const customArrayString = customComponents.map(comp => `'${comp}'`).join(', ');
    const ootbArrayString = ootbComponents.map(comp => `'${comp}'`).join(', ');
    
    // Replace the arrays in mappings.js
    let updatedContent = mappingsContent
      .replace(
        /let customComponents = \[([^\]]*)\];/,
        `let customComponents = [${customArrayString}];`
      )
      .replace(
        /const OOTBComponentDecorators = \[([^\]]*)\];/,
        `const OOTBComponentDecorators = [${ootbArrayString}];`
      );
    
    // Write back to file
    writeFileSync(mappingsPath, updatedContent);
    
    console.log('✅ Updated mappings.js:');
    console.log(`   Custom components (${customComponents.length}): [${customArrayString}]`);
    console.log(`   OOTB components (${ootbComponents.length}): [${ootbArrayString}]`);
    
    return true;
  } catch (error) {
    console.error('❌ Error updating mappings.js:', error.message);
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateMappings();
}

export { updateMappings }; 