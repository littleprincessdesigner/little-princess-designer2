# E-commerce SEO Findings — littleprincessdesigner.pk

**Scope:** Product schema validation, product-page fundamentals, size-based
pricing/indexation risk, category page structure, checkout-adjacent trust
signals. No DataForSEO Merchant API configured — marketplace/competitor
pricing data is out of scope for this pass.

**Data sources:** On-page analysis (static, via `render_page.py --mode never`
against the live site) + generator source review (`tools/render.js`,
`tools/content.js`, `tools/card.js`) + full read of all 76 files in
`content/products/`. Live checks were run 2026-08-25/26 against
https://littleprincessdesigner.pk.

**Overall score: 42/100**

| Area | Score | Note |
|---|---|---|
| Schema completeness | 65/100 | Structurally sound `Product`/`AggregateOffer`, missing several recommended fields |
| Content integrity/uniqueness | 15/100 | Live, verified data corruption and duplication across a large share of the catalogue |
| Image optimization | 70/100 | Responsive `srcset`, lazy-loading, sensible alt fallback; minor gaps |
| Category structure/indexation | 55/100 | Clean breadcrumbs and URLs, but sitemap and structured data gaps |
| Checkout-adjacent trust | 70/100 | WhatsApp + deposit model is disclosed clearly, but not machine-readable |

The generator (`tools/render.js`) is well engineered — every product gets a
real prerendered URL with a correct `Product`/`AggregateOffer` block, sizes
are validated for well-formedness at build time, and one URL per product with
`AggregateOffer` is the *right* way to handle size-based pricing (it avoids
the duplicate-URL trap a per-size page would create). The score is low not
because of that architecture, but because of what has actually been typed
into it: live, verified content-quality failures are currently more damaging
to search/trust than any schema gap.

---

## Critical

### 1. Live products carry placeholder names and near-zero prices in their Product schema

Verified live on 2026-08-25/26 (not a theoretical schema check — this is what
Google and any visitor sees today):

- `https://littleprincessdesigner.pk/product/first-steps-romper/` — `<title>`
  and JSON-LD `Product.name` are **"irha dress purple"**, and the JSON-LD
  `AggregateOffer.lowPrice` is **PKR 55** (≈ USD 0.20) for what the on-page
  copy describes as "our heaviest occasion gown... hand-worked beading."
  Source file: `content/products/first-steps-romper.json`, size prices
  `[55, 7200, 66, 44]` — three of four sizes are single/double-digit PKR
  values.
- `https://littleprincessdesigner.pk/product/first-birthday-baby-set/` — the
  **most recent commit in the repo** (`ad2dbf2`, today) — is live with
  `<title>aizal red frock`, not a birthday baby set. This is not old debris;
  it is happening in the current editing session.

Scanning all 76 files in `content/products/`, **35 products (46% of the
catalogue)** contain at least one size priced under PKR 100 (values like 25,
33, 40, 44, 55, 66, 77, 88, 98), and several `name` fields are clearly
placeholder text rather than product names: `"ppl"`, `"aizal dress shortt"`,
`"purplyyyy"`, `"peachie"`, `"girrafe "`, `"welcome home daddy romperr"`.

**Why this matters for SEO/trust:** these values are not cosmetic — they are
exactly what gets written into the `Product` JSON-LD (`name`,
`offers.lowPrice`, `offers.highPrice`) that Google reads for rich results and
Search Console's structured-data reports. A dress showing as PKR 55 risks
being flagged as an invalid/implausible price, and if it is ever surfaced
in search, a shopper sees a nonsensical price next to a mismatched name.

**Root cause (from `tools/content.js`):** the build only rejects a size row
if the price is `<= 0` or the size label is unrecognised — there is no
plausibility check, so a placeholder value like `55` passes straight through
into production schema. This looks like draft/test edits made in the CMS
(Decap) that were saved before the real name and prices were entered, and
then never fixed or hidden.

**Recommendation:**
- Immediate: manually review and fix (or set `visible: false` on) the 35
  flagged files — full list below — before the next deploy.
- Structural: add a build-time warning (the codebase already has this pattern
  for the "Sale badge without a sale price" case in `content.js`) for any
  size priced under a sensible floor (e.g. PKR 1,000), and for a product
  `name` shorter than ~3 words or matching known placeholder patterns.
  Expected impact: stops corrupted schema and mismatched titles from ever
  reaching production again.

<details>
<summary>Full list of 35 affected product files (price under PKR 100 on at least one size)</summary>

`first-steps-romper.json`, `first-tooth-boy-outfit.json`,
`first-tooth-romper.json`, `first-tooth-tutu-skirt.json`,
`frozen-half-frock.json`, `girrafe.json`, `half-birthday-romper.json`,
`handcuffs-and-headband.json`, `huntrix-performance-dress.json`,
`irhu-faisy-dress.json`, `junior-waistcoat-set.json`,
`marigold-party-theme-dress.json`, `mermaid-dress.json`,
`mickey-mouse-half-frock.json`, `minnie-mouse-coustume.json`,
`naming-day-gift-set.json`, `pastel-pink-blue.json`,
`peony-beaded-gown.json`, `prince-dress-red.json`,
`purple-red-burgundy.json`, `ready-ivory-frock.json`,
`ready-peach-baby-set.json`, `ready-sky-boys-suit.json`,
`rosette-classic-frock.json`, `rosette-flower-girl-gown.json`,
`rosette-frock.json`, `royal-braid-prince-suit.json`, `sea-dress.json`,
`soft-cotton-baby-shirt.json`, `three-piece-cotton-set.json`,
`unicorn-half-frock.json`, `unicorn-tutu-dress.json`,
`welcome-home-daddy-romperr.json`, `white-butterfly.json`,
`yellow-beaded-tiara.json`, `ziva-dress.json`

</details>

### 2. Duplicate product listing: "unicorn tutu dress" is live at two different URLs

Verified live: both of the following return HTTP 200 with the **identical**
`<title>` tag `unicorn tutu dress | Girls  Luxury dresses | Little Princess
Designer`, in the same subcategory (`girls-luxury-dresses`):

- `https://littleprincessdesigner.pk/product/unicorn-tutu-dress/`
  (`content/products/unicorn-tutu-dress.json`) — one size, PKR 55.
- `https://littleprincessdesigner.pk/product/soft-cotton-baby-shirt/`
  (`content/products/soft-cotton-baby-shirt.json`) — also named
  "unicorn tutu dress" despite the filename, sizes `[55, 4400, 40, 44]`.

This is a genuine duplicate-content problem: two indexable URLs compete for
the same title/keyword, Google has to guess which one to rank (or may treat
one as a near-duplicate and drop it from the index), and internally a "baby
shirt" file is displaying as a "tutu dress." Recommend merging into a single
listing, renaming/refiling the other product correctly, and re-checking the
Search Console coverage report after the fix to confirm the resolved
duplicate isn't stuck as "Duplicate, Google chose different canonical."

---

## High

### 3. Half the catalogue shares one identical meta description and Product-schema description

`tools/render.js` (product renderer) builds the page's meta description and
the JSON-LD `Product.description` from the product's own `description`
field; when that field is blank, both fall back to the same fixed sentence:
*"Made to order, hand-finished in our Lahore studio."* (from
`settings-products.json`, `productDefaults.summaryTail`).

**40 of 76 product files (53%) have no `description` field at all**, so on
those pages both the `<meta name="description">` tag and the `Product`
schema's `description` property are word-for-word identical to every other
product missing a description — a textbook duplicate-content signal across
more than half the store. (Products that do have a subcategory- or
product-level description are fine; this only affects the ones that
inherited nothing but the sitewide fallback.)

**Recommendation:** write at least one distinguishing sentence per product
(fabric, occasion, or a detail from the photo) before publishing — even a
short one breaks the duplication, since the description meta and JSON-LD
both key off the same field. Expected impact: removes duplicate-description
warnings in Search Console for ~40 URLs and gives Google unique snippet text
to show for each.

---

## Medium

### 4. Product schema is missing several of Google's recommended `Offer` fields

Current JSON-LD per product (from `tools/render.js` lines ~557–576):

```json
{
  "@type": "Product",
  "name": "...",
  "description": "...",
  "category": "...",
  "brand": { "@type": "Brand", "name": "Little Princess Designer" },
  "image": ["..."],
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "PKR",
    "lowPrice": 17500,
    "highPrice": 23500,
    "offerCount": 4,
    "availability": "https://schema.org/InStock"
  }
}
```

This is correctly formed and, importantly, the choice of `AggregateOffer`
over one URL per size is the right way to expose "price changes with size"
without creating duplicate/near-duplicate pages — no change needed there.

Missing/recommended-but-absent fields:
- `sku` — no product has one; not required, but recommended, and useful once
  there's any inventory/ordering system beyond WhatsApp.
- `offers.url` — should point back to the canonical product URL.
- `offers.priceValidUntil` — recommended by Google for pricing freshness.
- `offers.hasMerchantReturnPolicy` / `offers.shippingDetails` — Google's
  merchant-listing structured-data requirements (introduced 2022-2023) ask
  for these to be eligible for the richer "shopping" style result. Given the
  25%-non-refundable-deposit model (see finding 6), a `MerchantReturnPolicy`
  block with `returnPolicyCategory:
  https://schema.org/MerchantReturnNotPermitted` (or a suitable custom-window
  policy) would both satisfy this and correctly set buyer expectations in
  search.
- No `aggregateRating`/`review` — acceptable to omit given this is a small
  handmade brand with no review system; do not fabricate reviews to fill this.

### 5. No `BreadcrumbList` or `ItemList` structured data despite breadcrumb UI existing everywhere

Every product and category page renders a visible breadcrumb nav
(`<nav class="lp-crumb">` in `tools/render.js`), but there is no matching
`BreadcrumbList` JSON-LD, so Google can't show the breadcrumb trail in
search-result snippets. Category pages (`CollectionPage` type) also have no
`ItemList` of the products shown. Both are low-effort additions — the data
(`cat.title`, `cat.href`, per-product `p.name`/`p.href`) is already computed
in `renderShop`/`renderProduct`; it just isn't being emitted as its own
JSON-LD block yet.

### 6. Sitemap is missing every product page (and two of the four category pages)

Live `sitemap.xml` (checked 2026-08-25) lists only **4 URLs**: the homepage,
`/contact/`, `/girls/`, and `/boys/`. It does not include `/babies/` or
`/ready/`, and it does not include **any of the 76 `/product/<slug>/`
pages**. Google can still reach product pages by following links from
category pages, but for a catalogue this size, omitting ~80 URLs from the
sitemap slows down discovery of new products and re-crawling of price/stock
changes, and gives Search Console far less visibility into per-product
indexing status. Recommend generating the sitemap from the same product/
category list the build already assembles in `tools/content.js`, rather than
a hand-maintained 4-URL list.

---

## Low / Informational

### 7. WhatsApp + 25% non-refundable-deposit ordering model — disclosed well, not machine-readable

There is no cart, no checkout, and no online payment: ordering happens by
messaging on WhatsApp, paying a 25% non-refundable deposit to start
production, and paying the rest on delivery. This is unusual for e-commerce
schema purposes but not a problem in itself — the `Offer.availability`
field (`InStock`/`OutOfStock` based on the `Sold out` badge) is used
correctly and doesn't require an actual "Buy" button to be valid. The terms
are also disclosed clearly and in plain language on the contact page (steps
+ FAQ: *"A 25% advance starts production. Non-refundable once we cut."*),
which is good practice for a made-to-order business. The only gap is that
this policy exists only as page copy, not as `MerchantReturnPolicy` schema —
see recommendation in finding 4.

### 8. Image alt text: reasonable fallback, but generic across a product's whole gallery

`tools/content.js`'s `resolveImage()` falls back to the product name when a
photo has no explicit `alt`, which is a sound default (never blank). Almost
no product in `content/products/` sets a per-image `alt`, so every photo in
a product's gallery — front, back, detail shots — shares the same alt text.
Not urgent, but writing one distinguishing `alt` per image (e.g. "front,"
"back," "beading detail") would be a small accessibility and image-search
improvement.

### 9. Two very recently committed products return 404 on the live site

`content/products/elephant.json` (commit `91c752a`) and
`content/products/dados-lil-man-romper.json` (commit `ca561d4`) currently
404 on the live site while the newest commit's product
(`first-birthday-baby-set.json`, `ad2dbf2`) is live. This is most likely
Netlify build/deploy lag rather than an SEO defect — worth a quick check of
the latest Netlify deploy log to confirm the build succeeded and these two
are simply mid-deploy, not silently failing.

---

## Priority summary

| Priority | Finding | Effort to fix |
|---|---|---|
| Critical | 46% of products have placeholder names/near-zero prices live in Product schema | Content cleanup (manual) + a build-time price/name sanity check |
| Critical | Duplicate "unicorn tutu dress" listing at two URLs | Content fix (merge/rename) |
| High | 53% of products share one identical meta description/schema description | Content: one unique sentence per product |
| Medium | `Offer` missing `sku`, `url`, `priceValidUntil`, return-policy/shipping schema | Template change in `tools/render.js` |
| Medium | No `BreadcrumbList`/`ItemList` schema | Template change in `tools/render.js` |
| Medium | Sitemap omits all 76 product pages and 2 category pages | Generate sitemap from existing product/category list |
| Low | WhatsApp/deposit trust terms not machine-readable | Add `MerchantReturnPolicy` schema |
| Low | Alt text generic across a product's gallery | Content: per-image alt text |
| Info | 2 recent products 404 live, likely deploy lag | Check latest Netlify deploy |
