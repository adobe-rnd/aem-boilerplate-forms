export function handleAccordionNavigation(panel, tab) {
  const accordionTabs = panel?.querySelectorAll(':scope > fieldset');
  accordionTabs.forEach((otherTab) => {
    if (otherTab !== tab) {
      otherTab.classList.add('accordion-collapse');
    }
  });
  tab.classList.toggle('accordion-collapse');
  
  // Track the active panel state
  if (window.activeAccordionPanel === undefined) {
    window.activeAccordionPanel = null;
  }
  
  if (!tab.classList.contains('accordion-collapse')) {
    window.activeAccordionPanel = tab.dataset.id;
  } else if (window.activeAccordionPanel === tab.dataset.id) {
    window.activeAccordionPanel = null;
  }
}

export default function decorate(panel) {
  panel.classList.add('accordion');
  const accordionTabs = panel?.querySelectorAll(':scope > fieldset');
  accordionTabs?.forEach((tab, index) => {
    tab.dataset.index = index;
    const legend = tab.querySelector(':scope > legend');
    legend?.classList.add('accordion-legend');
    if (index !== 0) tab.classList.toggle('accordion-collapse'); // collapse all but the first tab on load
    legend?.addEventListener('click', () => {
      handleAccordionNavigation(panel, tab);
    });
  });
  return panel;
}
