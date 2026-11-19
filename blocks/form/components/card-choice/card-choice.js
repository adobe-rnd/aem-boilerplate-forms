import { subscribe } from '../../rules/index.js';

const ALL = 'All';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function safeUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url, window.location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? url : null;
  } catch (e) {
    return null;
  }
}

function toCards(data) {
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

function parseSelected(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function cardKey(card, index) {
  return card.id !== undefined && card.id !== null ? String(card.id) : `${card.title}-${index}`;
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const props = fieldJson?.properties || {};
  const input = fieldDiv.querySelector('input, textarea');
  if (input) input.style.display = 'none';

  const root = el('div', 'card-choice');
  const tabs = el('div', 'card-choice-tabs');
  tabs.setAttribute('role', 'tablist');
  const viewport = el('div', 'card-choice-viewport');
  const track = el('ul', 'card-choice-track');
  track.setAttribute('role', 'listbox');
  const prev = el('button', 'card-choice-nav card-choice-prev');
  const next = el('button', 'card-choice-nav card-choice-next');
  [[prev, 'Previous cards', '‹'], [next, 'Next cards', '›']].forEach(([btn, label, glyph]) => {
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    btn.textContent = glyph;
  });
  const dots = el('div', 'card-choice-dots');
  viewport.append(track);
  root.append(tabs, viewport, prev, next, dots);
  const description = fieldDiv.querySelector('.field-description');
  if (description) fieldDiv.insertBefore(root, description);
  else fieldDiv.append(root);

  let model = null;
  let allCards = [];
  let category = ALL;
  let selectedKey = null;

  const keyedCards = () => allCards.map((card, i) => ({ card, key: cardKey(card, i) }));

  const updateNav = () => {
    const max = viewport.scrollWidth - viewport.clientWidth;
    prev.hidden = viewport.scrollLeft <= 1;
    next.hidden = viewport.scrollLeft >= max - 1;
    const pages = max > 1 ? Math.ceil(viewport.scrollWidth / viewport.clientWidth) : 1;
    const page = max > 1 ? Math.round((viewport.scrollLeft / max) * (pages - 1)) : 0;
    dots.hidden = pages <= 1;
    dots.replaceChildren(...Array.from({ length: pages }, (_, i) => {
      const dot = el('button', `card-choice-dot${i === page ? ' active' : ''}`);
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to page ${i + 1}`);
      dot.addEventListener('click', () => {
        viewport.scrollTo({ left: pages > 1 ? (max * i) / (pages - 1) : 0, behavior: 'smooth' });
      });
      return dot;
    }));
  };

  const applySelection = () => {
    track.querySelectorAll('.card-choice-card').forEach((li) => {
      const selected = li.dataset.key === selectedKey;
      li.classList.toggle('selected', selected);
      li.setAttribute('aria-selected', String(selected));
      const btn = li.querySelector('.card-choice-select');
      const card = allCards.find((c, i) => cardKey(c, i) === li.dataset.key);
      btn.textContent = selected
        ? (props.selectedButtonText || 'Selected')
        : (card?.buttonText || props.buttonText || 'Get This Card');
    });
  };

  const commit = (card, key) => {
    if (key === selectedKey) return;
    selectedKey = key;
    applySelection();
    const value = JSON.stringify(card);
    if (model) {
      if (model.value !== value) model.value = value;
    } else if (input) {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const buildCard = ({ card, key }) => {
    const li = el('li', 'card-choice-card');
    li.dataset.key = key;
    li.setAttribute('role', 'option');
    li.append(el('h3', 'card-choice-title', card.title));
    if (card.subtitle) li.append(el('p', 'card-choice-subtitle', card.subtitle));
    if (card.image) {
      const img = el('img', 'card-choice-image');
      img.src = safeUrl(card.image) || '';
      img.alt = card.imageAlt || card.title || '';
      img.loading = 'lazy';
      li.append(img);
    }
    if (Array.isArray(card.features) && card.features.length) {
      const list = el('ul', 'card-choice-features');
      card.features.forEach((f) => {
        list.append(el('li', 'card-choice-feature', typeof f === 'object' ? f?.text : f));
      });
      li.append(list);
    }
    if (card.linkText) {
      const href = safeUrl(card.linkUrl);
      const link = el(href ? 'a' : 'span', 'card-choice-link', card.linkText);
      if (href) {
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      li.append(link);
    }
    if (card.amount !== undefined && card.amount !== null && card.amount !== '') {
      const amount = el('div', 'card-choice-amount');
      amount.append(
        el('span', 'card-choice-amount-label', card.amountLabel || props.amountLabel || 'Min. FD Amount'),
        el('span', 'card-choice-amount-value', card.amount),
      );
      li.append(amount);
    }
    const btn = el('button', 'card-choice-select');
    btn.type = 'button';
    if (fieldJson?.enabled === false || fieldJson?.readOnly) btn.disabled = true;
    btn.addEventListener('click', () => commit(card, key));
    li.append(btn);
    return li;
  };

  const renderTabs = () => {
    const categories = [...new Set(allCards.map((c) => c.category).filter(Boolean))];
    tabs.hidden = categories.length < 2;
    if (categories.length < 2) category = ALL;
    else if (!categories.includes(category)) [category] = categories;
    tabs.replaceChildren(...(categories.length < 2 ? [] : categories).map((cat) => {
      const tab = el('button', 'card-choice-tab', cat);
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      const active = cat === category;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.addEventListener('click', () => {
        category = cat;
        // eslint-disable-next-line no-use-before-define
        render();
      });
      return tab;
    }));
  };

  function render() {
    renderTabs();
    const visible = keyedCards()
      .filter(({ card }) => category === ALL || card.category === category);
    track.replaceChildren(...visible.map(buildCard));
    viewport.scrollLeft = 0;
    root.classList.toggle('empty', visible.length === 0);
    applySelection();
    updateNav();
  }

  const setCards = (data) => {
    const cards = toCards(data);
    if (JSON.stringify(cards) === JSON.stringify(allCards)) return;
    allCards = cards;
    const selected = parseSelected(model?.value ?? input?.value);
    selectedKey = null;
    if (selected) {
      const match = keyedCards().find(({ card, key }) => (selected.id !== undefined
        ? key === cardKey(selected, 0) : JSON.stringify(card) === JSON.stringify(selected)));
      selectedKey = match ? match.key : null;
    }
    render();
  };

  const syncValue = (value) => {
    const selected = parseSelected(value);
    let key = null;
    if (selected) {
      const match = keyedCards().find(({ card, key: k }) => (selected.id !== undefined
        ? k === cardKey(selected, 0) : JSON.stringify(card) === JSON.stringify(selected)));
      key = match ? match.key : null;
    }
    if (key !== selectedKey) {
      selectedKey = key;
      applySelection();
    }
  };

  const scrollByPage = (dir) => viewport.scrollBy({ left: dir * viewport.clientWidth * 0.9, behavior: 'smooth' });
  prev.addEventListener('click', () => scrollByPage(-1));
  next.addEventListener('click', () => scrollByPage(1));
  viewport.addEventListener('scroll', () => window.requestAnimationFrame(updateNav), { passive: true });
  window.addEventListener('resize', updateNav);

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      setCards(fieldModel.properties?.cards);
      syncValue(fieldModel.value);
      fieldModel.subscribe((evt) => {
        setCards(evt?.payload?.cards ?? evt?.payload);
      }, 'setCards');
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'properties') {
          if (change.currentValue && 'cards' in change.currentValue) {
            setCards(change.currentValue.cards);
          }
        } else if (change?.propertyName === 'value') {
          syncValue(change.currentValue);
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
