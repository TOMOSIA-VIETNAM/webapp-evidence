// Tells Chrome this page is not to be translated.
//
// Chrome decides, after a page loads, whether its language is one the browser is not set to, and
// if so raises an offer to translate — a bubble in the toolbar, hanging over the page. It is not
// part of the application, it is not something a step script can dismiss, and a window capture
// records it. It turned up in a real take.
//
// Two things that do NOT stop it, both measured rather than assumed: `--disable-features=Translate`,
// with the switch confirmed on Chrome's own command line and the bubble still on screen; and
// setting the context's locale to the page's own language.
//
// This is the documented way to say it from the page: a meta tag Chrome reads when it makes that
// decision, plus the attribute form for good measure. Neither affects layout, appearance or
// behaviour — nothing the evidence is about changes, and the browser keeps its offer to itself.
(() => {
  if (window.top !== window.self) return;

  const mark = () => {
    document.documentElement.setAttribute('translate', 'no');
    if (document.querySelector('meta[name="google"][content~="notranslate"]')) return;
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'google');
    meta.setAttribute('content', 'notranslate');
    (document.head || document.documentElement).prepend(meta);
  };

  // The init script runs before the page has built its tree, so <head> may not exist yet, and
  // Chrome makes its decision after the load — being early is what matters, not being last.
  if (document.head) {
    mark();
    return;
  }
  document.addEventListener('readystatechange', function once() {
    if (!document.head) return;
    document.removeEventListener('readystatechange', once);
    mark();
  });
})();
