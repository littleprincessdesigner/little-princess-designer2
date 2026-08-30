# Structured Data (Schema.org) Findings — littleprincessdesigner.pk

Audit date: 2026-08-26
Score: **62 / 100**

## Plain-language summary

The site does use structured data (the invisible tags that help Google understand
a page), and it's built the right way — JSON-LD, the format Google prefers, on
every page type. No deprecated schema (no HowTo, no Special Announcement) is
used anywhere, which is good.

Two things pull the score down:

1. **A live pricing bug that has leaked into the product schema.** One product
   page currently live on the site (`/product/first-birthday-baby-set/`, which
   displays as "aizal red frock") is showing **PKR 55** as its price, and the
   structured data behind it says the price range is **PKR 44–7,400**. Looking
   at the repo, this product's prices were corrected to PKR 25,000–32,000 in a
   commit made today (`ad2dbf2`), but the live site is still serving the old,
   wrong numbers. This isn't a schema-writing mistake — the code that builds the
   schema is fine — it's that **the site itself hasn't picked up the latest
   commit yet**. This needs checking in Netlify (see "not live yet" note below).
2. **No breadcrumb schema anywhere**, even though every category and product
   page already shows a visible breadcrumb trail ("Home › Girls › Luxury
   dresses › ..."). Adding the matching structured data is a quick, safe win.

Everything else is smaller: the store's address/contact schema on the homepage
is missing a few optional details, and three recently added or edited products
(elephant, dados-lil-man-romper, blue-horizon-dress) aren't live yet either, so
their schema couldn't be checked — same deploy-lag issue as above, not a schema
defect on its own.

**Important — not verified live:** the FAQ block (`c.faq` in
`content/settings-contact.json`) does render as `FAQPage` on `/contact/`. Per
standing rules, this is flagged at **Info** severity only: Google retired FAQ
rich results for all sites as of 7 May 2026, so this markup no longer earns any
search-result enhancement. It is not broken and does not need to be removed —
it's simply no longer doing anything for Google search. Any benefit to AI
answer engines citing it is unconfirmed, not something to promise. Because
these questions are written by the business rather than submitted by users,
`QAPage` would not be the right replacement type here.

---

## 1. Detection results

| Page type | URL checked | Schema found | Format |
|---|---|---|---|
| Homepage | `/` | `ClothingStore` + `PostalAddress` (662 bytes, 1 block) | JSON-LD |
| Category | `/girls/` | `CollectionPage` (296 bytes, 1 block) | JSON-LD |
| Product (live) | `/product/first-birthday-baby-set/` | `Product` + `Brand` + `AggregateOffer` (770 bytes, 1 block) | JSON-LD |
| Contact | `/contact/` | `FAQPage` with `Question`/`Answer` (1,130 bytes, 1 block) | JSON-LD |
| Product (not yet live) | `/product/elephant/`, `/product/dados-lil-man-romper/`, `/product/blue-horizon-dress/` | 404 — could not verify | — |
| 404 page | (not requested) | none (by design, `noindex`) | — |

No Microdata or RDFa found anywhere — JSON-LD only, which is Google's
preferred format. `@context` is consistently `"https://schema.org"` (correct,
not the deprecated `http://` form). All checked pages use absolute image URLs.

Generator: `tools/render.js` — `renderHome` (line ~383, `ClothingStore`),
`renderShop` (line ~500, `CollectionPage`), `renderProduct` (line ~557,
`Product`/`AggregateOffer`), `renderContact` (line ~654, `FAQPage`).

## 2. Validation results

### Homepage — `ClothingStore`

| Check | Result |
|---|---|
| Valid, non-deprecated `@type` | Pass — `ClothingStore` is a valid `Store` subtype |
| `@context` https | Pass |
| Required properties (`name`, `address`) | Pass |
| No placeholder text | Pass |
| Absolute URLs | Pass (`url` is `siteUrl + "/"`) |
| Date format (`foundingDate`) | Pass — `"2015"` is valid year-precision ISO 8601 |
| Address completeness | **Fail (Medium)** — only `addressLocality` and `addressCountry` are set; no `streetAddress`, `postalCode`, or `geo` coordinates |
| Recommended properties present (`image`, `priceRange`, `openingHoursSpecification`) | **Fail (Medium)** — all three are absent |

### Category pages — `CollectionPage`

| Check | Result |
|---|---|
| Valid `@type` | Pass |
| Required properties (`name`, `url`) | Pass |
| No placeholder text | Pass |
| Missing `BreadcrumbList` to match the visible breadcrumb nav | **Fail (High)** |

### Product pages — `Product` + `AggregateOffer`

| Check | Result |
|---|---|
| Valid `@type` (`Product`, `Brand`, `AggregateOffer`) | Pass |
| Required `Product` properties (`name`, `image`) | Pass |
| `offers` present with `priceCurrency`, `lowPrice`, `highPrice`, `offerCount` | Pass (structure) |
| `availability` uses full schema.org URL enum (`https://schema.org/InStock` / `OutOfStock`) | Pass |
| Numbers, not quoted strings, for price fields | Pass |
| **Price accuracy** | **Fail (Critical)** — live page shows `lowPrice: 44, highPrice: 7400`, PKR 55 on the page itself, while the current content file (`content/products/first-birthday-baby-set.json`) has been corrected to 25,000–32,000. The live build is stale. |
| Data-quality: `category` string | **Fail (Info)** — renders as `"Girls  > Luxury dresses"` (double space) because `content/categories/girls.json` has `"label": "Girls "` with a trailing space |
| Recommended: `url`, `sku`/`mpn`, `priceValidUntil`, `seller`, `aggregateRating`/`review` | Not present — optional, see recommendations |

### Contact page — `FAQPage`

| Check | Result |
|---|---|
| Valid structure (`Question`/`acceptedAnswer`/`Answer`) | Pass |
| Rich-result eligibility | **N/A — Info only.** Google retired FAQ rich results for all sites 7 May 2026. This markup is technically correct but earns no SERP feature. No removal recommended; no confirmed AI/GEO benefit either. |

## 3. Missing schema opportunities

1. **`BreadcrumbList` (High priority, low effort).** Every shop and product
   page already renders a visible breadcrumb trail in HTML
   (`tools/render.js` lines ~442 and ~534). Adding the matching JSON-LD is a
   direct, safe win with no new content needed — it can be built entirely from
   data already passed to `renderShop`/`renderProduct`.
2. **`priceRange` and a fuller address on the homepage `ClothingStore` block**
   (Medium). The site's own filter UI already knows the catalogue price floor
   and ceiling (PKR 3,000–100,000, per `tools/render.js` line ~476), so
   `priceRange` can be derived rather than guessed.
3. **`priceValidUntil` on product `Offer`s** (Info/Medium). Not required, but
   given the pricing-freshness issue found above, an explicit "valid until"
   date is good practice for a made-to-order catalogue where prices can move.
4. **`AggregateRating`/`Review` on products** (Info, optional) — only if the
   business has genuine collected reviews somewhere (WhatsApp, Instagram,
   Facebook) that could be surfaced. Do not add without real review data.
5. **`WebSite` + `SearchAction`** (Info, optional) — the site already has an
   on-page search UI (`lp-search`); a `WebSite` block with a `SearchAction`
   is the standard way to signal that to Google, though eligibility for a
   sitelinks search box is at Google's discretion.

## 4. Critical issue requiring attention (not a schema-code defect)

The stale live price on `/product/first-birthday-baby-set/` is not caused by
anything in `tools/render.js` — the template logic is correct and reads
directly from the content file. The mismatch between the content file's
current prices (25,000/28,000/32,000) and what's live (55/65/76/44/7,400,
matching the *previous* version of that file before commit `ad2dbf2`)
indicates the production site has not deployed the latest commit(s). This
should be checked in Netlify's deploy log before anything else — it affects
real customers seeing PKR 55 for a dress, not just the schema.

## 5. Generated JSON-LD for recommended additions

### BreadcrumbList — category page (e.g. `/girls/`)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://littleprincessdesigner.pk/" },
    { "@type": "ListItem", "position": 2, "name": "Girls", "item": "https://littleprincessdesigner.pk/girls/" }
  ]
}
```

### BreadcrumbList — product page (e.g. a girls luxury dress)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://littleprincessdesigner.pk/" },
    { "@type": "ListItem", "position": 2, "name": "Girls", "item": "https://littleprincessdesigner.pk/girls/" },
    { "@type": "ListItem", "position": 3, "name": "Luxury dresses", "item": "https://littleprincessdesigner.pk/girls/#girls-luxury-dresses" },
    { "@type": "ListItem", "position": 4, "name": "Aizal Red Frock", "item": "https://littleprincessdesigner.pk/product/first-birthday-baby-set/" }
  ]
}
```

### Homepage `ClothingStore` — filled-in fields (illustrative; owner should confirm the street address before publishing)

```json
{
  "@context": "https://schema.org",
  "@type": "ClothingStore",
  "name": "Little Princess Designer",
  "description": "Handmade children's occasion wear from our Lahore studio since 2015 — girls dresses, boys prince suits, baby sets and ready-to-wear kidswear, cut to your measurements.",
  "url": "https://littleprincessdesigner.pk/",
  "email": "info@littleprincessdesigner.pk",
  "telephone": "+92 321 715 2723",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Lahore",
    "addressCountry": "PK"
  },
  "priceRange": "PKR 3,000 - PKR 100,000",
  "image": "https://littleprincessdesigner.pk/assets/logo-lockup.webp",
  "sameAs": [
    "https://www.instagram.com/littleprincessdesigner/",
    "https://www.facebook.com/LittlePrincessDesigner/",
    "https://www.tiktok.com/@littleprincessdesigner"
  ],
  "foundingDate": "2015"
}
```
*(`streetAddress` and `postalCode` intentionally omitted here — only the site
owner can confirm those, and a placeholder would fail the "no placeholder
text" check.)*

## 6. Fix reference (not schema, but explains the Critical finding)

- `content/products/first-birthday-baby-set.json` — current, correct prices (25,000 / 28,000 / 32,000), committed today in `ad2dbf2`
- `tools/render.js` lines 557–576 — `Product`/`AggregateOffer` generation (logic confirmed correct)
- `content/categories/girls.json` line 13 — `"label": "Girls "` (trailing space causing the double-space in `Product.category`)
