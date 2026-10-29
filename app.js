(() => {
  'use strict';
  const LS_KEY = 'menu_cart_v1';
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('ru-RU') + ' ₽';
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  let cart = {};          // "itemId|variantId" -> qty
  const index = {};       // key -> {item, variant}
  let confirmTimer = null;

  const loadCart = () => {
    try { cart = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { cart = {}; }
  };
  const saveCart = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cart)); } catch { /* хранилище недоступно */ }
  };

  const change = (key, d) => {
    const q = Math.max(0, Math.min(99, (cart[key] || 0) + d));
    if (q) cart[key] = q; else delete cart[key];
    saveCart();
    refresh();
  };

  const stepper = (key) => {
    const q = cart[key] || 0;
    if (!q) {
      const b = el('button', 'btn', 'Добавить');
      b.onclick = () => change(key, 1);
      return b;
    }
    const w = el('div', 'step');
    const m = el('button', null, '−'); m.setAttribute('aria-label', 'Меньше'); m.onclick = () => change(key, -1);
    const p = el('button', null, '+'); p.setAttribute('aria-label', 'Больше'); p.onclick = () => change(key, 1);
    w.append(m, el('b', null, String(q)), p);
    return w;
  };

  const totals = () => {
    let count = 0, sum = 0;
    for (const [k, q] of Object.entries(cart)) { count += q; sum += q * index[k].variant.price; }
    return { count, sum };
  };

  const refresh = () => {
    document.querySelectorAll('[data-key]').forEach((n) => n.replaceChildren(stepper(n.dataset.key)));
    const { count, sum } = totals();
    $('cartBtn').hidden = count === 0;
    $('cartCount').textContent = count;
    $('cartTotal').textContent = fmt(sum);
    $('sheetTotal').textContent = fmt(sum);
    renderCart();
    if (count === 0 && $('cart').open) $('cart').close();
  };

  const renderCart = () => {
    const list = $('cartList');
    list.replaceChildren();
    const keys = Object.keys(cart);
    if (!keys.length) { list.append(el('p', 'empty', 'Корзина пуста')); return; }
    for (const k of keys) {
      const { item, variant } = index[k];
      const line = el('div', 'line');
      const t = el('div', 't');
      t.append(el('span', null, item.name));
      t.append(el('small', null, [variant.label, fmt(variant.price)].filter(Boolean).join(' · ')));
      const s = el('div'); s.append(stepper(k));
      line.append(t, s, el('b', 'sum', fmt(cart[k] * variant.price)));
      list.append(line);
    }
  };

  // Очистка корзины: двухшаговое подтверждение, само откатывается через 5 секунд
  const resetConfirm = () => {
    clearTimeout(confirmTimer);
    $('confirmBox').hidden = true;
    $('clearBtn').hidden = false;
  };
  const askConfirm = () => {
    $('clearBtn').hidden = true;
    $('confirmBox').hidden = false;
    $('clearNo').focus();
    confirmTimer = setTimeout(resetConfirm, 5000);
  };

  const render = (data) => {
    document.title = `${data.name}`;
    $('name').textContent = data.name;
    const tel = (data.phone || '').replace(/[^\d+]/g, '');
    for (const id of ['phone', 'callLink']) { $(id).textContent = data.phone; $(id).href = 'tel:' + tel; }
    (data.hours || []).forEach((h) => $('hours').append(el('div', null, `${h.days}: ${h.time}`)));
    if (data.address) { $('address').textContent = data.address; $('addr-box').hidden = false; }
    $('legal').textContent = data.legal || '';

    // приоритет категорий: больше число — выше в списке; без priority = 0, порядок файла сохраняется
    const sorted = [...data.categories].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));

    const menu = $('menu'), cats = $('cats');
    menu.replaceChildren();
    for (const c of sorted) {
      const a = el('a', null, c.name); a.href = '#cat-' + c.id; cats.append(a);
      const sec = el('section'); sec.id = 'cat-' + c.id;
      sec.append(el('h2', null, c.name));
      const grid = el('div', 'grid');
      for (const it of c.items) {
        const card = el('article', 'card');
        if (it.photo) {
          card.classList.add('has-photo');
          const img = el('img'); img.src = it.photo; img.alt = it.name; img.loading = 'lazy';
          img.onerror = () => { img.remove(); card.classList.remove('has-photo'); };
          card.append(img);
        }
        const body = el('div', 'body');
        body.append(el('h3', null, it.name));
        if (it.description) body.append(el('p', 'desc', it.description));
        for (const v of it.variants) {
          const key = `${it.id}|${v.id}`;
          index[key] = { item: it, variant: v };
          const row = el('div', 'row');
          const info = el('div', 'vinfo');
          if (v.label) info.append(el('span', 'vlabel', v.label));
          info.append(el('span', 'price', fmt(v.price)));
          const ctl = el('div'); ctl.dataset.key = key;
          row.append(info, ctl);
          body.append(row);
        }
        card.append(body);
        grid.append(card);
      }
      sec.append(grid);
      menu.append(sec);
    }

    // убрать из корзины позиции, которых больше нет
    for (const k of Object.keys(cart)) if (!index[k]) delete cart[k];
    saveCart();
    refresh();

    // подсветка активной категории
    const links = [...cats.querySelectorAll('a')];
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) links.forEach((l) => l.classList.toggle('on', l.hash === '#' + e.target.id));
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    menu.querySelectorAll('section').forEach((s) => io.observe(s));
  };

  $('cartBtn').onclick = () => $('cart').showModal();
  $('cartClose').onclick = () => $('cart').close();
  $('cart').addEventListener('click', (e) => { if (e.target === $('cart')) $('cart').close(); });
  $('cart').addEventListener('close', resetConfirm);
  $('clearBtn').onclick = askConfirm;
  $('clearNo').onclick = resetConfirm;
  $('clearYes').onclick = () => { resetConfirm(); cart = {}; saveCart(); refresh(); };

  loadCart();
  fetch('menu.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render)
    .catch(() => { $('menu').replaceChildren(el('p', 'muted', 'Не удалось загрузить. Обновите страницу.')); });
})();
