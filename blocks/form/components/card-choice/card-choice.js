import { subscribe } from '../../rules/index.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function parseCards(raw) {
  let cards = raw;
  if (typeof cards === 'string') {
    try {
      cards = JSON.parse(cards);
    } catch (e) {
      cards = [];
    }
  }
  return Array.isArray(cards) ? cards.filter((c) => c && typeof c === 'object') : [];
}

function safeUrl(url) {
  try {
    const u = new URL(url, window.location.href);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
  } catch (e) {
    return null;
  }
}

function cardKey(card, index) {
  return String(card.id ?? card.title ?? index);
}

function renderCard(card, index, selectedKey, onSelect) {
  const key = cardKey(card, index);
  const article = el('article', 'card-choice-card');
  article.dataset.cardKey = key;
  if (key === selectedKey) article.classList.add('selected');

  article.append(el('h3', 'card-choice-title', card.title));
  if (card.subtitle) article.append(el('p', 'card-choice-subtitle', card.subtitle));

  const imgSrc = safeUrl(card.image);
  if (imgSrc) {
    const img = el('img', 'card-choice-image');
    img.src = imgSrc;
    img.alt = card.imageAlt || card.title || '';
    img.loading = 'lazy';
    article.append(img);
  }

  if (Array.isArray(card.features) && card.features.length) {
    const ul = el('ul', 'card-choice-features');
    card.features.forEach((f) => {
      const text = typeof f === 'object' ? f.text : f;
      const li = el('li', 'card-choice-feature');
      const iconSrc = typeof f === 'object' ? safeUrl(f.icon) : null;
      if (iconSrc) {
        const icon = el('img', 'card-choice-feature-icon');
        icon.src = iconSrc;
        icon.alt = '';
        li.append(icon);
      } else {
        li.append(el('span', 'card-choice-feature-bullet'));
      }
      li.append(el('span', 'card-choice-feature-text', text));
      ul.append(li);
    });
    article.append(ul);
  }

  if (card.linkText) {
    const href = safeUrl(card.linkUrl);
    const link = el(href ? 'a' : 'span', 'card-choice-link', card.linkText);
    if (href) {
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    article.append(link);
  }

  if (card.minAmount !== undefined && card.minAmount !== null && card.minAmount !== '') {
    const row = el('div', 'card-choice-amount');
    row.append(
      el('span', 'card-choice-amount-label', card.minAmountLabel || 'Min. FD Amount'),
      el('span', 'card-choice-amount-value', card.minAmount),
    );
    article.append(row);
  }

  const button = el('button', 'card-choice-select', card.buttonText || 'Get This Card');
  button.type = 'button';
  button.setAttribute('aria-pressed', key === selectedKey ? 'true' : 'false');
  button.addEventListener('click', () => onSelect(card, key));
  article.append(button);
  return article;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input, textarea');
  if (input) input.style.display = 'none';

  const label = fieldDiv.querySelector('label');
  const description = fieldDiv.querySelector('.field-description');

  const root = el('div', 'card-choice');
  const categoriesBar = el('div', 'card-choice-categories');
  categoriesBar.setAttribute('role', 'tablist');
  const viewport = el('div', 'card-choice-viewport');
  viewport.tabIndex = 0;
  viewport.setAttribute('role', 'listbox');
  const track = el('div', 'card-choice-track');
  viewport.append(track);
  const next = el('button', 'card-choice-next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next cards');
  const prev = el('button', 'card-choice-prev');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous cards');
  const dots = el('div', 'card-choice-dots');
  root.append(categoriesBar, viewport, prev, next, dots);
  fieldDiv.append(root);
  if (description) fieldDiv.append(description);

  let model = null;
  let cards = [];
  let category = null;
  let selectedKey = null;

  const isDisabled = () => model?.enabled === false || model?.readOnly === true
    || fieldJson?.enabled === false || fieldJson?.readOnly === true;

  const pageWidth = () => viewport.clientWidth || 1;
  const maxScroll = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth);

  const updateNav = () => {
    const max = maxScroll();
    const pages = max > 0 ? Math.ceil(viewport.scrollWidth / pageWidth()) : 1;
    const ratio = max > 0 ? viewport.scrollLeft / max : 0;
    const page = Math.min(pages - 1, Math.round(ratio * (pages - 1)));
    dots.replaceChildren();
    if (pages > 1) {
      for (let i = 0; i < pages; i += 1) {
        const dot = el('button', 'card-choice-dot');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Go to page ${i + 1}`);
        if (i === page) dot.classList.add('active');
        dot.addEventListener('click', () => {
          viewport.scrollTo({ left: (max * i) / (pages - 1), behavior: 'smooth' });
        });
        dots.append(dot);
      }
    }
    prev.hidden = viewport.scrollLeft <= 1;
    next.hidden = viewport.scrollLeft >= max - 1;
  };

  const scrollByPage = (dir) => {
    viewport.scrollBy({ left: dir * pageWidth() * 0.9, behavior: 'smooth' });
  };
  next.addEventListener('click', () => scrollByPage(1));
  prev.addEventListener('click', () => scrollByPage(-1));
  viewport.addEventListener('scroll', () => updateNav(), { passive: true });
  viewport.addEventListener('keydown', (e) => {
    if (e.target !== viewport) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollByPage(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); scrollByPage(-1); }
  });
  window.addEventListener('resize', updateNav);

  const commit = (card, key) => {
    if (isDisabled()) return;
    selectedKey = key;
    const value = JSON.stringify(card);
    if (input && input.value !== value) {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // eslint-disable-next-line no-use-before-define
    markSelection();
  };

  function markSelection() {
    track.querySelectorAll('.card-choice-card').forEach((c) => {
      const on = c.dataset.cardKey === selectedKey;
      c.classList.toggle('selected', on);
      c.querySelector('.card-choice-select').setAttribute('aria-pressed', String(on));
    });
  }

  const renderCategories = () => {
    const names = [...new Set(cards.map((c) => c.category).filter(Boolean))];
    categoriesBar.replaceChildren();
    categoriesBar.hidden = names.length < 2;
    if (!names.includes(category)) [category] = names.length ? names : [null];
    names.forEach((name) => {
      const chip = el('button', 'card-choice-category', name);
      chip.type = 'button';
      chip.setAttribute('role', 'tab');
      chip.setAttribute('aria-selected', String(name === category));
      if (name === category) chip.classList.add('active');
      chip.addEventListener('click', () => {
        category = name;
        // eslint-disable-next-line no-use-before-define
        renderCards();
      });
      categoriesBar.append(chip);
    });
  };

  function renderCards() {
    renderCategories();
    const visible = cards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !category || card.category === category);
    track.replaceChildren(...visible.map(({ card, index }) => renderCard(
      card,
      index,
      selectedKey,
      commit,
    )));
    viewport.scrollLeft = 0;
    updateNav();
  }

  // value holds the selected card as JSON; reflect it in the view
  const syncSelection = (value) => {
    let key = null;
    if (value) {
      try {
        const sel = JSON.parse(value);
        const idx = cards.findIndex((c) => (sel.id !== undefined
          ? c.id === sel.id : c.title === sel.title));
        if (idx >= 0) key = cardKey(cards[idx], idx);
      } catch (e) {
        key = null;
      }
    }
    selectedKey = key;
    markSelection();
  };

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      cards = parseCards(fieldModel.properties?.cards);
      renderCards();
      syncSelection(fieldModel.value);
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change.propertyName === 'properties.cards' || change.propertyName === 'properties') {
          cards = parseCards(model.properties?.cards ?? change.currentValue?.cards);
          renderCards();
          syncSelection(model.value);
        } else if (change.propertyName === 'value') {
          syncSelection(change.currentValue);
        } else if (change.propertyName === 'enabled' || change.propertyName === 'readOnly') {
          root.classList.toggle('disabled', isDisabled());
        }
      });
    }
  }, { listenChanges: true });

  if (label) fieldDiv.prepend(label);
  return fieldDiv;
}
