/* eslint-env mocha */
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  parseArgs, cleanComponentName, resolveBaseComponent,
  getBaseComponents, validateComponentName,
} from '../../tools/forms-scaffolder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test Repository Structure Dependencies
 * These tests ensure the scaffolder's dependencies on repo structure are intact
 * If someone alters/removes/changes the structure, tests will fail to alert devs
 */
describe('Forms Scaffolder - Repository Structure', () => {
  describe('Required Directories', () => {
    it('should have blocks/form/models/form-components directory', () => {
      const modelsDir = path.join(__dirname, '../../blocks/form/models/form-components');
      expect(fs.existsSync(modelsDir)).to.be.true;
      expect(fs.lstatSync(modelsDir).isDirectory()).to.be.true;
    });

    it('should have blocks/form/components directory', () => {
      const componentsDir = path.join(__dirname, '../../blocks/form/components');
      expect(fs.existsSync(componentsDir)).to.be.true;
      expect(fs.lstatSync(componentsDir).isDirectory()).to.be.true;
    });

    it('should have blocks/form/mappings.js file', () => {
      const mappingsFile = path.join(__dirname, '../../blocks/form/mappings.js');
      expect(fs.existsSync(mappingsFile)).to.be.true;
      expect(fs.lstatSync(mappingsFile).isFile()).to.be.true;
    });

    it('should have blocks/form/_form.json file', () => {
      const formJsonFile = path.join(__dirname, '../../blocks/form/_form.json');
      expect(fs.existsSync(formJsonFile)).to.be.true;
      expect(fs.lstatSync(formJsonFile).isFile()).to.be.true;
    });

    it('should have tools/update-mappings.js file', () => {
      const updateMappingsFile = path.join(__dirname, '../../tools/update-mappings.js');
      expect(fs.existsSync(updateMappingsFile)).to.be.true;
      expect(fs.lstatSync(updateMappingsFile).isFile()).to.be.true;
    });

    it('should have tools/forms-scaffolder.js file', () => {
      const scaffolderFile = path.join(__dirname, '../../tools/forms-scaffolder.js');
      expect(fs.existsSync(scaffolderFile)).to.be.true;
      expect(fs.lstatSync(scaffolderFile).isFile()).to.be.true;
    });

    it('should have models/_component-definition.json file', () => {
      const componentDefFile = path.join(__dirname, '../../models/_component-definition.json');
      expect(fs.existsSync(componentDefFile)).to.be.true;
      expect(fs.lstatSync(componentDefFile).isFile()).to.be.true;
    });
  });

  describe('Base Components Structure', () => {
    const expectedBaseComponents = [
      '_button.json',
      '_checkbox.json',
      '_checkbox-group.json',
      '_date-input.json',
      '_drop-down.json',
      '_email.json',
      '_number-input.json',
      '_panel.json',
      '_radio-group.json',
      '_reset-button.json',
      '_submit-button.json',
      '_telephone-input.json',
      '_text.json',
      '_text-input.json',
    ];

    expectedBaseComponents.forEach((componentFile) => {
      it(`should have base component ${componentFile}`, () => {
        const componentPath = path.join(__dirname, '../../blocks/form/models/form-components', componentFile);
        expect(fs.existsSync(componentPath)).to.be.true;
      });
    });
  });

  describe('_form.json Structure', () => {
    let formJson;

    before(() => {
      const formJsonPath = path.join(__dirname, '../../blocks/form/_form.json');
      const content = fs.readFileSync(formJsonPath, 'utf-8');
      formJson = JSON.parse(content);
    });

    it('should have filters array with form filter', () => {
      expect(formJson.filters).to.be.an('array');
      expect(formJson.filters.length).to.be.greaterThan(0);
      
      const formFilter = formJson.filters.find(f => f.id === 'form');
      expect(formFilter).to.exist;
      expect(formFilter.components).to.be.an('array');
      expect(formFilter.components.length).to.be.greaterThan(0);
    });
  });

  describe('_component-definition.json Structure', () => {
    let componentDef;

    before(() => {
      const componentDefPath = path.join(__dirname, '../../models/_component-definition.json');
      const content = fs.readFileSync(componentDefPath, 'utf-8');
      componentDef = JSON.parse(content);
    });

    it('should have groups array with custom-components group', () => {
      expect(componentDef.groups).to.be.an('array');
      expect(componentDef.groups.length).to.be.greaterThan(0);

      const customGroup = componentDef.groups.find(g => g.id === 'custom-components');
      expect(customGroup).to.exist;
      expect(customGroup.title).to.equal('Custom Form Components');
      expect(customGroup.components).to.be.an('array');
    });
  });

  describe('CLI Argument Parsing (parseArgs)', () => {
    it('should parse --name argument', () => {
      const args = parseArgs(['node', 'script.js', '--name', 'my-component']);
      expect(args.name).to.equal('my-component');
    });

    it('should parse --base argument', () => {
      const args = parseArgs(['node', 'script.js', '--base', 'Text Input']);
      expect(args.base).to.equal('Text Input');
    });

    it('should parse both --name and --base together', () => {
      const args = parseArgs(['node', 'script.js', '--name', 'icon-radio', '--base', 'Radio Group']);
      expect(args.name).to.equal('icon-radio');
      expect(args.base).to.equal('Radio Group');
    });

    it('should parse --help flag', () => {
      expect(parseArgs(['node', 'script.js', '--help']).help).to.be.true;
    });

    it('should parse -h flag', () => {
      expect(parseArgs(['node', 'script.js', '-h']).help).to.be.true;
    });

    it('should return empty object when no arguments provided', () => {
      expect(parseArgs(['node', 'script.js'])).to.deep.equal({});
    });

    it('should ignore --name when no value follows', () => {
      expect(parseArgs(['node', 'script.js', '--name']).name).to.be.undefined;
    });

    it('should ignore --base when no value follows', () => {
      expect(parseArgs(['node', 'script.js', '--base']).base).to.be.undefined;
    });

    it('should handle arguments in any order', () => {
      const args = parseArgs(['node', 'script.js', '--base', 'Button', '--name', 'custom-btn']);
      expect(args.name).to.equal('custom-btn');
      expect(args.base).to.equal('Button');
    });
  });

  describe('CLI Component Name Cleaning (cleanComponentName)', () => {
    it('should convert spaces to hyphens', () => {
      expect(cleanComponentName('icon radio')).to.equal('icon-radio');
    });

    it('should convert to lowercase', () => {
      expect(cleanComponentName('MyComponent')).to.equal('mycomponent');
    });

    it('should remove invalid characters', () => {
      expect(cleanComponentName('my@comp!onent')).to.equal('mycomponent');
    });

    it('should collapse multiple hyphens', () => {
      expect(cleanComponentName('my--component')).to.equal('my-component');
    });

    it('should trim leading and trailing hyphens', () => {
      expect(cleanComponentName('-my-component-')).to.equal('my-component');
    });

    it('should trim whitespace', () => {
      expect(cleanComponentName('  my-component  ')).to.equal('my-component');
    });

    it('should allow underscores', () => {
      expect(cleanComponentName('my_component')).to.equal('my_component');
    });
  });

  describe('CLI Base Component Resolution (resolveBaseComponent)', () => {
    const baseComponents = getBaseComponents();

    it('should resolve by display name (case-insensitive)', () => {
      const result = resolveBaseComponent('Text Input', baseComponents);
      expect(result).to.exist;
      expect(result.name).to.equal('Text Input');
    });

    it('should resolve by display name in different case', () => {
      const result = resolveBaseComponent('text input', baseComponents);
      expect(result).to.exist;
      expect(result.name).to.equal('Text Input');
    });

    it('should resolve by kebab-case value', () => {
      const result = resolveBaseComponent('radio-group', baseComponents);
      expect(result).to.exist;
      expect(result.name).to.equal('Radio Group');
    });

    it('should return undefined for unknown component', () => {
      expect(resolveBaseComponent('nonexistent', baseComponents)).to.be.undefined;
    });

    it('should trim whitespace from input', () => {
      const result = resolveBaseComponent('  Button  ', baseComponents);
      expect(result).to.exist;
      expect(result.name).to.equal('Button');
    });

    it('should resolve all base components by name', () => {
      baseComponents.forEach((comp) => {
        const result = resolveBaseComponent(comp.name, baseComponents);
        expect(result, `Failed to resolve '${comp.name}'`).to.exist;
      });
    });

    it('should resolve all base components by kebab value', () => {
      baseComponents.forEach((comp) => {
        const result = resolveBaseComponent(comp.value, baseComponents);
        expect(result, `Failed to resolve '${comp.value}'`).to.exist;
      });
    });
  });

  describe('CLI Component Name Validation (validateComponentName)', () => {
    it('should return true for valid kebab-case name', () => {
      expect(validateComponentName('icon-radio')).to.equal(true);
    });

    it('should return true for simple lowercase name', () => {
      expect(validateComponentName('button')).to.equal(true);
    });

    it('should return error for empty string', () => {
      expect(validateComponentName('')).to.be.a('string');
    });

    it('should return error for null', () => {
      expect(validateComponentName(null)).to.be.a('string');
    });

    it('should return error for name starting with number after cleaning', () => {
      const result = validateComponentName('123abc');
      expect(result).to.be.a('string');
      expect(result).to.include('start with a letter');
    });

    it('should return error for name with only special characters', () => {
      const result = validateComponentName('!!!');
      expect(result).to.be.a('string');
      expect(result).to.include('at least one letter or number');
    });
  });

  describe('CLI Non-Interactive End-to-End', () => {
    const repoRoot = path.join(__dirname, '../..');
    const componentName = 'cli-e2e-test-component';
    const componentDir = path.join(repoRoot, 'blocks/form/components', componentName);

    afterEach(() => {
      if (fs.existsSync(componentDir)) {
        fs.rmSync(componentDir, { recursive: true });
      }
      try {
        execSync('git checkout -- models/_component-definition.json blocks/form/mappings.js blocks/form/_form.json', { cwd: repoRoot, stdio: 'pipe' });
      } catch { /* ignore */ }
    });

    it('should create component files with --name and --base', () => {
      execSync(`node tools/forms-scaffolder.js --name ${componentName} --base "Text Input"`, { cwd: repoRoot, stdio: 'pipe' });

      expect(fs.existsSync(path.join(componentDir, `${componentName}.js`))).to.be.true;
      expect(fs.existsSync(path.join(componentDir, `${componentName}.css`))).to.be.true;
      expect(fs.existsSync(path.join(componentDir, `_${componentName}.json`))).to.be.true;
    });

    it('should update _component-definition.json', () => {
      execSync(`node tools/forms-scaffolder.js --name ${componentName} --base "Button"`, { cwd: repoRoot, stdio: 'pipe' });

      const compDef = JSON.parse(fs.readFileSync(path.join(repoRoot, 'models/_component-definition.json'), 'utf-8'));
      const customGroup = compDef.groups.find((g) => g.id === 'custom-components');
      const entry = customGroup.components.find((c) => c['...'] && c['...'].includes(componentName));
      expect(entry).to.exist;
    });

    it('should update _form.json filters', () => {
      execSync(`node tools/forms-scaffolder.js --name ${componentName} --base "Checkbox"`, { cwd: repoRoot, stdio: 'pipe' });

      const formJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'blocks/form/_form.json'), 'utf-8'));
      const formFilter = formJson.filters.find((f) => f.id === 'form');
      expect(formFilter.components).to.include(componentName);
    });

    it('should fail with exit code 1 for invalid base component', () => {
      let threw = false;
      try {
        execSync(`node tools/forms-scaffolder.js --name ${componentName} --base "Nonexistent"`, { cwd: repoRoot, stdio: 'pipe' });
      } catch (error) {
        threw = true;
        expect(error.status).to.equal(1);
      }
      expect(threw).to.be.true;
    });

    it('should generate JSON with fd:viewType matching component name', () => {
      execSync(`node tools/forms-scaffolder.js --name ${componentName} --base "Text Input"`, { cwd: repoRoot, stdio: 'pipe' });

      const compJson = JSON.parse(fs.readFileSync(path.join(componentDir, `_${componentName}.json`), 'utf-8'));
      expect(compJson.definitions[0].id).to.equal(componentName);
      expect(compJson.definitions[0].plugins.xwalk.page.template['fd:viewType']).to.equal(componentName);
      expect(compJson.models[0].id).to.equal(componentName);
    });
  });
});
