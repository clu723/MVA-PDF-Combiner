(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!window.PDFLib) { $('libError').hidden = false; return; }
  const { PDFDocument } = PDFLib;
  if (window.PDF_SRC === 'cdn') $('libNote').hidden = false;

  const files = []; // { id, name, size, bytes:Uint8Array, count, range, error }
  let nextId = 1, dragId = null, busy = false;
  const list = $('list'), drop = $('drop'), input = $('input'), statusEl = $('status');
  const combineBtn = $('combine'), clearBtn = $('clear');

  const setStatus = (msg, isErr) => { statusEl.textContent = msg; statusEl.className = isErr ? 'err' : ''; };
  const fmtSize = n => n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';

  // "1-3, 5, 8-" -> zero-based page indices. Blank = all pages. "5-3" runs backwards.
  function parseRange(text, total) {
    if (!text.trim()) return Array.from({ length: total }, (_, i) => i);
    const out = [];
    for (const raw of text.split(',')) {
      const p = raw.trim();
      if (!p) continue;
      let m, a, b;
      if ((m = /^(\d+)$/.exec(p))) { a = b = +m[1]; }
      else if ((m = /^(\d*)\s*-\s*(\d*)$/.exec(p)) && (m[1] || m[2])) { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : total; }
      else throw new Error(`"${p}" is not a valid page or range.`);
      if (a < 1 || b < 1 || a > total || b > total) throw new Error(`"${p}" is outside pages 1-${total}.`);
      const step = a <= b ? 1 : -1;
      for (let i = a; i !== b + step; i += step) out.push(i - 1);
    }
    if (!out.length) throw new Error('No pages selected.');
    return out;
  }

  const validate = f => {
    try { parseRange(f.range, f.count); f.error = ''; } catch (e) { f.error = e.message; }
  };

  async function addFiles(fileList) {
    setStatus('');
    for (const file of fileList) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const head = new TextDecoder().decode(bytes.subarray(0, 1024));
        if (!head.includes('%PDF-')) throw new Error('not a PDF file');
        const doc = await PDFDocument.load(bytes, { updateMetadata: false });
        files.push({ id: nextId++, name: file.name, size: file.size, bytes, count: doc.getPageCount(), range: '', error: '' });
      } catch (e) {
        const enc = /encrypt/i.test(e.message) ? 'it is password-protected; remove the password first' : e.message;
        setStatus(`Could not add "${file.name}": ${enc}.`, true);
      }
    }
    render();
  }

  function move(id, toIndex) {
    const from = files.findIndex(f => f.id === id);
    if (from < 0) return;
    const [f] = files.splice(from, 1);
    files.splice(Math.max(0, Math.min(files.length, toIndex)), 0, f);
    render();
  }

  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    Object.assign(n, props);
    n.append(...kids);
    return n;
  }

  function render() {
    list.replaceChildren();
    files.forEach((f, i) => {
      const li = el('li', { className: 'item', draggable: true });
      const err = el('span', { className: 'perr', textContent: f.error });
      const inp = el('input', { type: 'text', id: 'r' + f.id, value: f.range, placeholder: `all ${f.count} pages`, autocomplete: 'off', spellcheck: false });
      inp.setAttribute('aria-invalid', String(!!f.error));
      inp.addEventListener('input', () => {
        f.range = inp.value; validate(f);
        err.textContent = f.error; inp.setAttribute('aria-invalid', String(!!f.error));
        updateButtons();
      });
      const up = el('button', { type: 'button', className: 'icon', textContent: '↑', title: 'Move up', disabled: i === 0 });
      const dn = el('button', { type: 'button', className: 'icon', textContent: '↓', title: 'Move down', disabled: i === files.length - 1 });
      const rm = el('button', { type: 'button', className: 'icon', textContent: '✕', title: 'Remove' });
      up.setAttribute('aria-label', `Move ${f.name} up`); dn.setAttribute('aria-label', `Move ${f.name} down`); rm.setAttribute('aria-label', `Remove ${f.name}`);
      up.onclick = () => move(f.id, i - 1);
      dn.onclick = () => move(f.id, i + 1);
      rm.onclick = () => { files.splice(files.findIndex(x => x.id === f.id), 1); render(); };

      li.append(
        el('span', { className: 'grip', textContent: '⠿', ariaHidden: 'true' }),
        el('div', {}, el('div', { className: 'name', textContent: f.name }),
          el('div', { className: 'meta', textContent: `${f.count} page${f.count === 1 ? '' : 's'} · ${fmtSize(f.size)}` })),
        el('div', { className: 'btns' }, up, dn, rm),
        el('div', { className: 'pages' }, el('label', { htmlFor: 'r' + f.id, textContent: 'Pages' }), inp, err)
      );
      li.addEventListener('dragstart', e => { dragId = f.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); });
      li.addEventListener('dragend', () => { dragId = null; li.classList.remove('dragging'); });
      li.addEventListener('dragover', e => { if (dragId) { e.preventDefault(); li.classList.add('target'); } });
      li.addEventListener('dragleave', () => li.classList.remove('target'));
      li.addEventListener('drop', e => {
        if (!dragId) return;
        e.preventDefault(); e.stopPropagation();
        const dragged = dragId; dragId = null;
        move(dragged, files.findIndex(x => x.id === f.id));
      });
      list.append(li);
    });
    $('empty').hidden = files.length > 0;
    $('hint').hidden = files.length === 0;
    updateButtons();
  }

  function updateButtons() {
    combineBtn.disabled = busy || files.length === 0 || files.some(f => f.error);
    clearBtn.disabled = busy || files.length === 0;
  }

  async function combine() {
    busy = true; updateButtons(); setStatus('Combining…');
    try {
      const out = await PDFDocument.create();
      out.setTitle(''); out.setAuthor(''); out.setSubject(''); out.setKeywords([]);
      out.setProducer('Client-side PDF combiner'); out.setCreator('Client-side PDF combiner');
      let total = 0;
      for (const f of files) {
        const src = await PDFDocument.load(f.bytes, { updateMetadata: false });
        const pages = await out.copyPages(src, parseRange(f.range, f.count));
        pages.forEach(p => out.addPage(p));
        total += pages.length;
      }
      const data = await out.save();
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const a = el('a', { href: url, download: 'combined.pdf' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus(`Done: combined.pdf has ${total} page${total === 1 ? '' : 's'}. It was created on your device only.`);
    } catch (e) {
      setStatus('Could not combine the files: ' + e.message, true);
    } finally { busy = false; updateButtons(); }
  }

  combineBtn.onclick = combine;
  clearBtn.onclick = () => { files.length = 0; input.value = ''; render(); setStatus('All files cleared from memory.'); };
  input.addEventListener('change', () => { addFiles([...input.files]); input.value = ''; });
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { if (!dragId) { e.preventDefault(); drop.classList.add('over'); } }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { if (!dragId) { e.preventDefault(); addFiles([...e.dataTransfer.files]); } });
  // Stop the browser from navigating to a PDF dropped outside the drop zone.
  window.addEventListener('dragover', e => { if (!dragId) e.preventDefault(); });
  window.addEventListener('drop', e => { if (!dragId) e.preventDefault(); });
  render();
})();
