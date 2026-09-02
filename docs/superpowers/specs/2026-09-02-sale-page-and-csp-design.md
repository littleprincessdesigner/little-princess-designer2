# Sale page + enforced CSP — design

Date: 2026-09-02
Status: awaiting owner review

Two independent pieces of work, specced together because they were requested
together and will be built in parallel:

- **Part 1 — Content-Security-Policy: report-only → enforced**, with Google
  Analytics kept working.
- **Part 2 — a "Sale" section** at `/sale/`, listing every discounted product
  grouped by category.

They share no code. Part 1 touches `netlify.toml` + the GA snippet in
`tools/render.js`. Part 2 touches the content model, renderers, build, admin
config and CSS.

---

## Part 1 — Enforce the CSP

### Today

`netlify.toml` sends, for `/*`:

```
Content-Security-Policy-Report-Only = "default-src 'self'; img-src 'self' https://ik.imagekit.io; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
```

Report-only: the browser checks it and logs violations to its own console, but
blocks nothing. There is no report-collection endpoint. So it is a dry run, not
protection.

Since 2026-09-01 every page also carries the Google Analytics tag (`G-K0TV7SBWFP`)
in the shared `head()` in `tools/render.js`. It has two parts:

1. `<script async src="https://www.googletagmanager.com/gtag/js?id=G-K0TV7SBWFP"></script>`
   — an external script.
2. An **inline** `<script>` block (`window.dataLayer = ...; gtag('config', ...)`).

The inline block already violates the report-only policy (`script-src 'self'`,
no `'unsafe-inline'`). Enforcing the policy as-is would block it and GA would
stop recording.

### Decisions (from the owner)

- Enforce on the **public site** only. The **admin** (`/admin/*`) gets a
  deliberately permissive policy so the Sveltia CMS + GitHub sign-in are
  completely unaffected — same freedom it effectively has today.
- **Basic GA4** allow-list only (visitor stats). No Google Ads / Signals /
  DoubleClick domains.
- Keep GA working: move the inline block into a self-hosted file so
  `script-src` can stay strict (no `'unsafe-inline'`).

### Changes

**1. `site/ga.js`** — new file, the inline block verbatim:

```js
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-K0TV7SBWFP');
```

**2. `tools/render.js`** — in `head()`, replace the inline `<script>` block with
`<script src="/ga.js"></script>`. Keep the async `gtag/js` loader tag as-is.
Order: loader tag first (async), then `/ga.js`.

**3. `tools/build.js`** — add `ga.js` to the passthrough copy list
(`for (const entry of ["tokens.css", "styles.css", "app.js", "carousel-3d.js", "assets", "admin"])`
→ add `"ga.js"`). It then inherits the existing `/*.js` 1-hour cache header.

**4. `netlify.toml`** — in the `for = "/*"` block, replace
`Content-Security-Policy-Report-Only` with:

```
Content-Security-Policy = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' https://ik.imagekit.io https://www.googletagmanager.com https://*.google-analytics.com; script-src 'self' https://www.googletagmanager.com; connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com; style-src 'self' 'unsafe-inline'; font-src 'self'"
```

Directive notes:
- `script-src`: `'self'` (site JS + `/ga.js`) + `googletagmanager.com` (gtag.js).
  No `'unsafe-inline'` — there are no inline scripts on public pages once `/ga.js`
  lands (verified: only `<script src>` and `<script type="application/ld+json">`,
  which CSP does not gate).
- `connect-src`: GA4 beacons go to `*.google-analytics.com` (covers
  `region1.…`) and `*.analytics.google.com`; gtag config fetch to
  `googletagmanager.com`.
- `img-src`: keeps ImageKit; adds GA's pixel fallback hosts.
- `style-src 'unsafe-inline'`: unchanged — the site uses inline `style=`
  attributes and a `<noscript><style>` block.

**5. `netlify.toml`** — in the existing `for = "/admin/*"` block, add alongside
`X-Robots-Tag`:

```
Content-Security-Policy = "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https:"
```

Permissive by intent: allows the CMS script from unpkg, GitHub API/OAuth over
https, blob/data workers, and the admin page's own inline boot script. This is
choice **B** — the admin is behind a login and `noindex`; the public site is the
attack surface that gets locked down.

**6. `netlify.toml`** — rewrite the long explanatory comment on the header to
describe the enforced policy and the admin override.

### Netlify header-merge assumption

The public `Content-Security-Policy` (`/*`) and the admin one (`/admin/*`) share
a header name. This design assumes Netlify lets the **more specific path
override** — which this same file already relies on for `Cache-Control`
(`/assets/*` and `/*.css` override `/*`). If instead Netlify concatenates the
two values, the admin would receive both policies and the strict one would break
it.

**Verification (owner, on the Netlify deploy preview, not guessable from the
build):**
1. Load the site normally — pages render, photos load, no console CSP errors.
2. Open GA Realtime, load a page, confirm the visit registers.
3. Open `/admin/`, sign in with GitHub, open a product, change a field, Save,
   confirm the commit lands.

If step 3 fails, the fallback is a properly-tuned admin policy built from
Sveltia's published requirements (`style-src 'self' 'unsafe-inline'`;
`font-src 'self' https://cdn.jsdelivr.net`; `img-src 'self' blob: data:
https://ik.imagekit.io`; `script-src 'self' https://unpkg.com`; `connect-src
'self' blob: data: https://unpkg.com https://api.github.com https://github.com`;
`media-src blob:`; `frame-src blob:`; `worker-src 'self' blob:`;
`manifest-src blob:`) — plus moving the admin's inline boot IIFE in
`site/admin/index.html` into a `site/admin/boot.js` file.

### Out of scope for Part 1

- Adding `priceValidUntil` / original price to product structured data (noted as
  a possible later SEO follow-up).
- The form-field `name`/`id` accessibility nit on card size selects.

---

## Part 2 — The Sale page

### The rule (single source of truth)

A product is **on sale** when **at least one available size has a sale price
below its normal price** — i.e. `content.js` produced a size with
`wasPrice != null`.

That one fact drives everything. There is **no separate "Sale" switch**. The
existing `badge` dropdown loses its "Sale" option.

| State | Result |
|---|---|
| ≥1 available size discounted | "Sale" tag shown on every view; product on `/sale/`; card there shows only the discounted sizes |
| No size discounted | Normal full-price product |
| `salePrice` set but not below `price` | That value ignored (existing warning), size not counted as discounted |
| `badge = "Sold out"` + a size discounted | "Sold out" tag wins on the card / product page; product is **excluded from `/sale/`** (nothing to buy). Any crossed-out prices still show on its normal pages. |

No build failure is possible from this — the inconsistent "flagged but not
discounted" state no longer exists.

### The "Sale" tag (badge)

`tools/card.js` and `tools/render.js` currently render `p.badge` directly into
`.lp-badge`. Replace with an **effective badge**:

```
effectiveBadge(p):
  if p.badge == "Sold out": return "Sold out"
  if p has ≥1 available discounted size: return "Sale"
  return p.badge            // "New" | "Made to order" | ""
```

- Applies on the card (`productCard`) and the product detail page
  (`productDetail`) — everywhere the badge renders.
- The `.lp-badge[data-badge="Sale"]` CSS already exists (filled berry pill, top
  left) — no CSS change for the tag itself.
- The tag is static: it does not change with the size the visitor selects
  (unchanged behaviour — it is a photo overlay, not tied to the price block).

### Which products appear on `/sale/`

Every live product with ≥1 available discounted size **and** `badge != "Sold
out"**, grouped under the four top-level categories (`Girls` / `Boys` /
`Babies` / `Ready to wear`). Only categories that contain such a product get a
heading. Sort within a heading: **newest first** (`addedOn` desc), matching the
shop pages.

### The `/sale/` card

Reuse `productCard`, but pass a **shallow copy of the product with `sizes`
filtered to only the discounted available ones** and `minPrice` recomputed. The
card then naturally shows only those sizes in its `<select>`, seeded to the
first one with its was/now price. The "Sale" tag shows (effective badge).

### The `/sale/` page layout

Mirror `renderShop` structure so the existing `app.js` filter code
(`initShop`, keyed on `[data-subsect]` / `[data-grid]` / `[data-size-chip]` /
`[data-fmax]`) works unchanged:

- Breadcrumb: Home › Sale.
- Editable eyebrow + `<h1>` + intro paragraph(s) (see settings below).
- The same Filters toolbar + panel as the shop pages (Size chips, Max price
  slider). `model.sizes` for the chip list; the 3000–100000 range as in
  `renderShop`.
- A **sticky row of category buttons** ("Girls", "Boys", …) above the sections,
  each an anchor link to that category's section id. Only rendered for
  categories that have sale products. New small CSS block; can lean on existing
  chip / `.lp-catsheading` styles.
- One `<section class="lp-subsect" data-subsect data-step data-visible>` per
  category (same attributes as a shop subsection), `<h3 id="sale-girls">` etc.,
  a `.lp-grid` of the filtered cards, and the same "Load more" affordance and
  `data-noresults` empty line.

### Empty state

When no product is on sale, the page still builds and still renders, showing a
single friendly line (reuse `.lp-empty` styling), e.g. *"Nothing is on sale
right now — [browse the collection](/girls/)."* No category sections, no filter
toolbar.

### Navigation

`header()` gains a nav entry `{ key: "sale", label: "Sale", href: "/sale/" }`
**after `ready`, before `contact`** — but only when there is ≥1 sale product.
`header()` currently takes `(s, activeTab)`; extend to receive that flag (or the
model) from `page()`.

`page()` / `data-tab="sale"`: use the default berry palette (as contact / 404
do) — matches the "Sale" badge colour. No per-tab palette override.

### Product detail page — default to a discounted size

In `renderProduct` / `card.productDetail`: if the product has ≥1 available
discounted size, the size `<select>` defaults to the **first discounted size in
normal size order** (not `sizes[0]`). Implementation: seed `first` from that
size and mark its `<option selected>`; the price block, total and WhatsApp order
link render from it. All sizes stay selectable; `app.js` repaints on change as
now. Applies to every visitor of that product page, not only Sale-page referrals.

### Editable wording (admin)

New file **`content/settings-sale.json`**:

```json
{
  "eyebrow": "Reduced for a limited time",
  "h1": "Sale",
  "blurb": "Handmade pieces from the studio, now at a reduced price. Same fabrics, same finishing — a lower price while stock and time allow.",
  "empty": "Nothing is on sale right now — browse the collection.",
  "seo": {
    "title": "Sale — Handmade Kids' Dresses at a Reduced Price | Little Princess Designer",
    "description": "Handmade girls dresses, boys prince suits and baby sets from our Lahore studio, now at a reduced price while stock lasts."
  }
}
```

Wording above is the built-in default; the owner edits it in the CMS.

**`site/admin/config.yml`** — under the `settings` collection `files:`, add a
fourth file entry "Sale page" → `content/settings-sale.json`, fields: eyebrow
(string), h1 (string), blurb (text), empty (string), seo (object: title, description).
`editor: { preview: false }` like its siblings.

**`site/admin/config.yml`** — remove the `{ label: "Sale", value: "Sale" }`
option from the product `badge` select, and update that field's `hint` (drop the
"Sale is the label only…" sentence; explain that a sale is created purely by
filling a size's sale price).

### Build / SEO plumbing

**`tools/content.js`**:
- Drop the now-dead `badge == "Sale" && !wasPrice` warning block.
- Load `settings-sale.json` into the model (as `model.sale` or on `settings`),
  with the built-in defaults as fallback, mirroring how the other settings
  files are read.
- Expose the sale set: either a `model.saleProducts` array (category-grouped)
  or a helper — products with ≥1 available `wasPrice` size, already sorted.

**`tools/render.js`**:
- New `renderSale(model, siteUrl)` — the page above.
- `header()` sale entry (conditional).
- effective-badge helper shared with `card.js` (put it where `card.js` can
  import it, like the other shared card helpers).

**`tools/build.js`**:
- Always `writeFile("sale/index.html", render.renderSale(model, SITE_URL))` —
  the page is permanent.
- Sitemap `urls`: always add `["/sale/", "content/settings-sale.json"]`.
- `llms.txt`: add `- Sale: <SITE_URL>/sale/` to the Sections list (permanent).

**`tools/check-config.js`** — picks up the new `settings-sale.json` ⇄ config.yml
pairing automatically; confirm it passes.

**JSON-LD** for `/sale/`: mirror `renderShop` — `CollectionPage` (name = h1,
description = seo.description, url = `/sale/`) + `BreadcrumbList` (Home → Sale).
Indexable (no `noindex`).

**`tools/feed.js`** — no change (already emits `price` + `sale_price` per size).

**`redirects.json`, `robots.txt`** — no change.

### Tests (`tools/test.js`, `tools/fixtures/content`)

- Remove the "Badged sale only" fixture + its three assertions (dead once the
  badge option is gone). Keep the "On sale" fixture and its price-swap
  assertions.
- Add fixtures: a product discounted on some-but-not-all sizes; a product
  discounted + `badge: "Sold out"`.
- New assertions:
  - effective badge = "Sale" for a discounted product with no explicit badge.
  - effective badge = "Sold out" for discounted + sold-out.
  - the sale set contains exactly the discounted products, category-grouped,
    newest-first.
  - a Sale-page card copy exposes only the discounted sizes and a `minPrice`
    that follows them.
  - `renderSale` with an empty sale set emits the empty-state line and no
    `data-subsect`.
  - the detail page for a partly-discounted product seeds the selected option
    to the first discounted size.
- The `card.fromCmsEntry` preview test at test.js:359 passes `badge: "Sale"` —
  update to not rely on the removed option (the preview should still show a sale
  from the size prices alone).

### CSS (`site/styles.css`)

- Sticky category-button row for `/sale/` (position: sticky; horizontal scroll
  on narrow screens, like the header nav).
- Everything else reuses existing shop / card / badge classes.

---

## Build order (for the plan)

Part 1 and Part 2 are independent and can run as parallel workstreams. Within
Part 2:

1. Content model + settings (`content.js`, `settings-sale.json`, `config.yml`)
   and the effective-badge helper — everything else depends on these.
2. `renderSale` + `header()` + `build.js` wiring.
3. Detail-page default-size change.
4. CSS.
5. Tests + fixtures (alongside each of the above; all green before the PR).

## Definition of done

- `npm test` and `npm run build` green, no new warnings beyond the two existing
  fascinator price notes.
- Local `dist/`: `/sale/` lists the discounted products grouped by category with
  discounted-only sizes; the "Sale" tag shows on those products on their normal
  category pages and product pages; the nav shows "Sale"; removing every sale
  price makes the tab disappear and `/sale/` show the empty line; `/sale/` is in
  `sitemap.xml`.
- `netlify.toml` sends an enforced `Content-Security-Policy` on `/*` and a
  permissive one on `/admin/*`; `/ga.js` is in `dist/` and referenced from every
  page; no inline `<script>` remains on public pages.
- PR opened with auto-merge enabled; the owner-side verification list (CSP/admin,
  GA Realtime) recorded in the PR description.
