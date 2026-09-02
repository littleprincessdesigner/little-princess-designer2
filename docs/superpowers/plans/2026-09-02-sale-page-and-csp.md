# Sale Page + Enforced CSP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the site's Content-Security-Policy from a dry run into a real one without breaking Google Analytics or the CMS, and add a permanent `/sale/` page that lists every discounted product, driven purely by the sale prices already in the content.

**Architecture:** Two independent workstreams that share no files. Part 1 moves the inline GA snippet into a self-hosted `/ga.js` so `script-src` can stay strict, then swaps `Content-Security-Policy-Report-Only` for an enforced `Content-Security-Policy` on `/*` with a deliberately permissive override on `/admin/*`. Part 2 replaces the manually-set `badge: "Sale"` with an **effective badge** computed from the price data (`tools/card.js`), exposes a category-grouped sale set on the content model (`tools/content.js`), and renders `/sale/` with the exact markup shape `site/app.js`'s `initShop()` already drives — so the filter panel, Load more and price repainting all work with no JavaScript change.

**Tech Stack:** Plain Node 20 (no dependencies, no bundler), CommonJS modules under `tools/`, hand-written CSS in `site/styles.css`, Sveltia CMS driven by `site/admin/config.yml`, Netlify for hosting and headers. Tests are `tools/test.js` — a dependency-free assertion script, no test runner.

**Spec:** `docs/superpowers/specs/2026-09-02-sale-page-and-csp-design.md`

## Global Constraints

- Branch `claude/sale-page-and-enforced-csp` is already created and checked out. The spec is already committed on it.
- `npm test` (runs `node tools/test.js`) and `npm run build` (runs `check-config.js` → `build.js` → `warm-previews.js` → `indexnow.js`) must both be green at the end of **every** task. Baseline before any change: **138 checks pass**.
- There is **no test runner**. Tests are `check(label, actual, expected)` and `checkTrue(label, actual)` calls appended to `tools/test.js`, run against `tools/fixtures/content`.
- No new npm dependencies. Node 20 is the floor (`netlify.toml` `NODE_VERSION = "20"`).
- The codebase is heavily commented with **why** comments, not what-comments. Every new block of code below is marked `<!-- COMMENT EXPECTED -->` where a why-comment belongs; write the prose in the house voice (plain English, explains the failure it prevents).
- GA4 measurement ID is exactly `G-K0TV7SBWFP`.
- Allowed badge values after this work: `""`, `"New"`, `"Made to order"`, `"Sold out"`. `"Sale"` is **never** a stored value again — it is only ever computed.
- The fixture catalogue must stay at exactly **10 visible products**. `tools/test.js:117-119` explains why: the carousel assertions compare against `model.products.length` and the ring's default 10 slots. Adding an 11th product breaks `carouselIds({ carouselSlots: "abc" }).length === model.products.length`.
- This environment's proxy blocks the live site, ImageKit, unpkg and Netlify deploy previews. All browser verification runs against the local `dist/` served by `node tools/serve.js` on `http://localhost:8080`. CSP headers and a full admin sign-in are **owner-verified on the deploy preview** and must be reported as unverified locally.
- House rule (`CLAUDE.md`): only open a PR when asked; once open, enable auto-merge without being asked twice.

---

## Workstream split

The two parts touch disjoint files and can be picked up by two independent agents at the same time.

| | Part 1 — CSP + GA | Part 2 — Sale page |
|---|---|---|
| Tasks | 1–2 | 3–9 |
| Files | `site/ga.js`, `tools/render.js` (`head()` only), `tools/build.js` (passthrough list only), `netlify.toml`, `tools/test.js` | `tools/card.js`, `tools/content.js`, `tools/render.js` (everything except `head()`), `tools/build.js`, `content/settings-sale.json`, `site/admin/config.yml`, `site/styles.css`, `tools/fixtures/content/*`, `tools/test.js` |
| Overlap risk | `tools/render.js` and `tools/build.js` are touched by both, in different functions. Part 1's `render.js` edit is inside `head()`; Part 2 never touches `head()`. Part 1's `build.js` edit is the passthrough array on line 122; Part 2 edits lines 142+. Expect a trivial merge, not a conflict. | |
| `tools/test.js` | Part 1 appends its block at the end of the "shape the rest of the build relies on" section. Part 2 appends after the existing sale-prices section. Both append — resolve any conflict by keeping both blocks. | |

**Task 10 (browser verification) runs last, after both workstreams have landed.**

Within Part 2 the order is forced by dependencies:

```
Task 3  card.js helpers (effectiveBadge / discountedSizes / saleCopy)
   │        └─ everything below reads these
Task 4  content/settings-sale.json + config.yml settings entry + model.sale
Task 5  model.saleCategories + fixtures + drop the dead warning
   │        └─ needs Task 3's discountedSizes
Task 6  config.yml: remove the "Sale" badge option; clear it from live content
   │        └─ must come AFTER Task 3, or products lose their tag in between
Task 7  renderSale + header() + build.js wiring
   │        └─ needs Tasks 3, 4, 5
Task 8  product detail defaults to the discounted size
Task 9  CSS for the sticky sale category row
```

---

# PART 1 — Enforce the CSP

### Task 1: Move the Google Analytics snippet into `/ga.js`

**Files:**
- Create: `site/ga.js`
- Modify: `tools/render.js:124-132` (the `head()` GA block)
- Modify: `tools/build.js:122` (the passthrough copy list)
- Test: `tools/test.js` (append a new block after the "shape the rest of the build relies on" section, which currently ends at line 206)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: a guarantee that no public page carries an inline `<script>`. Task 2's `script-src 'self' https://www.googletagmanager.com` (no `'unsafe-inline'`) depends on it.

- [ ] **Step 1: Write the failing test**

Append to `tools/test.js`, immediately after the `check("category href", …)` line (currently line 206):

```js
/* --- no inline scripts on a public page ----------------------------------
 *
 * The enforced Content-Security-Policy in netlify.toml has no 'unsafe-inline'
 * in script-src, so an inline <script> anywhere on a public page is not a
 * style question — the browser refuses to run it and whatever it did stops
 * happening silently. The Google Analytics setup was exactly that block until
 * it moved to /ga.js. ld+json is exempt: CSP does not gate a data block.
 *
 * renderHome/renderShop/renderContact are not exercised here because the
 * fixture settings.json deliberately has no `seo` or `contact` object — the
 * two pages checked go through the same head() as every other page.
 */

/** Every <script> opening tag on a page. */
const scriptTags = html => html.match(/<script\b[^>]*>/g) || [];

const publicPages = [
  ["a product page", render.renderProduct(model, byName["On sale"], "https://example.test")],
  ["the 404 page", render.render404(model, "https://example.test")]
];

for (const [what, html] of publicPages) {
  checkTrue("no inline <script> on " + what + " — the enforced CSP would block it",
    scriptTags(html).every(t => t.includes(" src=") || t.includes('type="application/ld+json"')));
  checkTrue("…and the analytics setup is loaded from /ga.js instead",
    html.includes('<script src="/ga.js"></script>'));
  checkTrue("…with the gtag loader still ahead of it",
    html.indexOf('googletagmanager.com/gtag/js?id=G-K0TV7SBWFP') <
      html.indexOf('<script src="/ga.js"></script>'));
}
```

Note: `render`, `card` and `shared` are required further down the current file (line 247-249). **Move those three `require` lines up** to just below the existing `const images = require("./images");` on line 37 so this block can use `render`:

```js
const path = require("path");
const { load, SIZES, readSettings, chooseCarousel, warnings } = require("./content");
const images = require("./images");
const card = require("./card");
const render = require("./render");
const shared = require("./shared");
```

and delete the now-duplicate `const card = require("./card"); const render = require("./render"); const shared = require("./shared");` at lines 247-249.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — three `✗` lines per page (`no inline <script> on a product page…`, `…loaded from /ga.js`, `…gtag loader still ahead of it`), because `head()` still emits the inline block and never emits `/ga.js`.

- [ ] **Step 3: Create `site/ga.js`**

```js
/**
 * <!-- COMMENT EXPECTED: why this is a file and not an inline block — the
 *      enforced CSP in netlify.toml keeps script-src at 'self' with no
 *      'unsafe-inline', so the GA setup has to be served from this site.
 *      Contents are the gtag boilerplate verbatim; the loader tag that
 *      defines gtag.js is emitted by tools/render.js immediately above the
 *      <script src="/ga.js"> tag. -->
 */
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-K0TV7SBWFP');
```

- [ ] **Step 4: Replace the inline block in `tools/render.js`**

In `head()`, replace lines 124-132 exactly:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-K0TV7SBWFP"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-K0TV7SBWFP');
</script>
```

with:

```html
<!-- Google tag (gtag.js). The setup that used to sit inline here is in
     site/ga.js — see the enforced Content-Security-Policy in netlify.toml,
     which has no 'unsafe-inline' in script-src. Loader first, setup second. -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-K0TV7SBWFP"></script>
<script src="/ga.js"></script>
```

- [ ] **Step 5: Add `ga.js` to the passthrough copy list in `tools/build.js`**

Line 122 becomes:

```js
for (const entry of ["tokens.css", "styles.css", "app.js", "carousel-3d.js", "ga.js", "assets", "admin"]) {
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: `OK — 144 checks passed` (138 baseline + 6 new).

- [ ] **Step 7: Verify the build ships the file**

Run: `npm run build`
Expected: build succeeds; `dist/ga.js` exists and `dist/index.html` contains `<script src="/ga.js"></script>`.

Run: `node -e "const fs=require('fs');console.log(fs.existsSync('dist/ga.js'), fs.readFileSync('dist/index.html','utf8').includes('<script src=\"/ga.js\"></script>'))"`
Expected: `true true`

- [ ] **Step 8: Commit**

```bash
git add site/ga.js tools/render.js tools/build.js tools/test.js
git commit -m "Move the Google Analytics setup into a self-hosted /ga.js

The enforced CSP that follows keeps script-src at 'self' plus the gtag
loader, with no 'unsafe-inline' — so the inline setup block had to become
a file or analytics would silently stop recording."
```

---

### Task 2: Enforce the CSP on `/*`, keep `/admin/*` permissive

**Files:**
- Modify: `netlify.toml:44-57` (the `/*` header block's CSP + its comment)
- Modify: `netlify.toml:86-89` (the `/admin/*` header block)
- Test: `tools/test.js` (append immediately after Task 1's block)

**Interfaces:**
- Consumes: Task 1's guarantee that no public page has an inline `<script>`.
- Produces: nothing other tasks read.

- [ ] **Step 1: Write the failing test**

Append to `tools/test.js`, directly after Task 1's block:

```js
/* --- the Content-Security-Policy is enforced, not a dry run ---------------
 *
 * netlify.toml is not exercised by any build step, so nothing else would
 * notice it drifting back to Report-Only or gaining an 'unsafe-inline' that
 * hands the whole point away. These are string checks on the file, which is
 * all that is available from Node — the header itself can only be seen on a
 * real Netlify deploy.
 */

const netlifyToml = require("fs").readFileSync(path.join(__dirname, "..", "netlify.toml"), "utf8");

checkTrue("the public policy blocks rather than only reporting",
  /\n\s*Content-Security-Policy = "/.test(netlifyToml) &&
  !netlifyToml.includes("Content-Security-Policy-Report-Only"));
checkTrue("script-src allows this site and the gtag loader, and nothing inline",
  netlifyToml.includes("script-src 'self' https://www.googletagmanager.com") &&
  !/script-src[^"]*'unsafe-inline'/.test(netlifyToml));
checkTrue("the analytics beacon hosts are reachable, or visits stop being recorded",
  netlifyToml.includes("connect-src 'self' https://www.googletagmanager.com " +
    "https://*.google-analytics.com https://*.analytics.google.com"));
checkTrue("ImageKit is still allowed to serve the photographs",
  /img-src[^"]*https:\/\/ik\.imagekit\.io/.test(netlifyToml));
checkTrue("inline style= attributes still work — the home page hero is built on them",
  /style-src 'self' 'unsafe-inline'/.test(netlifyToml));
checkTrue("the admin gets a policy of its own, so the CMS and GitHub sign-in are not blocked",
  netlifyToml.includes(
    "Content-Security-Policy = \"default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https:\""));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — 6 `✗` lines, starting with `the public policy blocks rather than only reporting`.

- [ ] **Step 3: Rewrite the `/*` CSP in `netlify.toml`**

Replace lines 44-57 (the comment block and the `Content-Security-Policy-Report-Only` line) with:

```toml
    # Enforced, not Report-Only: the browser actually blocks anything this
    # policy does not name. It is written for what the public pages really
    # load — this site's own CSS and JS, photographs from ImageKit, and the
    # Google Analytics tag — and nothing else. There is deliberately no
    # 'unsafe-inline' in script-src: the one inline script the site had (the
    # GA setup) is served from /ga.js instead, so a script injected into a CMS
    # field has nowhere to run. The only other <script> blocks on a page are
    # `type="application/ld+json"` structured data, which CSP does not gate.
    #   img-src      ImageKit for photographs, plus Google's pixel fallbacks
    #   connect-src  where GA4 sends the beacon (region1.google-analytics.com
    #                is why that host is wildcarded)
    #   style-src    'unsafe-inline' stays: the hero uses style="opacity:0"
    #                attributes and the <noscript><style> block in head()
    # The admin at /admin/* needs far more than this — see its own block at the
    # bottom of this file, which overrides this header for those paths.
    Content-Security-Policy = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' https://ik.imagekit.io https://www.googletagmanager.com https://*.google-analytics.com; script-src 'self' https://www.googletagmanager.com; connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com; style-src 'self' 'unsafe-inline'; font-src 'self'"
```

- [ ] **Step 4: Add the admin override in `netlify.toml`**

Replace lines 86-89 with:

```toml
# The admin is the one place that deliberately gets a loose policy. It loads
# the Sveltia CMS bundle from unpkg, signs in through GitHub's OAuth host,
# talks to api.github.com, and boots itself from an inline script — none of
# which the public policy allows. Locking it down would buy nothing: it is
# behind a GitHub login and noindexed, while the public pages are the part of
# the site a stranger can reach. This header shares a name with the one on
# /*, and Netlify lets the more specific path win — the same behaviour this
# file already relies on for Cache-Control on /assets/* and /*.css.
[[headers]]
  for = "/admin/*"
  [headers.values]
    X-Robots-Tag = "noindex"
    Content-Security-Policy = "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https:"
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: `OK — 150 checks passed` (144 + 6).

- [ ] **Step 6: Confirm the build is unaffected**

Run: `npm run build`
Expected: succeeds. `netlify.toml` is not read by the build; this is a regression guard only.

- [ ] **Step 7: Commit**

```bash
git add netlify.toml tools/test.js
git commit -m "Enforce the Content-Security-Policy on the public site

Report-Only checked the policy and blocked nothing. This turns it on for
/* with an allow-list built from what the pages actually load, and gives
/admin/* a deliberately permissive policy of its own so the CMS and its
GitHub sign-in are untouched."
```

**Owner-side verification (cannot be done from this environment — the proxy blocks Netlify previews). Record in the PR description:**
1. Load the deploy preview normally — pages render, photos load, no CSP errors in the browser console.
2. Open GA Realtime, load a page, confirm the visit registers.
3. Open `/admin/`, sign in with GitHub, open a product, change a field, Save, confirm the commit lands.

If step 3 fails, the fallback is the tuned admin policy in the spec's "Netlify header-merge assumption" section, plus moving the admin's inline boot IIFE (`site/admin/index.html:95`) into `site/admin/boot.js`.

---

# PART 2 — The Sale page

### Task 3: The effective badge and the discounted-size helpers

**Files:**
- Modify: `tools/card.js` — add three functions before `productCard` (currently line 173), use them in `productCard:188` and `productDetail:422`, export them from `CARD_API:568`
- Test: `tools/test.js` (append after the existing sale-prices section, which currently ends at the `check("…at its ordinary price", …)` line)

**Interfaces:**
- Consumes: nothing.
- Produces, all exported from `tools/card.js`:
  - `discountedSizes(p) -> Array<{size: string, price: number, wasPrice: number}>` — the entries of `p.sizes` whose `wasPrice` is non-null.
  - `effectiveBadge(p) -> string` — `"Sold out"` | `"Sale"` | `p.badge` | `""`.
  - `saleCopy(p) -> product` — a shallow copy with `sizes` narrowed to the discounted ones and `minPrice` recomputed; returns `p` unchanged when nothing is discounted.

- [ ] **Step 1: Write the failing test**

Append to `tools/test.js`, directly after the existing line `check("…at its ordinary price", byName["Badged sale only"].sizes[0].wasPrice, null);`:

```js
/* --- the tag a visitor actually sees -------------------------------------
 *
 * There is no "Sale" switch any more. A piece is on sale when a size it still
 * offers is discounted, and the tag is worked out from that — so the tag and
 * the prices cannot disagree, which is the state the old badge dropdown made
 * possible and the build could only warn about.
 */

check("a discounted piece wears the Sale tag without anyone setting one",
  card.effectiveBadge(byName["On sale"]), "Sale");
check("a piece with nothing discounted keeps the badge it was given",
  card.effectiveBadge(Object.assign({}, byName["Own words"], { badge: "New" })), "New");
check("sold out beats a discount — there is nothing to buy",
  card.effectiveBadge(Object.assign({}, byName["On sale"], { badge: "Sold out" })), "Sold out");
check("a piece with neither wears nothing",
  card.effectiveBadge(byName["Own words"]), "");

checkTrue("the card draws the tag from the effective badge, not the raw field",
  card.productCard(model, byName["On sale"])
    .includes('<span class="lp-badge" data-badge="Sale">Sale</span>'));
checkTrue("…and the product page shows the same tag over its gallery",
  card.productDetail(byName["On sale"], model.settings, "https://example.test")
    .includes('<span class="lp-badge" data-badge="Sale">Sale</span>'));
checkTrue("a piece with no tag gets no empty pill on either view",
  !card.productCard(model, byName["Own words"]).includes("lp-badge") &&
  !card.productDetail(byName["Own words"], model.settings, "https://example.test").includes("lp-badge"));

/* the copy of a product a Sale-page card is drawn from */

const saleCardProduct = card.saleCopy(byName["On sale"]);
check("a Sale-page card offers only the sizes that are actually reduced",
  saleCardProduct.sizes.map(s => s.size), ["0–3 years"]);
check("…and its lowest price follows those sizes",
  saleCardProduct.minPrice, 6000);
check("…while the piece it was copied from is left alone",
  byName["On sale"].sizes.length, 3);
check("a piece with nothing discounted is handed back untouched",
  card.saleCopy(byName["Own words"]).sizes, byName["Own words"].sizes);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — the first failure is a `TypeError: card.effectiveBadge is not a function`, which `tools/test.js` does not catch, so the run aborts. That is the expected red.

- [ ] **Step 3: Add the three helpers to `tools/card.js`**

Insert directly above `function productCard(model, p) {` (currently line 173), after the `priceBlock` function:

```js
/**
 * <!-- COMMENT EXPECTED: why the sale rule lives here and not in content.js —
 *      the admin's preview panel draws these same cards in a browser, where
 *      content.js (which reads the content directory) cannot run. Everything
 *      that decides how a sale looks therefore has to be reachable from this
 *      file. tools/content.js requires it from here rather than repeating it. -->
 */
function discountedSizes(p) {
  return ((p && p.sizes) || []).filter(s => s.wasPrice);
}

/**
 * <!-- COMMENT EXPECTED: the one rule. "Sold out" wins because a piece that
 *      cannot be supplied has nothing to advertise; "Sale" is computed from
 *      the prices rather than typed, so the tag and the prices can never
 *      disagree the way they could when "Sale" was a dropdown option. -->
 */
function effectiveBadge(p) {
  if (!p) return "";
  if (p.badge === "Sold out") return "Sold out";
  if (discountedSizes(p).length) return "Sale";
  return p.badge || "";
}

/**
 * <!-- COMMENT EXPECTED: the /sale/ page shows a piece by what is reduced on
 *      it, so its card is drawn from a copy holding only the discounted sizes.
 *      Shallow, so the original keeps every size on its own pages. A piece
 *      with nothing discounted comes back untouched rather than with an empty
 *      size list, which would make Math.min() Infinity and print "PKR ∞". -->
 */
function saleCopy(p) {
  const sizes = discountedSizes(p);
  if (!sizes.length) return p;
  return Object.assign({}, p, {
    sizes,
    minPrice: Math.min(...sizes.map(s => s.price))
  });
}
```

- [ ] **Step 4: Use the effective badge on the card**

In `productCard`, replace line 188:

```js
${p.badge ? '<span class="lp-badge" data-badge="' + esc(p.badge) + '">' + esc(p.badge) + "</span>" : ""}
```

with a local computed above the template (insert after `const first = p.sizes[0];`):

```js
  // The tag over the photo: worked out from the prices, not read off the form.
  const tag = effectiveBadge(p);
```

and the template line becomes:

```js
${tag ? '<span class="lp-badge" data-badge="' + esc(tag) + '">' + esc(tag) + "</span>" : ""}
```

- [ ] **Step 5: Show the same tag on the product page**

In `productDetail`, replace line 422:

```js
  const soldOut = p.badge === "Sold out";
```

with:

```js
  // <!-- COMMENT EXPECTED: same tag as the card, over the gallery. .lp-galwrap
  //      is already position:relative, so .lp-badge lands top-left with no CSS
  //      of its own. soldOut reads the effective badge too, so there is one
  //      answer to "is this sold out", not two. -->
  const tag = effectiveBadge(p);
  const soldOut = tag === "Sold out";
```

and inside the returned template, change the gallery wrapper from:

```html
<div class="lp-galwrap">
<div class="lp-gallery" data-gallery>
```

to:

```html
<div class="lp-galwrap">
${tag ? '<span class="lp-badge" data-badge="' + esc(tag) + '">' + esc(tag) + "</span>" : ""}
<div class="lp-gallery" data-gallery>
```

- [ ] **Step 6: Export the helpers**

`CARD_API` (currently line 568) becomes:

```js
const CARD_API = {
  esc, safeHref, money: shared.money, frame, IMG_SIZES, productCard,
  svg, ICON, waLink: shared.waLink, productDetail, applyWording, fromCmsEntry,
  discountedSizes, effectiveBadge, saleCopy
};
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test`
Expected: `OK — 161 checks passed` (150 + 11).

- [ ] **Step 8: Confirm the build is green**

Run: `npm run build`
Expected: succeeds, same warning count as before.

- [ ] **Step 9: Commit**

```bash
git add tools/card.js tools/test.js
git commit -m "Work the Sale tag out from the prices instead of a dropdown

A piece is on sale when a size it offers is actually reduced. The tag now
follows that, on the card and over the product page gallery, so the label
and the prices can no longer say different things."
```

---

### Task 4: The Sale page's editable wording

**Files:**
- Create: `content/settings-sale.json`
- Create: `tools/fixtures/settings-split/settings-sale.json`
- Modify: `tools/content.js` — add `SALE_DEFAULTS` + `readSale()` after `readSettings()` (currently ends line 232), call it in `load()`, add `sale` to the returned model and to `module.exports`
- Modify: `site/admin/config.yml` — a fourth entry under the `settings` collection's `files:` (after the `site` entry, which ends the collection)
- Test: `tools/test.js` (append after the "site settings, split across three admin pages" section)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `model.sale -> { eyebrow: string, h1: string, blurb: string, empty: string, seo: { title: string, description: string } }` — every field non-empty, defaults filled in.
  - `content.readSale(dir) -> the same shape` — exported for the test.

- [ ] **Step 1: Write the failing test**

Append to `tools/test.js`, directly after the line `check("a directory with only settings.json still loads", model.settings.brandName, "Fixture Designer");`:

```js
/* --- the Sale page's own wording -----------------------------------------
 *
 * A fourth settings file, read on its own rather than merged into `settings`
 * with the other three. It has to be: it carries a `seo` object and so does
 * settings.json, and the merge would report the two as a clash and hand the
 * home page's search listing to the Sale page.
 *
 * Every field has a built-in default, so a site whose owner has not opened
 * that admin page yet still gets a Sale page that reads properly — which is
 * exactly what tools/fixtures/content is.
 */

const { readSale } = require("./content");

check("with no file at all, the built-in wording is used",
  [model.sale.h1, model.sale.eyebrow], ["Sale", "Reduced for a limited time"]);
checkTrue("…including a search listing, so the page is never untitled",
  model.sale.seo.title.includes("Sale") && model.sale.seo.description.length > 20);
checkTrue("…and a line to show when nothing is reduced",
  model.sale.empty.length > 10);

const saleSettings = readSale(SPLIT_SETTINGS);
check("a file that is there wins over the built-in wording",
  [saleSettings.h1, saleSettings.eyebrow], ["SALE h1", "SALE eyebrow"]);
check("…field by field, so one blank box does not blank the page",
  saleSettings.blurb, model.sale.blurb);
check("…and the same for the search listing",
  [saleSettings.seo.title, saleSettings.seo.description],
  ["SALE title", model.sale.seo.description]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — aborts with `TypeError: Cannot read properties of undefined (reading 'h1')` on `model.sale.h1`.

- [ ] **Step 3: Create `content/settings-sale.json`**

```json
{
  "eyebrow": "Reduced for a limited time",
  "h1": "Sale",
  "blurb": "Handmade pieces from the studio, now at a reduced price. Same fabrics, same finishing — a lower price while stock and time allow.",
  "empty": "Nothing is on sale right now.",
  "seo": {
    "title": "Sale — Handmade Kids' Dresses at a Reduced Price | Little Princess Designer",
    "description": "Handmade girls dresses, boys prince suits and baby sets from our Lahore studio, now at a reduced price while stock lasts."
  }
}
```

> **Deviation from the spec, deliberate:** the spec's default `empty` reads *"Nothing is on sale right now — browse the collection."* while its prose shows the same line with *browse the collection* as a link. A CMS string field cannot hold a link, so the renderer (Task 7) puts a real "Browse the collection →" link underneath the line. Keeping the spec's trailing clause as well would say it twice, so it is dropped from the stored default. Everything else is verbatim.

- [ ] **Step 4: Create the fixture `tools/fixtures/settings-split/settings-sale.json`**

```json
{
  "eyebrow": "SALE eyebrow",
  "h1": "SALE h1",
  "blurb": "",
  "seo": {
    "title": "SALE title"
  }
}
```

`blurb` blank and `empty` / `seo.description` absent on purpose: they are what proves the fallback runs field by field rather than all-or-nothing.

- [ ] **Step 5: Add `SALE_DEFAULTS` and `readSale()` to `tools/content.js`**

Insert directly after `readSettings()` closes (currently line 232), before the `/* --- the home carousel */` banner:

```js
/**
 * <!-- COMMENT EXPECTED: why this file is read on its own rather than joining
 *      SETTINGS_FILES — it carries `seo`, and settings.json already does, so
 *      the merge would flag a clash and give the Sale page the home page's
 *      search listing. Nothing else reads these values, so they ride on the
 *      model as model.sale instead of on settings. -->
 */
const SALE_DEFAULTS = {
  eyebrow: "Reduced for a limited time",
  h1: "Sale",
  blurb: "Handmade pieces from the studio, now at a reduced price. Same fabrics, " +
    "same finishing — a lower price while stock and time allow.",
  empty: "Nothing is on sale right now.",
  seo: {
    title: "Sale — Handmade Kids' Dresses at a Reduced Price | Little Princess Designer",
    description: "Handmade girls dresses, boys prince suits and baby sets from our Lahore " +
      "studio, now at a reduced price while stock lasts."
  }
};

/**
 * <!-- COMMENT EXPECTED: field by field rather than Object.assign, so one box
 *      cleared in the admin falls back to the built-in wording instead of
 *      leaving the page with a blank heading. The file is optional: a
 *      catalogue that has never had it — the test fixtures, or this site
 *      before today — builds the page from the defaults alone. -->
 */
function readSale(dir) {
  const file = readJson(path.join(dir, "settings-sale.json"), { required: false }) || {};
  const seo = file.seo || {};
  return {
    eyebrow: nonEmpty(file.eyebrow, SALE_DEFAULTS.eyebrow),
    h1: nonEmpty(file.h1, SALE_DEFAULTS.h1),
    blurb: nonEmpty(file.blurb, SALE_DEFAULTS.blurb),
    empty: nonEmpty(file.empty, SALE_DEFAULTS.empty),
    seo: {
      title: nonEmpty(seo.title, SALE_DEFAULTS.seo.title),
      description: nonEmpty(seo.description, SALE_DEFAULTS.seo.description)
    }
  };
}
```

- [ ] **Step 6: Put it on the model**

In `load()`, in the returned object (currently line 592), add `sale` directly after `settings`:

```js
  return {
    settings,
    // The Sale page's own wording — see readSale for why it is not merged in
    // with the other settings files.
    sale: readSale(dir),
    sizes: SIZES,
```

And extend the export line (currently line 615):

```js
module.exports = { load, SIZES, readSettings, readSale, chooseCarousel, warnings };
```

- [ ] **Step 7: Declare the file in `site/admin/config.yml`**

Under the `settings` collection's `files:` list, after the `- name: site` entry (which is the last one in the file), append:

```yaml
      # --- 4. the Sale page's own wording ------------------------------------
      # Which pieces appear on /sale/ is not set here and cannot be: a piece is
      # on sale when one of its sizes has a sale price, and nothing else. This
      # page is only the words around them.
      - name: sale
        label: "Sale page"
        file: content/settings-sale.json
        description: >
          The wording on the Sale page. Which pieces appear there is decided by
          the pieces themselves — fill in a size's sale price and it appears,
          clear it and it goes. Nothing on this page changes that.
        fields:
          - { label: "Eyebrow", name: eyebrow, widget: string, hint: "The small line above the heading." }
          - { label: "Heading", name: h1, widget: string }
          - { label: "Intro", name: blurb, widget: text, hint: "Leave a blank line between paragraphs to split them." }
          - label: "When nothing is on sale"
            name: empty
            widget: string
            hint: "The single line the page shows when no piece has a sale price. A link back to the collection is added under it automatically."
          - label: "Search engine listing"
            name: seo
            widget: object
            collapsed: true
            fields:
              - { label: "Page title", name: title, widget: string }
              - { label: "Description", name: description, widget: text }
```

`editor: { preview: false }` is already set once at the collection level (line 483-484) and applies to every file in it — nothing to add per-file.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test`
Expected: `OK — 167 checks passed` (161 + 6).

- [ ] **Step 9: Verify the config/content pairing**

Run: `npm run check`
Expected: the output lists `settings/sale: 5 declared fields` and ends with `OK — every key in content/ is declared in config.yml.`

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 10: Commit**

```bash
git add content/settings-sale.json tools/fixtures/settings-split/settings-sale.json tools/content.js site/admin/config.yml tools/test.js
git commit -m "Add the Sale page's editable wording as a fourth settings file

Read on its own rather than merged with the other three: it carries a
search-engine listing and so does settings.json, and merging them would
hand the Sale page the home page's title."
```

---

### Task 5: The sale set on the content model

**Files:**
- Modify: `tools/content.js` — require `discountedSizes` from `./card`, delete the dead `badge == "Sale"` warning (lines 481-489), build `saleCategories` after the subcategory sort loop (after line 564), return it and count it in `stats`
- Delete: `tools/fixtures/content/products/badged-sale-only.json`
- Create: `tools/fixtures/content/subcategories/b1.json`
- Create: `tools/fixtures/content/products/boys-sale.json`
- Modify: `tools/fixtures/content/products/undated.json`
- Modify: `tools/test.js` — update three existing assertions, delete three, add the sale-set block

**Interfaces:**
- Consumes: `card.discountedSizes` (Task 3).
- Produces: `model.saleCategories -> Array<{ key: string, label: string, href: string, products: Product[] }>` — one entry per top-level category that has at least one live, not-sold-out, discounted product; in `CATEGORY_ORDER` (`girls`, `boys`, `babies`, `ready`); products newest-first. Categories with none are absent, so `model.saleCategories.length === 0` means "nothing is on sale".
- Also produces `model.stats.saleProducts -> number`.

- [ ] **Step 1: Update the fixture catalogue**

Delete `tools/fixtures/content/products/badged-sale-only.json`. Its only job was the "badged but not discounted" warning, which stops existing in Step 4.

Create `tools/fixtures/content/subcategories/b1.json`:

```json
{
  "parent": "boys",
  "name": "Boys section",
  "order": 10
}
```

Create `tools/fixtures/content/products/boys-sale.json` — a second category with something on sale (so the grouping is actually exercised) and a discount that is **not** on its first size (which Task 8 needs):

```json
{
  "name": "Boys on sale",
  "subcategory": "b1",
  "addedOn": "2026-08-04T11:00:00.000Z",
  "images": [],
  "sizes": [
    {
      "size": "0–3 years",
      "price": 5000
    },
    {
      "size": "4–6 years",
      "price": 12000,
      "salePrice": 9000
    }
  ]
}
```

Rewrite `tools/fixtures/content/products/undated.json` so one fixture also covers "discounted **and** sold out", which must be kept off `/sale/`. The catalogue stays at 10 visible products, which `tools/test.js:117-119` explains is load-bearing:

```json
{
  "name": "Undated",
  "subcategory": "s2",
  "badge": "Sold out",
  "sizes": [
    {
      "size": "4–6 years",
      "price": 2000,
      "salePrice": 1200
    }
  ]
}
```

- [ ] **Step 2: Update the existing assertions the fixture change moves**

In `tools/test.js`:

`check("visible products", …)` (line 75) becomes:

```js
check("visible products", model.products.map(p => p.name).sort(),
  ["Bad size row", "Boys on sale", "Completely unrelated name", "Inherits site", "Inherits sub",
    "On sale", "Own words", "Photos", "Some sizes off", "Undated"]);
```

`check("a product with no date sorts last rather than first", …)` (line 137) becomes:

```js
check("a product with no date sorts last rather than first",
  model.categories.find(c => c.key === "girls").subcategories
    .find(s => s.id === "s2").products.map(p => p.name),
  ["Inherits site", "On sale", "Photos", "Undated"]);
```

`check("a section's id is its file name", …)` (line 148) becomes:

```js
check("a section's id is its file name", model.subcategories.map(s => s.id).sort(), ["b1", "s1", "s2"]);
```

Delete the three assertions about the old badge warning (currently lines 231-237): the comment block starting `// The badge and the prices are set in different places on the form`, `checkTrue('a "Sale" badge with no sale price anywhere is warned about', …)`, `checkTrue("…and that piece still reaches the site", …)` and `check("…at its ordinary price", …)`.

- [ ] **Step 3: Write the failing test for the sale set**

Append to `tools/test.js`, directly after Task 3's `check("a piece with nothing discounted is handed back untouched", …)`:

```js
/* --- which pieces the Sale page lists ------------------------------------
 *
 * Grouped under the four top-level categories, in the order the tabs run,
 * newest first inside each — the same order the shop pages use, so a visitor
 * moving between them sees the catalogue arranged the one way.
 *
 * A sold-out piece is left out even when it is discounted: /sale/ is somewhere
 * to buy from, and there is nothing to buy. Its crossed-out prices still show
 * on its own pages, which is why "Undated" is discounted here and still absent.
 */

check("the sale set is grouped by category, in tab order, newest first",
  model.saleCategories.map(c => [c.key, c.products.map(p => p.name)]),
  [["girls", ["On sale"]], ["boys", ["Boys on sale"]]]);
checkTrue("a category with nothing reduced gets no heading at all",
  !model.saleCategories.some(c => c.key === "babies" || c.key === "ready"));
checkTrue("a discounted piece that is sold out is kept off the page",
  card.discountedSizes(byName["Undated"]).length === 1 &&
  !model.saleCategories.some(c => c.products.some(p => p.name === "Undated")));
check("…and the count the build reports agrees with the list",
  model.stats.saleProducts, 2);
checkTrue("a sale price that is not below the normal one still counts for nothing",
  card.discountedSizes(byName["On sale"]).map(s => s.size).join() === "0–3 years");
checkTrue("nothing is warned about a badge and a discount disagreeing any more",
  !warned(w, "badged", "no size has a sale price"));
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — aborts with `TypeError: Cannot read properties of undefined (reading 'map')` on `model.saleCategories.map`.

- [ ] **Step 5: Require the shared helper in `tools/content.js`**

Add below `const images = require("./images");` (line 15):

```js
// <!-- COMMENT EXPECTED: the sale rule is in tools/card.js because the admin's
//      preview panel needs it in a browser, where this file cannot run. Read
//      from there rather than kept in step by hand — the MIRRORED notes
//      elsewhere in this file are what that costs. -->
const { discountedSizes } = require("./card");
```

- [ ] **Step 6: Delete the dead warning**

Remove lines 481-489 of `tools/content.js` in full — the comment block starting `// The badge and the sale prices are set in two different places` and the `if (nonEmpty(data.badge) === "Sale" && !sizes.some(s => s.wasPrice)) { … }` block. The state it warned about cannot be expressed once Task 6 removes the dropdown option.

- [ ] **Step 7: Build the sale set**

Insert directly after the `for (const s of subs) { … }` sort loop closes (currently line 564), before the WebP-first-photo check:

```js
  // --- the sale set --------------------------------------------------------
  // <!-- COMMENT EXPECTED: one rule and no switch — a piece is on sale when a
  //      size it still offers is reduced. Sold-out pieces are excluded because
  //      /sale/ is somewhere to buy from; their crossed-out prices still show
  //      on their own pages. Sorted here rather than in the renderer for the
  //      same reason the carousel is: it is a content decision, and it has to
  //      match the newest-first order the shop pages already use. -->
  const saleCategories = categories.map(c => ({
    key: c.key,
    label: c.label,
    href: c.href,
    products: c.subcategories
      .flatMap(sub => sub.products)
      .filter(p => p.badge !== "Sold out" && discountedSizes(p).length)
      .sort((a, b) => b.addedOn - a.addedOn || a.name.localeCompare(b.name))
  })).filter(c => c.products.length);
```

- [ ] **Step 8: Return it and count it**

In the returned model, add `saleCategories` after `products` and extend `stats`:

```js
    categories,
    subcategories: subs,
    products,
    // Empty when nothing is reduced — which is what makes the "Sale" tab
    // disappear and /sale/ show its one friendly line instead.
    saleCategories,
    stats: {
      products: products.length,
      hidden: hiddenCount,
      subcategories: subs.length,
      saleProducts: saleCategories.reduce((n, c) => n + c.products.length, 0),
      warnings: warnings.length
    }
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test`
Expected: `OK — 170 checks passed` (167 + 6 new − 3 deleted).

- [ ] **Step 10: Confirm the real catalogue is green**

Run: `npm run build`
Expected: succeeds. Three products are on sale in the live content (`muhammad-baby-romper-with-pillow`, `prince-cape`, `prince-cape-and-crown`), so `model.stats.saleProducts` is 3. Warning count unchanged apart from the removed badge warning.

- [ ] **Step 11: Commit**

```bash
git add tools/content.js tools/test.js tools/fixtures/content
git commit -m "Group the discounted pieces into a sale set on the model

A piece is on sale when a size it offers is reduced, and sold-out pieces
are kept off the list. The old 'badged Sale but nothing discounted'
warning goes with it — that state can no longer be expressed."
```

---

### Task 6: Retire the "Sale" badge option

**Files:**
- Modify: `site/admin/config.yml:214-220` (the `badge` select options and hint)
- Modify: `content/products/muhammad-baby-romper-with-pillow.json` (the one live product still storing `"badge": "Sale"`)
- Modify: `tools/fixtures/content/products/on-sale.json` (drop its `"badge": "Sale"`)
- Modify: `tools/test.js:359-367` (the `fromCmsEntry` preview test passes `badge: "Sale"`)

**Interfaces:**
- Consumes: Task 3's `effectiveBadge` — without it, removing the stored value would strip the tag from those products.
- Produces: nothing new. This closes the loop so `"Sale"` can only ever be computed.

- [ ] **Step 1: Write the failing test**

Replace the existing `salePreview` block in `tools/test.js` (currently lines 359-367) with the same fixture minus the badge, and add an assertion that the tag still appears:

```js
const salePreview = card.fromCmsEntry({
  name: "Preview sale",
  sizes: [
    { size: "0–3 years", price: 8000, salePrice: 6000 },
    { size: "4–6 years", price: 9000 },
    { size: "7–9 years", price: 10000, salePrice: 12000 }
  ]
}, catalogue);
```

and append, directly after the existing `checkTrue("…and marks itself as a sale card so the styling applies", …)`:

```js
checkTrue("…and the preview shows the Sale tag from the prices alone, with no badge set",
  card.productCard(null, salePreview.product)
    .includes('<span class="lp-badge" data-badge="Sale">Sale</span>'));
```

Add a guard that the option is really gone, appended after Task 5's sale-set block:

```js
/* the "Sale" badge option is gone for good — the tag is computed, never typed */

const adminConfig = require("fs").readFileSync(
  path.join(__dirname, "..", "site", "admin", "config.yml"), "utf8");
checkTrue("the admin no longer offers a Sale badge to set by hand",
  !adminConfig.includes('{ label: "Sale", value: "Sale" }'));
checkTrue("…and no piece in the catalogue still stores one",
  !model.products.some(p => p.badge === "Sale"));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `✗ the admin no longer offers a Sale badge to set by hand` and `✗ …and no piece in the catalogue still stores one` (the fixture `on-sale.json` still has it).

- [ ] **Step 3: Remove the option from `site/admin/config.yml`**

Lines 214-220 become:

```yaml
        options:
          - { label: "None", value: "" }
          - { label: "New", value: "New" }
          - { label: "Made to order", value: "Made to order" }
          - { label: "Sold out", value: "Sold out" }
        hint: "Optional corner label on the photo. \"Sold out\" keeps the piece visible but marks it clearly. There is no \"Sale\" option any more: a sale is created purely by filling in a size's sale price below, and the SALE label then appears by itself — on the card, on the product page, and on the Sale page. Clear the sale price and it all goes away together."
```

- [ ] **Step 4: Clear the stored value in the live catalogue**

In `content/products/muhammad-baby-romper-with-pillow.json`, change:

```json
  "badge": "Sale",
```

to:

```json
  "badge": "",
```

(It has a real discount, so `effectiveBadge` gives it back the same "Sale" tag. Leaving the string would be a value the CMS dropdown can no longer show, and a tag that would survive the discount being removed.)

- [ ] **Step 5: Clear it in the fixture too**

In `tools/fixtures/content/products/on-sale.json`, delete the line `"badge": "Sale",`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: `OK — 173 checks passed` (170 + 3).

- [ ] **Step 7: Confirm the live site still tags those pieces**

Run: `npm run build`
Expected: succeeds.

Run: `node -e "console.log(require('fs').readFileSync('dist/product/muhammad-baby-romper-with-pillow/index.html','utf8').includes('data-badge=\"Sale\"'))"`
Expected: `true`

- [ ] **Step 8: Commit**

```bash
git add site/admin/config.yml content/products/muhammad-baby-romper-with-pillow.json tools/fixtures/content/products/on-sale.json tools/test.js
git commit -m "Remove the Sale option from the badge dropdown

The label is worked out from the sale prices now, so setting it by hand
could only ever disagree with them. The one piece that had it stored keeps
its tag — it has a real discount."
```

---

### Task 7: Render `/sale/`, add the nav entry, wire the build

**Files:**
- Modify: `tools/render.js` — extend the `card` destructure (line 18), `header()` (line 173), `page()` (line 262), add `renderSale` after `renderShop` (line 551), extend `module.exports` (line 785)
- Modify: `tools/build.js` — import `effectiveBadge`, map it into `data/products.json`, write the page, add the sitemap URL, add the llms.txt line, update the build report
- Modify: `tools/test.js`

**Interfaces:**
- Consumes: `model.sale` (Task 4), `model.saleCategories` (Task 5), `card.saleCopy` / `card.effectiveBadge` (Task 3), the existing `INITIAL_VISIBLE = 4` / `LOAD_STEP = 4` constants.
- Produces: `render.renderSale(model, siteUrl) -> string`, and `dist/sale/index.html`.

- [ ] **Step 1: Write the failing test**

Append to `tools/test.js`, after Task 6's block:

```js
/* --- the Sale page -------------------------------------------------------
 *
 * Built out of the same markup shape as a shop page on purpose — [data-subsect]
 * with a [data-grid] inside, size chips, the price slider — because that is
 * what site/app.js's initShop() keys off. Get the shape right and the filters,
 * Load more and the price repainting all work here with no JavaScript of their
 * own. These checks are what keep that shape from drifting.
 */

const saleHtml = render.renderSale(model, "https://example.test");

checkTrue("the page carries the filter markup app.js drives",
  saleHtml.includes("data-subsect") && saleHtml.includes("data-grid") &&
  saleHtml.includes("data-size-chip") && saleHtml.includes("data-fmax") &&
  saleHtml.includes("data-loadwrap") && saleHtml.includes("data-noresults"));
check("one section per category that has something reduced, in tab order",
  (saleHtml.match(/<h3 id="sale-([a-z]+)"/g) || []).join(),
  '<h3 id="sale-girls",<h3 id="sale-boys"');
checkTrue("a jump button per section, so the categories are reachable on a phone",
  saleHtml.includes('<a href="#sale-girls">') && saleHtml.includes('<a href="#sale-boys">'));
checkTrue("the cards show only the reduced sizes",
  saleHtml.includes('data-sizes="0–3 years"') && saleHtml.includes('data-sizes="4–6 years"') &&
  !saleHtml.includes('data-sizes="0–3 years|4–6 years|7–9 years"'));
checkTrue("…each wearing the Sale tag",
  (saleHtml.match(/data-badge="Sale"/g) || []).length === 2);
checkTrue("the page is indexable and canonical to itself",
  !saleHtml.includes('name="robots" content="noindex"') &&
  saleHtml.includes('<link rel="canonical" href="https://example.test/sale/">'));
checkTrue("…and says what it is to a search engine",
  saleHtml.includes('"@type":"CollectionPage"') && saleHtml.includes('"@type":"BreadcrumbList"'));
checkTrue("no inline <script> here either",
  scriptTags(saleHtml).every(t => t.includes(" src=") || t.includes('type="application/ld+json"')));

/* the nav entry appears only while there is something to see */

checkTrue("the Sale tab sits between Ready to wear and Contact us",
  saleHtml.indexOf('href="/ready/"') < saleHtml.indexOf('href="/sale/"') &&
  saleHtml.indexOf('href="/sale/"') < saleHtml.indexOf('href="/contact/"'));

/* nothing on sale: the page still builds, and the tab goes away */

const noSale = Object.assign({}, model, { saleCategories: [], stats: model.stats });
const emptyHtml = render.renderSale(noSale, "https://example.test");
checkTrue("with nothing reduced the page says so in one line",
  emptyHtml.includes('class="lp-empty"') && emptyHtml.includes(card.esc(model.sale.empty)));
checkTrue("…with a way back into the collection",
  emptyHtml.includes('href="/girls/"'));
checkTrue("…and no sections, no filters and no jump row to work with",
  !emptyHtml.includes("data-subsect") && !emptyHtml.includes("data-size-chip") &&
  !emptyHtml.includes("lp-salenav"));
checkTrue("…and no Sale tab in the header, on any page",
  !emptyHtml.includes('href="/sale/"') &&
  !render.renderProduct(noSale, byName["Own words"], "https://example.test").includes('href="/sale/"'));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — aborts with `TypeError: render.renderSale is not a function`.

- [ ] **Step 3: Extend the `card` destructure in `tools/render.js`**

Line 18 becomes:

```js
const { esc, safeHref, money, frame, IMG_SIZES, productCard, svg, ICON, waLink, saleCopy } = card;
```

- [ ] **Step 4: Add the conditional nav entry**

`header()` (line 173) becomes:

```js
/**
 * <!-- COMMENT EXPECTED: hasSale is passed in rather than read off a global
 *      because the Sale tab is only honest while something is reduced — a tab
 *      leading to "nothing is on sale right now" is a dead end in the one row
 *      of links every page carries. page() works it out from the model. -->
 */
function header(s, activeTab, hasSale) {
  const nav = [
    { key: "home", label: "Home", href: "/" },
    { key: "girls", label: "Girls", href: "/girls/" },
    { key: "boys", label: "Boys", href: "/boys/" },
    { key: "babies", label: "Babies", href: "/babies/" },
    { key: "ready", label: "Ready to wear", href: "/ready/" },
    ...(hasSale ? [{ key: "sale", label: "Sale", href: "/sale/" }] : []),
    { key: "contact", label: "Contact us", href: "/contact/" }
  ];
```

The rest of `header()` is unchanged.

- [ ] **Step 5: Pass the flag from `page()`**

In `page()` (line 272), replace `header(s, tab),` with:

```js
    header(s, tab, ((model.saleCategories || []).length > 0)),
```

- [ ] **Step 6: Add `renderSale`**

Insert after `renderShop` closes (currently line 551), before the `/* --- product */` banner:

```js
/* --- sale --------------------------------------------------------------- */

/**
 * <!-- COMMENT EXPECTED: every reduced piece in one place, grouped by
 *      category. Deliberately the same markup shape as renderShop —
 *      [data-subsect] / [data-grid] / [data-size-chip] / [data-fmax] — because
 *      that is what site/app.js's initShop() keys off, so the filter panel,
 *      Load more and the size-to-price repainting all work here without a line
 *      of JavaScript of their own. Each card is drawn from a copy of its
 *      product holding only the reduced sizes (card.saleCopy), so the dropdown
 *      offers what the page is advertising. -->
 */
function renderSale(model, siteUrl) {
  const sale = model.sale;
  const groups = model.saleCategories || [];

  // Nothing reduced: one friendly line and a way back into the collection.
  // No filter panel, no jump row and no sections — controls with nothing to
  // control read as a broken page rather than an empty one.
  if (!groups.length) {
    const emptyBody = `<main class="lp-main lp-main--shop">
<nav class="lp-crumb" aria-label="Breadcrumb">
<ol>
<li><a href="/">Home</a></li>
<li aria-hidden="true">›</li>
<li aria-current="page">${esc(sale.h1)}</li>
</ol>
</nav>
<div class="lp-eyebrow lp-shop-eyebrow">${esc(sale.eyebrow)}</div>
<h1 class="lp-shop-h1">${esc(sale.h1)}</h1>
<p class="lp-empty">${esc(sale.empty)}</p>
<a class="lp-back" href="/girls/">Browse the collection →</a>
</main>`;
    return saleShell(model, siteUrl, emptyBody);
  }

  const jumps = `<nav class="lp-salenav" aria-label="Jump to a category">
${groups.map(g => '<a href="#sale-' + esc(g.key) + '">' + esc(g.label) + "</a>").join("\n")}
</nav>`;

  const sections = groups.map(g => `<section class="lp-subsect lp-salesect" data-subsect data-step="${LOAD_STEP}" data-visible="${INITIAL_VISIBLE}">
<h3 id="sale-${esc(g.key)}">${esc(g.label)}</h3>
<div class="lp-grid" data-grid${g.products.length > INITIAL_VISIBLE ? " data-preload" : ""}>
${g.products.map(p => productCard(model, saleCopy(p))).join("\n")}
</div>
<div class="lp-loadwrap" data-loadwrap${g.products.length > INITIAL_VISIBLE ? "" : " hidden"}>
<button type="button" class="lp-load" data-load aria-label="${esc("Load more " + g.label.toLowerCase() + " pieces on sale")}">
<span>Load more</span>
<span class="lp-load-badge">${svg(ICON.chevRight, { size: 18, stroke: "var(--tone)", width: 2.4 })}</span>
</button>
</div>
<p class="lp-empty" data-noresults hidden>No reduced pieces in this category match your filters. Try a wider price range.</p>
</section>`).join("\n");

  const body = `<main class="lp-main lp-main--shop">
<nav class="lp-crumb" aria-label="Breadcrumb">
<ol>
<li><a href="/">Home</a></li>
<li aria-hidden="true">›</li>
<li aria-current="page">${esc(sale.h1)}</li>
</ol>
</nav>
<div class="lp-eyebrow lp-shop-eyebrow">${esc(sale.eyebrow)}</div>
<h1 class="lp-shop-h1">${esc(sale.h1)}</h1>
${paragraphs(sale.blurb).map(p => '<p class="lp-shop-blurb">' + esc(p) + "</p>").join("\n")}

<div class="lp-toolbar">
<button type="button" class="lp-filterbtn" data-filter-open aria-expanded="false" aria-controls="lp-filters">
${svg(ICON.filters, { size: 18, width: 2 })}
Filters</button>
</div>

<div class="lp-scrim" data-scrim data-open="0"></div>
<aside class="lp-panel" id="lp-filters" data-panel data-open="0" aria-label="Filters">
<div class="lp-panel-head">
<div class="lp-panel-title">Filters</div>
<button type="button" class="lp-panel-x" data-filter-close aria-label="Close filters">×</button>
</div>
<div>
<div class="lp-eyebrow">Size</div>
<div class="lp-chips">
${model.sizes.map(sz =>
  '<button type="button" class="lp-chip" data-size-chip="' + esc(sz) + '" aria-pressed="false">' + esc(sz) + "</button>"
).join("\n")}
</div>
</div>
<div>
<div class="lp-eyebrow">Maximum price</div>
<input class="lp-range" id="lp-fmax" type="range" min="3000" max="100000" step="1000" value="100000"
  data-fmax aria-label="Maximum price in Pakistani rupees">
<div class="lp-range-row">
<span class="lp-range-min">PKR 3,000</span>
<span class="lp-range-max" data-fmax-out>${money(100000)}</span>
</div>
</div>
<div class="lp-panel-foot">
<button type="button" class="lp-btn-ghost" data-filter-reset>Reset</button>
<button type="button" class="lp-btn-solid" data-filter-close>Show results</button>
</div>
</aside>

${jumps}
${sections}
</main>`;

  return saleShell(model, siteUrl, body);
}

/**
 * The chrome and search-engine data both /sale/ bodies share. Split out so the
 * empty page and the full one cannot drift apart on their title, canonical or
 * structured data — the empty state is the version nobody looks at.
 */
function saleShell(model, siteUrl, body) {
  const sale = model.sale;
  return page(model, {
    // No per-tab palette: "sale" matches none of the four category keys, so
    // the berry defaults on .lp-app apply — the same colour the Sale tag uses.
    tab: "sale",
    siteUrl,
    title: sale.seo.title,
    description: sale.seo.description,
    canonical: siteUrl + "/sale/",
    // Falls through to the built-in share card: the page is a mixture of
    // pieces, and picking one of them as the preview would misrepresent it.
    image: null,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: sale.h1,
        description: sale.seo.description,
        url: siteUrl + "/sale/"
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl + "/" },
          { "@type": "ListItem", position: 2, name: sale.h1, item: siteUrl + "/sale/" }
        ]
      }
    ],
    body
  });
}
```

- [ ] **Step 7: Export it**

Line 785 becomes:

```js
module.exports = { renderHome, renderShop, renderSale, renderProduct, renderContact, render404, money, esc };
```

- [ ] **Step 8: Wire the build**

In `tools/build.js`, line 23 becomes:

```js
const { waLink, effectiveBadge } = require("./card");
```

In the `data/products.json` write (line 161), replace `products: model.products` with:

```js
  // The tag a visitor actually sees, not the field on the form — the header
  // search reads this file and would otherwise say "Sale" only for pieces that
  // still had the retired badge stored on them.
  products: model.products.map(p => Object.assign({}, p, { badge: effectiveBadge(p) }))
```

After the 404 line (line 170), add:

```js
// Always written, even with nothing reduced: /sale/ is a permanent address
// that gets shared and linked, and a page that 404s between sales is worse
// than one that says there is nothing on right now.
writeFile("sale/index.html", render.renderSale(model, SITE_URL));
```

In the `urls` array (line 183), add the sale entry after contact:

```js
const urls = [
  ["/", "content/settings.json"],
  ["/contact/", "content/settings-contact.json"],
  ["/sale/", "content/settings-sale.json"],
  ...model.categories.map(c => [c.href, "content/categories/" + c.key + ".json"]),
  ...model.products.map(p => [p.href, "content/products/" + p.id + ".json"])
];
```

In the `llms.txt` write (line 243), the Sections list becomes:

```js
  "## Sections\n\n" +
  model.categories.map(c => "- " + c.label + ": " + SITE_URL + c.href).join("\n") + "\n" +
  "- Sale: " + SITE_URL + "/sale/\n\n" +
```

In the build report (line 270), the page line becomes:

```js
console.log("  " + pagesWritten.length + " pages" +
  "  (home, contact, 404, sale, " + model.categories.length + " category, " +
  model.products.length + " product)");
```

and add a line after the subcategories line (line 272-273):

```js
console.log("  " + st.saleProducts + " product(s) on sale" +
  (st.saleProducts ? " across " + model.saleCategories.length + " categor" +
    (model.saleCategories.length === 1 ? "y" : "ies") : " — the Sale tab is hidden"));
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test`
Expected: `OK — 186 checks passed` (173 + 13).

- [ ] **Step 10: Verify the built output**

Run: `npm run build`
Expected: succeeds; the report says `2 product(s) on sale…` for the fixture and `3 product(s) on sale across 2 categories` for the real catalogue.

Run:
```bash
node -e "
const fs=require('fs');
console.log('page written   ', fs.existsSync('dist/sale/index.html'));
console.log('in sitemap     ', fs.readFileSync('dist/sitemap.xml','utf8').includes('/sale/'));
console.log('in llms.txt    ', fs.readFileSync('dist/llms.txt','utf8').includes('- Sale: '));
console.log('nav on home    ', fs.readFileSync('dist/index.html','utf8').includes('href=\"/sale/\"'));
"
```
Expected: four `true`.

- [ ] **Step 11: Commit**

```bash
git add tools/render.js tools/build.js tools/test.js
git commit -m "Publish /sale/ — every reduced piece, grouped by category

Built with the same markup shape as a shop page, so the existing filter
panel, Load more and price repainting all work on it unchanged. The Sale
tab appears in the header only while something is actually reduced."
```

---

### Task 8: A product page opens on the size that is reduced

**Files:**
- Modify: `tools/card.js` — `productDetail`, the `opts` / `first` pair (currently lines 411-415)
- Test: `tools/test.js`

**Interfaces:**
- Consumes: nothing beyond `p.sizes[].wasPrice`.
- Produces: no new exports. `productDetail` now emits exactly one `<option … selected>`.

- [ ] **Step 1: Write the failing test**

Append to `tools/test.js`, after Task 7's block:

```js
/* --- a discounted product opens on the size that is actually reduced ------
 *
 * The dropdown used to open on sizes[0], which on a piece reduced in only one
 * band showed the full price to someone who arrived from the Sale page and had
 * just been shown a lower one. Every size stays selectable; app.js repaints on
 * change exactly as before, because a server-rendered `selected` is honoured.
 */

/** The label of the option a product page opens on. */
const openingSize = html => (html.match(/<option[^>]*\bselected[^>]*>([^<]+)</) || [])[1];

const partlyReduced = card.productDetail(byName["Boys on sale"], model.settings, "https://example.test");
check("the dropdown opens on the reduced size, not the first one",
  openingSize(partlyReduced), "4–6 years");
checkTrue("…so the price block opens showing the saving",
  partlyReduced.includes("lp-detail-price--sale") &&
  partlyReduced.includes("PKR 9,000") && partlyReduced.includes("PKR 12,000"));
checkTrue("…and the total is what that size actually costs",
  partlyReduced.includes('data-total>PKR 9,000<'));
check("every size is still there to pick from",
  (partlyReduced.match(/<option/g) || []).length, 2);
check("a piece with nothing reduced still opens on its first size",
  openingSize(card.productDetail(byName["Photos"], model.settings, "https://example.test")),
  "13–16 years");
check("exactly one option is marked, or the browser picks for itself",
  (partlyReduced.match(/\bselected\b/g) || []).length, 1);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `✗ the dropdown opens on the reduced size, not the first one / expected: "4–6 years" / actual: undefined` (nothing is marked `selected` today), plus the four assertions that follow.

- [ ] **Step 3: Seed the detail page from the first reduced size**

In `tools/card.js`, replace lines 411-415:

```js
  const opts = p.sizes.map((sz, i) =>
    '<option value="' + i + '" data-price="' + sz.price + '" data-was="' +
    (sz.wasPrice || "") + '">' + esc(sz.size) + "</option>"
  ).join("");
  const first = p.sizes[0];
```

with:

```js
  // <!-- COMMENT EXPECTED: a piece reduced in only one band used to open on
  //      whichever size came first, so someone arriving from /sale/ having
  //      just seen a lower price landed on the full one. Open on the first
  //      reduced size instead — in normal size order, so it is still the
  //      smallest of them. Every size stays selectable and app.js repaints on
  //      change; a server-rendered `selected` is what it reads on load.
  //      findIndex returns -1 when nothing is reduced, and Math.max puts that
  //      back to 0 — the behaviour every full-price piece has always had. -->
  const firstIndex = Math.max(0, p.sizes.findIndex(sz => sz.wasPrice));
  const opts = p.sizes.map((sz, i) =>
    '<option value="' + i + '" data-price="' + sz.price + '" data-was="' +
    (sz.wasPrice || "") + '"' + (i === firstIndex ? " selected" : "") + ">" + esc(sz.size) + "</option>"
  ).join("");
  const first = p.sizes[firstIndex];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: `OK — 192 checks passed` (186 + 6).

The existing WhatsApp-order-message assertions (currently around line 436) read `detailProduct.sizes[0]` for "On sale", whose reduced size **is** index 0, so they stay green unchanged.

- [ ] **Step 5: Confirm the build**

Run: `npm run build`
Expected: succeeds.

Run: `node -e "const h=require('fs').readFileSync('dist/product/prince-cape/index.html','utf8');console.log((h.match(/<option[^>]*selected[^>]*>([^<]+)</)||[])[1])"`
Expected: a size name, not `undefined`.

- [ ] **Step 6: Commit**

```bash
git add tools/card.js tools/test.js
git commit -m "Open a product page on the size that is actually reduced

A piece reduced in one band only used to open on the full price, which is
the wrong number for someone who has just clicked through from /sale/."
```

---

### Task 9: The sticky category row on `/sale/`

**Files:**
- Modify: `site/styles.css` — a new section `11b` inserted before `/* --- 12. Filters panel */` (currently line 638)

**Interfaces:**
- Consumes: the markup Task 7 emits — `.lp-salenav` with `<a>` children, and `.lp-salesect h3[id]`.
- Produces: nothing other tasks read.

- [ ] **Step 1: Add the stylesheet block**

Insert immediately before the `/* --- 12. Filters panel ------ */` banner:

```css
/* --- 11b. Sale page ----------------------------------------------------- */

/* The category jump row. Everything else on /sale/ reuses the shop classes;
   this is the one piece the shop pages have no equivalent of, because they
   only ever show one category at a time.

   It sticks under the header rather than at the top of the viewport: the
   header is itself sticky, and app.js measures its real height into
   --lp-header on load (see .lp-sticky, which does the same). The fallback
   figure is what the header measures to on a desktop — a row that overlaps
   for one frame on a slow load is better than one that never sticks at all if
   the script has not run.

   Horizontal scroll rather than wrapping, and the scrollbar hidden, for the
   same reason as .lp-nav: on a phone four pills do not fit, and a row that
   wraps to two lines pushes the first card off the screen. */
.lp-salenav{
  position:sticky;top:var(--lp-header,92px);z-index:30;
  display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;
  scrollbar-width:none;-ms-overflow-style:none;
  max-width:var(--lp-gridmax);margin:0 auto var(--space-6);
  padding:10px 0;background:var(--paper-050);
}
.lp-salenav::-webkit-scrollbar{display:none}
.lp-salenav a{
  flex:0 0 auto;text-decoration:none;
  font:var(--weight-bold) 0.9375rem/1 var(--font-ui);color:var(--tone-deep);
  background:var(--tone-soft);border:2px solid var(--tone-edge);
  border-radius:var(--radius-pill);padding:10px 16px;
}
.lp-salenav a:hover{filter:brightness(.97)}

/* Jumping to a section has to clear both the header and the sticky row above,
   so the heading lands below them rather than behind them. The generic
   .lp-anchor 6rem is not enough once there are two sticky bars. */
.lp-salesect h3{scroll-margin-top:calc(var(--lp-header,92px) + 5rem)}

/* The way back into the collection when nothing is reduced. .lp-back is built
   for the top-left of a product page, so it is centred under the empty line
   here rather than left-aligned against a page with nothing else on it. */
.lp-empty + .lp-back{display:block;width:max-content;margin:var(--space-5) auto 0}
```

- [ ] **Step 2: Verify the build copies it**

Run: `npm run build`
Expected: succeeds.

Run: `node -e "console.log(require('fs').readFileSync('dist/styles.css','utf8').includes('.lp-salenav'))"`
Expected: `true`

- [ ] **Step 3: Confirm the tests are still green**

Run: `npm test`
Expected: `OK — 192 checks passed`

- [ ] **Step 4: Commit**

```bash
git add site/styles.css
git commit -m "Style the Sale page's sticky category jump row

Sticks under the header using the height app.js already measures, and
scrolls sideways on a phone rather than wrapping and pushing the first
card off the screen."
```

---

### Task 10: Local browser pass over the built `dist/`

**Files:** none changed. This produces the report the spec's Definition of Done asks for.

**Interfaces:**
- Consumes: everything above, both workstreams merged.
- Produces: a written verification note for the PR description.

- [ ] **Step 1: Build and serve**

```bash
npm run build
```
Expected: succeeds; note the exact warning count from the output (the two existing fascinator price notes are expected; anything else is new and must be explained).

Start the server in the background:
```bash
node tools/serve.js
```
Expected: `Serving dist/ on http://localhost:8080`

- [ ] **Step 2: Walk the public pages with Chrome DevTools MCP**

For each of these addresses, call `mcp__chrome-devtools__navigate_page`, then `mcp__chrome-devtools__list_console_messages`, then `mcp__chrome-devtools__take_screenshot`:

1. `http://localhost:8080/` — the Sale tab is in the header.
2. `http://localhost:8080/boys/` — `prince-cape` and `prince-cape-and-crown` show a berry SALE pill.
3. `http://localhost:8080/ready/` — `muhammad-baby-romper-with-pillow` shows the SALE pill.
4. `http://localhost:8080/sale/` — two headings (Boys, Ready to wear), the sticky jump row, three cards.
5. `http://localhost:8080/product/prince-cape/` — the SALE pill over the gallery, the dropdown opened on a reduced size, a struck-through price.
6. `http://localhost:8080/contact/`
7. `http://localhost:8080/404.html`

Expected on every page: no console errors, and no request in `mcp__chrome-devtools__list_network_requests` failing for a file this site serves. ImageKit photos will not load — the proxy blocks that host — so **broken photographs are expected locally and are not a finding**; say so in the report rather than claiming the images were checked.

- [ ] **Step 3: Exercise the Sale page's controls**

On `http://localhost:8080/sale/`:
- `mcp__chrome-devtools__click` the "Filters" button, then a size chip that only one of the three pieces offers. Expected: the non-matching cards disappear; a category whose cards all disappear shows its "No reduced pieces in this category match your filters" line.
- Drag the Max price slider down with `mcp__chrome-devtools__fill` on `[data-fmax]` (set it to `5000`). Expected: cards drop out and the address gains `#max=5000`.
- `mcp__chrome-devtools__click` a jump button. Expected: the page scrolls to that heading and the heading is not hidden behind the header or the sticky row.
- Change a card's size dropdown with `mcp__chrome-devtools__evaluate_script`. Expected: the price repaints; the struck-through price stays, because every size on a sale card is a reduced one.

- [ ] **Step 4: Check the "nothing on sale" state without changing the content**

Rather than editing `content/`, prove it from the model:

```bash
node -e "
const content=require('./tools/content'); const render=require('./tools/render');
const m=content.load({quiet:true});
const empty=Object.assign({},m,{saleCategories:[]});
const html=render.renderSale(empty,'https://example.test');
console.log('empty line   ', html.includes(m.sale.empty));
console.log('no sections  ', !html.includes('data-subsect'));
console.log('no sale tab  ', !render.renderHome(empty,'https://example.test').includes('href=\"/sale/\"'));
"
```
Expected: three `true`.

- [ ] **Step 5: Load the admin shell**

Navigate to `http://localhost:8080/admin/` and call `mcp__chrome-devtools__list_console_messages`.

Expected: the page reaches the Sveltia login screen, and **no error comes from this repository's own files** (`shared.js`, `images.js`, `card.js`, `preview.js`, `tile-photo.js`, `no-scroll-number.js`, or the inline boot script). The unpkg CMS bundle itself will fail to load — the proxy blocks that host — so a **full admin sign-in cannot be tested here and is the owner's to do on the deploy preview**. Report that in exactly those words; do not describe the admin as verified.

- [ ] **Step 6: Write the report**

Report to the owner, in plain words:
- What is on `/sale/` now, and the one rule that puts a piece there.
- That the "Sale" option is gone from the badge dropdown and why nothing was lost.
- What was checked locally, and — plainly — what was **not**: the CSP headers (Netlify only, `serve.js` does not send them), the ImageKit photographs, GA Realtime, and a full admin sign-in.
- The three owner-side checks from Task 2, verbatim.

- [ ] **Step 7: Stop the server**

Kill the background `node tools/serve.js` process.

- [ ] **Step 8: Final green run**

```bash
npm test && npm run build
```
Expected: `OK — 192 checks passed`, then a successful build with no new warnings beyond the two existing fascinator price notes.

---

## Self-review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| Part 1 · `site/ga.js` | 1 |
| Part 1 · `render.js` head() swap, loader first | 1 |
| Part 1 · `build.js` passthrough `ga.js` | 1 |
| Part 1 · enforced `/*` CSP, exact directive string | 2 |
| Part 1 · permissive `/admin/*` CSP | 2 |
| Part 1 · rewritten netlify.toml comment | 2 |
| Part 1 · header-merge assumption + owner verification list | 2 (owner-side block) + 10 |
| Part 2 · the rule (≥1 discounted available size) | 3, 5 |
| Part 2 · the four-row state table | 3 (tag), 5 (sale-set exclusion of sold-out) |
| Part 2 · effective badge on card **and** product page | 3 |
| Part 2 · which products appear, grouped, newest first | 5 |
| Part 2 · sale card = shallow copy, sizes filtered, minPrice recomputed | 3 (`saleCopy`), 7 (used) |
| Part 2 · page layout: breadcrumb, eyebrow/h1/blurb, filter toolbar, sticky category row, per-category `lp-subsect` | 7 |
| Part 2 · empty state | 4 (wording), 7 (render), 9 (link centring) |
| Part 2 · nav entry after `ready`, before `contact`, conditional | 7 |
| Part 2 · `data-tab="sale"`, default berry palette | 7 (`saleShell`) |
| Part 2 · detail page defaults to first discounted size | 8 |
| Part 2 · `content/settings-sale.json` | 4 |
| Part 2 · `config.yml` settings entry | 4 |
| Part 2 · `config.yml` badge option removal + hint | 6 |
| Part 2 · `content.js` drop dead warning / load settings / expose sale set | 5, 4, 5 |
| Part 2 · `render.js` renderSale / header / shared helper | 7, 7, 3 |
| Part 2 · `build.js` page, sitemap, llms.txt | 7 |
| Part 2 · `check-config.js` picks up the pairing | 4 step 9 |
| Part 2 · JSON-LD CollectionPage + BreadcrumbList, indexable | 7 |
| Part 2 · `feed.js` / `redirects.json` / `robots.txt` unchanged | no task, correctly |
| Part 2 · every listed test | 3, 5, 6, 7, 8 |
| Part 2 · CSS sticky row | 9 |
| Definition of done · local browser pass, admin caveat, owner list | 10 |

No spec requirement is without a task.

**2. Placeholder scan**

No `TBD`, `TODO`, "implement later", "add error handling", "similar to Task N", or "write tests for the above". Every code step carries the literal code. The `<!-- COMMENT EXPECTED -->` markers are deliberate and named in Global Constraints: the *prose* of a house-style why-comment is left to the implementer, the *placement* is not.

**3. Type consistency**

- `discountedSizes(p)` → array of size objects. Used by `effectiveBadge` (Task 3), `saleCopy` (Task 3), `content.js` (Task 5), tests (Tasks 3, 5). Same name everywhere.
- `effectiveBadge(p)` → string. Used by `productCard`, `productDetail` (Task 3), `build.js` (Task 7), tests. Same name everywhere.
- `saleCopy(p)` → product. Used by `renderSale` (Task 7) and tests. Destructured into `render.js` as `saleCopy` in Task 7 Step 3.
- `model.sale` → `{ eyebrow, h1, blurb, empty, seo: { title, description } }`. Written in Task 4, read in Task 7 (`sale.h1`, `sale.eyebrow`, `sale.blurb`, `sale.empty`, `sale.seo.title`, `sale.seo.description`). No field is read that Task 4 does not produce.
- `model.saleCategories` → `[{ key, label, href, products }]`. Written in Task 5, read in Task 7 (`g.key`, `g.label`, `g.products`) and `page()` (`.length`). `href` is produced but unused — kept because it mirrors the category shape everything else in the model uses.
- `model.stats.saleProducts` → number. Written in Task 5, read in Task 7's build report and Task 5's test.
- `header(s, activeTab, hasSale)` — the third parameter is added in Task 7 Step 4 and supplied in Step 5. `header` has exactly one caller.
- `render.renderSale(model, siteUrl)` — same `(model, siteUrl)` signature as `renderHome`, `renderContact` and `render404`.
- Check counts run 138 → 144 → 150 → 161 → 167 → 170 → 173 → 186 → 192, each task's expected total matching the next task's baseline.

---

## Known ambiguities and risks

Flagged rather than silently decided:

1. **The spec says the effective badge applies "on the product detail page (`productDetail`)"** — but `productDetail` renders no badge today; the only `.lp-badge` in the codebase is in `productCard`. Task 3 adds one, inside `.lp-galwrap` (already `position:relative`), so it needs no CSS. If the owner did not want a tag on the product page, Task 3 Step 5's markup line is the whole change to drop.
2. **The `empty` default wording** — the spec's JSON gives a plain sentence ending "browse the collection." while its prose shows that phrase as a link. Task 4 shortens the stored default to "Nothing is on sale right now." and Task 7 renders a real link beneath it, so the phrase is not said twice. Documented at Task 4 Step 3.
3. **The header search dropdown** reads `p.badge` from `/data/products.json` (`site/app.js:710`). The spec's state table says the Sale tag shows "on every view" but never mentions the search. Task 7 maps `effectiveBadge` into that file so the search agrees with the cards. If that is unwanted, it is one line in `build.js`.
4. **One live product still stores `badge: "Sale"`** — `content/products/muhammad-baby-romper-with-pillow.json`. It has a real discount, so its tag survives either way, but the value would be one the CMS dropdown can no longer display, and it would outlive the discount. Task 6 clears it. `check-config.js` compares field *names*, not select *values*, so it would not have caught this.
5. **The Netlify header-merge assumption is untestable from here.** If Netlify concatenates rather than overrides, the admin receives both policies and the strict one breaks the CMS. Nothing in the build can prove it; it is the owner's step 3 on the deploy preview, and the spec's fallback policy is the fix.
6. **The fixture catalogue is a fixed size.** `tools/test.js:117-119` documents that the carousel assertions depend on there being ≤10 visible products. Task 5 deletes one fixture and adds one, and reuses `undated.json` for the sold-out-and-discounted case rather than adding an eleventh product. Any later fixture addition has to reckon with the same constraint.
7. **`tools/content.js` now requires `tools/card.js`.** That is a model file reading a view file, which is backwards on paper. The alternative — a fourth `MIRRORED:` copy of the sale rule — is worse, and `card.js` has no `fs` and no cycle back to `content.js`, so the require is safe. Called out because a reviewer will notice it.
8. **`.lp-salenav`'s sticky offset falls back to `92px`** when `--lp-header` has not been set — i.e. before `app.js` runs, or with JavaScript off. On a phone the real header is taller, so for one frame on a slow load the row can overlap. The alternative (no sticky at all without JavaScript) is worse; the existing `.lp-sticky` makes the same trade with a `78px` fallback.
