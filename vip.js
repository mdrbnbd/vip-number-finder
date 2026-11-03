/* VIP Number Finder — pure logic (scoring, patterns, candidate generation).
   Works in the browser (window.VIP) and in Node (module.exports) for tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VIP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const OPS = {
    ROBI:   { code: '018', intl: '88018', label: 'রবি', en: 'Robi', short: 'রবি ০১৮', shortEn: 'Robi 018', buy: 'https://www.robi.com.bd/bn/sim-services?requestType=NEW' },
    AIRTEL: { code: '016', intl: '88016', label: 'এয়ারটেল', en: 'Airtel', short: 'এয়ারটেল ০১৬', shortEn: 'Airtel 016', buy: 'https://cirkle.digital/bn/sim-services?requestType=NEW' }
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
    const add = (p, why, en) => { pts += p; reasons.push({ p, why, en: en || why }); };

    // identical digits
    const tr = trailingRun(s), lr = longestRun(s);
    const runPts = { 3: 10, 4: 28, 5: 44, 6: 62, 7: 76, 8: 90 };
    if (tr >= 3) add(runPts[tr], `শেষে ${toBn(tr)}টি একই সংখ্যা (${toBn(s.slice(-tr))})`, `${tr} same digits at the end (${s.slice(-tr)})`);
    else if (lr >= 4) add(Math.round(runPts[lr] * 0.6), `মাঝে ${toBn(lr)}টি একই সংখ্যা`, `${lr} same digits in the middle`);

    // sequences
    let seqDone = false;
    for (const dir of ['asc', 'desc']) {
      const t = trailingSeq(s, dir);
      const seqPts = { 3: 10, 4: 24, 5: 36, 6: 48, 7: 60, 8: 75 };
      if (t >= 3 && !seqDone) { add(seqPts[t], `শেষে ${dir === 'asc' ? 'ক্রমিক' : 'উল্টো ক্রমিক'} ${toBn(s.slice(-t))}`, `${dir === 'asc' ? 'Ascending' : 'Descending'} run at the end ${s.slice(-t)}`); seqDone = true; }
    }
    if (!seqDone) {
      const l = Math.max(longestSeq(s, 'asc'), longestSeq(s, 'desc'));
      if (l >= 4) add(l * 3, `মাঝে ${toBn(l)} অংকের ক্রমিক সংখ্যা`, `${l}-digit sequence in the middle`);
    }

    // repeated blocks
    const l4 = s.slice(-4), l6 = s.slice(-6);
    if (s.slice(0, 4) === s.slice(4) && longestRun(s) < 4) add(42, `ডাবল ব্লক ${toBn(s.slice(0, 4))}-${toBn(s.slice(4))}`, `Double block ${s.slice(0, 4)}-${s.slice(4)}`);
    else if (l6.slice(0, 3) === l6.slice(3) && trailingRun(l6) < 3) add(24, `ABCABC (${toBn(l6)})`, `ABCABC (${l6})`);
    if (/^(\d)(\d)(\1\2)+$/.test(s) && s[0] !== s[1]) add(55, `পুরোটা জোড়া প্যাটার্ন (${toBn(s.slice(0, 2))}×৪)`, `Full pair pattern (${s.slice(0, 2)}×4)`);
    else if (/(\d)(\d)\1\2\1\2$/.test(s) && l6[0] !== l6[1]) add(34, `শেষে ABABAB (${toBn(l6)})`, `ABABAB at the end (${l6})`);
    else if (/(\d)(\d)\1\2$/.test(s) && l4[0] !== l4[1]) add(18, `শেষে ABAB (${toBn(l4)})`, `ABAB at the end (${l4})`);
    if (/(\d)\1(\d)\2(\d)\3$/.test(s) && !(l6[0] === l6[2] && l6[2] === l6[4])) add(28, `AABBCC (${toBn(l6)})`, `AABBCC (${l6})`);
    else if (/(\d)\1(\d)\2$/.test(s) && l4[0] !== l4[2]) add(14, `AABB (${toBn(l4)})`, `AABB (${l4})`);

    // palindromes (skip if already all-same)
    if (lr < 8) {
      if (s === rev(s)) add(40, `পুরো আয়না/প্যালিনড্রোম (${toBn(s)})`, `Full mirror / palindrome (${s})`);
      else if (l6 === rev(l6) && trailingRun(l6) < 6) add(20, `শেষ ৬ অংক আয়না (${toBn(l6)})`, `Last 6 digits mirrored (${l6})`);
    }

    // round & lucky endings
    if (tr < 3 && s.endsWith('00')) add(6, 'শেষে ০০', 'Ends in 00');
    if (/[1-9]000$/.test(s) && tr === 3) add(8, 'রাউন্ড নাম্বার (…০০০)', 'Round number (…000)');
    if (s.endsWith('786')) add(22, 'শেষে ৭৮৬ (লাকি)', 'Ends in 786 (lucky)');
    else if (s.includes('786')) add(8, '৭৮৬ আছে', 'Contains 786');

    // few unique digits
    const u = new Set(s).size;
    if (u <= 2) add(26, `মাত্র ${toBn(u)} ধরনের অংক`, `Only ${u} distinct digits`);
    else if (u === 3) add(14, 'মাত্র ৩ ধরনের অংক', 'Only 3 distinct digits');
    else if (u === 4) add(5, 'মাত্র ৪ ধরনের অংক', 'Only 4 distinct digits');

    // matches operator code, e.g. 018-18…, 016-16…
    const code = full.slice(0, 2); // '18' or '16'
    if (s.startsWith(code + code)) add(12, `অপারেটর কোড ${toBn(code)} এর সাথে মিল`, `Matches operator code ${code}`);
    else if (s.endsWith(code + code)) add(8, `শেষে অপারেটর কোড ${toBn(code + code)}`, `Operator code ${code + code} at the end`);

    if (extra && extra.bday && extra.bday.length) {
      const hit = extra.bday.find((t) => (t.length === 8 ? s === t : s.endsWith(t)));
      if (hit) add(hit.length >= 6 ? 30 : 18, `আপনার বিশেষ তারিখ (${toBn(hit)})`, `Your special date (${hit})`);
    }
    pts = Math.min(100, pts);
    reasons.sort((a, b) => b.p - a.p);
    return { score: pts, tier: tierOf(pts), reasons };
  }

  const TIERS = {
    diamond: { min: 70, label: 'ডায়মন্ড', en: 'Diamond', icon: '💎' },
    gold:    { min: 45, label: 'গোল্ড', en: 'Gold', icon: '🥇' },
    silver:  { min: 22, label: 'সিলভার', en: 'Silver', icon: '🥈' },
    normal:  { min: 0,  label: 'সাধারণ', en: 'Regular', icon: '▫️' }
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
    // Simple search: the typed digits (1–6) appear in the number, preferably at the end.
    const q = opts.query ? String(opts.query).replace(/\D/g, '').slice(0, 8) : '';
    P.query = {
      label: 'সংখ্যা খুঁজুন',
      test: (s) => !!q && s.includes(q),
      gen: (r, h, al) => {
        if (!q) return null;
        const free = 8 - h.length - q.length;
        if (free < 0) return null;
        if (r() < 0.65 || free === 0) return withTail(r, h, q, al);
        const k = R(r, free + 1); // q somewhere after the head
        return h + fill(r, k, al) + q + fill(r, free - k, al);
      }
    };
    /* ---- v2 scan categories ---- */
    const qd = q.replace(/\D/g, '');
    const one = qd.length === 1 ? qd : null;           // optional fixed digit
    const CELEB = ['786', '786786', '1971', '1952', '007', '0007', '143', '1000', '2026', '0786'];
    const YEAR_RE = /(19[5-9]\d|20[0-2]\d)$/;
    const fixedYear = /^(19|20)\d\d$/.test(qd) ? qd : null;
    const ar4 = (t) => { const d = t.split('').map(Number), k = d[1] - d[0]; return [1, -1, 2, -2].includes(k) && d[2] - d[1] === k && d[3] - d[2] === k; };
    const cpat = opts.pattern ? parsePattern(opts.pattern) : null;
    Object.assign(P, {
      triple: {
        test: (s) => trailingRun(s) >= 3 && (!one || s.slice(-1) === one),
        gen: (r, h, al) => withTail(r, h, (one || rd(r, al)).repeat(3 + (r() < 0.35 ? 1 : 0) + (r() < 0.1 ? 1 : 0)), al)
      },
      pairs: {
        test: (s) => (/(\d)\1(\d)\2$/.test(s) && s[5] !== s[6]) || (/(\d)(\d)\1\2$/.test(s) && s[6] !== s[7]),
        gen: (r, h, al) => { const [a, b] = pair(r, one ? [one, ...al.filter((x) => x !== one)] : al); const x = one || a; const y = b === x ? (x === '9' ? '0' : String(+x + 1)) : b; return withTail(r, h, r() < 0.5 ? x + x + y + y : x + y + x + y, al); }
      },
      celebrity: {
        test: (s) => CELEB.some((c) => s.endsWith(c)) || (s.slice(0, 4) === s.slice(4)),
        gen: (r, h, al) => { if (r() < 0.2) { const x = lead(r, h, 4, al); return x + x; } return withTail(r, h, CELEB[R(r, CELEB.length)], al); }
      },
      years: {
        test: (s) => (fixedYear ? s.endsWith(fixedYear) : YEAR_RE.test(s)),
        gen: (r, h, al) => withTail(r, h, fixedYear || String(1960 + R(r, 67)), al)
      },
      zerobin: {
        test: (s) => /[01]{6}$/.test(s) || /0000$/.test(s) || /[1-9]000$/.test(s),
        gen: (r, h, al) => { const k = R(r, 3); if (k === 0) return withTail(r, h, '0000', al); if (k === 1) return withTail(r, h, rd(r, '123456789'.split('')) + '000', al); return withTail(r, h, fill(r, 6, ['0', '1']), al); }
      },
      ends: {
        test: (s) => !!qd && s.endsWith(qd),
        gen: (r, h, al) => (qd && h.length + qd.length <= 8 ? withTail(r, h, qd, al) : null)
      },
      math: {
        test: (s) => ar4(s.slice(-4)),
        gen: (r, h, al) => { const k = [1, -1, 2, -2][R(r, 4)]; const len = 4 + (r() < 0.3 ? 1 : 0); const st = k > 0 ? R(r, 10 - k * (len - 1)) : 9 - R(r, 10 + k * (len - 1)); let t = ''; for (let i = 0; i < len; i++) t += st + k * i; return /^\d+$/.test(t) && t.length === len ? withTail(r, h, t, al) : null; }
      },
      customd: cpat && cpat.ok && /[*A-Z]/.test(cpat.text) ? {
        test: (s) => matchTokens(s, cpat.tokens), gen: (r, h, al) => genFromTokens(r, h, cpat.tokens, al), opHint: cpat.opHint
      } : P.query
    });
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


  /* ---------- Smart pattern search: starts with / contains / ends with ---------- */
  // spec = { start, mid, end, pos }  (pos: 'any' or 1-based digit index inside the 8 digits after 016/018)
  function patternSpec(raw) {
    const clean = (v) => toEn(String(v || '')).replace(/\D/g, '').slice(0, 8);
    const start = clean(raw.start), mid = clean(raw.mid), end = clean(raw.end);
    const pos = raw.pos && raw.pos !== 'any' ? +raw.pos : 'any';
    const a = start.length, b = mid.length, c = end.length;
    const out = { start, mid, end, pos, ok: false, error: null, placements: [], templates: [], total: 0 };
    if (!a && !b && !c) { out.error = 'empty'; return out; }
    if (a + b + c > 8) { out.error = 'long'; return out; }
    if (b) {
      const lo = a, hi = 8 - c - b;
      if (pos === 'any') for (let p = lo; p <= hi; p++) out.placements.push(p);
      else if (pos - 1 >= lo && pos - 1 <= hi) out.placements.push(pos - 1);
      else { out.error = 'pos'; return out; }
    }
    const base = Array(8).fill('_');
    for (let i = 0; i < a; i++) base[i] = start[i];
    for (let i = 0; i < c; i++) base[8 - c + i] = end[i];
    out.base = base.join('');
    if (!b) out.templates = [out.base];
    else out.templates = out.placements.map((p) => { const t = base.slice(); for (let i = 0; i < b; i++) t[p + i] = mid[i]; return t.join(''); });
    out.total = unionCount(out.templates);
    out.ok = true;
    return out;
  }
  function mergeTpl(x, y) {
    let r = '';
    for (let i = 0; i < 8; i++) { const p = x[i], q = y[i]; if (p === '_') r += q; else if (q === '_' || q === p) r += p; else return null; }
    return r;
  }
  const freeOf = (t) => t.split('_').length - 1;
  function unionCount(tpls) {
    const n = tpls.length; if (!n) return 0;
    if (n > 12) return tpls.reduce((s, t) => s + Math.pow(10, freeOf(t)), 0); // upper bound (never happens: max 8 placements)
    let total = 0;
    for (let m = 1; m < 1 << n; m++) {
      let t = '________', bits = 0;
      for (let i = 0; i < n && t; i++) if (m & (1 << i)) { t = mergeTpl(t, tpls[i]); bits++; }
      if (t) total += (bits % 2 ? 1 : -1) * Math.pow(10, freeOf(t));
    }
    return total;
  }
  function matchSpec(sub, spec) {
    if (!spec || !spec.ok || !/^\d{8}$/.test(sub)) return false;
    if (spec.start && !sub.startsWith(spec.start)) return false;
    if (spec.end && !sub.endsWith(spec.end)) return false;
    if (spec.mid) return spec.placements.some((p) => sub.substr(p, spec.mid.length) === spec.mid);
    return true;
  }
  // i-th fill of a template (digits of i written into its free slots, left to right)
  function fillTpl(t, i) {
    const f = freeOf(t); let d = String(i).padStart(f, '0'), k = 0, r = '';
    for (let j = 0; j < 8; j++) r += t[j] === '_' ? d[k++] : t[j];
    return r;
  }
  // VIP-looking fills tried first: same digit, repeat neighbours, runs up/down, pairs
  function vipFills(t) {
    const f = freeOf(t), out = new Set(); if (!f) return [t];
    const fixed = t.replace(/_/g, '');
    const seeds = [...new Set((fixed + '0123456789').split(''))];
    for (const d of seeds) {
      const dn = +d;
      const fills = [
        d.repeat(f),
        Array.from({ length: f }, (_, i) => (dn + i + 1) % 10).join(''),
        Array.from({ length: f }, (_, i) => (dn - i - 1 + 20) % 10).join(''),
        Array.from({ length: f }, (_, i) => (i % 2 ? (dn + 1) % 10 : d)).join(''),
        Array.from({ length: f }, (_, i) => (Math.floor(i / 2) % 2 ? '0' : d)).join(''),
        '0'.repeat(f - 1) + d, d + '0'.repeat(f - 1)
      ];
      for (const s of fills) { let k = 0, r = ''; for (let j = 0; j < 8; j++) r += t[j] === '_' ? s[k++] : t[j]; out.add(r); }
    }
    return [...out];
  }
  /* Candidate source for a spec. next(n) returns up to n new subs (8 digits) in priority order, [] when exhausted.
     small spaces (<= enumMax): every candidate, sorted best-first (live series + VIP score).
     large spaces: VIP fills first, then a pseudo-random full sweep, live series first. */
  function patternSource(spec, opt) {
    opt = opt || {};
    const enumMax = opt.enumMax || 200000, liveHeads = opt.heads || [], code = opt.code || '18';
    const rank = (sub) => score('880' + code + sub).score + (liveHeads.includes(sub.slice(0, 2)) ? 1000 : liveHeads.some((h) => h[0] === sub[0]) ? 10 : 0) + Math.random() * 3;
    const emitted = new Set(); let queue = [], qi = 0;
    if (spec.total <= enumMax) {
      for (const t of spec.templates) { const m = Math.pow(10, freeOf(t)); for (let i = 0; i < m; i++) emitted.add(fillTpl(t, i)); }
      queue = [...emitted].map((s) => [s, rank(s)]).sort((x, y) => y[1] - x[1]).map((x) => x[0]);
      return { exhaustive: true, total: emitted.size, next(n) { const r = queue.slice(qi, qi + n); qi += r.length; return r; } };
    }
    // large: build prioritized sub-templates (live heads merged in first)
    const subs = [];
    for (const h of liveHeads) for (const t of spec.templates) { const m = mergeTpl(t, h + '______'); if (m && !subs.includes(m)) subs.push(m); }
    for (const t of spec.templates) if (!subs.includes(t)) subs.push(t);
    const vip = []; for (const t of subs) for (const s of vipFills(t)) if (!emitted.has(s)) { emitted.add(s); vip.push(s); }
    queue = vip.map((s) => [s, rank(s)]).sort((x, y) => y[1] - x[1]).map((x) => x[0]);
    const sweeps = subs.map((t) => { const m = Math.pow(10, freeOf(t)); let a = 7919; while (gcd(a, m) !== 1) a += 2; return { t, m, a, b: Math.floor(Math.random() * m), i: 0 }; });
    let si = 0, pend = [];
    return {
      exhaustive: false, total: spec.total,
      next(n) {
        const r = [];
        while (r.length < n && qi < queue.length) r.push(queue[qi++]);
        while (r.length < n && (pend.length || si < sweeps.length)) {
          if (!pend.length) {
            const w = sweeps[si]; const chunk = [];
            while (chunk.length < 600 && w.i < w.m) { const s = fillTpl(w.t, (w.a * w.i + w.b) % w.m); w.i++; if (!emitted.has(s)) { emitted.add(s); chunk.push(s); } }
            if (w.i >= w.m) si++;
            pend = chunk.map((s) => [s, rank(s)]).sort((x, y) => y[1] - x[1]).map((x) => x[0]);
          }
          while (r.length < n && pend.length) r.push(pend.shift());
        }
        return r;
      }
    };
  }
  function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
  function previewTpl(spec) {
    if (!spec.templates.length) return '________';
    return spec.pos === 'any' && spec.mid && spec.templates.length > 1 ? spec.base : spec.templates[0];
  }

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  return { OPS, TIERS, TIER_RANK, toBn, toEn, subOf, localOf, brandOf, pretty, score, tierOf, parsePattern, matchTokens,
    passFilters, makePresets, bdayStrings, buildBatch, mulberry32, trailingRun, trailingSeq,
    patternSpec, matchSpec, unionCount, fillTpl, vipFills, patternSource, previewTpl };
});
