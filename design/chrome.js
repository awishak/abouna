// The bar across the top of every mockup: which option this is, the other two,
// and Home / Screenings. It is not part of the design; it goes away when a
// direction is picked. The hash picks the page: #home or #screenings.
(function () {
  const here = document.body.dataset.option;
  const names = { a: 'A · Cathedral', b: 'B · Playbill', c: 'C · Marquee' };
  const bar = document.createElement('div');
  bar.id = 'mockbar';
  bar.innerHTML = '<a class="mb-index" href="/design/">Options</a>' +
    ['a', 'b', 'c'].map((k) => '<a class="mb-opt' + (k === here ? ' on' : '') + '" href="/design/' + k + '.html' + location.hash + '">' + names[k] + '</a>').join('') +
    '<span class="mb-gap"></span>' +
    '<a class="mb-page" data-page="home" href="#home">Home</a><a class="mb-page" data-page="screenings" href="#screenings">Screenings</a>';
  document.body.prepend(bar);
  function show() {
    const page = location.hash === '#screenings' ? 'screenings' : 'home';
    document.querySelectorAll('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== page; });
    bar.querySelectorAll('.mb-page').forEach((a) => a.classList.toggle('on', a.dataset.page === page));
    bar.querySelectorAll('.mb-opt').forEach((a) => { a.href = a.href.split('#')[0] + '#' + page; });
    window.scrollTo(0, 0);
    if (page === 'screenings' && window.drawMap) window.drawMap();
    document.querySelectorAll('video').forEach((v) => { if (!v.closest('[hidden]')) v.play().catch(() => {}); });
  }
  window.addEventListener('hashchange', show);
  show();
})();
