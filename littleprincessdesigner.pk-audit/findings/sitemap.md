# Sitemap Architecture Audit — littleprincessdesigner.pk

Date: 2026-08-26
Auditor: Sitemap Architecture specialist (automated)
Live sitemap: https://littleprincessdesigner.pk/sitemap.xml (fetched 2026-08-25 ~06:09 UTC)
Generator: `tools/build.js` (line ~185), driven by `tools/content.js`

## Score: 62 / 100

The sitemap file itself is clean, well-formed, and correctly built by design (no
deprecated tags, real per-file dates, admin excluded). It loses most of its
score because **the live site is stale** — it does not reflect the current
`main` branch, and the most likely cause (a broken `site/admin/config.yml`
parse in the same build pipeline) was reproduced locally. That is a content
freshness / build-pipeline problem, not a sitemap-generator bug, but it shows
up in the sitemap as missing new products and one deleted product that's still
indexable.

## Summary table

| Check | Result | Severity |
|---|---|---|
| XML well-formed | Pass | — |
| Correct namespace (`urlset` 0.9) | Pass | — |
| Deprecated tags (`priority`/`changefreq`) | Pass — none present | — |
| `<lastmod>` format (W3C date) | Pass | — |
| `<lastmod>` accuracy vs content history | Pass, mostly — see note on identical dates | Low |
| URL count / size vs 50k / 50MB cap | Pass — 68 URLs, ~8 KB | — |
| Declared in robots.txt | Pass | — |
| `/admin/` excluded from sitemap | Pass (also disallowed in robots.txt) | — |
| `/admin/` itself returns 200, not blocked at HTTP level | Fail | Medium |
| All sitemap URLs return 200 | Fail — one entry is a deleted product | High |
| Coverage: live products vs sitemap | Fail — 13 catalog items missing | High |
| Sitemap reflects current repo state | Fail — stale by several days | Critical (root cause) |
| Location-page doorway thresholds (30+/50+) | N/A | — |

## 1. Format and generator correctness (Pass)

`tools/build.js` (~line 178-197) writes a single, spec-correct sitemap:

```
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>...</loc><lastmod>YYYY-MM-DD</lastmod></url>
  ...
</urlset>
```

- No `priority` or `changefreq` — good, since Google ignores both.
- `<lastmod>` is derived from real git commit history per content file
  (`contentDates()`), not from build-time file mtimes, and the code
  deliberately omits `<lastmod>` entirely if it can't get real dates from a
  full clone rather than stamping every URL "today." This is the correct
  approach and better than what most small sites do.
- The URL list is built from exactly: `/`, `/contact/`, each of the 4
  category pages (`/girls/`, `/boys/`, `/babies/`, `/ready/`), and every
  product under `/product/<id>/`. `/admin/*` is never added — confirmed by
  robots.txt disallow and by the generator not iterating that directory.
- 68 URLs total in the live file — far under the 50,000 URL / 50 MB cap.
  No index-of-sitemaps is needed at this size.

## 2. robots.txt cross-check (Pass)

Live `robots.txt`:
```
User-agent: *
Allow: /
Disallow: /admin/
Sitemap: https://littleprincessdesigner.pk/sitemap.xml
```
The sitemap is correctly declared, and the sitemap URL itself returns HTTP 200.
`/admin/` is disallowed for crawling and correctly absent from the sitemap —
consistent.

**Gap:** `Disallow: /admin/` only asks well-behaved crawlers not to *crawl* the
path; it does not stop a URL from being indexed if it's linked from elsewhere,
and it does not add `noindex`. Checked live: `https://littleprincessdesigner.pk/admin/`
returns HTTP 200 with no `X-Robots-Tag` header (the `noindex` header in
`netlify.toml` is only applied to `/admin/*` sub-paths, not `/admin/` itself —
worth confirming the redirect rule `/admin/* -> /admin/index.html` also carries
that header through, or add a `<meta name="robots" content="noindex">` in the
admin's own `index.html`). Low practical risk since it's disallowed and no
real page content is there, but cheap to close.

## 3. URL health — one entry fails (High)

Spot-checked every sitemap URL type:

| URL | Status |
|---|---|
| `/` | 200 |
| `/contact/` | 200 |
| `/girls/`, `/boys/`, `/babies/`, `/ready/` | 200 |
| `/product/eid-waistcoat-set/` | 200 |
| `/product/first-birthday-baby-set/` | 200 |
| **`/product/peach-popper-shirt/`** | **200 — but this product was deleted from the CMS on 2026-08-22** |

`peach-popper-shirt` was removed via a "Delete Product" commit
(`82ed24f`, 2026-08-22T20:39:45Z) and no longer exists anywhere in
`content/products/`. It should have disappeared from both the site and the
sitemap the next time the site built (the generator rebuilds from scratch
every time — a deleted product "simply stops having a page," per the comment
at the top of `build.js`). It is still live and still listed in the sitemap,
which means **no successful production build has run since before that
deletion** — see §5.

No redirects or 404s otherwise found among the sampled URLs; trailing slash
usage is consistent (`/product/x` 301s to `/product/x/`, matching the
sitemap's own trailing-slash form).

## 4. Coverage — 13 live catalog items are missing from the sitemap (High, but sitemap is behaving correctly given what's deployed)

Compared `content/products/*.json` (76 files, current `main`) against the 64
product URLs in the live sitemap:

**In the CMS content, marked `visible: true`, but absent from the sitemap and returning 404 live:**
blue-horizon-dress, dados-lil-man-romper, elephant, first-tooth-boy-outfit-knickers,
first-tooth-outfit-dark-blue, first-tooth-romper, girrafe, half-birthday-romper,
handcuffs-and-headband, huntrix-performance-dress, masha-and-the-bear-dress,
welcome-home-daddy-romperr, yellow-beaded-tiara (13 products)

Verified `blue-horizon-dress`, `elephant`, `girrafe`, `dados-lil-man-romper` all
return HTTP 404 live — they were never deployed, so their absence from the
sitemap is technically "correct" (you can't list a page that doesn't exist),
but it means 13 finished, published-looking products are invisible to Google
and to customers, on top of the stale `peach-popper-shirt` entry from §3.

No sitemap URL was found pointing at a page that doesn't exist in content
*except* `peach-popper-shirt` (§3) — so this isn't a sitemap-code bug adding
wrong URLs; it's the whole site being several commits behind.

## 5. Root cause: the live site has not rebuilt successfully in days (Critical — feeds directly into the coverage and stale-URL findings above)

Evidence, most-recent-first:
- Sitemap fetched live still lists `peach-popper-shirt`, deleted 2026-08-22 20:39 UTC.
- 13 products created 2026-08-22 21:09–22:21 UTC (and edited again 2026-08-25)
  are not live.
- Running the project's own build right now, on the current `main` checkout,
  **fails outright**:
  ```
  npm run build
  → node tools/check-config.js
  FAILED — 4 problem(s) that would lose content:
    ✗ collection 'products' missing from config.yml
    ✗ collection 'subcategories' missing from config.yml
    ✗ collection 'categories' missing from config.yml
    ✗ collection 'settings' missing from config.yml
  ```
  and `node tools/build.js` on its own throws:
  ```
  Error: Cannot read the size list from site/admin/config.yml
  (products → Sizes and prices → Size → options): no 'products' collection.
  ```
  `tools/content.js`'s hand-written YAML reader (`tools/yaml.js`, used because
  the project has zero dependencies) is not parsing `site/admin/config.yml`
  correctly — it returns 4 collection entries but with `name: undefined` on
  each, so the products collection can never be found. `netlify.toml` runs
  exactly `npm run build` for production deploys, so **this same failure would
  block Netlify's build too**, which would explain why Netlify keeps serving
  an old successful deploy instead of the current content.
  `site/admin/config.yml` was last restructured in commit `73b76a0`
  ("Admin controls for the carousel, Site settings in three pages…",
  2026-08-22 01:40 UTC) — the timing lines up with when new content stopped
  reaching the live site.

**This is outside the scope of a sitemap fix** (it's a build-tooling bug, not
a sitemap-generator bug), but it is the reason the sitemap looks stale, and it
is worth raising to whoever maintains the build as the actual thing to fix.
Recommend checking the Netlify deploy log for the site's most recent builds —
if they show the same "no 'products' collection" error, that confirms this is
what's blocking every deploy since 2026-08-22.

## 6. `<lastmod>` accuracy (Pass, with one note — Low)

All 64 product entries in the current live sitemap share the exact same
`<lastmod>2026-08-22</lastmod>`, and the home/contact pages also both show
`2026-08-22`; all 4 category pages share `2026-08-04`. Checked against git
history: this matches real commit activity (a large batch of product edits
did land on 2026-08-22, and the categories haven't been touched since the
2026-08-04 bulk import), so these dates appear to be genuine rather than a
generator defect — the generator is explicitly designed to avoid stamping
"today" on everything (see comment in `build.js` lines 39-53). Still,
identical dates across the whole catalog are a weak signal to Google even
when accurate, and will look more suspicious to a crawler than to a human
once new edits resume and dates start to spread out again.

## 7. Location-page quality gates — Not applicable

This is a small handmade-kidswear catalog (4 category pages + ~64-76
products), with no location/city pages at all. The 30+/50+ location-page
thresholds in the standard checklist do not apply here and were not
triggered.

## Recommended actions, in order

1. **Fix the build so it deploys again.** Check Netlify's build log for the
   most recent deploy attempts; if they show the `content.js`/`config.yml`
   parsing error reproduced above, that is the actual blocker. Until it's
   fixed, every new product added in the CMS will keep silently failing to
   go live, and every deleted product will keep incorrectly staying live and
   indexable.
2. Once builds succeed again, redeploy so the sitemap picks up the 13 missing
   products and drops `peach-popper-shirt`.
3. Optionally add a `noindex` meta tag to `site/admin/index.html` (or confirm
   the existing `X-Robots-Tag: noindex` header in `netlify.toml` actually
   covers `/admin/` and not just `/admin/*` sub-paths) so the admin panel
   itself can never be indexed even if something links to it.
4. No sitemap-code changes are needed — the generator (`tools/build.js`) is
   already doing the right things (correct namespace, no deprecated fields,
   honest dates, admin excluded, well under size limits).
