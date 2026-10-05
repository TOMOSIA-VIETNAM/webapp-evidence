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
// decision. It affects no layout, appearance or behaviour. Not the `translate` attribute on <html>:
// React hydrates <html> against the server's HTML, and an attribute that was not sent fails it.
// The runner loads this only for a window or screen take; a page take cannot show the offer.
(() => {
  if (window.top !== window.self) return;

  const mark = () => {
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
