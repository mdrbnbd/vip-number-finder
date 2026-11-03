/* VIP Number Finder v2 — operator → type → scan. Uses only the official Robi availability endpoint. */
(function () {
  'use strict';
  const V = window.VIP, I18N = window.VNF_I18N;
  const { OPS, toBn, toEn } = V;
  const API = 'https://da-api.robi.com.bd/da-nll/free-msisdn/get-msisdn-list';
  const CONCURRENCY = 5;      // parallel lanes (polite)
  const CONC_MIN = 2, CONC_START = 5, CONC_MAX = 10; // adaptive pool for Smart Search
  const GAP_MS = 450;         // pause per lane between requests (+ jitter)
  const REQ_TIMEOUT_MS = 15000;
  const CATS = ['smart', 'triple', 'pairs', 'celebrity', 'years', 'zerobin', 'ends', 'math', 'customd'];
  const NEEDS_Q = { ends: true, customd: true };
  const $ = (id) => document.getElementById(id);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- language ---------------- */
  let lang = LS.get('vnf-lang', 'bn') === 'en' ? 'en' : 'bn';
  const T = (k, ...a) => { const v = I18N[lang][k]; return typeof v === 'function' ? v(...a) : v == null ? k : v; };
  const N = (x) => (lang === 'bn' ? toBn(x) : String(x));
  const NF = (x) => N(Number(x).toLocaleString('en-US'));
  const opName = (b) => (lang === 'bn' ? OPS[b].short : OPS[b].shortEn);
  const starOf = (it) => (it.score >= 70 ? 5 : it.score >= 45 ? 4 : 3);
  const starName = (s) => T('t' + s);
  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach((el) => { const v = T(el.dataset.t); if (el.dataset.html) el.innerHTML = v; else el.textContent = v; });
    document.querySelectorAll('[data-tp]').forEach((el) => (el.placeholder = T(el.dataset.tp)));
    document.querySelectorAll('.steps li b').forEach((b, i) => (b.textContent = N(i + 1)));
    $('langBtn').textContent = lang === 'bn' ? 'EN' : 'বাংলা';
    $('langBtn').title = lang === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন';
    document.title = lang === 'bn' ? 'ভিআইপি নাম্বার ফাইন্ডার — রবি ০১৮ · এয়ারটেল ০১৬' : 'VIP Number Finder — Robi 018 · Airtel 016';
    setScanBtn(); renderLimit(); renderCats(); renderSeries(); renderAvoid(); updateFavBtn(); prog(); scheduleRender();
  }
  $('langBtn').onclick = () => { lang = lang === 'bn' ? 'en' : 'bn'; LS.set('vnf-lang', lang); applyLang(); };

  /* ---------------- toast / theme ---------------- */
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }
  const root = document.documentElement;
  function applyTheme(t) { root.dataset.theme = t; $('themeBtn').textContent = t === 'dark' ? '🌙' : '☀️'; document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#0b0f1a' : '#f5f6fb'; }
  applyTheme(LS.get('vnf-theme', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  $('themeBtn').onclick = () => { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(t); LS.set('vnf-theme', t); };

  /* ---------------- settings ---------------- */
  const S = Object.assign({ op: 'AIRTEL', cat: 'smart', limit: 100, limitN: 100, pat: { start: '', mid: '', end: '', pos: 'any' }, smode: 'smart', manual: { ROBI: ['2', '4', '6', '1'], AIRTEL: ['1'] }, avoid: [], bonus: false, q: {} }, LS.get('vnf-settings-v2', {}));
  if (!OPS[S.op]) S.op = 'AIRTEL'; if (!CATS.includes(S.cat)) S.cat = 'triple'; if (typeof S.q !== 'object' || !S.q) S.q = {};
  if (!S.v3) { S.cat = 'smart'; S.v3 = 1; } // Smart Search is the new default
  if (!S.pat || typeof S.pat !== 'object') S.pat = { start: '', mid: '', end: '', pos: 'any' };
  const save = () => LS.set('vnf-settings-v2', S);
  const opsOn = () => ({ ROBI: S.op === 'ROBI', AIRTEL: S.op === 'AIRTEL' });

  function setOp(op) {
    if (running) return;
    S.op = op; save();
    document.querySelectorAll('#opPick button').forEach((b) => { const on = b.dataset.op === op; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    $('prefix').textContent = '+88' + OPS[op].code;
    document.body.dataset.op = op;
    renderSeries(); if ($('patBox')) renderPat();
  }
  document.querySelectorAll('#opPick button').forEach((b) => { b.setAttribute('role', 'radio'); b.onclick = () => setOp(b.dataset.op); });

  /* ---------------- categories ---------------- */
  function renderCats() {
    const box = $('cats'); box.innerHTML = '';
    CATS.forEach((k) => {
      const [name, ex] = T('cats')[k];
      const b = document.createElement('button'); b.type = 'button'; b.dataset.cat = k; b.setAttribute('role', 'radio');
      b.className = S.cat === k ? 'on' : ''; b.setAttribute('aria-checked', S.cat === k);
      b.innerHTML = `<b>${esc(name)}</b><small>${esc(ex)}</small>`;
      b.onclick = () => { if (running) return; S.cat = k; save(); $('qInput').value = S.q[k] || ''; renderCats(); };
      box.appendChild(b);
    });
    $('catHint').textContent = '💡 ' + T('cats')[S.cat][2];
    document.body.dataset.cat = S.cat; $('patBox').classList.toggle('hidden', S.cat !== 'smart'); renderPat();
    $('qInput').placeholder = T('qPh') + ({ triple: ' (7)', pairs: ' (1)', years: ' (1998)', ends: ' (4200)', customd: ' (199)' }[S.cat] || '');
    $('qInput').inputMode = S.cat === 'customd' ? 'text' : 'numeric';
  }
  $('qInput').oninput = () => {
    let v = $('qInput').value;
    v = S.cat === 'customd' ? toEn(v).toUpperCase().replace(/[^0-9*A-Z]/g, '') : toEn(v).replace(/\D/g, '');
    if (/^(88)?01[86]\d{8}$/.test(v)) v = v.slice(-8); // pasted full number
    if (v.length > 8) v = v.slice(0, 8);
    if ($('qInput').value !== v) $('qInput').value = v;
    S.q[S.cat] = v; save();
  };
  document.querySelectorAll('code[data-p]').forEach((c) => (c.onclick = () => {
    if (running) return;
    S.cat = 'customd'; S.q.customd = c.dataset.p; save(); $('qInput').value = c.dataset.p; renderCats();
    $('scanForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  function renderLimit() {
    const max = !S.limit; $('limitMax').classList.toggle('on', max); $('limitMax').textContent = T(max ? 'maxOn' : 'max');
    $('limitInput').disabled = max; $('limitInput').value = max ? '' : S.limit; $('limitInput').placeholder = max ? '∞' : '';
  }
  $('limitInput').onchange = () => { let n = Math.round(+toEn($('limitInput').value) || 100); n = Math.max(1, Math.min(5000, n)); S.limit = S.limitN = n; save(); renderLimit(); };
  $('limitMax').onclick = () => { if (running) return; S.limit = S.limit ? 0 : S.limitN || 100; save(); renderLimit(); };

  /* ---------------- Smart Search (starts / contains / ends) ---------------- */
  const fmtDur = (sec) => { sec = Math.max(1, Math.round(sec)); if (sec < 60) return N(sec) + ' ' + T('sU'); const m = Math.round(sec / 60); if (m < 60) return N(m) + ' ' + T('mU'); return N(Math.floor(m / 60)) + ' ' + T('hU') + ' ' + N(m % 60) + ' ' + T('mU'); };
  const ENUM_MAX = 200000;
  const fixedMask = (spec, sub) => {
    const m = Array(8).fill(false);
    for (let i = 0; i < spec.start.length; i++) m[i] = true;
    for (let i = 0; i < spec.end.length; i++) m[7 - i] = true;
    if (spec.mid) { const p = spec.placements.find((q) => sub.substr(q, spec.mid.length) === spec.mid); if (p != null) for (let i = 0; i < spec.mid.length; i++) m[p + i] = true; }
    return m;
  };
  function renderPat() {
    if (S.cat !== 'smart') return;
    const P = S.pat; ['start', 'mid', 'end'].forEach((k) => { const el = $('pat' + k[0].toUpperCase() + k.slice(1)); if (document.activeElement !== el) el.value = P[k] ? N(P[k]) : ''; });
    const a = P.start.length, b = P.mid.length, c = P.end.length;
    const sel = $('patPos'); $('patPosRow').classList.toggle('hidden', !b);
    const opts = ['any']; for (let p = a; p <= 8 - c - b; p++) opts.push(String(p + 1));
    if (!opts.includes(String(P.pos))) P.pos = 'any';
    sel.innerHTML = opts.map((o) => `<option value="${o}"${String(P.pos) === o ? ' selected' : ''}>${o === 'any' ? T('posAny') : T('posAt', N(o))}</option>`).join('');
    const spec = V.patternSpec(P);
    let tpl = spec.ok ? V.previewTpl(spec) : (P.start + '________').slice(0, 8);
    if (!spec.ok && c && a + c <= 8) tpl = tpl.slice(0, 8 - c) + P.end;
    const cell = (ch) => (ch === '_' ? '_' : '<em>' + N(ch) + '</em>');
    $('ppCode').textContent = N(OPS[S.op].code);
    $('ppDigits').innerHTML = tpl.slice(0, 4).split('').map(cell).join('') + ' ' + tpl.slice(4).split('').map(cell).join('');
    $('patNote').textContent = spec.ok && b && spec.placements.length > 1 ? T('patAnyNote', N(P.mid)) : '';
    const est = $('patEst');
    if (spec.ok) { est.className = 'hint'; est.textContent = '🔢 ' + T('patEst', NF(spec.total), spec.total <= ENUM_MAX, fmtDur(spec.total / LS.get('vnf-rate', 2.5))); }
    else { est.className = 'hint ' + (spec.error === 'empty' ? '' : 'err'); est.textContent = (spec.error === 'empty' ? '💡 ' : '⚠️ ') + T('patErr')[spec.error]; }
  }
  [['patStart', 'start'], ['patMid', 'mid'], ['patEnd', 'end']].forEach(([id, k]) => {
    const el = $(id);
    el.oninput = () => {
      let v = toEn(el.value).replace(/\D/g, '');
      if (k === 'start' && /^(88)?01[86]\d{3,}/.test(v) && v.length > 8) v = v.replace(/^(88)?01[86]/, '');
      v = v.slice(0, 8); S.pat[k] = v; save();
      const shown = N(v); if (el.value !== shown) el.value = shown;
      renderPat();
    };
    el.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); running ? stopScan() : startScan(); } };
  });
  $('patPos').onchange = () => { S.pat.pos = $('patPos').value; save(); renderPat(); };

  /* ---------------- series (advanced) ---------------- */
  const SEED_HEADS = { ROBI: ['25', '20', '16', '15', '43', '62'], AIRTEL: ['12', '13', '14', '10'] };
  let heads = LS.get('vnf-heads-v1', null);
  if (!heads) { heads = { ROBI: {}, AIRTEL: {} }; for (const b in SEED_HEADS) SEED_HEADS[b].forEach((h, i) => (heads[b][h] = { n: 6 - i, t: 0 })); }
  function learnHead(msisdn) { const b = V.brandOf(msisdn), h = V.subOf(msisdn).slice(0, 2); const e = heads[b][h] || (heads[b][h] = { n: 0, t: 0 }); e.n++; e.t = Date.now(); }
  const saveHeads = () => LS.set('vnf-heads-v1', heads);
  const topHeads = (b, k) => Object.entries(heads[b]).sort((x, y) => y[1].n - x[1].n).slice(0, k).map((x) => x[0]);
  const liveDigits = (b) => new Set(Object.keys(heads[b]).map((h) => h[0]));
  document.querySelectorAll('input[name=smode]').forEach((r) => { r.checked = r.value === S.smode; r.onchange = () => { S.smode = r.value; save(); renderSeries(); }; });
  function renderSeries() {
    $('seriesPick').classList.toggle('hidden', S.smode !== 'manual');
    $('smartHint').classList.toggle('hidden', S.smode !== 'smart');
    const on = opsOn();
    ['ROBI', 'AIRTEL'].forEach((b) => {
      const box = $('series' + b); box.innerHTML = '';
      document.querySelector(`.series-group[data-brand=${b}]`).classList.toggle('hidden', !on[b]);
      const live = liveDigits(b);
      for (const d of '1234567890') {
        const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = N(OPS[b].code + d);
        btn.className = (S.manual[b].includes(d) ? 'on ' : '') + (live.has(d) ? 'live' : '');
        btn.onclick = () => { const a = S.manual[b]; const i = a.indexOf(d); i >= 0 ? a.splice(i, 1) : a.push(d); save(); renderSeries(); };
        box.appendChild(btn);
      }
    });
    $('seriesSummary').textContent = T('seriesCount', N(seriesList().length));
  }
  function seriesList() {
    const b = S.op;
    return (S.smode === 'smart' ? topHeads(b, b === 'ROBI' ? 8 : 6) : S.manual[b]).map((h) => ({ brand: b, head: h }));
  }
  function renderAvoid() {
    const box = $('avoidChips'); box.innerHTML = '';
    for (const d of '0123456789') {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = N(d); b.className = S.avoid.includes(d) ? 'on' : '';
      b.onclick = () => { const i = S.avoid.indexOf(d); i >= 0 ? S.avoid.splice(i, 1) : S.avoid.push(d); save(); renderAvoid(); };
      box.appendChild(b);
    }
  }

  /* ---------------- results / favourites ---------------- */
  const results = new Map(), bonus = new Map();
  let favs = LS.get('vnf-favs-v1', []);
  const isFav = (m) => favs.some((f) => f.msisdn === m);
  function toggleFav(item) {
    const i = favs.findIndex((f) => f.msisdn === item.msisdn);
    if (i >= 0) favs.splice(i, 1); else favs.unshift({ ...item, at: Date.now() });
    LS.set('vnf-favs-v1', favs); toast(T(i >= 0 ? 'tFavDel' : 'tFavAdd')); updateFavBtn(); scheduleRender();
  }
  const view = { tab: 'found', star: 'all', sort: 'score', q: '' };
  let searchState = 'idle';
  function updateFavBtn() { $('showFavsBtn').textContent = T('showFavs', N(favs.length)); }
  function setTab(tab) { view.tab = tab; $('backToResults').classList.toggle('hidden', tab !== 'favs'); scheduleRender(); if (tab === 'favs') $('resultsCard').scrollIntoView({ behavior: 'smooth' }); }
  $('showFavsBtn').onclick = () => setTab('favs');
  $('backToResults').onclick = () => setTab('found');
  document.querySelectorAll('#tierFilter button').forEach((b) => (b.onclick = () => {
    document.querySelectorAll('#tierFilter button').forEach((x) => x.classList.toggle('on', x === b)); view.star = b.dataset.tier; scheduleRender();
  }));
  $('sortSel').onchange = () => { view.sort = $('sortSel').value; scheduleRender(); };
  $('searchBox').oninput = () => { view.q = toEn($('searchBox').value).replace(/\D/g, ''); scheduleRender(); };

  function baseItems() { return view.tab === 'favs' ? favs.slice() : [...results.values()]; }
  function currentItems() {
    let arr = baseItems();
    if (view.star !== 'all') arr = arr.filter((x) => String(starOf(x)) === view.star);
    if (view.q) arr = arr.filter((x) => V.localOf(x.msisdn).includes(view.q));
    const cmp = { score: (a, b) => b.score - a.score || a.msisdn.localeCompare(b.msisdn), new: (a, b) => b.at - a.at, num: (a, b) => a.msisdn.localeCompare(b.msisdn) }[view.sort];
    return arr.sort(cmp);
  }
  function numHtml(item) {
    const p = V.pretty(item.msisdn);
    if (item.mask) {
      let k = 0, out = '', open = false;
      for (const ch of p) {
        if (!/\d/.test(ch)) { out += ch; continue; }
        const on = k >= 3 && item.mask[k - 3]; k++;
        if (on && !open) { out += '<em>'; open = true; } else if (!on && open) { out += '</em>'; open = false; }
        out += N(ch);
      }
      return out + (open ? '</em>' : '');
    }
    let cnt = 0, i = p.length; while (i > 0 && cnt < 4) { i--; if (/\d/.test(p[i])) cnt++; }
    return N(p.slice(0, i)) + '<em>' + N(p.slice(i)) + '</em>';
  }
  const reasonText = (r) => (lang === 'en' ? r.en || r.why : r.why);
  function card(item) {
    const st = starOf(item);
    const el = document.createElement('div'); el.className = 'item s' + st;
    const top = item.reasons && item.reasons[0] ? reasonText(item.reasons[0]) : item.cat ? T('cats')[item.cat][0] + (item.qq ? ' ' + N(item.qq) : '') : T('regular');
    el.innerHTML = `<div class="item-top">
        <span class="badge st s${st}">${'★'.repeat(st)} ${starName(st)}</span>
        <span class="badge ${item.brand}">${opName(item.brand)}</span>
        ${item.src === 'bonus' ? `<span class="badge bonus">${T('near')}</span>` : ''}
        ${item.gone ? `<span class="badge gone">${T('gone')}</span>` : ''}
        <span class="spacer"></span>
        <button class="mini" data-a="verify" type="button" aria-label="verify">🔄</button>
        <button class="mini fav ${isFav(item.msisdn) ? 'on' : ''}" data-a="fav" type="button" aria-label="favourite">${isFav(item.msisdn) ? '★' : '☆'}</button>
      </div>
      <div class="num">${numHtml(item)}</div>
      <div class="reason">${esc(top)} · <button class="link-btn" data-a="why" type="button">${T('why')}</button></div>
      <div class="acts2">
        <button class="btn ghost" data-a="copy" type="button">${T('copy')}</button>
        <button class="btn buy" data-a="buy" type="button">${T('buy')}</button>
      </div>`;
    el.onclick = (e) => { const a = e.target.closest('[data-a]'); if (a) actions[a.dataset.a](item, a); };
    return el;
  }
  let renderQueued = false;
  function scheduleRender() { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } }
  function render() {
    renderQueued = false; renderBonus();
    const base = baseItems();
    $('cAll').textContent = N(base.length);
    [5, 4, 3].forEach((s) => ($('c' + s).textContent = N(base.filter((x) => starOf(x) === s).length)));
    $('resTitle').textContent = view.tab === 'favs' ? T('favsTitle', N(favs.length)) : results.size || searchState !== 'idle' ? T('resTitle', N(results.size)) : T('resTitle0');
    const list = $('list'); const items = currentItems(); list.innerHTML = '';
    if (!items.length) {
      const html = view.tab === 'favs' ? T('emptyFavs') : results.size ? T('emptyFilter') : { idle: T('emptyIdle'), running: T('emptyRunning'), done: T('emptyNone') }[searchState];
      list.innerHTML = `<div class="empty ${searchState}">${html}</div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    items.slice(0, 500).forEach((it) => frag.appendChild(card(it)));
    list.appendChild(frag);
  }
  function renderBonus() {
    $('bonusCard').classList.toggle('hidden', !bonus.size || view.tab === 'favs');
    $('bonusTitle').textContent = T('bonusTitle', N(bonus.size));
    const list = $('bonusList'); list.innerHTML = '';
    const frag = document.createDocumentFragment();
    [...bonus.values()].sort((a, b) => b.score - a.score).slice(0, 60).forEach((it) => frag.appendChild(card(it)));
    list.appendChild(frag);
  }

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); return ok; }
  }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  const shareText = (item) => T('shareTxt', V.pretty(item.msisdn), lang === 'bn' ? OPS[item.brand].label : OPS[item.brand].en, starName(starOf(item)), OPS[item.brand].buy);
  const actions = {
    async buy(item) {
      const ok = await copyText(V.localOf(item.msisdn));
      toast(ok ? T('tBuy') : T('tRemember', N(V.localOf(item.msisdn))));
      window.open(OPS[item.brand].buy, '_blank', 'noopener');
    },
    async copy(item) { toast((await copyText(V.localOf(item.msisdn))) ? T('tCopied', N(V.localOf(item.msisdn))) : T('tCopyFail')); },
    async share(item) { const text = shareText(item); if (navigator.share) { try { await navigator.share({ title: T('title'), text }); } catch {} } else toast((await copyText(text)) ? T('tCopied', '') : T('tCopyFail')); },
    fav(item) { toggleFav(item); },
    why(item) { showWhy(item); },
    async verify(item, btn) {
      btn.disabled = true; btn.textContent = '⏳';
      try {
        const d = await callApi(item.msisdn, item.brand, true);
        item.gone = d.available !== true;
        const f = favs.find((x) => x.msisdn === item.msisdn); if (f) { f.gone = item.gone; LS.set('vnf-favs-v1', favs); }
        const r = results.get(item.msisdn); if (r) r.gone = item.gone;
        toast(T(item.gone ? 'tGone' : 'tStill'));
      } catch (e) { toast(T('tVerifyFail') + e.message); }
      scheduleRender();
    }
  };
  function showWhy(item) {
    const st = starOf(item);
    $('whyTitle').innerHTML = numHtml(item);
    const rows = (item.reasons || []).map((r) => `<div class="why-row"><span>${esc(reasonText(r))}</span><b>+${N(r.p)}</b></div>`).join('') || `<p class="muted">${T('whyNone')}</p>`;
    $('whyContent').innerHTML = rows + `<div class="why-total"><span>${T('whyTotal')}</span><span>${N(item.score)} · ${'★'.repeat(st)} ${starName(st)}</span></div>
      <p class="hint">${T('whyTiers')}</p>
      <div class="acts2"><button class="btn ghost" id="whyShare" type="button">📤</button><button class="btn buy" id="whyBuy" type="button">${T('buy')}</button></div>`;
    $('whyShare').onclick = () => actions.share(item); $('whyBuy').onclick = () => actions.buy(item);
    $('whySheet').classList.remove('hidden');
  }
  $('whyClose').onclick = () => $('whySheet').classList.add('hidden');
  $('whySheet').onclick = (e) => { if (e.target.id === 'whySheet') $('whySheet').classList.add('hidden'); };

  // exports
  $('txtBtn').onclick = async () => {
    const it = currentItems(); if (!it.length) return toast(T('tNothing'));
    const stamp = new Date().toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB');
    const lines = [`${T('txtHead')} — ${stamp}`, ''].concat(it.map((x) => `${V.localOf(x.msisdn)}  ${'★'.repeat(starOf(x))} ${starName(starOf(x))}  ${opName(x.brand)}`));
    const ops = [...new Set(it.map((x) => x.brand))]; lines.push('', ...ops.map((b) => `${T('txtBuy')} ${opName(b)}: ${OPS[b].buy}`));
    const text = lines.join('\n');
    download('vip-numbers.txt', '\ufeff' + text, 'text/plain;charset=utf-8'); await copyText(text);
    toast(T('tTxt', N(it.length)));
  };
  $('copyAllBtn').onclick = async () => { const it = currentItems(); if (!it.length) return toast(T('tNothing')); toast((await copyText(it.map((x) => V.localOf(x.msisdn)).join('\n'))) ? T('tCount', N(it.length)) : T('tCopyFail')); };
  $('csvBtn').onclick = () => {
    const it = currentItems(); if (!it.length) return toast(T('tNothing'));
    const rows = [['number', 'operator', 'score', 'stars', 'why', 'buy_url']].concat(it.map((x) => [V.localOf(x.msisdn), x.brand, x.score, starOf(x), (x.reasons || []).map(reasonText).join('; '), OPS[x.brand].buy]));
    download('vip-numbers.csv', '\ufeff' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv;charset=utf-8');
  };

  /* ---------------- API (polite) ---------------- */
  let pauseUntil = 0, backoff = 0, stopCtrl = null, slowNote = false, throttleEvents = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function callApi(msisdn, brand, standalone) {
    const sc = standalone ? null : stopCtrl;
    for (let attempt = 0; attempt < 4; attempt++) {
      const wait = pauseUntil - Date.now(); if (wait > 0) await sleep(wait);
      if (sc && sc.signal.aborted) throw new DOMException('stopped', 'AbortError');
      const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
      const onStop = () => ctrl.abort(); if (sc) sc.signal.addEventListener('abort', onStop, { once: true });
      try {
        const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msisdn, brand, simCategory: 'PREPAID' }), signal: ctrl.signal, cache: 'no-store' });
        if (res.status === 429 || res.status >= 500) { backoff = Math.min(30000, backoff ? backoff * 2 : 2000); pauseUntil = Date.now() + backoff; slowNote = true; throttleEvents++; continue; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        backoff = Math.max(0, backoff / 2 | 0); if (!backoff) slowNote = false;
        return await res.json();
      } catch (e) {
        if (sc && sc.signal.aborted) throw new DOMException('stopped', 'AbortError');
        if (attempt === 3) throw e.name === 'AbortError' ? new Error('timeout') : e;
        backoff = Math.min(30000, backoff ? backoff * 2 : 1500); pauseUntil = Date.now() + backoff; slowNote = true; throttleEvents++;
      } finally { clearTimeout(tm); if (sc) sc.signal.removeEventListener('abort', onStop); }
    }
    throw new Error('busy');
  }

  /* ---------------- scan ---------------- */
  let running = false, stats = null;
  const triedLS = LS.get('vnf-tried-v1', {});
  (function prune() { const cut = Date.now() - 12 * 3600e3; for (const k in triedLS) if (triedLS[k] < cut) delete triedLS[k]; })();
  function setScanBtn() { const b = $('scanBtn'); b.textContent = T(running ? 'stopScan' : 'start'); b.classList.toggle('stop', running); }
  function prog() {
    if (!stats) return;
    const { checked, found, limit, t0, cap, ended, stopped, total } = stats;
    const secs = (Date.now() - t0) / 1000, rate = secs > 2 ? checked / secs : 0;
    const lim = isFinite(limit) ? N(limit) : '∞', tot = total || cap;
    $('sChecked').textContent = NF(checked); $('sFound').textContent = NF(found); $('sTotal').textContent = NF(tot);
    $('sEta').textContent = ended ? '✓' : rate > 0.05 && checked > 3 ? fmtDur(Math.max(0, tot - checked) / rate) : '…';
    const rateTxt = rate ? ` · ${N(rate.toFixed(1))}/s` : '';
    $('progText').textContent = !ended ? (slowNote ? T('slow') : '') + (total ? T('progPat', NF(checked), NF(total), NF(found)) : T('prog', N(checked), N(found), lim)) + rateTxt : stopped ? T('progStopped', N(checked), N(found)) : T('progDone', N(checked), N(found));
    $('spin').classList.toggle('hidden', !!ended);
    $('bar').style.width = (ended ? 100 : Math.min(100, Math.max(isFinite(limit) ? found / limit : 0, checked / tot) * 100)) + '%';
  }
  function addResult(msisdn, src, extra) {
    if (results.has(msisdn)) return false;
    const item = { msisdn, brand: V.brandOf(msisdn), sub: V.subOf(msisdn), ...V.score(msisdn), src, at: Date.now(), cat: src === 'bonus' ? null : S.cat, qq: src === 'bonus' ? '' : S.q[S.cat] || '' };
    if (extra && extra.mask) { item.mask = extra.mask; item.qq = extra.label; }
    results.set(msisdn, item); bonus.delete(msisdn); scheduleRender(); return true;
  }
  function addBonus(msisdn) {
    if (results.has(msisdn) || bonus.has(msisdn)) return;
    bonus.set(msisdn, { msisdn, brand: V.brandOf(msisdn), sub: V.subOf(msisdn), ...V.score(msisdn), src: 'bonus', at: Date.now() });
    scheduleRender();
  }
  function beginUI() {
    running = true; stopCtrl = new AbortController(); searchState = 'running'; results.clear(); bonus.clear(); view.tab = 'found';
    $('backToResults').classList.add('hidden'); $('progressBox').classList.remove('hidden');
    document.body.classList.add('scanning'); setScanBtn(); scheduleRender();
  }
  function endUI() {
    running = false; stopCtrl = null; searchState = 'done'; document.body.classList.remove('scanning');
    setScanBtn(); saveHeads(); LS.set('vnf-tried-v1', triedLS); renderSeries(); scheduleRender();
  }

  async function checkOne(sub) {
    const brand = S.op, msisdn = OPS[brand].intl + sub;
    beginUI(); stats = { checked: 0, found: 0, limit: 1, cap: 1, t0: Date.now() }; prog();
    try {
      const d = await callApi(msisdn, brand); stats.checked = 1;
      if (d.available === true) { addResult(msisdn, 'check'); stats.found = 1; toast(T('tOneFree')); } else toast(T('tOneTaken'));
      for (const n of d.freeMsisdnList || []) { const s = String(n); if (/^880(18|16)\d{8}$/.test(s) && V.brandOf(s) === brand) { learnHead(s); addResult(s, 'bonus'); } }
    } catch (e) { if (e.name !== 'AbortError') toast(T('tNet', e.message)); }
    stats.ended = true; stats.stopped = false; endUI(); prog();
  }

  async function startPatternScan() {
    const spec = V.patternSpec(S.pat);
    if (!spec.ok) { toast(T('patErr')[spec.error]); $(spec.error === 'pos' ? 'patPos' : 'patStart').focus(); return; }
    if (spec.total === 1) return checkOne(spec.templates[0]);
    const brand = S.op, code = OPS[brand].code.slice(1), intl = OPS[brand].intl;
    const hs = topHeads(brand, 10).filter((h) => heads[brand][h].n > 0);
    const src = V.patternSource(spec, { code, heads: hs, enumMax: ENUM_MAX });
    const label = V.previewTpl(spec).replace(/_+/g, '…');
    const limit = S.limit || Infinity;
    beginUI();
    stats = { checked: 0, found: 0, limit, cap: src.total, total: src.total, t0: Date.now() }; prog();
    let conc = CONC_START, okStreak = 0, consecErr = 0, active = 0, netErr = null, exhausted = false, seenT = throttleEvents;
    const buf = [];
    const take = () => {
      for (;;) {
        if (!buf.length) { const b = src.next(200); if (!b.length) { exhausted = true; return null; } buf.push(...b); }
        const sub = buf.shift(), m = intl + sub;
        if (results.has(m) || triedLS[brand + '|' + sub]) { stats.checked++; continue; } // already known: free (found) or taken (last 12h)
        return { m, sub };
      }
    };
    const extraHit = (d) => {
      for (const n of d.freeMsisdnList || []) {
        const s = String(n); if (!/^880(18|16)\d{8}$/.test(s)) continue;
        learnHead(s);
        if (V.brandOf(s) !== brand) continue;
        const sub = V.subOf(s);
        if (V.matchSpec(sub, spec)) { if (stats.found < limit && addResult(s, 'check', { mask: fixedMask(spec, sub), label })) stats.found++; }
        else if (V.score(s).score >= 22) addBonus(s);
      }
    };
    const run = async (c) => {
      try {
        const d = await callApi(c.m, brand);
        stats.checked++; consecErr = 0;
        if (d.available === true) { if (addResult(c.m, 'check', { mask: fixedMask(spec, c.sub), label })) { stats.found++; learnHead(c.m); } }
        else triedLS[brand + '|' + c.sub] = Date.now();
        extraHit(d);
        if (++okStreak >= 12 && conc < CONC_MAX && !backoff) { conc++; okStreak = 0; }
      } catch (e) {
        if (e.name === 'AbortError') return;
        stats.checked++; consecErr++; okStreak = 0;
        if (consecErr >= 8) { netErr = e.message; running = false; }
      } finally { active--; prog(); }
    };
    try {
      while (running && stats.found < limit) {
        if (throttleEvents > seenT) { seenT = throttleEvents; conc = Math.max(CONC_MIN, Math.floor(conc / 2)); okStreak = 0; }
        if (active < conc) {
          const c = take(); if (!c) break;
          active++; run(c);
          await sleep(150 + Math.random() * 150); // pace request starts (never a burst)
        } else await sleep(80);
      }
      while (active > 0) await sleep(100);
    } finally {
      stats.stopped = !!(stopCtrl && stopCtrl.signal.aborted); stats.ended = true;
      const secs = (Date.now() - stats.t0) / 1000; if (stats.checked > 20 && secs > 10) LS.set('vnf-rate', +(stats.checked / secs).toFixed(2));
      endUI(); prog(); renderPat();
      if (netErr) toast(T('tNet', netErr));
      else if (!stats.stopped) toast(stats.found ? T('tFound', N(stats.found)) : exhausted ? T('tExhausted') : T('tNone'));
    }
  }

  async function startScan() {
    if (running) return;
    if (S.cat === 'smart') return startPatternScan();
    const cat = S.cat, q = (S.q[cat] || '').trim();
    if (NEEDS_Q[cat] && !q) { toast(T('needDigits')); $('qInput').focus(); return; }
    if (q.length === 8 && /^\d{8}$/.test(q) && (cat === 'ends' || cat === 'customd')) return checkOne(q);
    let series = seriesList();
    const isPattern = cat === 'customd' && /[*A-Z]/.test(q);
    const presets = V.makePresets({ query: isPattern ? '' : q, pattern: isPattern ? q : null });
    const P = presets[cat];
    if (isPattern) {
      const p = V.parsePattern(q); if (!p.ok) return toast(p.error);
      const lead2 = (p.tokens.join('').match(/^\d{2}/) || [''])[0];
      if (lead2) series = [{ brand: S.op, head: lead2 }];
    } else if ((cat === 'ends' || cat === 'customd') && q.length > 6) {
      // long input (7 digits): only 1 free digit before it, so scan by 1-digit series heads
      series = [...new Set(series.map((s) => s.head[0]))].map((h) => ({ brand: S.op, head: h }));
    }
    if (!series.length) { toast(T('selOp')); return; }
    const filters = { avoid: S.avoid, must: '' };
    const limit = S.limit || Infinity, cap = S.limit ? Math.min(3000, Math.max(300, limit * 25)) : 20000;
    beginUI();
    stats = { checked: 0, found: 0, limit, cap, t0: Date.now() }; prog();
    const seen = new Set(Object.keys(triedLS));
    let consecErr = 0, queue = [], empties = 0, issued = 0, netErr = null;
    const refill = () => {
      if (queue.length > 10) return;
      const b = V.buildBatch({ preset: cat, presets, seriesList: series, size: 60, seen, filters });
      b.forEach((x) => seen.add(x.brand + '|' + x.sub));
      if (!b.length) empties++; else empties = 0;
      // interleave series so blocks are scanned in parallel, best scores first within each round
      queue = queue.concat(b).sort((a, c) => c.score - a.score);
    };
    const lane = async () => {
      while (running && issued < cap && stats.found < limit) {
        refill();
        const c = queue.shift();
        if (!c) { if (empties > 2) break; continue; }
        issued++;
        try {
          const d = await callApi(c.msisdn, c.brand);
          stats.checked++; consecErr = 0;
          if (d.available === true) { if (addResult(c.msisdn, 'check')) { stats.found++; learnHead(c.msisdn); } }
          else triedLS[c.brand + '|' + c.sub] = Date.now();
          for (const n of d.freeMsisdnList || []) {
            const s = String(n); if (!/^880(18|16)\d{8}$/.test(s)) continue;
            learnHead(s);
            if (V.brandOf(s) !== S.op || stats.found >= limit) continue;
            const sub = V.subOf(s), code = OPS[S.op].code.slice(1);
            if (P.test(sub, code) && V.passFilters(sub, filters)) { if (addResult(s, 'check')) stats.found++; }
            else if (V.score(s).score >= 22 && V.passFilters(sub, filters)) addBonus(s);
          }
        } catch (e) {
          if (e.name === 'AbortError') break;
          stats.checked++; consecErr++;
          if (consecErr >= 8) { netErr = e.message; running = false; break; }
        }
        prog();
        if (running) await sleep(GAP_MS + Math.random() * 250);
      }
    };
    try { await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => sleep(i * 180).then(lane))); }
    finally {
      stats.stopped = !!(stopCtrl && stopCtrl.signal.aborted); stats.ended = true;
      endUI(); prog();
      if (netErr) toast(T('tNet', netErr));
      else if (!stats.stopped) toast(stats.found ? T('tFound', N(stats.found)) : empties > 2 ? T('tExhausted') : T('tNone'));
    }
  }
  function stopScan() { if (stopCtrl) { stopCtrl.abort(); running = false; setScanBtn(); } }
  $('scanForm').onsubmit = (e) => { e.preventDefault(); $('qInput').blur(); running ? stopScan() : startScan(); };

  /* ---------------- PWA ---------------- */
  let deferred = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('installBtn').classList.remove('hidden'); });
  $('installBtn').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; $('installBtn').classList.add('hidden'); };
  if ('serviceWorker' in navigator && location.protocol !== 'file:') addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

  window.VNF = { addResult, showWhy, results, bonus, S, renderPat, startScan, stopScan, setLang: (l) => { lang = l; LS.set('vnf-lang', l); applyLang(); } };
  $('qInput').value = S.q[S.cat] || '';
  setOp(S.op); renderLimit(); applyLang();
})();
