/* VIP Number Finder — UI + polite search engine */
(function () {
  'use strict';
  const V = window.VIP;
  const { OPS, TIERS, TIER_RANK, toBn, toEn } = V;
  const API = 'https://da-api.robi.com.bd/da-nll/free-msisdn/get-msisdn-list';
  const CONCURRENCY = 3;          // max parallel requests
  const GAP_MS = 350;             // pause between requests per worker
  const REQ_TIMEOUT_MS = 15000;
  const $ = (id) => document.getElementById(id);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  /* ---------------- toast ---------------- */
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200); }

  /* ---------------- theme ---------------- */
  const root = document.documentElement;
  function applyTheme(t) { root.dataset.theme = t; $('themeBtn').textContent = t === 'dark' ? '🌙' : '☀️'; document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#0b0f1a' : '#f5f6fb'; }
  applyTheme(LS.get('vnf-theme', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  $('themeBtn').onclick = () => { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(t); LS.set('vnf-theme', t); };

  /* ---------------- settings ---------------- */
  const S = Object.assign({
    ops: { ROBI: true, AIRTEL: true }, smode: 'smart', manual: { ROBI: ['2', '4', '6', '1'], AIRTEL: ['1'] },
    preset: 'mix', digit: null, avoid: [], must: '', budget: 300, bonus: true, custom: '****ABAB', bfmt: 'any', bday: ''
  }, LS.get('vnf-settings', {}));
  const save = () => LS.set('vnf-settings', S);

  // Sub-series (2 digits after 018/016) where the operator is currently releasing numbers.
  // Seeded from observed suggestions (Nov 2026); updated live from every API response.
  const SEED_HEADS = { ROBI: ['25', '20', '16', '15', '43', '62'], AIRTEL: ['12', '13', '14', '10'] };
  let heads = LS.get('vnf-heads-v1', null);
  if (!heads) { heads = { ROBI: {}, AIRTEL: {} }; for (const b in SEED_HEADS) SEED_HEADS[b].forEach((h, i) => (heads[b][h] = { n: 6 - i, t: 0 })); }
  function learnHead(msisdn) {
    const b = V.brandOf(msisdn), h = V.subOf(msisdn).slice(0, 2);
    const e = heads[b][h] || (heads[b][h] = { n: 0, t: 0 }); e.n++; e.t = Date.now();
  }
  const saveHeads = () => LS.set('vnf-heads-v1', heads);
  function topHeads(b, k) { return Object.entries(heads[b]).sort((x, y) => y[1].n - x[1].n).slice(0, k).map((x) => x[0]); }
  function liveDigits(b) { return new Set(Object.keys(heads[b]).map((h) => h[0])); }

  /* ---------------- operator & series UI ---------------- */
  ['ROBI', 'AIRTEL'].forEach((b) => {
    const cb = $('op' + b); cb.checked = !!S.ops[b];
    cb.onchange = () => { S.ops[b] = cb.checked; save(); renderSeries(); };
  });
  document.querySelectorAll('input[name=smode]').forEach((r) => {
    r.checked = r.value === S.smode;
    r.onchange = () => { S.smode = r.value; save(); renderSeries(); };
  });
  function renderSeries() {
    $('seriesPick').classList.toggle('hidden', S.smode !== 'manual');
    $('smartHint').classList.toggle('hidden', S.smode !== 'smart');
    ['ROBI', 'AIRTEL'].forEach((b) => {
      const box = $('series' + b); box.innerHTML = '';
      document.querySelector(`.series-group[data-brand=${b}]`).classList.toggle('hidden', !S.ops[b]);
      const live = liveDigits(b);
      for (const d of '1234567890') {
        const btn = document.createElement('button'); btn.type = 'button';
        btn.textContent = toBn(OPS[b].code + d);
        btn.className = (S.manual[b].includes(d) ? 'on ' : '') + (live.has(d) ? 'live' : '');
        btn.onclick = () => { const a = S.manual[b]; const i = a.indexOf(d); i >= 0 ? a.splice(i, 1) : a.push(d); save(); renderSeries(); };
        box.appendChild(btn);
      }
    });
    const list = seriesList();
    $('seriesSummary').textContent = toBn(list.length) + 'টি সিরিজ';
  }
  function seriesList() {
    const out = [];
    for (const b of ['ROBI', 'AIRTEL']) {
      if (!S.ops[b]) continue;
      const hs = S.smode === 'smart' ? topHeads(b, b === 'ROBI' ? 8 : 5) : S.manual[b];
      hs.forEach((h) => out.push({ brand: b, head: h }));
    }
    return out;
  }

  /* ---------------- presets UI ---------------- */
  const PRESET_UI = [
    ['mix', '⭐ সেরা মিক্স', 'সব ভিআইপি একসাথে'],
    ['rep4', '৭৭৭৭', 'শেষে ৪টি একই'],
    ['rep5', '৭৭৭৭৭', '৫-৬টি একই'],
    ['zero', '০০০০ / ৫০০০', 'রাউন্ড নাম্বার'],
    ['asc', '১২৩৪', 'ক্রমিক (আরোহী)'],
    ['desc', '৯৮৭৬', 'উল্টো ক্রমিক'],
    ['mirror', '১২৩৩২১', 'আয়না / প্যালিনড্রোম'],
    ['abab', '১৮১৮', 'ABAB জোড়া'],
    ['aabb', '১১২২', 'AABB'],
    ['double', '২০২৫-২০২৫', 'ডাবল ব্লক'],
    ['lucky786', '…৭৮৬', 'লাকি ৭৮৬'],
    ['opcode', '০১৮-১৮১৮', 'অপারেটর কোড মিল'],
    ['birthday', '🎂 জন্মদিন', 'DDMMYY / সাল'],
    ['custom', '🛠 কাস্টম', 'নিজের প্যাটার্ন']
  ];
  const presetBox = $('presets');
  PRESET_UI.forEach(([k, big, small]) => {
    const l = document.createElement('label'); l.className = 'preset';
    l.innerHTML = `<input type="radio" name="preset" value="${k}" ${S.preset === k ? 'checked' : ''}/><span><b>${big}</b><small>${small}</small></span>`;
    l.querySelector('input').onchange = () => { S.preset = k; save(); syncPreset(); };
    presetBox.appendChild(l);
  });
  function digitChips(box, isOn, onTap, withAny) {
    box.innerHTML = '';
    const mk = (label, val) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.className = isOn(val) ? 'on' : ''; b.onclick = () => onTap(val); box.appendChild(b); };
    if (withAny) mk('যেকোনো', null);
    for (const d of '0123456789') mk(toBn(d), d);
  }
  function renderDigitChips() {
    digitChips($('digitChips'), (v) => S.digit === v, (v) => { S.digit = v; save(); renderDigitChips(); }, true);
    $('avoidChips').classList.add('avoid');
    digitChips($('avoidChips'), (v) => S.avoid.includes(v), (v) => { const i = S.avoid.indexOf(v); i >= 0 ? S.avoid.splice(i, 1) : S.avoid.push(v); save(); renderDigitChips(); }, false);
  }
  function syncPreset() {
    $('digitField').classList.toggle('hidden', !['rep4', 'rep5'].includes(S.preset));
    $('bdayField').classList.toggle('hidden', S.preset !== 'birthday');
    $('customField').classList.toggle('hidden', S.preset !== 'custom');
    if (S.preset === 'custom') renderPatternPreview();
    if (S.preset === 'birthday') renderBday();
  }
  // birthday
  $('bdayInput').value = S.bday || '';
  $('bdayInput').oninput = () => { S.bday = $('bdayInput').value; save(); renderBday(); };
  document.querySelectorAll('input[name=bfmt]').forEach((r) => { r.checked = r.value === S.bfmt; r.onchange = () => { S.bfmt = r.value; save(); renderBday(); }; });
  function bdayObj() { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(S.bday || ''); return m ? { yyyy: m[1], mm: m[2], dd: m[3], fmt: S.bfmt } : null; }
  function renderBday() { const b = bdayObj(); $('bdayPreview').textContent = b ? 'খোঁজা হবে নাম্বারের শেষে: ' + V.bdayStrings(b).map(toBn).join(' · ') : 'তারিখ বেছে নিন'; }
  // custom pattern
  $('patternInput').value = S.custom;
  $('patternInput').oninput = () => { S.custom = $('patternInput').value; save(); renderPatternPreview(); };
  document.querySelectorAll('code[data-p]').forEach((c) => (c.onclick = () => { $('patternInput').value = S.custom = c.dataset.p; save(); renderPatternPreview(); }));
  function renderPatternPreview() {
    const box = $('patternPreview'); const p = V.parsePattern(S.custom);
    if (!p.ok) { box.innerHTML = `<span class="err">${p.error}</span>`; return; }
    const cells = ['0', '1', '৮/৬'].map((c) => `<span class="cell op">${toBn(c)}</span>`).join('');
    box.innerHTML = cells + p.tokens.map((t) => `<span class="cell ${/\d/.test(t) ? 'fix' : t === '*' ? '' : 'var'}">${/\d/.test(t) ? toBn(t) : t}</span>`).join('');
  }
  // advanced
  $('mustInput').value = toBn(S.must || '');
  $('mustInput').oninput = () => { S.must = toEn($('mustInput').value).replace(/\D/g, ''); save(); };
  $('budgetSel').value = String(S.budget); $('budgetSel').onchange = () => { S.budget = +$('budgetSel').value; save(); };
  $('bonusChk').checked = S.bonus; $('bonusChk').onchange = () => { S.bonus = $('bonusChk').checked; save(); };

  /* ---------------- results & favorites ---------------- */
  const results = new Map(); // msisdn -> item
  let favs = LS.get('vnf-favs-v1', []);
  const isFav = (m) => favs.some((f) => f.msisdn === m);
  function toggleFav(item) {
    const i = favs.findIndex((f) => f.msisdn === item.msisdn);
    if (i >= 0) favs.splice(i, 1); else favs.unshift({ ...item, at: Date.now() });
    LS.set('vnf-favs-v1', favs); toast(i >= 0 ? 'পছন্দ থেকে সরানো হয়েছে' : 'পছন্দে যোগ হয়েছে ⭐'); scheduleRender();
  }
  let view = { tab: 'found', tier: 'all', op: 'all', sort: 'score', q: '' };
  document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b)); view.tab = b.dataset.tab; scheduleRender();
  }));
  document.querySelectorAll('#tierFilter button').forEach((b) => (b.onclick = () => {
    document.querySelectorAll('#tierFilter button').forEach((x) => x.classList.toggle('on', x === b)); view.tier = b.dataset.tier; scheduleRender();
  }));
  $('opFilter').onchange = () => { view.op = $('opFilter').value; scheduleRender(); };
  $('sortSel').onchange = () => { view.sort = $('sortSel').value; scheduleRender(); };
  $('searchBox').oninput = () => { view.q = toEn($('searchBox').value).replace(/\D/g, ''); scheduleRender(); };

  function currentItems() {
    let arr = view.tab === 'favs' ? favs.slice() : [...results.values()];
    if (view.tier !== 'all') arr = arr.filter((x) => x.tier === view.tier);
    if (view.op !== 'all') arr = arr.filter((x) => x.brand === view.op);
    if (view.q) arr = arr.filter((x) => V.localOf(x.msisdn).includes(view.q));
    const cmp = { score: (a, b) => b.score - a.score || a.msisdn.localeCompare(b.msisdn), new: (a, b) => b.at - a.at, num: (a, b) => a.msisdn.localeCompare(b.msisdn) }[view.sort];
    return arr.sort(cmp);
  }
  function numHtml(item) {
    const p = V.pretty(item.msisdn); // 01825-222-252
    if (item.tier === 'normal') return toBn(p);
    // emphasise the last 4 digits (where VIP patterns live)
    let cnt = 0, i = p.length;
    while (i > 0 && cnt < 4) { i--; if (/\d/.test(p[i])) cnt++; }
    return toBn(p.slice(0, i)) + '<em>' + toBn(p.slice(i)) + '</em>';
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function card(item) {
    const T = TIERS[item.tier];
    const el = document.createElement('div');
    el.className = 'item ' + item.tier;
    const top = item.reasons && item.reasons[0] ? item.reasons[0].why : 'সাধারণ নাম্বার';
    el.innerHTML = `<div>
        <div class="num">${numHtml(item)}</div>
        <div class="meta">
          <span class="badge t-${item.tier}">${T.icon} ${T.label} · ${toBn(item.score)}</span>
          <span class="badge ${item.brand}">${OPS[item.brand].short}</span>
          ${item.src === 'bonus' ? '<span class="badge bonus">সাজেশন</span>' : ''}
          ${item.gone ? '<span class="badge gone">বিক্রি হয়ে গেছে</span>' : ''}
          <span class="badge why" data-a="why">কেন? ›</span>
        </div>
        <div class="reason">${esc(top)}</div>
      </div>
      <div class="acts">
        <button class="buy" data-a="buy" type="button" title="অফিসিয়াল সাইটে কিনুন">কিনুন</button>
        <button data-a="copy" type="button" title="কপি">📋</button>
        <button data-a="share" type="button" title="শেয়ার">📤</button>
        <button data-a="verify" type="button" title="আবার যাচাই">🔄</button>
        <button class="fav ${isFav(item.msisdn) ? 'on' : ''}" data-a="fav" type="button" title="পছন্দ">⭐</button>
      </div>`;
    el.onclick = (e) => { const a = e.target.closest('[data-a]'); if (a) actions[a.dataset.a](item, a); };
    return el;
  }
  let renderQueued = false;
  function scheduleRender() { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } }
  function render() {
    renderQueued = false;
    $('cFound').textContent = toBn(results.size); $('cFavs').textContent = toBn(favs.length);
    const list = $('list'); const items = currentItems();
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = `<div class="empty">${view.tab === 'favs' ? 'পছন্দের তালিকা খালি — নাম্বারের পাশে ⭐ চাপুন।' : (results.size ? 'এই ফিল্টারে কিছু নেই।' : 'একটি ভিআইপি প্যাটার্ন বেছে <b>খুঁজুন</b> চাপুন। শুধু খালি থাকা নাম্বারই এখানে আসবে।')}</div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    items.slice(0, 400).forEach((it) => frag.appendChild(card(it)));
    list.appendChild(frag);
  }

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); return ok; }
  }
  function shareText(item) { return `ভিআইপি নাম্বার ${V.pretty(item.msisdn)} (${OPS[item.brand].label}, ${TIERS[item.tier].label}) — অফিসিয়াল সাইটে কিনুন: ${OPS[item.brand].buy}`; }
  const actions = {
    async buy(item) {
      const ok = await copyText(V.localOf(item.msisdn));
      toast(ok ? 'নাম্বার কপি হয়েছে — অফিসিয়াল পেজে পেস্ট করুন' : 'নাম্বারটি মনে রাখুন: ' + toBn(V.localOf(item.msisdn)));
      window.open(OPS[item.brand].buy, '_blank', 'noopener');
    },
    async copy(item) { toast((await copyText(V.localOf(item.msisdn))) ? 'কপি হয়েছে: ' + toBn(V.localOf(item.msisdn)) : 'কপি করা যায়নি'); },
    async share(item) {
      const text = shareText(item);
      if (navigator.share) { try { await navigator.share({ title: 'ভিআইপি নাম্বার', text }); } catch {} }
      else toast((await copyText(text)) ? 'শেয়ার টেক্সট কপি হয়েছে' : 'কপি করা যায়নি');
    },
    fav(item) { toggleFav(item); },
    why(item) { showWhy(item); },
    async verify(item, btn) {
      btn.disabled = true; btn.textContent = '⏳';
      try {
        const d = await callApi(item.msisdn, item.brand);
        item.gone = d.available !== true;
        const f = favs.find((x) => x.msisdn === item.msisdn); if (f) { f.gone = item.gone; LS.set('vnf-favs-v1', favs); }
        const r = results.get(item.msisdn); if (r) r.gone = item.gone;
        toast(item.gone ? 'দুঃখিত, নাম্বারটি আর খালি নেই' : '✅ এখনো খালি আছে — দ্রুত কিনুন');
      } catch (e) { toast('যাচাই করা যায়নি: ' + e.message); }
      scheduleRender();
    }
  };
  function showWhy(item) {
    $('whyTitle').innerHTML = numHtml(item);
    const rows = (item.reasons || []).map((r) => `<div class="why-row"><span>${esc(r.why)}</span><b>+${toBn(r.p)}</b></div>`).join('') || '<p class="muted">কোনো বিশেষ প্যাটার্ন নেই।</p>';
    $('whyContent').innerHTML = rows + `<div class="why-total"><span>মোট স্কোর (সর্বোচ্চ ১০০)</span><span>${TIERS[item.tier].icon} ${toBn(item.score)} · ${TIERS[item.tier].label}</span></div>
      <p class="hint">টিয়ার: 💎 ডায়মন্ড ৭০+ · 🥇 গোল্ড ৪৫+ · 🥈 সিলভার ২২+</p>`;
    $('whySheet').classList.remove('hidden');
  }
  $('whyClose').onclick = () => $('whySheet').classList.add('hidden');
  $('whySheet').onclick = (e) => { if (e.target.id === 'whySheet') $('whySheet').classList.add('hidden'); };

  // export
  $('copyAllBtn').onclick = async () => { const it = currentItems(); if (!it.length) return toast('কপি করার মতো কিছু নেই'); toast((await copyText(it.map((x) => V.localOf(x.msisdn)).join('\n'))) ? toBn(it.length) + 'টি নাম্বার কপি হয়েছে' : 'কপি করা যায়নি'); };
  $('shareAllBtn').onclick = async () => {
    const it = currentItems().slice(0, 20); if (!it.length) return toast('শেয়ার করার মতো কিছু নেই');
    const text = 'খালি ভিআইপি নাম্বার:\n' + it.map((x) => `${V.pretty(x.msisdn)} ${TIERS[x.tier].icon}`).join('\n');
    if (navigator.share) { try { await navigator.share({ title: 'ভিআইপি নাম্বার', text }); } catch {} } else toast((await copyText(text)) ? 'কপি হয়েছে' : 'কপি করা যায়নি');
  };
  $('csvBtn').onclick = () => {
    const it = currentItems(); if (!it.length) return toast('ডাউনলোড করার মতো কিছু নেই');
    const rows = [['number', 'operator', 'score', 'tier', 'why', 'buy_url']].concat(it.map((x) => [V.localOf(x.msisdn), x.brand, x.score, x.tier, (x.reasons || []).map((r) => r.why).join('; '), OPS[x.brand].buy]));
    const csv = '\ufeff' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'vip-numbers.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('clearBtn').onclick = () => { if (view.tab === 'favs') { if (confirm('সব পছন্দ মুছবেন?')) { favs = []; LS.set('vnf-favs-v1', favs); } } else results.clear(); scheduleRender(); };

  /* ---------------- API ---------------- */
  let pauseUntil = 0, backoff = 0, stopCtrl = null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function callApi(msisdn, brand) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const wait = pauseUntil - Date.now(); if (wait > 0) await sleep(wait);
      if (stopCtrl && stopCtrl.signal.aborted) throw new DOMException('stopped', 'AbortError');
      const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
      const onStop = () => ctrl.abort(); if (stopCtrl) stopCtrl.signal.addEventListener('abort', onStop, { once: true });
      try {
        const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msisdn, brand, simCategory: 'PREPAID' }), signal: ctrl.signal, cache: 'no-store' });
        if (res.status === 429 || res.status >= 500) {
          backoff = Math.min(30000, backoff ? backoff * 2 : 2000); pauseUntil = Date.now() + backoff;
          setStatus(res.status === 429 ? 'ধীরে…' : 'সার্ভার ব্যস্ত'); continue;
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        backoff = Math.max(0, backoff / 2 | 0);
        return await res.json();
      } catch (e) {
        if (stopCtrl && stopCtrl.signal.aborted) throw new DOMException('stopped', 'AbortError');
        if (attempt === 3) throw e.name === 'AbortError' ? new Error('সময় শেষ') : e;
        await sleep(800 * (attempt + 1));
      } finally { clearTimeout(tm); if (stopCtrl) stopCtrl.signal.removeEventListener('abort', onStop); }
    }
    throw new Error('অনেক অনুরোধ — একটু পরে চেষ্টা করুন');
  }

  /* ---------------- search engine ---------------- */
  let running = false;
  const triedLS = LS.get('vnf-tried-v1', {}); // key -> ts (unavailable), kept 12h
  (function prune() { const cut = Date.now() - 12 * 3600e3; for (const k in triedLS) if (triedLS[k] < cut) delete triedLS[k]; })();
  function setStatus(t) { $('sStatus').textContent = t; }

  function addResult(msisdn, src, extra) {
    if (results.has(msisdn)) return false;
    const brand = V.brandOf(msisdn);
    const item = { msisdn, brand, sub: V.subOf(msisdn), ...V.score(msisdn, extra), src, at: Date.now() };
    results.set(msisdn, item); scheduleRender(); return true;
  }

  async function runSearch() {
    const series = seriesList();
    if (!series.length) return toast('অন্তত একটি অপারেটর/সিরিজ বাছাই করুন');
    let custom = null;
    if (S.preset === 'custom') {
      const p = V.parsePattern(S.custom); if (!p.ok) { toast(p.error); return; }
      custom = p.tokens;
      if (p.opHint) for (let i = series.length - 1; i >= 0; i--) if (series[i].brand !== p.opHint) series.splice(i, 1);
      // custom pattern with fixed leading digits -> restrict/override heads
      const fixedLead = (p.tokens.join('').match(/^\d+/) || [''])[0];
      if (fixedLead) {
        const brands = [...new Set(series.map((s) => s.brand))]; series.length = 0;
        brands.forEach((b) => series.push({ brand: b, head: fixedLead.slice(0, 2) }));
      }
    }
    const bday = S.preset === 'birthday' ? bdayObj() : null;
    if (S.preset === 'birthday' && (!bday || !V.bdayStrings(bday).length)) return toast('জন্মতারিখ বেছে নিন');
    const extra = bday ? { bday: V.bdayStrings(bday) } : null;
    const presets = V.makePresets({ digit: S.digit, bday: bday || {}, custom });
    const P = presets[S.preset];
    const filters = { avoid: S.avoid, must: S.must };
    const budget = S.budget;

    running = true; stopCtrl = new AbortController();
    $('startBtn').disabled = true; $('startBtn').textContent = '⏳ খোঁজা চলছে…'; $('stopBtn').classList.remove('hidden');
    setStatus('চলছে');
    const seen = new Set(Object.keys(triedLS));
    const perSeries = new Map(series.map((s) => [s.brand + s.head, { c: 0, f: 0, s }]));
    let checked = 0, foundNow = 0, errors = 0, consecErr = 0, queue = [], empties = 0;
    const t0 = Date.now();
    const updateUI = () => {
      $('sChecked').textContent = toBn(checked); $('sFound').textContent = toBn(foundNow);
      const secs = (Date.now() - t0) / 1000; $('sRate').textContent = secs > 2 ? toBn((checked / secs).toFixed(1)) : '–';
      $('bar').style.width = Math.min(100, (checked / budget) * 100) + '%';
      $('seriesLive').innerHTML = [...perSeries.values()].map((x) => `<span class="${x.f ? 'hit' : ''}">${toBn(OPS[x.s.brand].code + x.s.head)} · 🔍${toBn(x.c)} · ✅${toBn(x.f)}</span>`).join('');
    };
    updateUI();
    const refill = () => {
      if (queue.length > 6) return;
      const b = V.buildBatch({ preset: S.preset, presets, seriesList: series, size: 60, seen, filters, extra });
      b.forEach((x) => seen.add(x.brand + '|' + x.sub));
      if (!b.length) empties++; else empties = 0;
      queue = queue.concat(b).sort((a, c) => c.score - a.score);
    };
    let issued = 0;
    const worker = async () => {
      while (running && issued < budget) {
        refill();
        const c = queue.shift();
        if (!c) { if (empties > 2) break; continue; }
        issued++;
        const ps = perSeries.get(c.brand + c.series.head);
        try {
          const d = await callApi(c.msisdn, c.brand);
          checked++; consecErr = 0; if (ps) ps.c++;
          if (d.available === true) { if (addResult(c.msisdn, 'check', extra)) { foundNow++; if (ps) ps.f++; learnHead(c.msisdn); } }
          else triedLS[c.brand + '|' + c.sub] = Date.now();
          for (const n of d.freeMsisdnList || []) {
            const s = String(n); if (!/^880(18|16)\d{8}$/.test(s)) continue;
            learnHead(s);
            const b = V.brandOf(s); if (!S.ops[b]) continue;
            const sub = V.subOf(s), code = OPS[b].code.slice(1);
            if (P.test(sub, code) && V.passFilters(sub, filters)) { if (addResult(s, 'check', extra)) foundNow++; }
            else if (S.bonus && V.score(s).score >= 22 && V.passFilters(sub, filters)) addResult(s, 'bonus');
          }
        } catch (e) {
          if (e.name === 'AbortError') break;
          checked++; errors++; consecErr++;
          if (consecErr >= 6) { toast('সার্ভারের সাথে যোগাযোগ হচ্ছে না (' + e.message + ') — ইন্টারনেট দেখে আবার চেষ্টা করুন'); running = false; break; }
        }
        updateUI();
        if (running) await sleep(GAP_MS + Math.random() * 150);
      }
    };
    try { await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => sleep(i * 200).then(worker))); }
    finally {
      const stoppedByUser = stopCtrl.signal.aborted;
      running = false; stopCtrl = null;
      $('startBtn').disabled = false; $('startBtn').textContent = '🔍 আবার খুঁজুন'; $('stopBtn').classList.add('hidden');
      $('bar').style.width = '100%';
      setStatus(stoppedByUser ? 'থামানো' : 'সম্পন্ন');
      saveHeads(); LS.set('vnf-tried-v1', triedLS); renderSeries(); updateUI();
      toast(foundNow ? `🎉 ${toBn(foundNow)}টি খালি ভিআইপি নাম্বার পাওয়া গেছে!` : (empties > 2 ? 'এই প্যাটার্নের সব সম্ভাব্য নাম্বার দেখা শেষ' : 'এবার মিলেনি — আবার খুঁজুন বা অন্য প্যাটার্ন বাছুন'));
    }
  }
  $('startBtn').onclick = () => { if (!running) runSearch(); };
  $('stopBtn').onclick = () => { if (stopCtrl) { stopCtrl.abort(); running = false; setStatus('থামানো হচ্ছে…'); } };

  /* ---------------- PWA ---------------- */
  let deferred = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('installBtn').classList.remove('hidden'); });
  $('installBtn').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; $('installBtn').classList.add('hidden'); };
  if ('serviceWorker' in navigator && location.protocol !== 'file:') addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

  window.VNF = { addResult, showWhy, results }; // small hook for testing/debugging
  renderSeries(); renderDigitChips(); syncPreset(); render();
})();
