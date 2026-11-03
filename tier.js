/* v9 Tier search: one tap "💎 Diamond / 🥇 Gold / 💜 Premium খুঁজুন".
   Generates candidate numbers of that tier (or better) inside the chosen code, checks each one with the
   official Robi availability API (polite: 3 lanes, ~0.6 s gap, shared back-off, hard request budget) and
   shows ONLY numbers the API reports as available. Nothing is invented. */
(() => {
  'use strict';
  const V = window.VIP, $ = (id) => document.getElementById(id);
  const BUDGET = 240, LANES = 3, GAP_MS = 550; // BUDGET applies only to 10/20/50; 'সীমাহীন' (value 0) has no cap
  const bnD = '০১২৩৪৫৬৭৮৯';
  const en = (s) => String(s || '').replace(/[০-৯]/g, (c) => bnD.indexOf(c));
  const L = () => (window.VNF && VNF.lang() === 'en' ? 'en' : 'bn');
  const num = (n) => { const s = Number(n).toLocaleString('en-US'); return L() === 'bn' ? s.replace(/\d/g, (d) => bnD[d]) : s; };
  const TX = {
    bn: { title: '👑 ক্যাটাগরি অনুযায়ী ভিআইপি খুঁজুন', hint: 'এক চাপে ডায়মন্ড, গোল্ড বা প্রিমিয়াম নাম্বার খুঁজুন — রবি সার্ভারে যাচাই করে শুধু খালি নাম্বারগুলোই দেখাবে (ওই ক্যাটাগরি ও তার উপরের)। ভিআইপি নাম্বার খুব কম খালি থাকে, তাই না পেলে আবার চাপুন — আগে যাচাই করা নাম্বার ১২ ঘণ্টা বাদ যায়, প্রতিবার নতুন নাম্বার দেখা হয়।',
      code: 'কোড (ঐচ্ছিক)', want: 'কতগুলো', unl: 'সীমাহীন', find: (t) => `${t} খুঁজুন`, stop: '⏹ বন্ধ করুন', andUp: (t) => `${t} ও উপরে`,
      ex: { diamond: '৭৭৭৭৭৭\n১২৩৪৫৬৭', gold: '৭৭৭৭৭\n১২১২১২', premium: '৭৭৭৭ · ১১২২\n১২৩৪ · ৭৮৬' },
      e_code: 'কোড ০১৮ (রবি) বা ০১৬ (এয়ারটেল) দিয়ে শুরু করুন, যেমন 01815', e_busy: 'আরেকটা খোঁজ চলছে — আগে সেটা বন্ধ করুন',
      scope: (op, h, u) => `${op}${h ? ' · কোড ' + h : ' · লাইভ সিরিজগুলোতে'} · ${u ? 'সীমাহীন — বন্ধ না করা পর্যন্ত চলবে' : 'সর্বোচ্চ ' + num(BUDGET) + 'টি যাচাই'}`,
      prog: (c, f, t) => `${num(c)} / ${num(BUDGET)} যাচাই · ${num(f)}টি খালি ${t} পাওয়া গেছে`,
      progU: (c, f) => `${num(c)} যাচাই · ${num(f)}টি পাওয়া গেছে`, paused: '⏸ ট্যাব লুকানো — ফিরে এলে আবার চলবে · ', wait: '⏳ নেটওয়ার্ক/সার্ভার সমস্যা — অপেক্ষা করে আবার চলবে · ',
      done: (c, f, t) => (f ? `✅ শেষ — ${num(c)}টি যাচাই করে ${num(f)}টি খালি ${t} পাওয়া গেছে` : `শেষ — ${num(c)}টি যাচাই, এবার খালি ${t} মেলেনি। আবার চাপুন বা অন্য কোড দিন।`),
      stopped: (c, f) => `থামানো হয়েছে — ${num(c)}টি যাচাই, ${num(f)}টি পাওয়া গেছে`, net: 'নেটওয়ার্ক সমস্যা — একটু পরে আবার চেষ্টা করুন',
      slow: '⏳ সার্ভার ব্যস্ত, ধীরে চলছে… ', rules: '📖 ক্যাটাগরির নিয়ম (Tier rules)', score: 'স্কোর',
      op: { ROBI: 'রবি ০১৮', AIRTEL: 'এয়ারটেল ০১৬' } },
    en: { title: '👑 Find VIP numbers by category', hint: 'One tap finds Diamond, Gold or Premium numbers — each one is checked with the Robi server and only AVAILABLE numbers of that tier (or better) are shown. Free VIP numbers are rare, so tap again if none turn up — numbers already checked are skipped for 12 h, so every tap checks new ones.',
      code: 'Code (optional)', want: 'How many', unl: 'Unlimited', find: (t) => `Find ${t}`, stop: '⏹ Stop', andUp: (t) => `${t} & up`,
      ex: { diamond: '777777\n1234567', gold: '77777\n121212', premium: '7777 · 1122\n1234 · 786' },
      e_code: 'Start with 018 (Robi) or 016 (Airtel), e.g. 01815', e_busy: 'Another search is running — stop it first',
      scope: (op, h, u) => `${op}${h ? ' · code ' + h : ' · live series'} · ${u ? 'unlimited — runs until you stop' : 'up to ' + num(BUDGET) + ' checks'}`,
      prog: (c, f, t) => `${num(c)} / ${num(BUDGET)} checked · ${num(f)} available ${t} found`,
      progU: (c, f) => `${num(c)} checked · ${num(f)} found`, paused: '⏸ Tab hidden — resumes when you return · ', wait: '⏳ Network/server problem — waiting, will resume · ',
      done: (c, f, t) => (f ? `✅ Done — checked ${num(c)}, found ${num(f)} available ${t}` : `Done — checked ${num(c)}, no available ${t} this time. Tap again or try another code.`),
      stopped: (c, f) => `Stopped — ${num(c)} checked, ${num(f)} found`, net: 'Network problem — please try again shortly',
      slow: '⏳ Server busy, slowing down… ', rules: '📖 Tier rules (ক্যাটাগরির নিয়ম)', score: 'score',
      op: { ROBI: 'Robi 018', AIRTEL: 'Airtel 016' } }
  };
  const t = (k, ...a) => { const v = TX[L()][k]; return typeof v === 'function' ? v(...a) : v; };
  const TN = (k) => (L() === 'en' ? V.TIER9[k].en : V.TIER9[k].bn);
  const TIERS = ['diamond', 'gold', 'premium'];
  let st = null;

  function parseCode() {
    const c = en($('txCode').value).replace(/\D/g, '').replace(/^88/, '');
    if (!c) return { brands: ['ROBI', 'AIRTEL'], head: '', code: '' };
    if (c.length < 3) return /^0?1?$/.test(c) ? { brands: ['ROBI', 'AIRTEL'], head: '', code: '' } : { err: 'e_code' };
    if (!/^01[68]/.test(c)) return { err: 'e_code' };
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
  function labels() {
    $('txTitle').textContent = t('title'); $('txHint').textContent = t('hint');
    $('txCodeL').textContent = t('code'); $('txWantL').textContent = t('want'); $('txWantU').textContent = t('unl'); $('txStop').textContent = t('stop');
    $('txRulesS').textContent = t('rules'); renderTiers(); renderRules(); info();
  }
  function info() {
    if (st) return;
    const p = parseCode(), el = $('txInfo'); el.className = 'ex-info';
    if (p.err) { el.textContent = t(p.err); el.classList.add('err'); return; }
    el.textContent = t('scope', p.brands.map((b) => t('op')[b]).join(' + '), p.code, +$('txWant').value === 0);
  }
  const exactRunning = () => !$('exStop').classList.contains('hidden');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function start(target) {
    if (st) return;
    if (exactRunning()) return VNF.toast(t('e_busy'));
    const p = parseCode(); if (p.err) { info(); $('txCode').focus(); return; }
    const unl = +$('txWant').value === 0;
    const want = unl ? Infinity : Math.max(1, Math.min(50, +$('txWant').value || 20)), budget = unl ? Infinity : BUDGET;
    const minRank = V.TIER9[target].rank, label = t('andUp', TN(target));
    // sources: the typed code, or the learned live 2-digit series of each operator
    const mkSrcs = (k) => {
      let srcs = p.head ? p.brands.map((b) => ({ brand: b, head: p.head })) : p.brands.flatMap((b) => VNF.topHeads(b, (b === 'ROBI' ? 6 : 4) * k).map((h) => ({ brand: b, head: h })));
      if (!srcs.length) srcs = p.brands.map((b) => ({ brand: b, head: '' }));
      srcs.forEach((s) => { s.intl = V.OPS[s.brand].intl; s.buf = []; s.empty = 0; s.done = false; s.exh = 8 - s.head.length <= 4; s.filled = false; });
      return srcs;
    };
    let srcs = mkSrcs(1), round = 1;
    st = { target, want, budget, unl, minRank, label, checked: 0, found: 0, stop: false, issued: new Set(), err: 0, net: false, rr: 0, t0: Date.now() };
    VNF.setGrp('+' + target); VNF.setSort('tier'); VNF.showFound();
    $('txStop').classList.remove('hidden'); $('txBarBox').classList.remove('hidden'); $('txBar').style.width = '0'; $('txBarBox').classList.toggle('indet', unl);
    document.body.classList.add('tier-running'); renderTiers(); draw();
    const skip = (s) => (sub) => st.issued.has(s.brand + sub) || VNF.isTried(s.brand, sub) || VNF.results.has(s.intl + sub);
    const take = () => {
      for (let guard = 0; guard < srcs.length * 3; guard++) {
        const live = srcs.filter((s) => !s.done); if (!live.length) return null;
        const s = live[st.rr++ % live.length];
        if (!s.buf.length) {
          if (s.exh && s.filled) { s.done = true; continue; }
          const c = V.tierCandidates({ head: s.head, target, n: 40, skip: skip(s), all: s.exh });
          s.filled = true;
          if (!c.length) { if (++s.empty >= 3 || s.exh) s.done = true; continue; }
          s.empty = 0; s.buf = c.map((x) => x.sub);
        }
        const sub = s.buf.shift(); if (skip(s)(sub)) continue;
        st.issued.add(s.brand + sub);
        return { s, sub, m: s.intl + sub };
      }
      return null;
    };
    const harvest = (d) => {
      for (const x of d.freeMsisdnList || []) {
        const m = String(x); if (!/^880(18|16)\d{8}$/.test(m)) continue;
        VNF.learnHead(m);
        const b = V.brandOf(m), sub = V.subOf(m);
        if (!p.brands.includes(b) || (p.head && !sub.startsWith(p.head))) continue;
        if (V.tierInfo(m).rank >= minRank && st.found < want && VNF.addResult(m, 'tier')) st.found++;
      }
    };
    const pauseHidden = async () => { while (document.hidden && !st.stop) { st.paused = true; draw(); await sleep(500); } if (st.paused) { st.paused = false; draw(); } };
    const lane = async () => {
      while (!st.stop && st.checked < budget && st.found < want) {
        await pauseHidden(); if (st.stop) break;
        let c = take();
        if (!c && unl && srcs.some((x) => !x.done)) { await sleep(50); continue; } // generator miss, sources still live
        if (!c && unl && round < 4) { srcs = mkSrcs(++round); c = take(); } // unlimited: widen to more live series before ending
        if (!c) break;
        try {
          const d = await VNF.callApi(c.m, c.s.brand);
          st.err = 0;
          if (d.available === true) { if (st.found < want && VNF.addResult(c.m, 'tier')) { st.found++; VNF.learnHead(c.m); } }
          else VNF.markTried(c.s.brand, c.sub);
          harvest(d);
        } catch (e) {
          if (unl) { // never give up: wait (growing, max 60 s) and resume; this number is not marked tried
            st.err++; st.issued.delete(c.s.brand + c.sub); c.s.buf.push(c.sub); st.waiting = true; draw();
            const until = Date.now() + Math.min(60000, 3000 * st.err);
            while (!st.stop && Date.now() < until) await sleep(250);
            st.waiting = false; draw(); continue;
          }
          if (++st.err >= 6) { st.net = true; st.stop = true; }
        }
        st.checked++; draw();
        if (!st.stop) await sleep(GAP_MS + Math.random() * 300);
      }
    };
    try { await Promise.all(Array.from({ length: LANES }, (_, i) => sleep(i * 250).then(lane))); }
    finally {
      const s = st; st = null;
      VNF.saveTried(); VNF.saveHeads(); VNF.setDone();
      $('txStop').classList.add('hidden'); $('txStop').textContent = t('stop'); $('txBarBox').classList.remove('indet'); $('txBar').style.width = '100%'; document.body.classList.remove('tier-running');
      $('txProg').textContent = s.net ? t('net') : s.stop ? t('stopped', s.checked, s.found) : t('done', s.checked, s.found, s.label);
      VNF.toast(s.net ? t('net') : s.stop ? t('stopped', s.checked, s.found) : t('done', s.checked, s.found, s.label));
      renderTiers(); info();
    }
  }
  function draw() {
    if (!st) return;
    if (st.unl) $('txProg').textContent = (st.paused ? t('paused') : st.waiting ? t('wait') : '') + t('progU', st.checked, st.found);
    else {
      $('txBar').style.width = Math.min(100, Math.max(st.checked / BUDGET, st.found / st.want) * 100).toFixed(1) + '%';
      $('txProg').textContent = t('prog', st.checked, st.found, st.label);
    }
    $('txInfo').textContent = '';
  }
  function stop() { if (st) { st.stop = true; $('txStop').textContent = '⏳'; } }
  $('txStop').onclick = stop;
  $('txCode').addEventListener('input', info);
  // v11: new key so everyone starts on 'সীমাহীন' (old v9 choice of 10/20/50 is ignored once)
  try { localStorage.removeItem('vnf-txwant'); const w = localStorage.getItem('vnf-txwant11'); if (w !== null && [...$('txWant').options].some((o) => o.value === w)) $('txWant').value = w; } catch {}
  $('txWant').onchange = () => { try { localStorage.setItem('vnf-txwant11', $('txWant').value); } catch {} info(); };
  new MutationObserver(labels).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  labels();
  window.VNF_TIER = { running: () => !!st, start, stop };
})();
