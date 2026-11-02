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
