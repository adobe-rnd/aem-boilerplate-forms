import { subscribe } from '../../rules/index.js';

const ALL = 'All';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function parseCards(raw) {
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
  return Array.isArray(data) ? data.filter((c) => c && typeof c === 'object') : [];
}

function safeUrl(url) {
  return typeof url === 'string' && /^(https?:\/\/|\/|#)/i.test(url) ? url : null;
}

function cardKey(card, index) {
  return String(card.id ?? card.name ?? index);
}

function parseSelection(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function buildCard(card, key, onSelect) {
  const item = el('li', 'card-choice-card');
  item.dataset.cardKey = key;
  item.append(el('h3', 'card-choice-card-title', card.name));
  if (card.tagline) item.append(el('p', 'card-choice-card-tagline', card.tagline));
  if (card.image) {
    const img = el('img', 'card-choice-card-image');
    img.src = card.image;
    img.alt = card.imageAlt || card.name || '';
    img.loading = 'lazy';
    item.append(img);
  }
  if (Array.isArray(card.features) && card.features.length) {
    const list = el('ul', 'card-choice-card-features');
    card.features.forEach((f) => list.append(el('li', '', typeof f === 'object' ? f?.text : f)));
    item.append(list);
  }
  if (card.linkText) {
    const href = safeUrl(card.linkUrl);
    const link = el(href ? 'a' : 'span', 'card-choice-card-link', card.linkText);
    if (href) link.href = href;
    item.append(link);
  }
  if (card.minAmount !== undefined && card.minAmount !== null) {
    const amount = el('div', 'card-choice-card-amount');
    amount.append(
      el('span', 'card-choice-card-amount-label', card.minAmountLabel || 'Min. FD Amount'),
      el('span', 'card-choice-card-amount-value', card.minAmount),
    );
    item.append(amount);
  }
  const button = el('button', 'card-choice-card-select', card.buttonLabel || 'Get This Card');
  button.type = 'button';
  button.addEventListener('click', onSelect);
  item.append(button);
  return item;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  if (input) input.hidden = true;

  const root = el('div', 'card-choice');
  const tabs = el('div', 'card-choice-tabs');
  tabs.setAttribute('role', 'tablist');
  const viewport = el('div', 'card-choice-viewport');
  const track = el('ul', 'card-choice-track');
  track.tabIndex = 0;
  const prev = el('button', 'card-choice-nav card-choice-prev', '‹');
  const next = el('button', 'card-choice-nav card-choice-next', '›');
  prev.type = 'button';
  next.type = 'button';
  prev.setAttribute('aria-label', 'Previous cards');
  next.setAttribute('aria-label', 'Next cards');
  const dots = el('div', 'card-choice-dots');
  viewport.append(prev, track, next);
  root.append(tabs, viewport, dots);
  const anchor = input || fieldDiv.querySelector('.field-description');
  if (anchor) anchor.after(root);
  else fieldDiv.append(root);

  let model = null;
  let cards = parseCards(fieldJson?.properties?.cards);
  let category = ALL;
  let selectedKey = null;

  const pageWidth = () => track.clientWidth || 1;

  const updateNav = () => {
    const max = track.scrollWidth - track.clientWidth;
    prev.hidden = track.scrollLeft <= 1;
    next.hidden = max <= 1 || track.scrollLeft >= max - 1;
    const pages = Math.max(1, Math.ceil(track.scrollWidth / pageWidth() - 0.05));
    const ratio = max <= 1 ? 0 : track.scrollLeft / max;
    const current = Math.min(pages - 1, Math.round(ratio * (pages - 1)));
    dots.hidden = pages <= 1;
    if (dots.children.length !== pages) {
      dots.replaceChildren(...Array.from({ length: pages }, (_, i) => {
        const dot = el('button', 'card-choice-dot');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Go to page ${i + 1}`);
        dot.addEventListener('click', () => track.scrollTo({ left: i * pageWidth(), behavior: 'smooth' }));
        return dot;
      }));
    }
    Array.from(dots.children).forEach((d, i) => d.classList.toggle('active', i === current));
  };

  const markSelected = () => {
    track.querySelectorAll('.card-choice-card').forEach((c) => {
      const on = c.dataset.cardKey === selectedKey;
      c.classList.toggle('selected', on);
      c.querySelector('.card-choice-card-select').setAttribute('aria-pressed', String(on));
    });
  };

  const select = (card, key) => {
    selectedKey = key;
    markSelected();
    const value = JSON.stringify(card);
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (model && model.value !== value) {
      model.value = value;
    }
  };

  const renderCards = () => {
    const visible = cards
      .map((card, i) => ({ card, key: cardKey(card, i) }))
      .filter(({ card }) => category === ALL || card.category === category);
    track.replaceChildren(...visible.map(({ card, key }) => (
      buildCard(card, key, () => select(card, key))
    )));
    markSelected();
    track.scrollLeft = 0;
    updateNav();
  };

  const renderTabs = () => {
    const categories = [...new Set(cards.map((c) => c.category).filter(Boolean))];
    if (category !== ALL && !categories.includes(category)) category = ALL;
    tabs.hidden = categories.length < 2;
    tabs.replaceChildren(...categories.map((name) => {
      const tab = el('button', 'card-choice-tab', name);
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      const active = name === category;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.addEventListener('click', () => {
        category = category === name ? ALL : name;
        renderTabs();
        renderCards();
      });
      return tab;
    }));
  };

  const syncSelection = (value) => {
    const picked = parseSelection(value);
    if (!picked) {
      selectedKey = null;
    } else {
      const index = cards.findIndex((c, i) => (picked.id !== undefined
        ? cardKey(c, i) === String(picked.id)
        : JSON.stringify(c) === JSON.stringify(picked)));
      selectedKey = index >= 0 ? cardKey(cards[index], index) : null;
    }
    markSelected();
  };

  const setCards = (raw) => {
    cards = parseCards(raw);
    renderTabs();
    renderCards();
    syncSelection(model?.value ?? input?.value);
  };

  prev.addEventListener('click', () => track.scrollBy({ left: -pageWidth(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: pageWidth(), behavior: 'smooth' }));
  track.addEventListener('scroll', updateNav, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') track.scrollBy({ left: pageWidth() / 2, behavior: 'smooth' });
    if (e.key === 'ArrowLeft') track.scrollBy({ left: -pageWidth() / 2, behavior: 'smooth' });
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateNav).observe(track);

  setCards(cards);

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      setCards(model.properties?.cards ?? cards);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'properties') {
          const incoming = change.currentValue?.cards;
          if (JSON.stringify(incoming) !== JSON.stringify(change.prevValue?.cards)) {
            setCards(incoming);
          }
        } else if (change?.propertyName === 'value') {
          syncSelection(change.currentValue);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
