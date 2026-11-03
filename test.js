// Run: node test.js  — sanity tests for scoring & pattern logic
const V = require('./vip.js');
const assert = require('assert');
const t = (n) => V.score(n).tier;
assert.equal(t('8801877777777'), 'diamond');
assert.equal(t('8801812345678'), 'diamond');
assert.equal(t('8801818181818'), 'diamond');
assert.equal(t('8801825777777'), 'diamond');
assert.equal(t('8801825573685'), 'normal');
assert.equal(t('8801820433786'), 'silver');
assert.ok(V.matchTokens('12344321', V.parsePattern('ABCDDCBA').tokens));
assert.ok(!V.matchTokens('11111111', V.parsePattern('ABCDDCBA').tokens));
assert.deepEqual(V.parsePattern('01*-***7777').tokens.join(''), '****7777');
assert.equal(V.parsePattern('01825*****').opHint, 'ROBI');
const P = V.makePresets({});
for (const k of ['rep4', 'asc', 'desc', 'mirror', 'abab', 'aabb', 'zero', 'lucky786', 'mix']) {
  const b = V.buildBatch({ preset: k, presets: P, seriesList: [{ brand: 'ROBI', head: '25' }, { brand: 'AIRTEL', head: '12' }], size: 50, seen: new Set(), filters: { avoid: ['4', '9'] } });
  assert.ok(b.length > 0, k);
  b.forEach((x) => { assert.ok(P[k].test(x.sub, x.brand === 'ROBI' ? '18' : '16'), k + ' ' + x.sub); assert.ok(!/[49]/.test(x.sub.slice(1)), 'avoid ' + x.sub); });
  for (let i = 1; i < b.length; i++) assert.ok(b[i - 1].score >= b[i].score, 'sorted');
}
console.log('all tests passed');
{ // simple query preset
  const Q = V.makePresets({ query: '777' });
  const b = V.buildBatch({ preset: 'query', presets: Q, seriesList: [{ brand: 'ROBI', head: '25' }, { brand: 'AIRTEL', head: '12' }], size: 40, seen: new Set(), filters: {} });
  assert.ok(b.length > 10, 'query batch');
  b.forEach((x) => { assert.ok(x.sub.includes('777') && /^(25|12)/.test(x.sub), 'query ' + x.sub); });
  assert.ok(V.score('8801812345678').reasons[0].en, 'english reasons');
  console.log('query tests passed');
}
{ // v2 scan categories
  const series = [{ brand: 'ROBI', head: '25' }, { brand: 'AIRTEL', head: '12' }];
  const cases = { triple: {}, pairs: {}, celebrity: {}, years: {}, zerobin: {}, math: {}, ends: { query: '77' }, customd: { query: '19' } };
  for (const k in cases) {
    const Q = V.makePresets(cases[k]);
    const b = V.buildBatch({ preset: k, presets: Q, seriesList: series, size: 40, seen: new Set(), filters: {} });
    assert.ok(b.length >= 10, k + ' batch ' + b.length);
    b.forEach((x) => assert.ok(Q[k].test(x.sub, '18'), k + ' ' + x.sub));
  }
  const C = V.makePresets({ pattern: '****ABAB' });
  const cb = V.buildBatch({ preset: 'customd', presets: C, seriesList: series, size: 20, seen: new Set(), filters: {} });
  assert.ok(cb.length > 5 && cb.every((x) => /(\d)(\d)\1\2$/.test(x.sub)), 'custom pattern');
  console.log('category tests passed');
}

// smart pattern search
{
  const s = V.patternSpec({ start: '18', end: '77' });
  assert.ok(s.ok); assert.equal(s.total, 10000); assert.equal(V.previewTpl(s), '18____77');
  assert.ok(V.matchSpec('18123477', s)); assert.ok(!V.matchSpec('19123477', s));
  const c = V.patternSpec({ mid: '1234' });
  assert.ok(c.ok); assert.equal(c.placements.length, 5);
  { let n = 0; for (let i = 0; i < 1e8; i++) if (String(i).padStart(8, '0').includes('1234')) n++; assert.equal(c.total, n); }
  assert.ok(V.matchSpec('99123499', c)); assert.ok(!V.matchSpec('99124399', c));
  const src = V.patternSource(c, { code: '16', heads: ['12'] });
  assert.ok(src.exhaustive); assert.equal(src.total, c.total);
  const all = []; let b; while ((b = src.next(5000)).length) all.push(...b);
  assert.equal(new Set(all).size, c.total); assert.ok(all.every((x) => V.matchSpec(x, c)));
  assert.equal(V.patternSpec({ start: '12345', end: '6789' }).error, 'long');
  assert.equal(V.patternSpec({ start: '12', mid: '5', end: '7', pos: 1 }).error, 'pos');
  const e = V.patternSpec({ start: '12', mid: '55', pos: 3 }); assert.ok(e.ok); assert.equal(e.templates[0], '1255____');
  const big = V.patternSpec({ end: '7' });
  const bs = V.patternSource(big, { code: '18', heads: ['25', '20'] });
  assert.ok(!bs.exhaustive); const first = bs.next(300);
  assert.equal(first.length, 300); assert.equal(new Set(first).size, 300); assert.ok(first.every((x) => x.endsWith('7')));
  assert.ok(first.slice(0, 20).every((x) => /^(25|20)/.test(x)));
  console.log('pattern tests passed (contains 1234 total =', c.total + ')');
}

// v4: VIP score, stars, types, list parsing
{
  assert.equal(V.vipOf(0), 0); assert.equal(V.vipOf(10), 50); assert.equal(V.vipOf(28), 70); assert.equal(V.vipOf(44), 85); assert.equal(V.vipOf(100), 100);
  assert.equal(V.starsOf(90), 5); assert.equal(V.starsOf(75), 4); assert.equal(V.starsOf(55), 3); assert.equal(V.starsOf(40), 0);
  assert.ok(V.score('8801817777777').vip >= 85);
  assert.ok(V.vipTypes('17777777').includes('triple'));
  assert.ok(V.vipTypes('11223344').includes('pairs'));
  assert.ok(V.vipTypes('25129876').includes('seq'));
  assert.ok(V.vipTypes('17656765').includes('mirror'));
  assert.ok(V.vipTypes('25001971').includes('lucky'));
  assert.ok(!V.vipTypes('25420786').includes('lucky')); // 420-free
  assert.ok(V.score('8801825420786').score < V.score('8801825431786').score);
  assert.ok(V.score('8801825123477', { want: ['77'] }).reasons.some((r) => /Your digits/.test(r.en)));
  const L = V.parseList('number,name\n+8801712345678,A\n৮৮০১৮১১২৩৪৫৬৭\n1612345678\n01712345678\n0181234\n880 1611-111 111');
  assert.deepEqual(L.items, ['01712345678', '01811234567', '01612345678', '01611111111']);
  assert.equal(L.invalid, 1); assert.equal(L.dups, 1);
  assert.equal(V.opOfLocal('01811234567'), 'ROBI'); assert.equal(V.opOfLocal('01712345678'), 'GP');
  const pr = V.makePresets({});
  assert.ok(pr.allvip.test('25777777')); assert.ok(!pr.allvip.test('25372946'));
  assert.ok(pr.mirror.test('25677652'));
  console.log('v4 tests passed');
}
