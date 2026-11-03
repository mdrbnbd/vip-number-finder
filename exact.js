/* v5 Exact Search: prefix + suffix (+ contains / X-wildcard) → check EVERY middle combination */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const MAX = 200000, KEY = 'vnf-exact-v1';
  const bnD = '০১২৩৪৫৬৭৮৯';
  const en = (s) => String(s || '').replace(/[০-৯]/g, (c) => bnD.indexOf(c));
  const L = () => (window.VNF && VNF.lang() === 'en' ? 'en' : 'bn');
  const num = (n) => { const s = Number(n).toLocaleString('en-US'); return L() === 'bn' ? s.replace(/\d/g, (d) => bnD[d]) : s; };
  const TX = {
    bn: { title: '🎯 নির্দিষ্ট নাম্বার খুঁজুন (সব কম্বিনেশন)', hint: 'শুরুর কোড আর শেষের সংখ্যা দিন — মাঝের প্রতিটা সম্ভাব্য সংখ্যা রবি সার্ভারে যাচাই হবে, শুধু খালিগুলো দেখাবে।',
      start: 'শুরু (কোড)', end: 'শেষে', more: '➕ প্যাটার্ন (ঐচ্ছিক)', mid: 'মাঝখানে থাকবে (ঐচ্ছিক)', pat: 'প্যাটার্ন, X = যেকোনো সংখ্যা (ঐচ্ছিক)',
      go: '🔍 সব যাচাই শুরু', resume: '▶ আগের জায়গা থেকে চালু', pause: '⏸ বিরতি', cont: '▶ চালু', stop: '⏹ বন্ধ',
      e_op: 'কোড ০১৮ (রবি) বা ০১৬ (এয়ারটেল) দিয়ে শুরু হতে হবে', e_len: 'মোট ১১ সংখ্যার বেশি হয়ে গেছে', e_empty: 'শুরুর কোড দিন, যেমন 018 বা 01766', e_mid: '"মাঝখানে" সংখ্যাটা খালি ঘরে বসে না',
      info: (op, n, eta) => `${op} · মোট ${n}টি কম্বিনেশন যাচাই হবে · আনুমানিক ${eta}`, big: (n) => `${n}টি কম্বিনেশন — অনেক বেশি (সীমা ২,০০,০০০)। আরও সংখ্যা দিয়ে ছোট করুন:`,
      prog: (c, t, f, r) => `${c} / ${t} যাচাই · ${f}টি খালি · ${r}/সেকেন্ড`, done: (t, f) => `✅ শেষ — ${t}টির সবগুলো যাচাই হয়েছে, ${f}টি খালি পাওয়া গেছে`, paused: 'বিরতিতে আছে', stopped: (c, f) => `থামানো হয়েছে — ${c}টি যাচাই, ${f}টি খালি। পরে আবার চালু করা যাবে।`,
      saved: (c, t) => `আগের খোঁজ সংরক্ষিত: ${c} / ${t}`, mC: '🛠 কাস্টমাইজ', mD: '👯 ডাবল', mT: '🔱 ট্রিপল', hC: 'শুরুর কোড আর শেষের সংখ্যা দিন — মাঝের প্রতিটা সম্ভাব্য সংখ্যা যাচাই হবে, শুধু আপনার কোডের খালি নাম্বার দেখাবে।', hD: 'শুধু আপনার কোডের সিরিজে ডাবল/জোড়া প্যাটার্ন (AABB, ABAB, AA·BB·CC) খুঁজবে।', hT: 'শুধু আপনার কোডের সিরিজে ট্রিপল/চারবার একই সংখ্যা (AAA, AAAA…) খুঁজবে।', e_code: 'কমপক্ষে ০১৮ বা ০১৬ সহ কোড দিন, যেমন 01815', pat2: 'প্যাটার্ন, X = যেকোনো সংখ্যা (ঐচ্ছিক)', s: 'সেকেন্ড', m: 'মিনিট', h: 'ঘণ্টা' },
    en: { title: '🎯 Exact search (every combination)', hint: 'Enter the starting code and the ending digits — every possible middle is checked with the Robi server, only AVAILABLE numbers are shown.',
      start: 'Starts with (code)', end: 'Ends with', more: '➕ Pattern (optional)', mid: 'Contains (optional)', pat: 'Pattern, X = any digit (optional)',
      go: '🔍 Check all', resume: '▶ Resume where I left off', pause: '⏸ Pause', cont: '▶ Resume', stop: '⏹ Stop',
      e_op: 'Code must start with 018 (Robi) or 016 (Airtel)', e_len: 'More than 11 digits in total', e_empty: 'Enter a starting code, e.g. 018 or 01766', e_mid: '"Contains" digits don’t fit in the free positions',
      info: (op, n, eta) => `${op} · ${n} combinations will be checked · ETA ~${eta}`, big: (n) => `${n} combinations — too many (limit 200,000). Narrow it down:`,
      prog: (c, t, f, r) => `${c} / ${t} checked · ${f} available · ${r}/s`, done: (t, f) => `✅ Done — all ${t} checked, ${f} available`, paused: 'Paused', stopped: (c, f) => `Stopped — ${c} checked, ${f} available. You can resume later.`,
      saved: (c, t) => `Saved search: ${c} / ${t}`, mC: '🛠 Customize', mD: '👯 Double', mT: '🔱 Triple', hC: 'Enter the starting code and the ending digits — every possible middle is checked, only available numbers in YOUR code are shown.', hD: 'Finds double/pair patterns (AABB, ABAB, AA·BB·CC) only inside your code series.', hT: 'Finds triple/quad repeats (AAA, AAAA…) only inside your code series.', e_code: 'Enter a code with 018 or 016, e.g. 01815', pat2: 'Pattern, X = any digit (optional)', s: 's', m: 'min', h: 'h' },
  };
  // v7: Grameenphone texts (generator only — never says "available")
  Object.assign(TX.bn, { g_title: '🎯 গ্রামীণফোন প্যাটার্ন নাম্বার (যাচাই নেই)', g_hC: 'শুরুর কোড (017… / 013…) আর শেষের সংখ্যা দিন — আপনার কোডের সিরিজে সব সম্ভাব্য নাম্বার তৈরি হবে। খালি কি না যাচাই করা হয় না।', g_hD: 'শুধু আপনার GP কোডের সিরিজে ডাবল/জোড়া প্যাটার্ন (AABB, ABAB, AA·BB·CC) তৈরি করবে — যাচাই নেই।', g_hT: 'শুধু আপনার GP কোডের সিরিজে ট্রিপল/চারবার একই সংখ্যা (AAA, AAAA…) তৈরি করবে — যাচাই নেই।',
    g_eop: 'GP কোড ০১৭ বা ০১৩ দিয়ে শুরু হতে হবে', g_ecode: 'কমপক্ষে ০১৭ বা ০১৩ সহ কোড দিন, যেমন 01711', g_info: (op, n) => `${op} · আপনার কোডে মোট ${n}টি সম্ভাব্য নাম্বার · যাচাই নেই`, g_go: '✨ ১০০টি নাম্বার তৈরি করুন', g_more: '✨ আরও ১০০টি তৈরি করুন',
    g_done: (a, sh, tot) => `✨ ${a}টি নতুন নাম্বার তৈরি হয়েছে (${tot}টির মধ্যে ${sh}টি দেখানো হয়েছে) · ⚠️ যাচাই নেই`, g_all: (tot) => `✅ আপনার কোডের সবগুলো (${tot}টি) সম্ভাব্য নাম্বার দেখানো হয়েছে · ⚠️ যাচাই নেই`,
    g_banner: '⚠️ <b>গ্রামীণফোনের কোনো পাবলিক “নাম্বার খালি আছে কি না” যাচাই ব্যবস্থা নেই।</b> এখানে শুধু আপনার কোডের সিরিজে প্যাটার্ন অনুযায়ী <b>সম্ভাব্য</b> নাম্বার তৈরি হয় — নাম্বারটি খালি কি না যাচাই করা হয়নি। কেনার আগে GP সেন্টার বা GP অনলাইন শপে কনফার্ম করুন।<br><small>Not checked: Grameenphone has no public availability check. These are pattern-generated possible numbers only — confirm at a GP centre or the GP online shop.</small>', g_shop: '🛒 GP অনলাইন সিম শপ', ph: '01711 / 013XX' });
  Object.assign(TX.en, { g_title: '🎯 Grameenphone pattern numbers (not checked)', g_hC: 'Enter your starting code (017… / 013…) and ending digits — every possible number in YOUR code series is generated. Availability is NOT checked.', g_hD: 'Generates double/pair patterns (AABB, ABAB, AA·BB·CC) only inside your GP code series — not checked.', g_hT: 'Generates triple/quad repeats (AAA, AAAA…) only inside your GP code series — not checked.',
    g_eop: 'GP code must start with 017 or 013', g_ecode: 'Enter a code with 017 or 013, e.g. 01711', g_info: (op, n) => `${op} · ${n} possible numbers in your code · not checked`, g_go: '✨ Generate 100 numbers', g_more: '✨ Generate 100 more',
    g_done: (a, sh, tot) => `✨ ${a} new numbers generated (${sh} of ${tot} shown) · ⚠️ not checked`, g_all: (tot) => `✅ All ${tot} possible numbers in your code are shown · ⚠️ not checked`,
    g_banner: '⚠️ <b>Grameenphone has no public availability check.</b> This only generates <b>possible</b> numbers in your code series by pattern — they are NOT checked. Confirm at a GP centre or the GP online shop before buying.<br><small>যাচাই নেই: এগুলো শুধু প্যাটার্ন অনুযায়ী তৈরি সম্ভাব্য নাম্বার — GP সেন্টারে কনফার্ম করুন।</small>', g_shop: '🛒 GP online SIM shop', ph: '01711 / 013XX' });
  const GPM = () => !!(window.VNF && VNF.net && VNF.net() === 'GP');
  const D3 = () => (GPM() ? ['7', '3'] : ['8', '6']);
  const tk = (k) => (GPM() && TX.bn['g_' + k] ? 'g_' + k : k);
  const t = (k, ...a) => { const v = TX[L()][k]; return typeof v === 'function' ? v(...a) : v; };
  const RATE = 4; // checks/s observed
  const eta = (n) => { const s = Math.ceil(n / RATE); return s < 90 ? num(s) + ' ' + t('s') : s < 5400 ? num(Math.ceil(s / 60)) + ' ' + t('m') : num((s / 3600).toFixed(1)) + ' ' + t('h'); };

  let mode = localStorage.getItem('vnf-exmode') || 'C';
  const isDouble = (x) => /(\d)\1(?!\1)(\d)\2/.test(x) || /(\d)(?!\1)(\d)\1\2/.test(x) || /(\d)\1.*(\d)\2.*(\d)\3/.test(x);
  const isTriple = (x) => /(\d)\1\1/.test(x);
  function codeOf() { return en($('exStart').value).replace(/\D/g, '').replace(/^88/, ''); }
  function spec() {
    if (mode === 'C') { const r = specC(); if (r.err) return r; r.get = (i) => { const loc = build(r.tpl, r.free, r.ops, i); return !r.mid || loc.slice(3).includes(r.mid) ? loc : null; }; r.code = r.tpl.join('').match(/^[^X]*/)[0]; r.ok = (loc) => loc.length === 11 && r.tpl.every((c, i) => c === 'X' || c === loc[i]) && (!r.mid || loc.slice(3).includes(r.mid)); r.key = 'C|' + r.key; return r; }
    const code = codeOf();
    if (!(GPM() ? /^01[37]/ : /^01[68]/).test(code)) return { err: code.length < 3 ? (GPM() ? 'g_ecode' : 'e_code') : (GPM() ? 'g_eop' : 'e_op') };
    if (code.length > 10) return { err: 'e_len' };
    const k = 11 - code.length, pred = mode === 'D' ? isDouble : isTriple, ops = [code[2]];
    const tpl = (code + 'X'.repeat(k)).split('');
    const key = (GPM() ? 'GP' : '') + mode + '|' + code;
    const ok = (loc) => loc.length === 11 && loc.startsWith(code) && pred(loc.slice(3));
    if (k > 7) return { err: null, tpl, ops, code, countable: true, total: MAX + 1, key, ok, big: true };
    if (cache.key !== key) {
      const list = []; const n = Math.pow(10, k);
      for (let i = 0; i < n; i++) { const loc = code + String(i).padStart(k, '0'); if (pred(loc.slice(3))) list.push(loc); }
      // nicest first: pattern at the end
      list.sort((a, b) => (pred(b.slice(-4)) ? 1 : 0) - (pred(a.slice(-4)) ? 1 : 0));
      cache.key = key; cache.list = list;
    }
    const list = cache.list;
    return { tpl, ops, code, countable: true, total: list.length, raw: list.length, get: (i) => list[i], key, ok };
  }
  const cache = { key: null, list: [] };
  /* build an 11-char template ('0','1',...,'X') */
  function specC() {
    const pat = en($('exPat').value).toUpperCase().replace(/[^0-9X?*]/g, '').replace(/[?*]/g, 'X');
    let tpl;
    if (pat) {
      if (pat.length > 11) return { err: 'e_len' };
      tpl = (pat + 'X'.repeat(11)).slice(0, 11).split('');
      const end = en($('exEnd').value).replace(/\D/g, '');
      if (end) { if (end.length > 11) return { err: 'e_len' }; for (let i = 0; i < end.length; i++) { const p = 11 - end.length + i; if (tpl[p] !== 'X' && tpl[p] !== end[i]) return { err: 'e_len' }; tpl[p] = end[i]; } }
    } else {
      const st = en($('exStart').value).replace(/\D/g, '').replace(/^88/, ''), end = en($('exEnd').value).replace(/\D/g, '');
      if (!st) return { err: 'e_empty' };
      if (st.length + end.length > 11) return { err: 'e_len' };
      tpl = (st + 'X'.repeat(11 - st.length - end.length) + end).split('');
    }
    const head = tpl.slice(0, 3).join('');
    if (!/^01[X68]$/.test(head) && !/^0X/.test(head) && head !== 'XXX') { if (!/^0?1?[68X]?/.test(head)) return { err: 'e_op' }; }
    tpl[0] = '0'; tpl[1] = '1';
    const d3 = D3(), eop = GPM() ? 'g_eop' : 'e_op';
    if (tpl[2] !== 'X' && !d3.includes(tpl[2])) return { err: eop };
    if (tpl.join('').slice(0, 2) !== '01') return { err: eop };
    const ops = tpl[2] === 'X' ? d3.slice() : [tpl[2]];
    const mid = en($('exMid').value).replace(/\D/g, '');
    const free = []; tpl.forEach((c, i) => { if (c === 'X' && i !== 2) free.push(i); });
    let total = ops.length * Math.pow(10, free.length), countable = true;
    if (mid) {
      // does mid fit anywhere?
      let fits = false;
      for (let p = 3; p + mid.length <= 11; p++) { let ok = true; for (let i = 0; i < mid.length; i++) { const c = tpl[p + i]; if (c !== 'X' && c !== mid[i]) { ok = false; break; } } if (ok) { fits = true; break; } }
      if (!fits) return { err: 'e_mid' };
      if (total <= 3e6) { let n = 0; for (let i = 0; i < total; i++) if (build(tpl, free, ops, i).slice(3).includes(mid)) n++; total = n; } else countable = false;
    }
    return { tpl, free, ops, mid, total, countable, key: (GPM() ? 'GP' : '') + tpl.join('') + '|' + mid, raw: ops.length * Math.pow(10, free.length) };
  }
  function build(tpl, free, ops, i) {
    const a = tpl.slice(); const per = Math.pow(10, free.length);
    a[2] = ops[Math.floor(i / per)]; let r = i % per;
    for (let k = free.length - 1; k >= 0; k--) { a[free[k]] = String(r % 10); r = Math.floor(r / 10); }
    return a.join('');
  }
  const OPL = { 8: ['রবি ০১৮', 'Robi 018'], 6: ['এয়ারটেল ০১৬', 'Airtel 016'], 7: ['জিপি ০১৭', 'GP 017'], 3: ['জিপি ০১৩', 'GP 013'] };
  const opLabel = (ops) => ops.map((o) => OPL[o][L() === 'bn' ? 0 : 1]).join(' + ');

  let st = null; // running state
  const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {} };

  function preview() {
    const s = spec(), info = $('exInfo'), go = $('exGo');
    $('exTpl').innerHTML = s.err ? '' : s.tpl.map((c, i) => (c === 'X' || (i === 2 && s.ops.length > 1) ? '<i>X</i>' : c)).join('').replace(/^(.{5})/, '$1 ');
    info.className = 'ex-info'; const old = $('exSug'); if (old) old.remove();
    if (st) return;
    if (s.err) { info.textContent = t(s.err); info.classList.add('err'); go.disabled = true; return; }
    if (!s.countable || s.total > MAX) {
      info.textContent = t('big', s.countable && !s.big ? num(s.total) : '> ' + num(MAX)); info.classList.add('err'); go.disabled = true;
      const box = document.createElement('div'); box.className = 'ex-sug'; box.id = 'exSug';
      const base = codeOf() || '01' + (s.ops[0] || '8');
      const sugg = base.length < 3 ? (GPM() ? ['017', '013'] : ['018', '016']) : base.length < 11 ? [0, 1, 2, 5, 7, 9].map((d) => base + d) : [];
      sugg.forEach((v) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = v + '…'; b.onclick = () => { $('exPat').value = ''; $('exStart').value = v; preview(); }; box.appendChild(b); });
      info.after(box); return;
    }
    if (GPM()) { info.textContent = t('g_info', opLabel(s.ops), num(s.total)); const fin = gp.key === s.key && gp.pos >= gp.list.length; go.disabled = !s.total || fin; go.textContent = gp.key === s.key && gp.pos > 0 ? t('g_more') : t('g_go'); if (gp.key !== s.key) $('exProg').textContent = ''; return; }
    if (!s.total) { info.textContent = t('info', opLabel(s.ops), num(0), eta(0)); go.disabled = true; return; }
    info.textContent = t('info', opLabel(s.ops), num(s.total), eta(s.total)); go.disabled = false;
    const sv = saved(); const can = !GPM() && sv && sv.key === s.key && sv.done < sv.total;
    go.textContent = can ? t('resume') : t('go');
    $('exProg').textContent = can ? t('saved', num(sv.done), num(sv.total)) : '';
  }

  /* v7 GP generator: no network at all — builds numbers in the user's code series, best VIP score first, 100 per tap */
  const gp = { key: null, list: [], pos: 0 };
  function generate(s) {
    const V = window.VIP;
    if (gp.key !== s.key) {
      let arr = []; for (let i = 0; i < s.raw; i++) { const loc = s.get(i); if (loc && s.ok(loc)) arr.push(loc); }
      if (arr.length <= MAX) arr = arr.map((l) => { const r = V.score('88' + l); return [l, r.vip != null ? r.vip : V.vipOf(r.score)]; }).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
      gp.key = s.key; gp.list = arr; gp.pos = 0;
    }
    const batch = [];
    while (gp.pos < gp.list.length && batch.length < 100) { const m = '88' + gp.list[gp.pos++]; if (!VNF.results.has(m)) batch.push(m); }
    VNF.showFound();
    // add worst→best so the best number of this batch ends up newest (on top)
    for (let i = batch.length - 1; i >= 0; i--) VNF.addResult(batch[i], 'exact');
    preview();
    $('exProg').textContent = gp.pos >= gp.list.length ? t('g_all', num(gp.list.length)) : t('g_done', num(batch.length), num(gp.pos), num(gp.list.length));
  }
  async function run() {
    const s = spec(); if (s.err || s.total > MAX || !s.countable || !s.total) return preview();
    if (GPM()) return generate(s);
    const sv = saved(); const resume = sv && sv.key === s.key && sv.done < sv.total;
    st = { s, next: resume ? sv.idx : 0, done: resume ? sv.done : 0, found: resume ? sv.found : [], paused: false, stop: false, inflight: new Set(), t0: Date.now(), d0: resume ? sv.done : 0, conc: 5, ok: 0, retry: [] };
        (st.found || []).forEach((m) => VNF.addResult(m, 'exact'));
    VNF.showFound();
    $('exGo').classList.add('hidden'); $('exPause').classList.remove('hidden'); $('exStop').classList.remove('hidden'); $('exBarBox').classList.remove('hidden');
    $('exPause').textContent = t('pause'); $('exStop').textContent = t('stop'); $('exInfo').textContent = t('info', opLabel(s.ops), num(s.total), eta(s.total - st.done));
    const persist = () => { const low = st.inflight.size ? Math.min(...st.inflight) : st.next; save({ key: s.key, idx: low, done: st.done, total: s.total, found: st.found }); };
    const nextIdx = () => { if (st.retry.length) return st.retry.shift(); while (st.next < s.raw) { const i = st.next++; const loc = s.get(i); if (loc) return [i, loc]; } return null; };
    let lastSave = 0;
    const worker = async (w) => {
      for (;;) {
        while (st.paused && !st.stop) await new Promise((r) => setTimeout(r, 300));
        if (st.stop || w >= st.conc) return;
        const n = nextIdx(); if (!n) return;
        const [i, loc] = n; st.inflight.add(i);
        const msisdn = '88' + loc, brand = loc[2] === '8' ? 'ROBI' : 'AIRTEL';
        try {
          const d = await VNF.callApi(msisdn, brand);
          if (d.available === true && VNF.addResult(msisdn, 'exact')) st.found.push(msisdn);
          for (const x of d.freeMsisdnList || []) { const m = String(x); if (/^880(18|16)\d{8}$/.test(m) && m !== msisdn && s.ok(m.slice(2)) && VNF.addResult(m, 'exact')) st.found.push(m); }
          if (++st.ok > 15 && st.conc < 10) { st.conc++; st.ok = 0; spawn(); }
        } catch (e) { st.conc = Math.max(2, st.conc >> 1); st.ok = 0; st.retry.push([i, loc]); st.inflight.delete(i); await new Promise((r) => setTimeout(r, 1500)); continue; }
        st.inflight.delete(i); st.done++;
        if (Date.now() - lastSave > 1500) { lastSave = Date.now(); persist(); }
        draw();
      }
    };
    let nW = 0; const pool = [];
    const spawn = () => { while (nW < st.conc) pool.push(worker(nW++)); };
    spawn();
    while (pool.length) { const p = pool.slice(); pool.length = 0; await Promise.all(p); }
    // retried indexes may remain if errors rewound next — loop again until exhausted
    while (!st.stop && st.done < s.total && (st.next < s.raw || st.retry.length)) { nW = 0; spawn(); while (pool.length) { const p = pool.slice(); pool.length = 0; await Promise.all(p); } }
    persist(); const fin = !st.stop;
    $('exProg').textContent = fin ? t('done', num(s.total), num(st.found.length)) : t('stopped', num(st.done), num(st.found.length));
    if (fin) $('exBar').style.width = '100%';
    st = null; $('exGo').classList.remove('hidden'); $('exPause').classList.add('hidden'); $('exStop').classList.add('hidden'); preview();
    if (fin) $('exProg').textContent = t('done', num(s.total), num((saved() || {}).found ? saved().found.length : 0));
  }
  function draw() {
    if (!st) return; const s = st.s; const sec = (Date.now() - st.t0) / 1000; const r = sec > 1 ? (st.done - st.d0) / sec : 0;
    $('exBar').style.width = (st.done / s.total * 100).toFixed(1) + '%';
    $('exProg').textContent = (st.paused ? t('paused') + ' · ' : '') + t('prog', num(st.done), num(s.total), num(st.found.length), num(r.toFixed(1)));
  }
  function labels() {
    const g = GPM();
    $('exTitle').textContent = t(g ? 'g_title' : 'title'); $('exHint').textContent = t(g ? 'g_h' + mode : 'h' + mode);
    $('gpBanner').classList.toggle('hidden', !g); $('gpBannerTxt').innerHTML = t('g_banner'); $('gpShop').textContent = t('g_shop');
    $('exStart').placeholder = g ? '01711 / 013XX' : '01766 / 018XX'; $('exPat').placeholder = g ? '0171X-XX5555' : '0176X-XX5555';
    document.querySelectorAll('#netSeg button').forEach((b) => { b.classList.toggle('on', b.dataset.net === (g ? 'GP' : 'ROBI')); b.setAttribute('aria-selected', b.dataset.net === (g ? 'GP' : 'ROBI')); });
    document.querySelectorAll('#exModes button').forEach((b) => { b.textContent = t('m' + b.dataset.m); b.classList.toggle('on', b.dataset.m === mode); b.setAttribute('aria-selected', b.dataset.m === mode); });
    $('exEndWrap').classList.toggle('hidden', mode !== 'C'); $('exMoreBox').classList.toggle('hidden', mode !== 'C');
    $('exStartL').textContent = t('start'); $('exEndL').textContent = t('end'); $('exMore').textContent = t('more'); $('exMidL').textContent = t('mid'); $('exPatL').textContent = t('pat');
    $('exGo').textContent = t('go'); preview();
  }
  /* v7 operator switch — inputs remembered per operator */
  const IN = ['exStart', 'exEnd', 'exMid', 'exPat'];
  const INK = (op) => 'vnf-exin-' + op;
  function setNet(op) {
    if (st || !window.VNF || VNF.net() === op) return;
    try { localStorage.setItem(INK(VNF.net()), JSON.stringify(IN.map((id) => $(id).value))); } catch {}
    VNF.setNet(op);
    let v = null; try { v = JSON.parse(localStorage.getItem(INK(op)) || 'null'); } catch {}
    IN.forEach((id, i) => ($(id).value = v ? v[i] || '' : id === 'exStart' ? (op === 'GP' ? '017' : '018') : ''));
    $('exProg').textContent = ''; $('exBarBox').classList.add('hidden'); labels();
  }
  document.querySelectorAll('#netSeg button').forEach((b) => (b.onclick = () => setNet(b.dataset.net)));
  ['exStart', 'exEnd', 'exMid', 'exPat'].forEach((id) => $(id).addEventListener('input', preview));
  $('exGo').onclick = run;
  document.querySelectorAll('#exModes button').forEach((b) => (b.onclick = () => { if (st) return; mode = b.dataset.m; localStorage.setItem('vnf-exmode', mode); labels(); }));
  $('exPause').onclick = () => { if (!st) return; st.paused = !st.paused; $('exPause').textContent = st.paused ? t('cont') : t('pause'); draw(); };
  $('exStop').onclick = () => { if (st) st.stop = true; };
  new MutationObserver(labels).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  const sv = saved();
  if (!GPM() && sv && sv.key && sv.done < sv.total) { const [tp, mid] = sv.key.split('|'); if (sv.key.startsWith('C|') && /X/.test(sv.key.split('|')[1])) { const tp2 = sv.key.split('|')[1]; $('exPat').value = tp2; $('exMid').value = sv.key.split('|')[2] || ''; } else if (sv.key[1] === '|' && sv.key[0] !== 'C') { mode = sv.key[0]; $('exStart').value = sv.key.split('|')[1]; } if (false) { $('exPat').value = tp; $('exMid').value = mid || ''; } }
  labels();
  window.VNF_EXACT = { spec, build, reset: () => { $('exProg').textContent = ''; $('exBar').style.width = '0'; $('exBarBox').classList.add('hidden'); preview(); } };
})();
