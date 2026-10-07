// Loads pdf-lib, then the app. Tries your own copy first (vendor/pdf-lib.min.js),
// and falls back to a pinned cdnjs URL so the site works with no setup.
(() => {
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
  // Optional: paste the SRI hash for this exact file (e.g. "sha512-...") from cdnjs.com
  // so the browser rejects the script if the CDN copy ever differs.
  const CDN_SRI = '';

  const load = (src, opts = {}) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    Object.assign(s, opts);
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });

  load('vendor/pdf-lib.min.js')
    .then(() => { if (!window.PDFLib) throw new Error('empty'); window.PDF_SRC = 'local'; })
    .catch(() => {
      const opts = { crossOrigin: 'anonymous', referrerPolicy: 'no-referrer' };
      if (CDN_SRI) opts.integrity = CDN_SRI;
      return load(CDN, opts).then(() => { window.PDF_SRC = 'cdn'; });
    })
    .catch(() => {})
    .then(() => load('app.js'));
})();
