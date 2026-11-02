/* VIP Number Finder — pure logic (scoring, patterns, candidate generation).
   Works in the browser (window.VIP) and in Node (module.exports) for tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VIP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const OPS = {
    ROBI:   { code: '018', intl: '88018', label: 'রবি', short: 'রবি ০১৮', buy: 'https://www.robi.com.bd/bn/sim-services?requestType=NEW' },
    AIRTEL: { code: '016', intl: '88016', label: 'এয়ারটেল', short: 'এয়ারটেল ০১৬', buy: 'https://cirkle.digital/bn/sim-services?requestType=NEW' }
  };

  const BN = '০১২৩৪৫৬৭৮৯';
  const toBn = (s) => String(s).replace(/[0-9]/g, (d) => BN[d]);
  const toEn = (s) => String(s).replace(/[০-৯]/g, (d) => BN.indexOf(d));

  // msisdn helpers: intl 8801812345678 <-> local 01812345678 <-> sub 12345678
  const subOf = (msisdn) => String(msisdn).slice(-8);
  const localOf = (msisdn) => { const s = String(msisdn); return s.startsWith('880') ? '0' + s.slice(3) : s; };
  const brandOf = (msisdn) => (String(msisdn).startsWith('88016') ? 'AIRTEL' : 'ROBI');
  const pretty = (msisdn) => { const l = localOf(msisdn); return l.slice(0, 5) + '-' + l.slice(5, 8) + '-' + l.slice(8); };

  const rev = (s) => s.split('').reverse().join('');
  const ASC = '01234567890';
  const DESC = '98765432109';

  function trailingRun(s) { let n = 1; for (let i = s.length - 1; i > 0 && s[i] === s[i - 1]; i--) n++; return n; }
  function longestRun(s) { let best = 1, cur = 1; for (let i = 1; i < s.length; i++) { cur = s[i] === s[i - 1] ? cur + 1 : 1; if (cur > best) best = cur; } return best; }
  function trailingSeq(s, dir) {
    const ref = dir === 'asc' ? ASC : DESC; let n = 1;
    for (let i = s.length - 1; i > 0; i--) { if (ref.includes(s[i - 1] + s[i])) n++; else break; }
    return n;
  }
  function longestSeq(s, dir) {
    const ref = dir === 'asc' ? ASC : DESC; let best = 1, cur = 1;
    for (let i = 1; i < s.length; i++) { cur = ref.includes(s[i - 1] + s[i]) ? cur + 1 : 1; if (cur > best) best = cur; }
    return best;
  }

  /* Beauty score 0–100 with human-readable Bangla reasons. */
  function score(msisdn, extra) {
    const s = subOf(msisdn);
    const full = String(msisdn).slice(-10); // e.g. 1812345678
    const reasons = [];
    let pts = 0;
    const add = (p, why) => { pts += p; reasons.push({ p, why }); };

    // identical digits
    const tr = trailingRun(s), lr = longestRun(s);
    const runPts = { 3: 10, 4: 28, 5: 44, 6: 62, 7: 76, 8: 90 };
    if (tr >= 3) add(runPts[tr], `শেষে ${toBn(tr)}টি একই সংখ্যা (${toBn(s.slice(-tr))})`);
    else if (lr >= 4) add(Math.round(runPts[lr] * 0.6), `মাঝে ${toBn(lr)}টি একই সংখ্যা`);

    // sequences
    let seqDone = false;
    for (const dir of ['asc', 'desc']) {
      const t = trailingSeq(s, dir);
      const seqPts = { 3: 10, 4: 24, 5: 36, 6: 48, 7: 60, 8: 75 };
      if (t >= 3 && !seqDone) { add(seqPts[t], `শেষে ${dir === 'asc' ? 'ক্রমিক' : 'উল্টো ক্রমিক'} ${toBn(s.slice(-t))}`); seqDone = true; }
    }
    if (!seqDone) {
      const l = Math.max(longestSeq(s, 'asc'), longestSeq(s, 'desc'));
      if (l >= 4) add(l * 3, `মাঝে ${toBn(l)} অংকের ক্রমিক সংখ্যা`);
    }

    // repeated blocks
    const l4 = s.slice(-4), l6 = s.slice(-6);
    if (s.slice(0, 4) === s.slice(4) && longestRun(s) < 4) add(42, `ডাবল ব্লক ${toBn(s.slice(0, 4))}-${toBn(s.slice(4))}`);
    else if (l6.slice(0, 3) === l6.slice(3) && trailingRun(l6) < 3) add(24, `ABCABC (${toBn(l6)})`);
    if (/^(\d)(\d)(\1\2)+$/.test(s) && s[0] !== s[1]) add(55, `পুরোটা জোড়া প্যাটার্ন (${toBn(s.slice(0, 2))}×৪)`);
    else if (/(\d)(\d)\1\2\1\2$/.test(s) && l6[0] !== l6[1]) add(34, `শেষে ABABAB (${toBn(l6)})`);
    else if (/(\d)(\d)\1\2$/.test(s) && l4[0] !== l4[1]) add(18, `শেষে ABAB (${toBn(l4)})`);
    if (/(\d)\1(\d)\2(\d)\3$/.test(s) && !(l6[0] === l6[2] && l6[2] === l6[4])) add(28, `AABBCC (${toBn(l6)})`);
    else if (/(\d)\1(\d)\2$/.test(s) && l4[0] !== l4[2]) add(14, `AABB (${toBn(l4)})`);

    // palindromes (skip if already all-same)
    if (lr < 8) {
      if (s === rev(s)) add(40, `পুরো আয়না/প্যালিনড্রোম (${toBn(s)})`);
      else if (l6 === rev(l6) && trailingRun(l6) < 6) add(20, `শেষ ৬ অংক আয়না (${toBn(l6)})`);
    }

    // round & lucky endings
    if (tr < 3 && s.endsWith('00')) add(6, 'শেষে ০০');
    if (/[1-9]000$/.test(s) && tr === 3) add(8, 'রাউন্ড নাম্বার (…০০০)');
    if (s.endsWith('786')) add(22, 'শেষে ৭৮৬ (লাকি)');
    else if (s.includes('786')) add(8, '৭৮৬ আছে');

    // few unique digits
    const u = new Set(s).size;
    if (u <= 2) add(26, `মাত্র ${toBn(u)} ধরনের অংক`);
    else if (u === 3) add(14, 'মাত্র ৩ ধরনের অংক');
    else if (u === 4) add(5, 'মাত্র ৪ ধরনের অংক');

    // matches operator code, e.g. 018-18…, 016-16…
    const code = full.slice(0, 2); // '18' or '16'
    if (s.startsWith(code + code)) add(12, `অপারেটর কোড ${toBn(code)} এর সাথে মিল`);
    else if (s.endsWith(code + code)) add(8, `শেষে অপারেটর কোড ${toBn(code + code)}`);

    if (extra && extra.bday && extra.bday.length) {
      const hit = extra.bday.find((t) => (t.length === 8 ? s === t : s.endsWith(t)));
      if (hit) add(hit.length >= 6 ? 30 : 18, `আপনার বিশেষ তারিখ (${toBn(hit)})`);
    }
    pts = Math.min(100, pts);
    reasons.sort((a, b) => b.p - a.p);
    return { score: pts, tier: tierOf(pts), reasons };
  }

  const TIERS = {
    diamond: { min: 70, label: 'ডায়মন্ড', icon: '💎' },
    gold:    { min: 45, label: 'গোল্ড', icon: '🥇' },
    silver:  { min: 22, label: 'সিলভার', icon: '🥈' },
    normal:  { min: 0,  label: 'সাধারণ', icon: '▫️' }
  };
  function tierOf(p) { return p >= 70 ? 'diamond' : p >= 45 ? 'gold' : p >= 22 ? 'silver' : 'normal'; }
  const TIER_RANK = { normal: 0, silver: 1, gold: 2, diamond: 3 };

  /* ---------- Pattern language (custom builder) ----------
     Up to 8 tokens for the 8 digits after 018/016, right-aligned:
       0-9 = fixed digit, * or x or ? = any digit,
       A-Z = variable: same letter -> same digit, different letters -> different digits.
     Dashes/spaces ignored. A leading "01*", "018" or "016" is stripped (operator part). */
  function parsePattern(input) {
    let p = toEn(String(input || '')).toUpperCase().replace(/[\s\-_.]/g, '').replace(/[X?]/g, '*');
    let opHint = null;
    if (/^01[*0-9]/.test(p) && p.length >= 9) { opHint = p[2] === '8' ? 'ROBI' : p[2] === '6' ? 'AIRTEL' : null; p = p.slice(3); }
    if (!/^[0-9*A-WYZ]*$/.test(p)) return { ok: false, error: 'শুধু সংখ্যা, * আর A-Z অক্ষর ব্যবহার করুন' };
    if (p.length > 8) return { ok: false, error: 'সর্বোচ্চ ৮টি ঘর (০১৮ এর পরের অংশ)' };
    if (!p.length) return { ok: false, error: 'প্যাটার্ন লিখুন' };
    const tokens = ('*'.repeat(8 - p.length) + p).split('');
    return { ok: true, tokens, text: p, opHint };
  }
  function matchTokens(sub, tokens) {
    const map = {}, used = {};
    for (let i = 0; i < 8; i++) {
      const t = tokens[i], d = sub[i];
      if (t === '*') continue;
      if (/\d/.test(t)) { if (t !== d) return false; continue; }
      if (map[t] === undefined) { if (used[d] && used[d] !== t) return false; map[t] = d; used[d] = t; }
      else if (map[t] !== d) return false;
    }
    return true;
  }

  /* ---------- Filters ---------- */
  function passFilters(sub, f) {
    if (!f) return true;
    if (f.avoid && f.avoid.length && f.avoid.some((d) => sub.slice(1).includes(d))) return false;
    if (f.must && f.must.length) {
      const m = toEn(f.must);
      if (!sub.includes(m)) return false;
    }
    return true;
  }

  /* ---------- Presets: each has test(sub) and gen(rand, seriesDigit) ---------- */
  const R = (rand, n) => Math.floor(rand() * n);
  const rd = (rand, allowed) => allowed[R(rand, allowed.length)];
  function fill(rand, len, allowed) { let s = ''; for (let i = 0; i < len; i++) s += rd(rand, allowed); return s; }
  // head = series head after 018/016 (1–2 digits, e.g. '2' for 0182, '25' for 01825)
  function lead(rand, head, n, al) { return (head + fill(rand, Math.max(0, n - head.length), al)).slice(0, n); }
  function withTail(rand, head, tail, al) {
    const free = 8 - head.length - tail.length;
    if (free >= 0) return head + fill(rand, free, al) + tail;
    return (head + tail.slice(head.length - (8 - tail.length))).slice(0, 8).length === 8 ? tail.slice(-8) : null;
  }
  function seqOf(dir, start, len) { const ref = dir === 'asc' ? '0123456789' : '9876543210'; return ref.slice(start, start + len); }
  function pair(rand, al) { const all = '0123456789'.split(''); const src = al.length > 1 ? al : all; let a = rd(rand, src), b = rd(rand, src); let k = 0; while (b === a && k++ < 30) b = rd(rand, src); return [a, b]; }

  function makePresets(opts) {
    opts = opts || {};
    const digit = opts.digit; // chosen digit for repeat presets or undefined
    const bday = opts.bday || {};
    const custom = opts.custom; // tokens
    const P = {
      rep4: {
        label: '৭৭৭৭ — শেষে ৪টি একই', test: (s) => trailingRun(s) >= 4 && (digit == null || s.slice(-1) === digit),
        gen: (r, h, al) => withTail(r, h, (digit != null ? digit : rd(r, al)).repeat(4 + (r() < 0.25 ? 1 : 0)), al)
      },
      rep5: {
        label: '৫+ একই সংখ্যা', test: (s) => trailingRun(s) >= 5 && (digit == null || s.slice(-1) === digit),
        gen: (r, h, al) => withTail(r, h, (digit != null ? digit : rd(r, al)).repeat(5 + R(r, 2)), al)
      },
      zero: {
        label: '০০০০ — শেষে শূন্য', test: (s) => /0000$/.test(s) || /[1-9]000$/.test(s),
        gen: (r, h, al) => withTail(r, h, r() < 0.5 ? '0000' : rd(r, '123456789'.split('')) + '000', al)
      },
      asc: {
        label: '১২৩৪ — ক্রমিক', test: (s) => trailingSeq(s, 'asc') >= 4,
        gen: (r, h, al) => { const len = 4 + R(r, 2); return withTail(r, h, seqOf('asc', R(r, 11 - len), len), al); }
      },
      desc: {
        label: '৯৮৭৬ — উল্টো ক্রমিক', test: (s) => trailingSeq(s, 'desc') >= 4,
        gen: (r, h, al) => { const len = 4 + R(r, 2); return withTail(r, h, seqOf('desc', R(r, 11 - len), len), al); }
      },
      mirror: {
        label: 'আয়না / প্যালিনড্রোম', test: (s) => s === rev(s) || s.slice(-6) === rev(s.slice(-6)),
        gen: (r, h, al) => {
          if (r() < 0.35) { const x = lead(r, h, 4, al); return x + rev(x); }
          const x = fill(r, 3, al); return lead(r, h, 2, al) + x + rev(x);
        }
      },
      abab: {
        label: '১৮১৮ — ABAB জোড়া', test: (s) => /(\d)(\d)\1\2$/.test(s) && s[6] !== s[7],
        gen: (r, h, al) => { const [a, b] = pair(r, al); return withTail(r, h, (a + b).repeat(r() < 0.3 ? 3 : 2), al); }
      },
      aabb: {
        label: '১১২২ — AABB', test: (s) => /(\d)\1(\d)\2$/.test(s) && s[5] !== s[6],
        gen: (r, h, al) => { const [a, b] = pair(r, al); let t = a + a + b + b; if (r() < 0.3) { const c = rd(r, al); t = c + c + t; } return withTail(r, h, t, al); }
      },
      double: {
        label: '১২৩৪-১২৩৪ ডাবল ব্লক', test: (s) => s.slice(0, 4) === s.slice(4) || s.slice(2, 5) === s.slice(5),
        gen: (r, h, al) => { if (r() < 0.5) { const x = lead(r, h, 4, al); return x + x; } const x = fill(r, 3, al); return lead(r, h, 2, al) + x + x; }
      },
      lucky786: {
        label: 'শেষে ৭৮৬', test: (s) => s.endsWith('786'),
        gen: (r, h, al) => withTail(r, h, r() < 0.3 ? '786786' : '786', al)
      },
      opcode: {
        label: 'অপারেটর কোড মিল (০১৮-১৮১৮…)', test: (s, code) => s.startsWith(code + code) || s.endsWith(code + code),
        gen: (r, h, al, code) => ((code + code).startsWith(h) && r() < 0.5) ? code + code + fill(r, 4, al) : withTail(r, h, code + code, al)
      },
      birthday: {
        label: 'জন্মতারিখ',
        test: (s) => bdayStrings(bday).some((t) => (t.length === 8 ? s === t : s.endsWith(t))),
        gen: (r, h, al) => { const o = bdayStrings(bday); const t = o[R(r, o.length)] || ''; if (!t) return null; return t.length === 8 ? t : withTail(r, h, t, al); }
      },
      custom: {
        label: 'কাস্টম প্যাটার্ন',
        test: (s) => !!custom && matchTokens(s, custom),
        gen: (r, h, al) => genFromTokens(r, h, custom, al)
      }
    };
    P.mix = {
      label: 'সেরা মিক্স (সব ভিআইপি)',
      keys: ['rep4', 'rep5', 'zero', 'asc', 'desc', 'mirror', 'abab', 'aabb', 'double', 'lucky786', 'opcode'],
      test(s, code) { return this.keys.some((k) => P[k].test(s, code)); },
      gen(r, h, al, code) { return P[this.keys[R(r, this.keys.length)]].gen(r, h, al, code); }
    };
    return P;
  }

  function bdayStrings(b) {
    if (!b || !b.dd || !b.mm) return [];
    const dd = String(b.dd).padStart(2, '0'), mm = String(b.mm).padStart(2, '0');
    const yyyy = b.yyyy ? String(b.yyyy) : '', yy = yyyy.slice(-2);
    const all = { ddmmyy: dd + mm + yy, ddmm: dd + mm, ddmmyyyy: dd + mm + yyyy, yyyy: yyyy, mmdd: mm + dd };
    if (b.fmt && b.fmt !== 'any') return all[b.fmt] && all[b.fmt].length >= 4 ? [all[b.fmt]] : [];
    return [all.ddmmyy, all.ddmm, all.ddmmyyyy, all.yyyy].filter((x) => x && (x.length === 4 || x.length === 6 || x.length === 8));
  }

  function genFromTokens(r, head, tokens, al) {
    if (!tokens) return null;
    const map = {}, used = new Set();
    const any = al.length ? al : '0123456789'.split('');
    let out = '';
    for (let i = 0; i < 8; i++) {
      const t = tokens[i];
      const hd = i < head.length ? head[i] : null;
      let d;
      if (/\d/.test(t)) d = t;
      else if (t === '*') d = hd != null ? hd : rd(r, any);
      else {
        if (map[t] === undefined) {
          if (hd != null && !used.has(hd)) d = hd;
          else { let k = 0; do { d = rd(r, any); } while (used.has(d) && ++k < 40); }
          map[t] = d; used.add(d);
        }
        d = map[t];
      }
      out += d;
    }
    return out;
  }

  /* Build a prioritized batch of unique candidate subs for given series digits.
     series = {brand, head}. Returns highest-score first. seen = Set of already-tried "BRAND|sub". */
  function buildBatch({ preset, presets, seriesList, size, seen, filters, rand, extra }) {
    rand = rand || Math.random;
    const P = presets[preset];
    const allowed = '0123456789'.split('').filter((d) => !(filters && filters.avoid || []).includes(d));
    const al = allowed.length ? allowed : '0123456789'.split('');
    const out = [], local = new Set();
    let tries = 0;
    const maxTries = size * 40;
    while (out.length < size && tries < maxTries && seriesList.length) {
      tries++;
      const ser = seriesList[tries % seriesList.length];
      const code = OPS[ser.brand].code.slice(1); // '18' / '16'
      const sub = P.gen(rand, ser.head, al, code);
      if (!sub || sub.length !== 8 || !/^\d{8}$/.test(sub)) continue;
      if (!sub.startsWith(ser.head)) continue;
      const key = ser.brand + '|' + sub;
      if (local.has(key) || (seen && seen.has(key))) continue;
      if (!P.test(sub, code) || !passFilters(sub, filters)) continue;
      local.add(key);
      const msisdn = OPS[ser.brand].intl + sub;
      out.push({ msisdn, brand: ser.brand, sub, series: ser, ...score(msisdn, extra) });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  return { OPS, TIERS, TIER_RANK, toBn, toEn, subOf, localOf, brandOf, pretty, score, tierOf, parsePattern, matchTokens,
    passFilters, makePresets, bdayStrings, buildBatch, mulberry32, trailingRun, trailingSeq };
});
