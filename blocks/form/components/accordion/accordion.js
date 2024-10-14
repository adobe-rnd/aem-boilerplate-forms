export default function decorate(panel) {
  panel.classList.add('accordion-wrapper');
  const legend = panel?.querySelector('legend');
  legend?.classList.add('accordion-legend');
  legend?.addEventListener('click', () => {
    panel.classList.toggle('accordion-collapse');
  });
  return panel;
}
