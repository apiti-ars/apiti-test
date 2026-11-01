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
  const entries = [];     // для поиска: категории и блюда в порядке на странице
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

  /* ---------- Поиск (всё локально: ничего не отправляется и не сохраняется) ---------- */
  const nav = document.querySelector('.cats');
  const qIn = $('q');
  let results = [], cur = -1, timer = null, pushed = false;

  const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const hasWord = (text, t) => (' ' + text).includes(' ' + t);   // слово начинается с t

  // Блюдо: все слова запроса есть в «название + категория», и хотя бы одно — в самом названии.
  // Если есть блюда — показываем их; иначе — категории.
  const find = (text) => {
    const tokens = norm(text).split(' ').filter(Boolean);
    if (norm(text).length < 2) return [];
    const items = entries.filter((e) => e.kind === 'item'
      && tokens.every((t) => hasWord(e.own + ' ' + e.cat, t))
      && tokens.some((t) => hasWord(e.own, t)));
    if (items.length) return items;
    return entries.filter((e) => e.kind === 'cat' && tokens.every((t) => hasWord(e.own, t)));
  };

  const flash = (node, strong) => {
    node.classList.remove('hit', 'hit-cur');
    void node.offsetWidth;                       // перезапуск анимации
    node.classList.add(strong ? 'hit-cur' : 'hit');
  };

  const updateUI = () => {
    const has = qIn.value.trim() !== '';
    $('qClear').hidden = !has;
    $('sTools').hidden = !has;
    $('sCount').textContent = !has ? '' : results.length ? `${Math.max(cur, 0) + 1} из ${results.length}` : 'Не найдено';
    $('sPrev').disabled = $('sNext').disabled = results.length < 2;
  };

  const go = (i) => {
    if (!results.length) return;
    cur = (i + results.length) % results.length;
    results[cur].scroll.scrollIntoView({ block: 'start' });
    results.forEach((r, k) => flash(r.flash, k === cur));
    updateUI();
  };

  const run = () => {
    timer = null;
    results = find(qIn.value);
    cur = -1;
    if (results.length) go(0); else updateUI();
  };

  const resetSearch = () => {
    clearTimeout(timer); timer = null;
    qIn.value = ''; results = []; cur = -1;
    updateUI();
  };
  // Закрыть поиск; если мы добавляли запись в историю — убираем её, чтобы «Назад» не накапливался
  const closeSearch = () => {
    const had = pushed; pushed = false;
    resetSearch();
    if (had) history.back();
  };

  qIn.addEventListener('input', () => {
    if (qIn.value.trim() === '') { closeSearch(); return; }
    if (!pushed) { history.pushState({ search: true }, ''); pushed = true; }   // «Назад» закроет поиск, а не сайт
    updateUI();
    clearTimeout(timer);
    timer = setTimeout(run, 300);
  });
  qIn.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSearch(); qIn.blur(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (timer) { clearTimeout(timer); run(); }
    else if (cur < 0) go(0);
    else go(cur + (e.shiftKey ? -1 : 1));
    if (matchMedia('(pointer:coarse)').matches) qIn.blur();    // на телефоне убрать клавиатуру
  });
  $('qClear').onclick = () => { closeSearch(); qIn.focus(); };
  $('sNext').onclick = () => go(cur < 0 ? 0 : cur + 1);
  $('sPrev').onclick = () => go(cur < 0 ? 0 : cur - 1);
  window.addEventListener('popstate', () => {
    if (pushed) { pushed = false; resetSearch(); qIn.blur(); }
  });

  // высота панели нужна, чтобы найденное не пряталось под ней
  const setNavH = () => document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');
  new ResizeObserver(setNavH).observe(nav);
  setNavH();

  /* ---------- Меню ---------- */
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
    entries.length = 0;
    for (const c of sorted) {
      const sec = el('section'); sec.id = 'cat-' + c.id;
      const h2 = el('h2', null, c.name);
      sec.append(h2);
      entries.push({ kind: 'cat', scroll: h2, flash: h2, own: norm(c.name), cat: '' });

      const a = el('a', null, c.name); a.href = '#cat-' + c.id;
      a.addEventListener('click', (e) => { e.preventDefault(); h2.scrollIntoView({ block: 'start' }); });   // без записей в истории
      cats.append(a);

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
        const h3 = el('h3', null, it.name);
        body.append(h3);
        entries.push({ kind: 'item', scroll: card, flash: h3, own: norm(it.name), cat: norm(c.name) });
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
    setNavH();

    // подсветка активной категории
    const links = [...cats.querySelectorAll('a')];
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) links.forEach((l) => l.classList.toggle('on', l.hash === '#' + e.target.id));
      });
    }, { rootMargin: `-${nav.offsetHeight + 8}px 0px -70% 0px` });
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
