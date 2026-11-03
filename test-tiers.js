// Run: node test-tiers.js — v9 tier classifier tests
const V = require('./vip.js'); const assert = require('assert');
const T = (sub) => V.tierInfo('88018' + sub).tier;
const cases = {
  diamond: ['15777777', '25777777', '77777777', '11234567', '19876543', '18181818', '55559999', '12344321', '20666666'],
  gold: ['25677777', '15123456', '25121212', '20555777', '16112233', '15791579', '43786786', '25550000', '43557777', '16654321'],
  premium: ['25437777', '25431234', '25439876', '25431212', '25431122', '25436777', '25432000', '25432786', '20211971', '25123321', '16777720'],
  regular: ['25573685', '20433781', '16208419', '25817394']
};
for (const t in cases) for (const s of cases[t]) assert.equal(T(s), t, s + ' expected ' + t + ' got ' + T(s));
// score bands
for (const t in cases) for (const s of cases[t]) { const x = V.tierInfo('88018' + s); assert.ok(x.tscore >= V.TIER9[t].min && x.tscore <= V.TIER9[t].max, 'band ' + s + ' ' + x.tscore); }
assert.ok(V.tierInfo('8801625777777').rule.en.includes('6+'));
// generator: every candidate meets target and keeps the head
for (const target of ['diamond', 'gold', 'premium']) for (const head of ['', '2', '15', '815', '1555']) {
  const c = V.tierCandidates({ head, target, n: 30, rand: V.mulberry32(7) });
  assert.ok(c.length >= 5, target + ' head ' + head + ' ' + c.length);
  c.forEach((x) => { assert.ok(x.sub.startsWith(head) && /^\d{8}$/.test(x.sub)); assert.ok(x.rank >= V.TIER9[target].rank, target + ' ' + x.sub + ' ' + x.tier); });
  for (let i = 1; i < c.length; i++) assert.ok(c[i - 1].rank * 1000 + c[i - 1].tscore >= c[i].rank * 1000 + c[i].tscore || c[i-1].rank > c[i].rank, 'sorted');
}
// exhaustive small space
const ex = V.tierCandidates({ head: '157777', target: 'gold', all: true });
assert.ok(ex.every((x) => x.rank >= 2) && ex.some((x) => x.sub === '15777777'));
// distribution sanity on random numbers
const r = V.mulberry32(42), cnt = { diamond: 0, gold: 0, premium: 0, regular: 0 };
for (let i = 0; i < 200000; i++) { const s = String(Math.floor(r() * 1e8)).padStart(8, '0'); cnt[V.tierInfo('88018' + s).tier]++; }
console.log('random 200k distribution', cnt);
assert.ok(cnt.diamond < cnt.gold && cnt.gold < cnt.premium && cnt.premium < cnt.regular);
console.log('tier tests passed');
