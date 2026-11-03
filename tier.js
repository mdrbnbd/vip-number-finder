/* v9 Tier search: one tap "💎 Diamond / 🥇 Gold / 💜 Premium খুঁজুন".
   Runs continuously (no check cap) until the user taps Stop/Pause or leaves the page; pauses while the tab is hidden.
   Generates candidate numbers of that tier (or better) inside the chosen code and checks each one with the official
   Robi availability API — politely: 3 lanes, 0.55–0.85 s gap per lane, shared back-off on 429/5xx, and its own
   exponential back-off (2 s → 60 s) on connection errors, then auto-resume. Shows ONLY numbers the API reports as available. */
(() => {
  'use strict';
  const V = window.VIP, $ = (id) => document.getElementById(id);
  const LANES = 3, GAP_MS = 550, GAP_JITTER = 300, BACK_MIN = 2000, BACK_MAX = 60000, REFRESH_EVERY = 150;
  const bnD = '০১২৩৪৫৬৭৮৯';
  const en = (s) => String(s || '').replace(/[০-৯]/g, (c) => bnD.indexOf(c));
  const L = () => (window.VNF && VNF.lang() === 'en' ? 'en' : 'bn');
  const num = (n) => { const s = Number(n).toLocaleString('en-US'); return L() === 'bn' ? s.replace(/\d/g, (d) => bnD[d]) : s; };
  const TX = {
    bn: { title: '👑 ক্যাটাগরি অনুযায়ী ভিআইপি খুঁজুন', hint: 'এক চাপে ডায়মন্ড, গোল্ড বা প্রিমিয়াম নাম্বার খুঁজুন — রবি সার্ভারে যাচাই করে শুধু খালি নাম্বারগুলোই দেখাবে (ওই ক্যাটাগরি ও তার উপরের)। খোঁজ সীমাহীন চলবে যতক্ষণ না আপনি থামান; ট্যাব লুকালে নিজে থেকে বিরতি নেয়। ভিআইপি নাম্বার খুব কম খালি থাকে, তাই একটু সময় দিন।',
      code: 'কোড (ঐচ্ছিক)', want: 'কতগুলো', find: (t) => `${t} খুঁজুন`, stop: '⏹ বন্ধ', pause: '⏸ বিরতি', cont: '▶ চালু', more: (t) => `▶ আরও খুঁজুন (${t})`, andUp: (t) => `${t} ও উপরে`,
      ex: { diamond: '৭৭৭৭৭৭\n১২৩৪৫৬৭', gold: '৭৭৭৭৭\n১২১২১২', premium: '৭৭৭৭ · ১১২২\n১২৩৪ · ৭৮৬' },
      e_code: 'কোড ০১৮ (রবি) বা ০১৬ (এয়ারটেল) দিয়ে শুরু করুন, যেমন 01815', e_busy: 'আরেকটা খোঁজ চলছে — আগে সেটা বন্ধ করুন',
      scope: (op, h) => `${op}${h ? ' · কোড ' + h : ' · লাইভ সিরিজগুলোতে'} · সীমাহীন খোঁজ (∞)`,
      checked: 'যাচাই', found: 'পাওয়া', rate: '/সেকেন্ড', running: '🔄 খুঁজছে…', paused: '⏸ বিরতিতে', hiddenP: '⏸ ট্যাব লুকানো — ফিরলে আবার চলবে',
      back: (s) => `⏳ সার্ভার/নেটওয়ার্ক ব্যস্ত — ${s} সেকেন্ড পরে নিজে থেকে আবার চলবে`,
      done: (c, f, t) => (f ? `✅ শেষ — ${num(c)}টি যাচাই, ${num(f)}টি খালি ${t}` : `শেষ — এই কোডের সব সম্ভাব্য ${t} যাচাই হয়েছে (${num(c)}টি), খালি মেলেনি। অন্য কোড দিন।`),
      reached: (f) => `✅ লক্ষ্য পূরণ — ${num(f)}টি পাওয়া গেছে`,
      stopped: (c, f) => `থামানো হয়েছে — ${num(c)}টি যাচাই, ${num(f)}টি পাওয়া গেছে। “আরও খুঁজুন” চাপলে যেখানে থেমেছিল সেখান থেকে চলবে।`,
      rules: '📖 ক্যাটাগরির নিয়ম (Tier rules)', score: 'স্কোর', op: { ROBI: 'রবি ০১৮', AIRTEL: 'এয়ারটেল ০১৬' } },
    en: { title: '👑 Find VIP numbers by category', hint: 'One tap finds Diamond, Gold or Premium numbers — each one is checked with the Robi server and only AVAILABLE numbers of that tier (or better) are shown. The search runs without limit until you stop it, and pauses by itself while the tab is hidden. Free VIP numbers are rare, so give it time.',
      code: 'Code (optional)', want: 'How many', find: (t) => `Find ${t}`, stop: '⏹ Stop', pause: '⏸ Pause', cont: '▶ Resume', more: (t) => `▶ Search more (${t})`, andUp: (t) => `${t} & up`,
      ex: { diamond: '777777\n1234567', gold: '77777\n121212', premium: '7777 · 1122\n1234 · 786' },
      e_code: 'Start with 018 (Robi) or 016 (Airtel), e.g. 01815', e_busy: 'Another search is running — stop it first',
      scope: (op, h) => `${op}${h ? ' · code ' + h : ' · live series'} · unlimited search (∞)`,
      checked: 'checked', found: 'found', rate: '/s', running: '🔄 Searching…', paused: '⏸ Paused', hiddenP: '⏸ Tab hidden — resumes when you come back',
      back: (s) => `⏳ Server/network busy — auto-resuming in ${s}s`,
      done: (c, f, t) => (f ? `✅ Done — ${num(c)} checked, ${num(f)} available ${t}` : `Done — every possible ${t} in this code was checked (${num(c)}), none available. Try another code.`),
      reached: (f) => `✅ Target reached — ${num(f)} found`,
      stopped: (c, f) => `Stopped — ${num(c)} checked, ${num(f)} found. “Search more” continues where it stopped.`,
      rules: '📖 Tier rules (ক্যাটাগরির নিয়ম)', score: 'score', op: { ROBI: 'Robi 018', AIRTEL: 'Airtel 016' } }
  };
  const t = (k, ...a) => { const v = TX[L()][k]; return typeof v === 'function' ? v(...a) : v; };
  const TN = (k) => (L() === 'en' ? V.TIER9[k].en : V.TIER9[k].bn);
  const TIERS = ['diamond', 'gold', 'premium'];
  let st = null;      // running session
  let last = null;    // last stopped session (for "Search more")

  function parseCode() {
    const c = en($('txCode').value).replace(/\D/g, '').replace(/^88/, '');
    if (!c || (c.length < 3 && /^0?1?$/.test(c))) return { brands: ['ROBI', 'AIRTEL'], head: '', code: '' };
    if (c.length < 3 || !/^01[68]/.test(c)) return { err: 'e_code' };
    return { brands: [c[2] === '8' ? 'ROBI' : 'AIRTEL'], head: c.slice(3, 9), code: c };
  }
  function renderTiers() {
    const box = $('txTiers'); box.innerHTML = '';
    TIERS.forEach((k) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tx-card tc-' + k + (st && st.target === k ? ' run' : '');
      b.dataset.tier = k; b.disabled = !!st && st.target !== k;
      b.innerHTML = `<span class="tx-ic">${V.TIER9[k].icon}</span><b>${t('find', TN(k))}</b><small>${t('ex')[k]}</small><em>${t('score')} ${num(V.TIER9[k].min)}–${num(V.TIER9[k].max)}</em>`;
      b.onclick = () => (st ? stop() : start(k));
      box.appendChild(b);
    });
  }
  function renderRules() {
    const other = L() === 'en' ? 'bn' : 'en';
    $('txRules').innerHTML = TIERS.map((k) => `<div class="tr-grp tc-${k}"><h4>${V.TIER9[k].icon} ${TN(k)} <small>${num(V.TIER9[k].min)}–${num(V.TIER9[k].max)}</small></h4><ul>`
      + V.TIER_RULES.filter((r) => r[0] === k).map((r) => `<li>${L() === 'en' ? r[3] : r[2]}<small>${other === 'en' ? r[3] : r[2]}</small></li>`).join('') + '</ul></div>').join('')
      + `<p class="hint">${L() === 'en' ? '▫️ Regular: no rule matched (score below 60). Rules look at the 8 digits after 018/016; the highest matching tier wins.' : '▫️ সাধারণ: কোনো নিয়মে মেলেনি (স্কোর ৬০-এর নিচে)। নিয়মগুলো ০১৮/০১৬ এর পরের ৮ অংক দেখে; সবচেয়ে উঁচু যে ক্যাটাগরিতে মেলে সেটাই ধরা হয়।'}</p>`;
  }
  function buttons() {
    const s = st;
    $('txPause').classList.toggle('hidden', !s); $('txStop').classList.toggle('hidden', !s);
    $('txPause').textContent = s && s.paused ? t('cont') : t('pause'); $('txStop').textContent = s && s.stop ? '⏳' : t('stop');
    const more = !s && last && !last.exhausted;
    $('txMore').classList.toggle('hidden', !more); if (more) $('txMore').textContent = t('more', t('andUp', TN(last.target)));
  }
  function labels() {
    $('txTitle').textContent = t('title'); $('txHint').textContent = t('hint');
    $('txCodeL').textContent = t('code'); $('txWantL').textContent = t('want');
    $('txRulesS').textContent = t('rules'); renderTiers(); renderRules(); buttons(); info(); draw();
  }
  function info() {
    if (st) return;
    const p = parseCode(), el = $('txInfo'); el.className = 'ex-info';
    if (p.err) { el.textContent = t(p.err); el.classList.add('err'); return; }
    el.textContent = t('scope', p.brands.map((b) => t('op')[b]).join(' + '), p.code);
  }
  const exactRunning = () => !$('exStop').classList.contains('hidden');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const halted = () => st.paused || document.hidden;

  function makeSession(target) {
    const p = parseCode(); if (p.err) return null;
    const want = Math.max(0, Math.min(1000, +$('txWant').value || 0)); // 0 = unlimited
    return { target, p, want, minRank: V.TIER9[target].rank, label: t('andUp', TN(target)), checked: 0, found: 0,
      byTier: { diamond: 0, gold: 0, premium: 0 }, issued: new Set(), srcs: [], srcKeys: new Set(), rr: 0, exhausted: false, active: 0, t0: Date.now(), c0: 0 };
  }
  function addSources(s) {
    const p = s.p;
    const list = p.head ? p.brands.map((b) => ({ brand: b, head: p.head })) : p.brands.flatMap((b) => VNF.topHeads(b, b === 'ROBI' ? 8 : 5).map((h) => ({ brand: b, head: h })));
    if (!list.length && !s.srcs.length) p.brands.forEach((b) => list.push({ brand: b, head: '' }));
    for (const x of list) {
      const k = x.brand + '|' + x.head; if (s.srcKeys.has(k)) continue;
      s.srcKeys.add(k); s.srcs.push({ ...x, intl: V.OPS[x.brand].intl, buf: [], empty: 0, done: false, exh: 8 - x.head.length <= 4, filled: false });
    }
  }

  async function start(target, resume) {
    if (st) return;
    if (exactRunning()) return VNF.toast(t('e_busy'));
    const s = resume && last && last.target === target ? last : makeSession(target);
    if (!s) { info(); $('txCode').focus(); return; }
    last = null; st = s; s.stop = false; s.paused = false; s.back = 0; s.backUntil = 0; s.t0 = Date.now(); s.c0 = s.checked;
    if (!s.srcs.length) addSources(s);
    const { p, minRank } = s;
    VNF.setGrp('+' + target); VNF.setSort('tier'); VNF.showFound();
    $('txBarBox').classList.remove('hidden'); $('txCount').classList.remove('hidden'); $('txInfo').textContent = '';
    document.body.classList.add('tier-running'); renderTiers(); buttons(); draw();
    const skip = (src) => (sub) => s.issued.has(src.brand + sub) || VNF.isTried(src.brand, sub) || VNF.results.has(src.intl + sub);
    const take = () => {
      for (let guard = 0; guard < s.srcs.length * 3 + 3; guard++) {
        const live = s.srcs.filter((x) => !x.done); if (!live.length) { s.exhausted = true; return null; }
        const src = live[s.rr++ % live.length];
        if (!src.buf.length) {
          if (src.exh && src.filled) { src.done = true; continue; }
          const c = V.tierCandidates({ head: src.head, target, n: 40, skip: skip(src), all: src.exh });
          src.filled = true;
          if (!c.length) { if (++src.empty >= 3 || src.exh) src.done = true; continue; }
          src.empty = 0; src.buf = c.map((x) => x.sub);
        }
        const sub = src.buf.shift(); if (skip(src)(sub)) continue;
        s.issued.add(src.brand + sub);
        return { src, sub, m: src.intl + sub };
      }
      return null;
    };
    const wantLeft = () => !s.want || s.found < s.want;
    const add = (m) => { if (!wantLeft()) return; if (VNF.addResult(m, 'tier')) { s.found++; const k = V.tierInfo(m).tier; if (s.byTier[k] != null) s.byTier[k]++; } };
    const harvest = (d) => {
      for (const x of d.freeMsisdnList || []) {
        const m = String(x); if (!/^880(18|16)\d{8}$/.test(m)) continue;
        VNF.learnHead(m);
        const b = V.brandOf(m), sub = V.subOf(m);
        if (!p.brands.includes(b) || (p.head && !sub.startsWith(p.head))) continue;
        if (V.tierInfo(m).rank >= minRank) add(m);
      }
    };
    const lane = async () => {
      while (!s.stop && wantLeft()) {
        while (!s.stop && (halted() || Date.now() < s.backUntil)) { draw(); await sleep(400); }
        if (s.stop) break;
        const c = take(); if (!c) break;
        try {
          const d = await VNF.callApi(c.m, c.src.brand);
          s.back = 0;
          if (d.available === true) { add(c.m); VNF.learnHead(c.m); } else VNF.markTried(c.src.brand, c.sub);
          harvest(d);
          s.checked++;
          if (s.checked % REFRESH_EVERY === 0) { if (!p.head) addSources(s); VNF.saveTried(); VNF.saveHeads(); }
        } catch (e) {
          // never give up: exponential back-off shared by all lanes, then retry the same number
          s.back = Math.min(BACK_MAX, s.back ? s.back * 2 : BACK_MIN);
          s.backUntil = Math.max(s.backUntil, Date.now() + s.back);
          s.issued.delete(c.src.brand + c.sub); c.src.buf.unshift(c.sub);
        }
        draw();
        if (!s.stop) await sleep(GAP_MS + Math.random() * GAP_JITTER);
      }
    };
    try { await Promise.all(Array.from({ length: LANES }, (_, i) => sleep(i * 250).then(lane))); }
    finally {
      st = null;
      VNF.saveTried(); VNF.saveHeads(); VNF.setDone();
      document.body.classList.remove('tier-running');
      const msg = s.stop ? t('stopped', s.checked, s.found) : !wantLeft() ? t('reached', s.found) : t('done', s.checked, s.found, s.label);
      $('txProg').textContent = msg; VNF.toast(msg);
      last = s.stop || !wantLeft() ? s : null; if (last && !wantLeft()) last.want = 0; // "Search more" continues without the target
      renderTiers(); buttons(); draw(s); info();
    }
  }
  function draw(fin) {
    const s = st || fin || last; const box = $('txCount');
    if (!s) { box.classList.add('hidden'); $('txBarBox').classList.add('hidden'); return; }
    const secs = (Date.now() - s.t0) / 1000, rate = st && secs > 3 ? (s.checked - s.c0) / secs : 0;
    const chip = (k) => (V.TIER9[k].rank >= s.minRank ? `<span class="tc tc-${k}">${V.TIER9[k].icon} ${TN(k)} <b>${num(s.byTier[k])}</b></span>` : '');
    box.innerHTML = `<span class="tc tc-all">🔍 ${t('checked')} <b>${num(s.checked)}</b></span>${chip('diamond')}${chip('gold')}${chip('premium')}`
      + (rate ? `<span class="tc tc-rate">${num(rate.toFixed(1))}${t('rate')}</span>` : '');
    const bar = $('txBarBox'); bar.classList.toggle('live', !!st && !st.paused && !document.hidden && Date.now() >= st.backUntil);
    if (st) {
      $('txProg').textContent = st.stop ? '⏳' : document.hidden ? t('hiddenP') : st.paused ? t('paused') : Date.now() < st.backUntil ? t('back', num(Math.ceil((st.backUntil - Date.now()) / 1000))) : t('running') + ' ' + st.label;
    }
  }
  function stop() { if (st) { st.stop = true; buttons(); } }
  $('txStop').onclick = stop;
  $('txPause').onclick = () => { if (!st) return; st.paused = !st.paused; buttons(); draw(); };
  $('txMore').onclick = () => { if (last) start(last.target, true); };
  document.addEventListener('visibilitychange', () => draw());
  $('txCode').addEventListener('input', () => { if (!st) last = null; buttons(); info(); });
  try { const w = localStorage.getItem('vnf-txwant9'); if (w != null) $('txWant').value = w; } catch {}
  $('txWant').onchange = () => { try { localStorage.setItem('vnf-txwant9', $('txWant').value); } catch {} };
  new MutationObserver(labels).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  labels();
  window.VNF_TIER = { running: () => !!st, start, stop, pause: () => st && (st.paused = true), state: () => st || last };
})();
