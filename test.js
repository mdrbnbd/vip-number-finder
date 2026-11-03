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
