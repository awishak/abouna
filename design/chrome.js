// The bar across the top of every mockup: which option this is, the other two,
// and Home / Screenings. It is not part of the design; it goes away when a
// direction is picked. The hash picks the page (#home, #screenings) or a
// section inside a page (#story, #crew, #request); a section scrolls to itself.
(function () {
  const here = document.body.dataset.option;
  const names = { a: 'A · Cathedral', b: 'B · Playbill', c: 'C · Marquee' };
  const bar = document.createElement('div');
  bar.id = 'mockbar';
  bar.innerHTML = '<a class="mb-index" href="/design/">Options</a>' +
    ['a', 'b', 'c'].map((k) => '<a class="mb-opt' + (k === here ? ' on' : '') + '" href="/design/' + k + '.html#home">' + names[k] + '</a>').join('') +
    '<span class="mb-gap"></span>' +
    '<a class="mb-page" data-page="home" href="#home">Home</a><a class="mb-page" data-page="screenings" href="#screenings">Screenings</a>';
  document.body.prepend(bar);
  const views = Array.from(document.querySelectorAll('[data-view]'));
  function pageFor(hash) {
    const id = hash.replace(/^#/, '');
    if (id === 'screenings' || id === 'home' || !id) return id || 'home';
    const el = document.getElementById(id);
    const view = el && el.closest('[data-view]');
    return view ? view.dataset.view : 'home';
  }
  let current = null;
  function show() {
    const id = location.hash.replace(/^#/, '');
    const page = pageFor(location.hash);
    if (page !== current) {
      views.forEach((v) => { v.hidden = v.dataset.view !== page; });
      bar.querySelectorAll('.mb-page').forEach((a) => a.classList.toggle('on', a.dataset.page === page));
      bar.querySelectorAll('.mb-opt').forEach((a) => { a.href = a.href.split('#')[0] + '#' + page; });
      current = page;
      if (page === 'screenings' && window.drawMap) window.drawMap();
      document.querySelectorAll('video').forEach((v) => { if (!v.closest('[hidden]')) v.play().catch(() => {}); });
    }
    const target = id && id !== 'home' && id !== 'screenings' ? document.getElementById(id) : null;
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 8;
      window.scrollTo({ top, behavior: 'smooth' });
    } else window.scrollTo({ top: 0, behavior: 'instant' });
  }
  window.addEventListener('hashchange', show);
  show();
})();
