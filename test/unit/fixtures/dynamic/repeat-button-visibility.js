import assert from 'assert';

// Comprehensive test for repeat button visibility covering all scenarios
export const sample = {
  total: 6,
  offset: 0,
  limit: 6,
  data: [{
    Name: 'item', Type: 'fieldset', Description: '', Placeholder: '', Label: 'Test Item', 'Read Only': '', Mandatory: '', Pattern: '', Step: '', Min: '1', Max: '3', Value: '', Options: '', OptionNames: '', Fieldset: '', Repeatable: 'true',
  }, {
    Name: 'name', Type: 'text', Description: '', Placeholder: '', Label: 'Name', 'Read Only': '', Mandatory: '', Pattern: '', Step: '', Min: '', Max: '', Value: '', Options: '', OptionNames: '', Fieldset: 'item', Repeatable: '',
  }],
  ':type': 'sheet',
};

export function op(block) {
  const addBtn = block.querySelector('.repeat-wrapper > .repeat-actions > .item-add');
  
  // Test complete cycle: min -> add -> add to max -> remove -> remove to min
  // 1. Add first instance (1 -> 2)
  addBtn.click();
  
  // 2. Add second instance to reach max (2 -> 3)  
  addBtn.click();
  
  // 3. Remove one instance (3 -> 2)
  const firstRemoveBtn = block.querySelector('.item-remove');
  firstRemoveBtn.click();
  
  // 4. Remove another to reach min (2 -> 1)
  const secondRemoveBtn = block.querySelector('.item-remove');
  secondRemoveBtn.click();
}

export function expect(block) {
  // Final state: should be back to 1 instance (min)
  const instances = block.querySelectorAll('.repeat-wrapper > fieldset[data-repeatable="true"]');
  assert.equal(instances.length, 1, 'Should have 1 instance at end (min)');
  
  // Add button should be visible (below max)
  const addBtn = block.querySelector('.repeat-wrapper > .repeat-actions > .item-add');
  assert.notEqual(addBtn.style.display, 'none', 'Add button should be visible when below max');
  
  // Remove button should be hidden (at min)
  const removeButtons = block.querySelectorAll('.item-remove');
  removeButtons.forEach(btn => {
    assert.equal(btn.style.display, 'none', 'Remove buttons should be hidden when at min');
  });
  
  // Test adding back to max to verify max limit behavior
  addBtn.click(); // 1 -> 2
  addBtn.click(); // 2 -> 3 (max)
  
  // At max, add button should be hidden
  assert.equal(addBtn.style.display, 'none', 'Add button should be hidden when at max');
  
  // Remove buttons should be visible (above min)
  const newRemoveButtons = block.querySelectorAll('.item-remove');
  newRemoveButtons.forEach(btn => {
    assert.notEqual(btn.style.display, 'none', 'Remove buttons should be visible when above min');
  });
} 