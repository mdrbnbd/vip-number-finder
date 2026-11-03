# ভিআইপি নাম্বার ফাইন্ডার (VIP Number Finder)

রবি (০১৮) ও এয়ারটেল (০১৬) এর **খালি থাকা** ভিআইপি নাম্বার এক ট্যাপে খোঁজার স্ট্যাটিক ওয়েব অ্যাপ। GitHub Pages-এ সরাসরি চলে, কোনো build step নেই।

## v4

- **Robi + Airtel** together: every scan runs on 018 and 016, each result labelled with its operator.
- VIP types: All VIP, Triple / Four Same, Double Pair, Sequence, Mirror / Palindrome, Lucky / Special (786, 1971, 2024, 007, 000; numbers with 420 are marked down).
- **VIP score 0–100** on every card and a **Minimum VIP score** slider (default 50) that filters live. Stars: 5★ Elite ≥ 85 · 4★ Premium ≥ 70 · 3★ Regular ≥ 50 · below 50 = normal.
- **My list** mode: paste numbers (01…, +880, 880, Bangla digits) or load a .txt/.csv, or tick *Use sample data*; scores and sorts them offline, shows invalid/duplicate counts, and can optionally check Robi/Airtel availability against the official API (same polite throttling).

## Smart Search (v3)

- **শুরুতে / Starts with**, **মাঝখানে / Contains** (anywhere or an exact position), **শেষে / Ends with** — any combination, up to 8 digits after 016/018, with a live preview (e.g. `016 12__ __77`) and a count of possible numbers.
- Up to 200,000 candidates: every matching number is checked (best-looking and live-series first). Bigger spaces: VIP-looking fills first, then a full pseudo-random sweep.
- The extra free numbers the official API returns with each answer are collected too: matching ones join the results, other nice ones go to a separate **Bonus** section. Everything is de-duplicated.
- Adaptive 2–10 parallel requests with paced starts and back-off on errors/429. Progress shows checked / total / found / ETA. **Limit list** has a **Max / সর্বোচ্চ** option (until all candidates are checked or you press Stop). The last search is remembered.

## ফিচার (v2 — সহজ স্ক্যানার)
- ৩ ধাপ: **অপারেটর বাছুন → ধরন বাছুন → স্ক্যান করে কিনুন**
- বড় দুটি অপারেটর বোতাম: এয়ারটেল বাংলাদেশ (০১৬) / রবি আজিয়াটা (০১৮); ইনপুটের ভেতরে +88016 / +88018 প্রিফিক্স
- ৮টি ধরন: তিনটি একই (Triple Suffix), ডাবল জোড়া, সেলিব্রিটি ব্লক (৭৮৬, ১৯৭১, ০০৭…), জন্মসাল, শূন্য/বাইনারি, শেষে থাকবে (Ends With), গাণিতিক ধারা (+/-), কাস্টম সংখ্যা (`****ABAB` প্যাটার্নও চলে)
- "কতগুলো চাই" লিমিট (ডিফল্ট ১০০), এক বোতামে **স্ক্যান শুরু / থামান**; ৫টি লেনে একসাথে, ভদ্র গতিতে (বিরতি + ব্যাকঅফ), ফলাফল লাইভ আসে
- স্টার স্কোর: এলিট ৫★ / প্রিমিয়াম ৪★ / রেগুলার ৩★ লাইভ ফিল্টার (সংখ্যাসহ)
- প্রতিটি কার্ডে বড় **কপি** আর **কিনুন** (নাম্বার কপি করে অপারেটরের অফিসিয়াল পেজ খোলে), ☆ পছন্দ, 🔄 আবার যাচাই, "কেন?"
- **টেক্সট লিস্ট এক্সপোর্ট** (.txt ডাউনলোড + কপি), সব কপি, CSV
- বাংলা / English টগল (মনে রাখে), ডার্ক/লাইট, PWA (অফলাইন শেল)
- "আরও অপশন": পছন্দের তালিকা, সাজানো, কাস্টম প্যাটার্ন উদাহরণ, স্মার্ট/ম্যানুয়াল সিরিজ, বাদ দেওয়া সংখ্যা, সাজেশন

## কীভাবে কাজ করে
রবির পাবলিক availability API (`POST https://da-api.robi.com.bd/da-nll/free-msisdn/get-msisdn-list`, `{msisdn, brand, simCategory:"PREPAID"}`) পুরো ১৩ অংকের নাম্বার (যেমন `8801825777777`) নেয় এবং `available` (নাম্বারটি খালি কি না) আর `freeMsisdnList` (৪টি খালি সাজেশন) ফেরত দেয়। API `Access-Control-Allow-Origin: *` পাঠায়, তাই github.io থেকে ব্রাউজারেই সরাসরি কল করা যায়।
একসাথে সর্বোচ্চ ৫টি অনুরোধ যায়, প্রতিটির পরে বিরতি থাকে, আর 429/5xx হলে exponential backoff হয়।

## লোকাল টেস্ট
```
python3 -m http.server 8099   # তারপর http://localhost:8099
node test.js                  # scoring/pattern টেস্ট
```

## GitHub Pages
রিপো পুশ করে Settings → Pages → Branch `main` / root চালু করুন।

> নাম্বারগুলো অপারেটরের পাবলিক availability চেক থেকে আসে; কেনাকাটা শুধু অফিসিয়াল সাইটে হয়। রবি/এয়ারটেলের সাথে কোনো সম্পর্ক নেই।

Made by Robin · [dfaster.com](https://dfaster.com) · [GitHub](https://github.com/mdrbnbd)

## v9 — VIP tiers (💎 Diamond · 🥇 Gold · 💜 Premium)
Every number gets a tier badge + tier score (rules on the 8 digits after 018/016, highest match wins):
- **💎 Diamond (90–100):** 6+ same digits in a row, 7+ digit sequence, pair ×4 (18181818), AAAABBBB, full 8-digit mirror.
- **🥇 Gold (75–89):** 5 same in a row, 6-digit sequence, ends ABABAB / AAABBB / AABBCC / ABCABC, double block ABCD-ABCD, ends 0000 or AA+BBBB.
- **💜 Premium (60–74):** 4 same in a row, 4+ sequence at the end (or 5 inside), ends ABAB / AABB / AAA, lucky 786 / 1971 / 1952, last-6 mirror.
- **▫️ Regular:** none of the above.

"👑 Find by category": one tap checks generated Diamond/Gold/Premium candidates with the official Robi availability
endpoint (3 lanes, ~0.6 s gap, shared back-off, max 240 checks per tap) and shows only numbers reported available.
Results can be filtered by tier chips and sorted by tier/score. Tests: `node test-tiers.js`.

### v10 — unlimited tier search
- The one-tap tier search has no check cap any more: it keeps going until you tap ⏹ Stop / ⏸ Pause or leave the page (optional "How many" target, default ∞).
- Pauses automatically while the tab is hidden and resumes when visible.
- Polite pacing unchanged (3 lanes, 0.55–0.85 s gap); 429/5xx back-off in `callApi`, plus exponential back-off 2 s → 60 s on connection errors, then auto-resume — never gives up.
- Live counter: checked · 💎 Diamond · 🥇 Gold · 💜 Premium found. "▶ আরও খুঁজুন" resumes a stopped search where it left off.
