import { subscribe } from '../../rules/index.js';

const ALL = 'All';

function parseCards(data) {
  let cards = data;
  if (typeof cards === 'string') {
    try {
      cards = JSON.parse(cards);
    } catch (e) {
      cards = [];
    }
  }
  return Array.isArray(cards) ? cards.filter((c) => c && typeof c === 'object') : [];
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function sameCard(a, b) {
  return !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
}

function parseValue(value) {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (e) {
    return null;
  }
}

function buildCard(card, onSelect) {
  const item = el('li', 'card-choice-card');
  item.setAttribute('role', 'listitem');
  if (card.title) item.append(el('h3', 'card-choice-title', card.title));
  if (card.subtitle) item.append(el('p', 'card-choice-card-subtitle', card.subtitle));
  if (card.image) {
    const img = el('img', 'card-choice-image');
    img.src = card.image;
    img.alt = card.imageAlt || card.title || '';
    img.loading = 'lazy';
    item.append(img);
  }
  if (Array.isArray(card.features) && card.features.length) {
    const list = el('ul', 'card-choice-features');
    card.features.forEach((f) => {
      const feature = typeof f === 'object' ? f : { text: f };
      const li = el('li');
      if (feature.icon) {
        const icon = el('img', 'card-choice-feature-icon');
        icon.src = feature.icon;
        icon.alt = '';
        li.append(icon);
      } else {
        li.append(el('span', 'card-choice-feature-icon placeholder'));
      }
      li.append(el('span', 'card-choice-feature-text', feature.text));
      list.append(li);
    });
    item.append(list);
  }
  if (card.link || card.linkText) {
    const a = el('a', 'card-choice-link', card.linkText || 'All Features & Benefits');
    a.href = card.link || '#';
    if (card.link) a.target = '_blank';
    if (card.link) a.rel = 'noopener noreferrer';
    item.append(a);
  }
  if (card.amount !== undefined || card.amountLabel) {
    const box = el('div', 'card-choice-amount');
    box.append(el('span', 'card-choice-amount-label', card.amountLabel || ''));
    box.append(el('span', 'card-choice-amount-value', card.amount));
    item.append(box);
  }
  const button = el('button', 'card-choice-select', card.buttonText || 'Get This Card');
  button.type = 'button';
  button.addEventListener('click', () => onSelect(card));
  item.append(button);
  return item;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  if (input) input.style.display = 'none';
  const subtitle = fieldJson?.properties?.subtitle;

  let model = null;
  let cards = parseCards(fieldJson?.properties?.cards);
  let selected = parseValue(fieldJson?.value);
  let category = ALL;
  let interactive = fieldJson?.enabled !== false && fieldJson?.readOnly !== true;

  const widget = el('div', 'card-choice-widget');
  if (subtitle) widget.append(el('p', 'card-choice-subtitle', subtitle));
  const tabs = el('div', 'card-choice-tabs');
  tabs.setAttribute('role', 'tablist');
  const viewport = el('div', 'card-choice-viewport');
  const track = el('ul', 'card-choice-track');
  track.setAttribute('role', 'list');
  track.tabIndex = 0;
  const prev = el('button', 'card-choice-nav prev');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous cards');
  const next = el('button', 'card-choice-nav next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next cards');
  const dots = el('div', 'card-choice-dots');
  viewport.append(track, prev, next);
  widget.append(tabs, viewport, dots);
  const anchor = fieldDiv.querySelector('.field-description');
  if (anchor) anchor.before(widget);
  else fieldDiv.append(widget);

  const pageWidth = () => track.clientWidth || 1;
  const pageCount = () => Math.max(1, Math.ceil(track.scrollWidth / pageWidth() - 0.05));

  const updateNav = () => {
    const max = track.scrollWidth - track.clientWidth;
    prev.hidden = track.scrollLeft <= 1;
    next.hidden = track.scrollLeft >= max - 1;
    const pages = pageCount();
    const ratio = max <= 0 ? 0 : track.scrollLeft / max;
    const current = Math.min(pages - 1, Math.round(ratio * (pages - 1)));
    [...dots.children].forEach((d, i) => d.classList.toggle('active', i === current));
  };

  const renderDots = () => {
    dots.replaceChildren();
    const pages = pageCount();
    if (pages < 2) return;
    for (let i = 0; i < pages; i += 1) {
      const dot = el('button', 'card-choice-dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to page ${i + 1}`);
      dot.addEventListener('click', () => {
        const max = track.scrollWidth - track.clientWidth;
        track.scrollTo({ left: (max * i) / (pages - 1), behavior: 'smooth' });
      });
      dots.append(dot);
    }
  };

  const scrollByPage = (dir) => track.scrollBy({ left: dir * pageWidth(), behavior: 'smooth' });
  prev.addEventListener('click', () => scrollByPage(-1));
  next.addEventListener('click', () => scrollByPage(1));
  track.addEventListener('scroll', updateNav, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') scrollByPage(1);
    if (e.key === 'ArrowLeft') scrollByPage(-1);
  });

  const markSelection = () => {
    track.querySelectorAll('.card-choice-card').forEach((li) => {
      const card = li.cardData;
      const isSel = sameCard(card, selected);
      li.classList.toggle('selected', isSel);
      li.setAttribute('aria-current', isSel ? 'true' : 'false');
      const btn = li.querySelector('.card-choice-select');
      btn.disabled = !interactive;
      btn.setAttribute('aria-pressed', isSel ? 'true' : 'false');
      btn.textContent = isSel ? 'Selected' : (card.buttonText || 'Get This Card');
    });
  };

  const select = (card) => {
    if (!interactive) return;
    selected = card;
    markSelection();
    if (model) model.value = JSON.stringify(card);
  };

  const renderCards = () => {
    track.replaceChildren();
    cards
      .filter((c) => category === ALL || c.category === category)
      .forEach((card) => {
        const li = buildCard(card, select);
        li.cardData = card;
        track.append(li);
      });
    track.scrollLeft = 0;
    markSelection();
    renderDots();
    updateNav();
  };

  const renderTabs = () => {
    tabs.replaceChildren();
    const categories = [...new Set(cards.map((c) => c.category).filter(Boolean))];
    tabs.hidden = categories.length < 2;
    if (category !== ALL && !categories.includes(category)) category = ALL;
    if (categories.length > 1 && category === ALL) [category] = categories;
    categories.forEach((name) => {
      const tab = el('button', 'card-choice-tab', name);
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(name === category));
      tab.classList.toggle('active', name === category);
      tab.addEventListener('click', () => {
        category = name;
        renderTabs();
        renderCards();
      });
      tabs.append(tab);
    });
  };

  const setCards = (data) => {
    cards = parseCards(data);
    renderTabs();
    renderCards();
  };

  setCards(cards);
  window.addEventListener('resize', () => {
    renderDots();
    updateNav();
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      if (model.properties?.cards) setCards(model.properties.cards);
      selected = parseValue(model.value) || selected;
      markSelection();
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        const { propertyName } = change;
        if (propertyName === 'properties' || propertyName === 'properties.cards') {
          const data = propertyName === 'properties' ? change.currentValue?.cards : change.currentValue;
          if (JSON.stringify(data) !== JSON.stringify(cards)) setCards(data);
        } else if (propertyName === 'value') {
          selected = parseValue(change.currentValue);
          markSelection();
        } else if (propertyName === 'enabled' || propertyName === 'readOnly') {
          interactive = model.enabled !== false && !model.readOnly;
          markSelection();
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
