# Performance / Core Web Vitals

Method: no CrUX API key is configured, so this audit uses lab measurement
only — Lighthouse 13.4.1 (npx, Chromium), mobile form factor, simulated
"Slow 4G"-class throttling (RTT 150ms, ~1.6Mbps, 4x CPU slowdown), the same
default profile PageSpeed Insights uses. The unauthenticated PSI REST API was
rate-limited on every attempt during this session, so no field (CrUX) or
authenticated-PSI data could be pulled — everything below is lab data, not
real-user data. Treat the numbers as directionally reliable but not a
substitute for field data once CrUX/Search Console has enough traffic to
report on this origin.

Pages tested (mobile, Lighthouse performance category only):

| Page | Perf score | LCP | Speed Index | CLS | TBT |
|---|---|---|---|---|---|
| `/` (homepage) | 69/100 | 4.83s — POOR | 14.9s — very poor | 0.070 — GOOD | 5ms — GOOD |
| `/girls/` (category) | 97/100 | 2.25s — GOOD | 3.1s | 0.005 — GOOD | 79.5ms — GOOD |
| `/product/mermaid-dress/` (product) | 66/100 | 8.20s — POOR | 4.4s | 0.005 — GOOD | 308ms — needs improvement |

INP could not be measured: Lighthouse is a lab tool and does not produce a
real INP number (only a deprecated max-potential-fid proxy, which is not
reported here since FID/its proxies are obsolete per current CWV guidance).
INP requires field data (CrUX or a Real User Monitoring script) — see the
Info item below.

Thresholds used: LCP good ≤2.5s / poor >4.0s. INP good ≤200ms / poor >500ms.
CLS good ≤0.1 / poor >0.25.

## Critical

### 1. Product pages: LCP 8.2s (poor), driven by oversized, unthrottled full-quality gallery images
On `/product/mermaid-dress/` the Lighthouse LCP element is the main product
photo. It downloads at `q-90` quality and `w-1200` width even though it is
never displayed anywhere near that size, and it does **not** get
`fetchpriority="high"` (Lighthouse's own checklist: "fetchpriority=high
should be applied" — currently false). Evidence from the run:

- Total page weight: 1,187 KB across 12 requests. Images alone: 1,040 KB
  (88% of the page) across just 3 `<img>` requests.
- `ik.imagekit.io/lpdlhr/1000641134.heic?tr=w-1200,c-at_max,f-auto,q-90` —
  600 KB downloaded, Lighthouse estimates 526 KB of it is wasted
  (oversized + excess compression quality for its display size).
- `ik.imagekit.io/lpdlhr/1000641121.jpg%20(1).jpeg?tr=w-1200,c-at_max,f-auto,q-90` —
  396 KB downloaded, ~322 KB wasted.
- Lighthouse's image-delivery insight estimates **869 KB of potential
  savings on this single page** — roughly 85% of total image weight, before
  reserving anything else.
- LCP breakdown: TTFB 857ms, resource load delay 83ms, resource load
  duration 1,940ms, element render delay 368ms under throttled conditions —
  the resource itself (a needlessly large file, at q-90 with no CDN
  preconnect) is the dominant cost, not the server.
- No `<link rel="preconnect">` to `ik.imagekit.io` exists anywhere, so the
  browser pays a full DNS+TLS+TCP handshake before it can even start
  downloading the LCP image, on top of the oversized payload.

Same underlying pattern (oversized ImageKit transform + no priority hint)
will affect every one of the ~68 product pages listed in the sitemap, since
they share one template.

**What this means for the site:** on a typical customer's phone connection,
the main product photo — the thing that sells the dress — can take 8+
seconds to finish appearing. That is well past the point where shoppers
give up and leave, and it will keep Core Web Vitals in the "poor" bucket for
product pages, which Google factors into ranking and which directly costs
conversions on the pages that matter most for revenue.

**Recommendation (highest impact, do this first):**
- Lower the ImageKit quality parameter on product hero images from `q-90` to
  `q-70`–`q-75` (visually near-identical for most photography, roughly
  halves file size).
- Request a width that matches the actual rendered size × device pixel
  ratio instead of a flat `w-1200` for every breakpoint — e.g. serve
  `w-700`/`w-900` variants via `srcset` sized to the gallery's real display
  width (the gallery renders at ~380px CSS width per the audit, so even
  accounting for a 2x-3x DPR phone, 1200px is oversized).
- Add `fetchpriority="high"` to the main product image `<img>` tag on the
  product template (it is already eagerly loaded and discoverable in the
  initial HTML — the priority hint is the one missing piece).
- Add `<link rel="preconnect" href="https://ik.imagekit.io" crossorigin>` in
  the `<head>` of the product (and homepage/category) templates so the
  connection to the image CDN is already warm when the LCP image request
  fires.
- Expected impact: bringing the LCP image down from ~600KB/396KB to a
  properly-sized ~100-150KB q-75 file, plus removing the connection-setup
  delay, should move product-page LCP from ~8.2s into the 2.5-3.5s range —
  a meaningful step toward "good," and likely the single highest-ROI fix
  available on this site.

### 2. Homepage: Speed Index 14.9s and LCP 4.83s, driven by the hero image carousel
The homepage's "explore collection" 3D carousel (`<carousel-3d>`, driven by
`/carousel-3d.js`) loads ~10 product thumbnails that are individually much
larger than needed for their displayed size:

- `1000641130.heic?tr=w-800,c-at_max,f-auto` — 145 KB downloaded, 136 KB
  (94%) wasted: displayed at 178×316px but sized at 800×1074px.
- `1000641121.jpg (1).jpeg?tr=w-800,...` — 134 KB, ~125 KB wasted (596×800
  actual vs. 239×239 displayed, plus excess compression).
- Five more carousel images in the same 80-112 KB range, same pattern.
- Lighthouse's image-delivery insight totals **958 KB of potential savings**
  on the homepage — the carousel alone accounts for most of the page's
  1,397 KB total weight (1,181 KB / 85% is images).
- Speed Index scored 0.01/1.0 (effectively the worst possible) because the
  carousel keeps painting/repainting images well into the page load; total
  page load only reaches "Interactive" at 4.9s.
- The actual largest-contentful-paint *element*, however, is the hand-drawn
  hero sketch (`/assets/dress-sketch-tall.webp`), which already correctly
  uses `fetchpriority="high"` and is not lazy-loaded — that part is done
  right. The 4.83s LCP time is inflated by contention with the carousel's
  simultaneous image requests competing for bandwidth on the same
  connection under throttled conditions.

**Recommendation:**
- Apply the same ImageKit sizing/quality fix as Critical #1 to every
  carousel thumbnail (`w-400` instead of `w-800` matches the actual 178-
  239px display width even at 2x DPR; drop to `q-70`-`q-75`).
- Confirm the carousel component defers loading of off-screen/upcoming
  slides rather than fetching all ~10 images immediately (the images
  already carry `loading="lazy"`, which is good, but they still fire early
  enough to compete with the LCP hero image — consider `fetchpriority="low"`
  on carousel images specifically, since `loading="lazy"` alone doesn't
  deprioritize a request once it enters the loading viewport range).
- This should cut homepage image weight by roughly two-thirds and pull
  Speed Index down from the "very poor" 14.9s range substantially, without
  touching the hero image logic that is already correct.

## High

### 3. Render-blocking CSS delays first paint on every page
`tokens.css` (2.9 KB) and `styles.css` (11.5 KB, ~150ms of estimated waste)
are both loaded as blocking `<link rel="stylesheet">` tags in `<head>` with
no `media` split or inlining. Lighthouse's render-blocking insight
estimates ~620ms of savings on the homepage and ~130-300ms on the other
pages tested. This is a smaller win than the image fixes above but is
essentially free and compounds with them.

**Recommendation:** inline the small amount of critical, above-the-fold CSS
directly in `<head>` (logo, header, hero layout — this is a small enough
site that a single critical CSS block is feasible to maintain by hand) and
load the rest of `styles.css` non-blocking (`<link rel="preload" as="style"
onload="this.rel='stylesheet'">` pattern, or a `media="print"` swap trick).
`tokens.css` mainly exists to declare `@font-face` rules — those don't need
to block rendering at all since every face already uses `font-display:
swap` (see Info #2), so `tokens.css` is a strong candidate for the
preload-and-swap treatment first.

### 4. Product-page interactivity: TBT 308ms (needs improvement)
Total Blocking Time on the product page (308ms) is meaningfully worse than
the homepage (5ms) or category page (79.5ms). TBT is a lab proxy for real
INP risk — a value this high suggests the product page's JS (gallery/zoom
interaction, `app.js`) is doing more main-thread work per page than the
other templates, which could translate into a sluggish first tap response
on the product gallery for real visitors on mid-range phones.

**Recommendation:** profile `app.js` specifically on a product page in
Chrome DevTools Performance panel to find the long task(s) behind the
308ms TBT (likely gallery/zoom initialization or image-load event
handlers), and break up any task over ~50ms with `requestIdleCallback` or
by deferring non-critical setup (e.g. zoom/lightbox wiring) until after
first paint.

## Medium

### 5. Six unsized icon images cause the homepage's (still "good") layout shift
The homepage's CLS of 0.070 is under the 0.1 "good" threshold, but
Lighthouse's cls-culprits insight attributes essentially all of it (0.0696)
to the hero sketch frame shifting when the small crown icon
(`/assets/logo-crown.png`, used 6 times: header inline SVG aside, section
headings, and each product photo badge) loads without explicit width/height
and without being covered by a `srcset`/`sizes` pair. `unsized-images`
scored only 0.5.

**Recommendation:** add explicit `width`/`height` attributes (or `aspect-
ratio` in CSS) to `logo-lockup.webp` and `logo-crown.png` everywhere they
appear. This is a very low-effort fix that removes the only layout-shift
risk found on the site and gives more margin against CLS regressing past
"good" as content changes.

### 6. No `preconnect` to the image CDN anywhere on the site
Every page tested loads all of its product/hero imagery from
`ik.imagekit.io`, a third-party origin, with zero `rel="preconnect"` or
`rel="dns-prefetch"` hints. Lighthouse explicitly flags this as a
"preconnect candidate" on every page. Combined with Critical #1/#2, this
adds one full connection setup (DNS + TCP + TLS) of avoidable latency before
the largest images on the page can even start downloading.

**Recommendation:** add `<link rel="preconnect" href="https://ik.imagekit.io" crossorigin>` site-wide (all templates share a common `<head>` partial per the
sitemap structure, so this is a one-line, one-place change).

## Info / Not verifiable in this audit

### 7. INP has no data source right now
No CrUX API key is configured and this origin may not have enough Chrome
traffic yet for CrUX to report on it even with a key (CrUX requires a
minimum traffic threshold per origin/URL). Lighthouse (lab) cannot produce a
real INP value — there is no substitute lab metric for INP as of the March
2024 CWV update (the old FID proxy is deprecated and is deliberately
omitted from this report). The Total Blocking Time figures above (5ms /
79.5ms / 308ms) are the closest available lab signal and point at the
product template as the one to watch, but they are not INP and should not
be reported as such.

**Recommendation:** once a Google API key with PSI/CrUX access is
available, re-run this audit with `pagespeed_check.py` to get authenticated
PSI quota and attempt a CrUX field-data pull; separately, Search Console's
Core Web Vitals report (Google Search Console, free) will start surfacing
real INP once the site has enough Chrome traffic, and requires no API key
setup — worth checking directly.

## What's already working well (no action needed)

- **No CMS/admin leakage:** confirmed no DecapBridge or Netlify CMS admin
  scripts load on any public page — `/admin/*` is correctly isolated via
  the `netlify.toml` redirect, and the public HTML for `/`, `/girls/`, and
  the product page tested contains only two first-party scripts
  (`/carousel-3d.js`, `/app.js`), both `defer`red.
- **No third-party widget bloat:** the WhatsApp "contact us" buttons are
  plain `<a href="https://wa.me/...">` links, not an embedded chat widget
  script — zero performance cost. No social-embed iframes, ad tags, or
  analytics beacons were found blocking the main thread on any page tested.
- **Fonts are self-hosted with `font-display: swap`:** all `Nunito` and
  `Caveat Brush` weights are served from `/assets/fonts/*.woff2` (own
  origin, no Google Fonts round-trip) and every `@font-face` rule already
  declares `font-display: swap`, so there's no invisible-text (FOIT) risk
  and Lighthouse's font-display audit passes cleanly. This is a genuinely
  good setup already — leave it as is.
- **Category/listing pages are fast:** `/girls/` scored 97/100 with LCP
  2.25s (good), CLS 0.005 (good), TBT 79.5ms (good). This confirms the
  performance problems are specific to the homepage hero carousel and the
  product-page image gallery, not a systemic template or hosting issue —
  fixing Critical #1 and #2 should be enough to bring the whole site into
  "good" territory without a broader re-architecture.
- **Static hosting fundamentals are solid:** TTFB was 101-294ms unthrottled
  across pages tested (well under the 800ms "good" CrUX threshold), and
  `netlify.toml` already sets `Cache-Control: public, max-age=31536000,
  immutable` on `/assets/*` while keeping HTML fresh (`max-age=0,
  must-revalidate`) — correct caching policy for a static, rebuild-on-push
  site.
