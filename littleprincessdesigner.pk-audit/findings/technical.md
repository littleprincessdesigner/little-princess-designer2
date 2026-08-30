# Technical SEO Audit — littleprincessdesigner.pk

Audit date: 2026-08-26
Method: live fetch of https://littleprincessdesigner.pk (and http/www variants), robots.txt, sitemap.xml, homepage, one category page (/girls/), one product page (/product/aurora-theme-dress/), plus a repo-side check of the 76 product content files behind the product pages. Rendered with the seo skill's `render_page.py` (`mode auto` — result: raw fetch, `is_spa: false`), `sitemap_discovery.py`, `schema_ecommerce_validate.py`, and `preload_check.py`.

**Technical SEO score: 70 / 100**

The scaffolding (robots.txt, sitemap, canonicals, redirects, mobile CSS, SSR content) is solid and clearly deliberately built. The score is pulled down mainly by one critical content/URL-integrity bug that affects 41% of live product pages, plus a Merchant-Listing-blocking structured data gap and a couple of Core Web Vitals gaps on the product template.

---

## Critical

### 1. 31 of 76 product URLs (41%) show a completely different product than their URL slug implies
**Category:** Indexability / URL structure
**Evidence:** The URL `https://littleprincessdesigner.pk/product/aurora-theme-dress/` renders a page titled, H1'd, and JSON-LD-named "huda dress pink" — a pink beaded gown, not an "aurora" themed dress. The underlying file `content/products/aurora-theme-dress.json` has `"name": "huda dress pink"`. A repo-wide scan of `content/products/*.json` (filename = URL slug, per `tools/content.js`) found 31 files where the slug and the `name` field share no meaningful words:

  | URL slug (unchanged) | Actual page content (`name`) |
  |---|---|
  | `/product/blossom-birthday-theme-dress/` | "amna dress pink" |
  | `/product/clara-walima-gown/` | "amna dress purple" |
  | `/product/peony-beaded-gown/` | "mickey mouse dress" |
  | `/product/rosette-classic-frock/` | "purplyyyy" |
  | `/product/naming-day-gift-set/` | "ppl" |
  | ...(26 more — full list available in scratch data) |

  `git log -p` on `content/products/blossom-birthday-theme-dress.json` confirms the mechanism: commit `e0146d0` ("Update Product 'blossom-birthday-theme-dress' ... via DecapBridge") changed `"name"` from `"Blossom Birthday Theme Dress"` to `"amna dress pink"` in place, in the same file. The static-site generator derives both the URL and the `id` directly from the filename (`tools/content.js:381-452`, `href: "/product/" + slug + "/"`) and never renames the file when the admin panel edits a product's name — so every time someone reuses an existing catalogue slot to list a new/renamed piece instead of creating a fresh entry, the live URL permanently stops matching its content.

**Why it matters (plain terms):** Anyone who finds one of these pages through Google search, a saved link, or a social share for what the URL/old listing said ("Aurora Theme Dress") lands on an unrelated product ("huda dress pink") instead. That is a broken promise to both Google and shoppers — it damages trust, tanks click-through on that listing, and confuses Google about what each URL is actually about (hurting how well it ranks for either name). Several of the actual product names showing live right now are also placeholder-looking test names ("ppl", "purplyyyy", "KS shoot dress", "red") rather than real product titles a customer would search for.

**Recommendation:**
- Going forward, always create a **new** product entry (new file/slug) in the admin panel when adding a genuinely different piece, rather than editing an existing product's name in place. Reserve "editing a product" for price/size/photo/description changes to the *same* piece.
- For the 31 already-mismatched pages, either restore the correct product info at that URL, or 301-redirect the old slug to the correct new slug for that product and republish the item at a URL matching its real name — then resubmit the affected URLs to Google Search Console for reindexing.
- Add a lightweight build check (this repo already has `tools/test.js`) that flags when a product's slug and its `name` field slugify to less than ~30% word overlap, so future renames get caught before publish rather than after.

---

## High

### 2. Product structured data will likely be rejected for Google Merchant Listing rich results
**Category:** Structured Data
**Evidence:** Validating the live JSON-LD from `/product/aurora-theme-dress/` against Google's Product/Merchant rules:
```
High:   offers.@type is "AggregateOffer" — merchant listings require "Offer".
Medium: Offer is missing the recommended "price" field.
Medium: Product/Offer is missing hasMerchantReturnPolicy.
Medium: Product/Offer is missing shippingDetails.
```
Every product page on the site uses the same template, so this applies sitewide (~76+ product pages).

**Recommendation:** Since each product is sold in multiple sizes at different prices, either (a) emit one `Offer` per size as a `ProductGroup`/`hasVariant` structure (Google's now-preferred pattern for apparel with size variants), or (b) keep `AggregateOffer` but also declare `hasMerchantReturnPolicy` and `shippingDetails` at the `Product` level, which Google will accept as of the 2023+ structured-data requirements for Product rich results. Without these, product rich results (price, availability, star ratings if added later) are unlikely to display in Search.

### 3. Product pages (the majority of the site) don't prioritize their LCP image — Core Web Vitals risk
**Category:** Core Web Vitals
**Evidence:** `preload_check.py` scored the homepage 75/100 (hero image correctly marked `fetchpriority="high"`), but the product template scored 50/100:
```
lcp_resource_hints.preload_lcp_candidate: false
lcp_resource_hints.fetchpriority_high: 0
recommendation: "Mark the LCP hero image with fetchpriority=\"high\"..."
```
The first gallery image on `/product/aurora-theme-dress/` (the page's Largest Contentful Paint candidate) has no `fetchpriority` and no preload hint, and it is served from a third-party host (`ik.imagekit.io`) with **no `<link rel="preconnect" href="https://ik.imagekit.io">`** in `<head>` — so the browser pays a full DNS + TLS handshake to that host before it can even start downloading the LCP image.

**Recommendation:** On the product template, add `fetchpriority="high"` to the first (visible, above-the-fold) gallery image only, and add `<link rel="preconnect" href="https://ik.imagekit.io" crossorigin>` to `<head>` on every page that references ImageKit images (homepage carousel, category grids, product galleries). This is a small template change with an outsized LCP benefit since it affects every one of the ~80 catalogue pages.

---

## Medium

### 4. No baseline security headers beyond HSTS
**Category:** Security
**Evidence:** Response headers on `https://littleprincessdesigner.pk/` are limited to `Strict-Transport-Security: max-age=31536000`. There is no `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, or `Permissions-Policy`. The HSTS header also lacks `includeSubDomains` and `preload`.
**Recommendation:** Add via `netlify.toml` `[[headers]] for = "/*"`:
```
X-Content-Type-Options = "nosniff"
Referrer-Policy = "strict-origin-when-cross-origin"
X-Frame-Options = "DENY"
Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
```
A `Content-Security-Policy` is worth adding too but needs care since the site loads images from `ik.imagekit.io` and links out to WhatsApp/Instagram/Facebook/TikTok — start with a report-only policy before enforcing.

### 5. CSS/JS served at the site root are never cached long-term
**Category:** Core Web Vitals / caching
**Evidence:** `netlify.toml` gives `/assets/*` a 1-year immutable cache, but `styles.css` (46 KB), `tokens.css` (11 KB), `app.js` (25 KB) and `carousel-3d.js` (6 KB) live at the site root, are not fingerprinted, and fall back to Netlify's default caching alongside HTML — every repeat visit re-validates them instead of using a cached copy.
**Recommendation:** Either move these into `/assets/` (or a versioned subpath) with content-hashed filenames and reference them with the hash, or add an explicit `[[headers]] for = "/*.css"` / `"/*.js"` rule with a shorter-but-real max-age (e.g. `public, max-age=3600, must-revalidate`) so returning visitors on a slow connection aren't refetching the full CSS/JS on every page.

### 6. Product schema is missing return policy, shipping, and (per finding 2) loyalty/member-program data
Rolled into finding 2 above — listed separately in Google's validator output as three independent Medium-severity gaps; fixing them together is efficient since they're all additions to the same JSON-LD block.

### 7. No BreadcrumbList structured data despite a visible breadcrumb trail
**Category:** Structured Data
**Evidence:** Product pages render a real breadcrumb nav (`Home › Girls › Luxury dresses › huda dress pink`) but there is no matching `BreadcrumbList` JSON-LD block — only `Product` schema is present.
**Recommendation:** Add a `BreadcrumbList` block mirroring the visible trail. Low effort, and it's the most common cause of the breadcrumb rich snippet (folder-path display) under search results.

### 8. IndexNow protocol not implemented
**Category:** IndexNow
**Evidence:** No IndexNow key file was found at any of the conventional locations (`/indexnow.txt` → 404), and there's no reference to IndexNow in the repo (`indexnow_submit.py` requires a host key file the site doesn't currently publish). Bing, Yandex and Naver support instant-indexing via IndexNow at no cost.
**Recommendation:** Generate an IndexNow key, publish it at `https://littleprincessdesigner.pk/<key>.txt`, and call the IndexNow API (a single POST) from the Netlify build hook whenever `dist/` changes — pushing the sitemap URL list (or just the changed pages) each deploy. This is inexpensive to add given the site already deploys on every git push.

---

## Low

### 9. `/index.html` is a live, separately-crawlable duplicate of `/`
**Category:** Indexability
**Evidence:** `https://littleprincessdesigner.pk/index.html` returns `200 OK` (not a redirect) and correctly self-canonicalizes to `https://littleprincessdesigner.pk/` — so there's no ranking risk, but it's an avoidable duplicate URL that a crawler still has to fetch and evaluate.
**Recommendation:** Add a Netlify redirect: `/index.html` → `/` (301), same pattern already used for the trailing-slash normalization on category/product URLs.

### 10. Social preview tags incomplete on Twitter Card
**Category:** Indexability / sharing
**Evidence:** Pages set `twitter:card` and `twitter:image` but not `twitter:title` or `twitter:description`; Twitter/X falls back to the Open Graph title/description, which are present and correct, so this is cosmetic risk only (some third-party unfurlers don't fall back).
**Recommendation:** Add `twitter:title` and `twitter:description` mirroring the existing `og:title`/`og:description` for full compatibility.

### 11. First `<img>` in each responsive image falls back to a HEIC file for non-`srcset`-aware clients
**Category:** Mobile / compatibility
**Evidence:** e.g. `<img src="https://ik.imagekit.io/lpdlhr/1000641115.heic" srcset="...f-auto...">` — modern browsers always honor `srcset` (which requests an auto-negotiated format via ImageKit's `f-auto`), so this only affects the vanishingly small number of clients with no `srcset` support, where a raw `.heic` would fail to render.
**Recommendation:** Point the fallback `src` at an ImageKit URL with an explicit `?tr=f-auto` transform (or a plain `.jpg`) instead of the raw upload, for defense in depth.

### 12. No `security.txt`
**Category:** Security
**Evidence:** `/.well-known/security.txt` → 404.
**Recommendation:** Optional best practice; low priority for a small e-commerce brochure site, but a two-minute add if a security researcher ever needs a contact channel.

---

## Passed / no issues found

- **Crawlability:** `robots.txt` is valid, allows `/`, disallows `/admin/`, and declares `Sitemap: https://littleprincessdesigner.pk/sitemap.xml`. The sitemap validates as a proper `urlset`, and `sitemap_discovery.py` confirmed it via the robots.txt declaration (not a stale/guessed fallback).
- **Admin noindex:** `/admin/*` correctly returns `X-Robots-Tag: noindex` (verified live), matching `netlify.toml`.
- **Canonicals:** Every page checked (home, category, product, and the query-string variant `/girls/?utm_source=test`) emits a correct, self-referencing, query-stripped canonical tag.
- **No accidental noindex:** No `<meta name="robots">` tag found on any public template (home, category, product).
- **HTTPS/redirects:** `http://` and `https://www.` both 301 to the canonical `https://littleprincessdesigner.pk/`. Trailing-slash-less and mixed-case category URLs (`/girls`, `/Girls/`) both 301 to the clean lowercase, trailing-slash form. No redirect chains (each is a single hop) or redirect loops found.
- **404 handling:** Unknown paths return a real `404` status (not a soft-404 200), so they won't be indexed as content.
- **URL structure:** Clean, lowercase, hyphenated, trailing-slash-consistent paths throughout (`/product/<slug>/`, `/girls/`, `/contact/`) with no query-string or session-ID pollution.
- **Mobile-friendliness:** Correct `<meta name="viewport" content="width=device-width, initial-scale=1">` with no zoom-disabling. CSS uses `aspect-ratio` on every image container (hero, carousel, gallery, card grid) to reserve layout space — a real, deliberate CLS mitigation, not an accident. Interactive controls (`select`, filter buttons, range input) are styled with `min-height:44px`, meeting the 44px touch-target guideline.
- **JavaScript rendering:** Confirmed **not** an SPA (`is_spa: false`). Full page content — headings, product descriptions, prices, nav — is present in the raw HTML with no client-side rendering required; `extracted_text` pulled a complete, meaningful summary from a plain fetch. A `<noscript>` block explicitly serves the full unfiltered catalogue if JS fails to load, which is good defensive design.
- **Homepage structured data:** `ClothingStore` + `PostalAddress` JSON-LD is present and passes basic validation (`"valid": true`), confirming the known baseline is intact.
- **Fonts:** No web-font requests (`@font-face`/Google Fonts) found — the site uses system fonts, avoiding FOIT/FOUT and an extra render-blocking or layout-shifting resource.
- **HSTS:** Present sitewide (`max-age=31536000`), just missing `includeSubDomains`/`preload` (see Medium #4).

---

## Category scorecard

| Category | Status |
|---|---|
| 1. Crawlability | Pass |
| 2. Indexability | Fail — critical URL/content mismatch (Critical #1), minor `/index.html` duplicate (Low #9) |
| 3. Security | Needs improvement — HTTPS/HSTS solid, other headers missing (Medium #4) |
| 4. URL structure | Pass |
| 5. Mobile | Pass |
| 6. Core Web Vitals (lab estimate) | Needs improvement — product-page LCP hints missing (High #3), asset caching (Medium #5) |
| 7. Structured data | Needs improvement — homepage baseline valid; product schema fails Merchant Listing checks (High #2), no BreadcrumbList (Medium #7) |
| 8. JavaScript rendering | Pass — server-rendered, no SPA shell |
| 9. IndexNow | Not implemented (Medium #8) |
