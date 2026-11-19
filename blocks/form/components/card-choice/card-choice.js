import { subscribe } from '../../rules/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function chevron() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M9 5l7 7-7 7');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
}

function parseCards(raw) {
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      data = [];
    }
  }
  return Array.isArray(data) ? data.filter((c) => c && typeof c === 'object') : [];
}

function parseSelected(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

const cardKey = (card, index) => String(card.id ?? card.title ?? index);

function renderCard(card, index, selectLabel) {
  const item = el('li', 'card-choice-card');
  item.dataset.cardId = cardKey(card, index);
  item.appendChild(el('h3', 'card-choice-title', card.title));
  if (card.subtitle) item.appendChild(el('p', 'card-choice-card-subtitle', card.subtitle));
  if (card.image) {
    const img = el('img', 'card-choice-image');
    img.src = card.image;
    img.alt = card.imageAlt || card.title || '';
    img.loading = 'lazy';
    item.appendChild(img);
  }
  if (Array.isArray(card.features) && card.features.length) {
    const list = el('ul', 'card-choice-features');
    card.features.forEach((f) => {
      const feature = typeof f === 'string' ? { text: f } : f;
      const li = el('li');
      if (feature.icon) {
        const icon = el('img', 'card-choice-feature-icon');
        icon.src = feature.icon;
        icon.alt = '';
        li.appendChild(icon);
      } else {
        li.appendChild(el('span', 'card-choice-feature-icon card-choice-feature-bullet'));
      }
      li.appendChild(el('span', 'card-choice-feature-text', feature.text));
      list.appendChild(li);
    });
    item.appendChild(list);
  }
  if (card.linkText || card.linkUrl) {
    const link = el('a', 'card-choice-link', card.linkText || 'All Features & Benefits');
    link.href = card.linkUrl || '#';
    if (card.linkUrl) link.target = '_blank';
    link.rel = 'noopener';
    link.appendChild(chevron());
    item.appendChild(link);
  }
  if (card.minAmount !== undefined && card.minAmount !== null) {
    const amount = el('div', 'card-choice-amount');
    amount.appendChild(el('span', 'card-choice-amount-label', card.minAmountLabel || 'Min. FD Amount'));
    amount.appendChild(el('span', 'card-choice-amount-value', card.minAmount));
    item.appendChild(amount);
  }
  const button = el('button', 'card-choice-select', card.ctaLabel || selectLabel);
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  item.appendChild(button);
  return item;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  const selectLabel = fieldJson?.properties?.selectLabel || 'Get This Card';
  const subtitle = fieldJson?.properties?.subtitle;
  fieldDiv.classList.add('card-choice-wrapper');
  if (input) input.style.display = 'none';

  const widget = el('div', 'card-choice-widget');
  const header = el('div', 'card-choice-header');
  const tabs = el('div', 'card-choice-categories');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Card categories');
  header.appendChild(tabs);
  const viewport = el('div', 'card-choice-viewport');
  const track = el('ul', 'card-choice-track');
  track.tabIndex = 0;
  track.setAttribute('aria-label', fieldJson?.label?.value || 'Cards');
  const next = el('button', 'card-choice-next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next cards');
  next.appendChild(chevron());
  viewport.append(track, next);
  const dots = el('div', 'card-choice-dots');
  widget.append(header, viewport, dots);
  if (subtitle) widget.insertBefore(el('p', 'card-choice-subtitle', subtitle), viewport);
  const description = fieldDiv.querySelector('.field-description');
  fieldDiv.insertBefore(widget, description);

  let model = null;
  let cards = [];
  let category = null;
  let renderedKey = '';
  let committing = false;

  const visibleCards = () => cards.filter((c) => !category || c.category === category);

  const pageCount = () => {
    const w = track.clientWidth;
    return w ? Math.max(1, Math.ceil(track.scrollWidth / w - 0.01)) : 1;
  };

  const updateCarousel = () => {
    const pages = pageCount();
    const w = track.clientWidth || 1;
    const page = Math.min(pages - 1, Math.round(track.scrollLeft / w));
    dots.replaceChildren();
    if (pages > 1) {
      for (let i = 0; i < pages; i += 1) {
        const dot = el('button', `card-choice-dot${i === page ? ' active' : ''}`);
        dot.type = 'button';
        dot.setAttribute('aria-label', `Go to page ${i + 1}`);
        dot.addEventListener('click', () => track.scrollTo({ left: i * w, behavior: 'smooth' }));
        dots.appendChild(dot);
      }
    }
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    next.hidden = pages <= 1 || atEnd;
  };

  const applySelection = (value) => {
    const selected = parseSelected(value);
    const key = selected ? cardKey(selected, -1) : null;
    track.querySelectorAll('.card-choice-card').forEach((item) => {
      const on = key !== null && item.dataset.cardId === key;
      item.classList.toggle('selected', on);
      item.querySelector('.card-choice-select').setAttribute('aria-pressed', String(on));
    });
  };

  const select = (card) => {
    if (model?.enabled === false || model?.readOnly) return;
    const value = JSON.stringify(card);
    if (model && model.value !== value) {
      committing = true;
      model.value = value;
      committing = false;
    } else if (input && input.value !== value) {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    applySelection(value);
  };

  const renderTabs = () => {
    const categories = [...new Set(cards.map((c) => c.category).filter(Boolean))];
    tabs.replaceChildren();
    if (categories.length < 2) {
      category = null;
      return;
    }
    if (!categories.includes(category)) [category] = categories;
    categories.forEach((name) => {
      const tab = el('button', `card-choice-category${name === category ? ' active' : ''}`, name);
      tab.type = 'button';
      tab.setAttribute('aria-pressed', String(name === category));
      tab.addEventListener('click', () => {
        category = name;
        renderTabs();
        renderCards(true); // eslint-disable-line no-use-before-define
      });
      tabs.appendChild(tab);
    });
  };

  function renderCards(force) {
    const list = visibleCards();
    const key = JSON.stringify(list);
    if (!force && key === renderedKey) return;
    renderedKey = key;
    track.replaceChildren();
    list.forEach((card, i) => {
      const item = renderCard(card, i, selectLabel);
      item.querySelector('.card-choice-select').addEventListener('click', () => select(card));
      track.appendChild(item);
    });
    track.scrollLeft = 0;
    applySelection(model?.value ?? input?.value);
    updateCarousel();
  }

  const setCards = (raw) => {
    const parsed = parseCards(raw);
    if (JSON.stringify(parsed) === JSON.stringify(cards)) return;
    cards = parsed;
    renderTabs();
    renderCards(true);
  };

  next.addEventListener('click', () => {
    track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
  });
  track.addEventListener('scroll', () => window.requestAnimationFrame(updateCarousel), { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      track.scrollBy({ left: e.key === 'ArrowRight' ? 200 : -200, behavior: 'smooth' });
    }
  });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => updateCarousel()).observe(track);
  }

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      setCards(model.properties?.cards);
      applySelection(model.value);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        const { propertyName, currentValue } = change;
        if (propertyName === 'properties') {
          setCards(currentValue?.cards ?? model?.properties?.cards);
        } else if (propertyName === 'properties.cards') {
          setCards(currentValue);
        } else if (propertyName === 'value' && !committing) {
          applySelection(currentValue);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
