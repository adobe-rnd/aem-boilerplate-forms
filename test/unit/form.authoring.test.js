/* eslint-env mocha */
import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { annotateFormForEditing, getItems, getFieldById } from '../../scripts/form-editor-support.js';
import { generateFormRendition } from '../../blocks/form/form.js';
import { ueFormDef } from './forms/universaleditorform.js';

describe('Universal Editor Authoring Test Cases', () => {
  it('test form annotation for UE', async () => {
    document.documentElement.classList.add('adobe-ue-edit');
    const formEl = document.createElement('form');

    await generateFormRendition(ueFormDef, formEl, getItems);

    annotateFormForEditing(formEl, ueFormDef);

    assert.equal(formEl.classList.contains('edit-mode'), true, 'form is not having edit-mode class');

    const formFieldMap = {};

    function testAnnotation(node, fd, auetype, auemodel) {
      assert.equal(node.dataset.aueType, auetype, `data-aue-type not set ${fd.id}`);
      assert.equal(node.dataset.aueResource, `urn:aemconnection:${fd.properties['fd:path']}`, `data-aue-resource not set ${fd.id}`);
      assert.equal(node.dataset.aueModel, auemodel, `data-aue-model not set ${fd.id}`);
      assert.equal(node.dataset.aueLabel, fd.label.value, `data-aue-label not set ${fd.id}`);
      if (auetype === 'container') {
        assert.equal(node.dataset.aueFilter, 'form');
      }
    }

    function testPlainTextAnnotation(node, fd, auetype, auemodel) {
      assert.equal(node.dataset.aueType, auetype, `data-aue-type not set ${fd.id}`);
      assert.equal(node.dataset.aueResource, `urn:aemconnection:${fd.properties['fd:path']}`, `data-aue-resource not set ${fd.id}`);
      assert.equal(node.dataset.aueModel, auemodel, `data-aue-model not set ${fd.id}`);
      assert.equal(node.dataset.aueLabel, 'Text');
      assert.equal(node.dataset.aueProp, 'value');
      assert.equal(node.dataset.aueBehavior, 'component');
    }

    function testChildren(items, formDef, fieldMap) {
      items.forEach((node) => {
        if (node.classList.contains('field-wrapper')) {
          const fd = getFieldById(ueFormDef, node.dataset.id, formFieldMap);
          if (node.classList.contains('panel-wrapper') && !fd.properties['fd:fragment']) {
            if (fd[':type'] === 'wizard') {
              testAnnotation(node, fd, 'container', fd[':type']);
            } else {
              testAnnotation(node, fd, 'container', fd.fieldType);
            }
            testChildren(node.childNodes, formDef, fieldMap);
          } else if (fd.properties['fd:fragment'] && node.classList.contains('edit-mode')) {
            testAnnotation(node, fd, 'component', 'form-fragment');
            const textNodeCount = Array.from(node.childNodes)
              .filter((child) => child.nodeType === 3).length;
            assert.equal(textNodeCount, Object.keys(fd[':items']).length, `fragment items not set ${textNodeCount} ${fd.id}`);
          } else if (fd.fieldType === 'plain-text') {
            testPlainTextAnnotation(node, fd, 'richtext', fd.fieldType);
          } else if (fd[':type'] === 'rating') {
            testAnnotation(node, fd, 'component', fd[':type']);
          } else if (!fd.properties['fd:fragment']) {
            testAnnotation(node, fd, 'component', fd.fieldType);
          }
        }
      });
    }
    testChildren(formEl.childNodes, ueFormDef, formFieldMap);
  });

  it('test form component definitions for UE', async () => {
    const definitionFilePath = path.resolve('component-definition.json');
    const modelsFilePath = path.resolve('component-models.json');
    const filtersFilePath = path.resolve('component-filters.json');
    const componentDefinitions = fs.readFileSync(definitionFilePath, 'utf8');
    const componentModels = fs.readFileSync(modelsFilePath, 'utf8');
    const filters = fs.readFileSync(filtersFilePath, 'utf8');
    try {
      const definition = JSON.parse(componentDefinitions);
      const componentModelsArray = JSON.parse(componentModels);
      const filtersArray = JSON.parse(filters);
      const { components: formComponents } = filtersArray.find((filter) => filter.id === 'form');
      const idsArray = componentModelsArray.map((component) => component.id);
      if (definition) {
        definition?.groups.forEach((group) => {
          if (group.id === 'form-general') {
            group.components.forEach((component) => {
              const cmpId = component.id;
              if (!formComponents.includes(cmpId)) {
                throw new Error(`component not present in filter ${component.id}`);
              }
              const { fieldType } = component.plugins.xwalk.page.template;
              let cmpIdfromFieldType = fieldType;
              if (fieldType === 'image' || fieldType === 'button') {
                cmpIdfromFieldType = `form-${fieldType}`;
              } else if (cmpId === 'form-fragment') {
                cmpIdfromFieldType = 'form-fragment';
              }
              if (!idsArray.includes(cmpIdfromFieldType)) {
                throw new Error(`component model not found for component ${component.id}`);
              }
            });
          }
        });
      }
    } catch (err) {
      assert.equal(true, false, err);
    }
  });
});
