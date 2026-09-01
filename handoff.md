# Handoff: Little Princess Designer

_Last updated: 2026-09-01. Read `README.md` first — it explains how the repo
works. This file only carries what a fresh session cannot work out from the
code: what is live, what has never been proved, and which roads are closed._

## Goal

A handmade kidswear shop (Lahore) running on Netlify, where the owner and
invited helpers add products, prices and photos through a form — no developer.
Photos live on ImageKit, not in git.

## Constraints that bite if forgotten

- **Zero runtime dependencies.** `tools/check-config.js` parses `config.yml`
  with a hand-rolled YAML reader and gates every build — anything added to the
  config must survive it.
- **Every field in `content/` must be declared in `site/admin/config.yml`**, or
  the CMS may drop it on save. `npm run check` enforces this. (Strictly true of
  Decap; treat it as strict under Sveltia too until proven otherwise.)
- `site/tokens.css` is a binding design system. Don't edit its values.
- **Be careful claiming a mobile fix is verified.** A plain headless-Chromium
  screenshot is a capture artifact — it ignores the viewport meta and does not
  reproduce scrolling, so "phone-width" shots prove little (the old contact page
  "overflows" identically in one). The `chrome-devtools` MCP's `emulate` with a
  `viewport` string (e.g. `390x844x3,mobile,touch`) is much closer: it honours
  the viewport, scrolls, and lets you check a sticky header top-to-bottom — the
  `mobile-nav-scrolling-tabs` work was checked that way. What it still cannot
  reproduce is the phone URL-bar sliding in/out and the resize events that fire
  with it, so anything that depends on those (and, to be safe, any layout the
  owner will actually look at on their phone) is only truly confirmed on a real
  device.

## Current state

**Live** at `https://littleprincessdesigner.pk` — a custom domain added in
August 2026; `littleprincessdesigner.netlify.app` redirects to it. Preview
deploys still answer on `.netlify.app` addresses of their own, which is correct:
a custom domain serves the live deploy only.

Build succeeds: 145 live products, 152 pages, 16 subcategories (as of
2026-09-01). The build prints 2 content warnings now — "suspiciously low
price" on two new fascinators (see "Waiting on the owner"); it still succeeds.

**Admin: on Sveltia CMS, confirmed working.** The migration off Decap +
DecapBridge merged to `main` (PR #36, then PR #42 pinned the version). See
"The Sveltia migration" below for what changed and why. Sign-in and saving
are no longer just "should work" — commit history from 2026-08-30 onward
shows dozens of product/category saves authored by the owner's own GitHub
account (no more "via DecapBridge" suffix), so the owner has completed
`docs/CMS-SETUP.md` and is actively using the admin. The three finer,
best-effort items under "The Sveltia migration" (the preview iframe's
interactivity, the tile-photo thumbnail hook) are still unconfirmed from a
sandbox, but nothing has surfaced as broken in practice.

**Header nav.** The phone header's hamburger menu and slide-in drawer were
replaced by a single horizontal tab strip — `search · ‹ · tabs · ›` under the
centred logo (PR #59, merged 2026-08-31). The strip scrolls (swipe or arrows)
on phones and shows all six tabs at once on a laptop. The header no longer
shrinks on scroll (the `data-min` latch is gone). The Instagram icon was
removed from the header (still in the footer and on the contact page). The
contact page's social cards are a 3-across, 2-row grid. Checked with Chrome
DevTools device emulation at 390px and 1280px; the URL-bar resize behaviour on
a real phone is still unproven here (see the constraint above).

**Google Merchant Center feed** — `product-feed.csv`, built by `tools/feed.js`
from the same product model as the rest of the site, published at
`/product-feed.csv` (see "Recent history"). Follows Google's full product feed
template column-for-column; see item 4 below for what's still incomplete.

## Waiting on the owner — all admin jobs, no code can fix them

_Refreshed 2026-09-01 against the current catalogue. Since the previous pass
(2026-08-27): all four category card photos were filled in, the empty Tutu
Dresses section was populated, the HEIC photo was replaced, and every
placeholder price named below was fixed — those items are gone from this
list._

1. **Renaming a product in the admin still changes its web address** — this
   is inherent to how products are filed (filename = URL), not a bug to fix.
   Two large batches of renames have gone through cleanly since this was first
   flagged (35 products on 2026-08-27, 73 more on 2026-09-01), each paired
   with matching entries in `redirects.json` → `dist/_redirects` so old links
   still 301 to the new address. Keep doing it that way: if a product is
   renamed in the admin, add its old→new path to `redirects.json` in the same
   change — or create a **New Product** instead of editing an existing one
   into a different piece.
2. **Two new placeholder-range prices**: the build flags "suspiciously low
   price" on "Ivory Bloom Feather Fascinator" and "Minimal Flower Fascinator"
   (PKR 950 flat across every size — just under the site's PKR 1,000 floor).
   Every other fascinator was standardized to PKR 1,100 on 2026-08-31/09-01;
   confirm whether these two are meant to match or are genuinely cheaper, and
   update or hide them.
3. **`content/settings-products.json` `accessoryPriceDefault` is still `95`**, which
   looks like leftover test data (real per-product accessory prices are
   250–7500). Set it to the intended default.
4. **The Google Merchant Center feed's `color` and `pattern` columns are
   mostly blank** (`tools/feed.js`, added 2026-09-01). There's no `color` or
   `pattern` field on products today, so the feed only fills these in when a
   product's name/description names one clearly (e.g. "Aizal Blue Dress" →
   Blue) — most products get left blank rather than guessed. Google marks
   `color` "required for apparel products", so this is worth closing:
   add `color` (and optionally `pattern`) fields to the products collection
   in `site/admin/config.yml`, have the owner fill them in per product, and
   update `tools/feed.js` to read the real field instead of guessing from
   text. Deferred at the owner's request on 2026-09-01 — not urgent, but
   flagged since it's the one feed column actually required for this
   product type.

## Never verified from this environment

The proxy blocks `unpkg.com`, `*.netlify.app`, `littleprincessdesigner.pk`,
`ik.imagekit.io`, `res.cloudinary.com` and `docs.netlify.com` (403 on CONNECT),
so a session cannot open the admin, the deploy preview or the live site. Do not
promise to check them. What that leaves unproved:

- **The admin panel itself.** Under Sveltia this now also needs a real GitHub
  OAuth sign-in that only exists once the owner does the CMS-SETUP steps. Config
  changes can only be checked with `npm run check` and by parsing the YAML.
- **Link previews in WhatsApp.** `og:image` asks ImageKit for a resized JPEG
  copy (`w-1200,h-630,cm-pad_resize,bg-FFFCF8,f-jpg`) because WhatsApp will not
  render WebP and skips images over roughly 300 KB. Testing it needs a real
  share on `littleprincessdesigner.pk` — not a `<deploy-id>--…netlify.app`
  snapshot — with `?1` appended to defeat WhatsApp's per-URL preview cache.
- **Anything on a phone.** See the constraint above.

To check what an npm package actually does, download its tarball from
`registry.npmjs.org` and read `dist/*.js.map` `sourcesContent`. Every Decap
claim in this repo was confirmed that way.

## The Sveltia migration (2026-08-30, merged in PR #36)

The owner asked to move off Decap + DecapBridge. Sveltia CMS is the successor
and reads the same `config.yml`. This is now on `main`; the notes below are kept
because the reasoning still governs how the admin is wired. Three conflicts were
resolved with the owner before any code changed:

1. **Sign-in.** Sveltia does not support git-gateway (so DecapBridge is out).
   Chosen: the **GitHub backend**, each editor a repo collaborator, sign-in
   brokered by Netlify's OAuth service (fallback: a Cloudflare `sveltia-cms-auth`
   worker). Steps for the owner are in `docs/CMS-SETUP.md`.
2. **Photos.** Sveltia ignores custom media libraries, so the ImageKit in-page
   picker is gone. Chosen: **keep ImageKit, paste addresses.** The `upload`
   field is now a `string` box; the editor copies the URL from imagekit.io. The
   live site's image pipeline (`tools/images.js`) is untouched — every existing
   photo URL still works. Cloudinary (which Sveltia *does* have a picker for) is
   the noted upgrade path if the paste step annoys.
3. **Preview panel.** `site/admin/preview.js` uses Decap's React preview API.
   First dropped for Sveltia's built-in preview; the owner then asked for the
   full product-page preview back (2026-08-30). It was restored and adapted for
   Sveltia: broader `h` lookup, a note that Sveltia only makes the preview pane
   an iframe once `registerPreviewStyle` is called (which this file does), and
   graceful degradation at every step. `imagekit.js` stays deleted.

Also: the `<style>` skin in `index.html` was dropped (Sveltia's Svelte UI can't
be re-skinned — it has its own themed UI with dark mode); `local_backend` and
the `npm run cms` script are gone (Sveltia edits local files via the browser's
File System Access API instead); `auth:` and the DecapBridge `commit_messages`
wording were removed.

**Sign-in + saving: confirmed working, not just set up.** Commit history from
2026-08-30 onward shows dozens of product/category/subcategory saves authored
by the owner's own GitHub account (no more "via DecapBridge" suffix on the
commit message) — proof the owner finished `docs/CMS-SETUP.md` and has been
using the admin day-to-day since. **Still open**, three things are best-effort
and still want a real browser check — all degrade to "still usable", none
block use, and nothing has surfaced as actually broken:
  - `preview.js` — does Sveltia expose `h`? does the preview iframe run the
    injected `/app.js` (interactive size/accessory recompute) or only render
    static? Static is fine; empty pane means `h` is missing and we fall back to
    `editor.preview: false` or a static-only card.
  - `tile-photo.js`'s `preSave` hook — worst case a blank grid thumbnail.
  - the `thumbnail: image` collection option — same.

## Roads already found to be closed

- **Do not add a `netlify-identity-widget` script tag.** It hijacks login and
  points it at the retired Netlify Identity service. (Was a git-gateway
  footgun; still true, and Sveltia has no reason to load it either.)
- **`add_repo` for `decaporg/decap-cms` was denied by the user.** Don't retry;
  use the npm tarball route. (Same applies to `sveltia/sveltia-cms` — read its
  published `dist/*.js` from `registry.npmjs.org` if you need to confirm
  behaviour.)
- **ffmpeg cannot decode WebP here** (Playwright's minimal build). Use headless
  Chromium to render and screenshot instead — that is how
  `site/assets/share-card.png` was produced, and `tools/share-card.html` carries
  the exact commands in a comment.
- **`pkill -f "tools/serve.js"` kills its own shell** (the pattern matches the
  bash command line). Use `pkill -f "serve[.]js"`.
- **Anchor-jump screenshots (`#about`) do not work** — headless Chromium resets
  scroll. To capture lower sections, inject a fixed-**pixel** height override
  for `.lp-story` into a throwaway copy in `dist/`; `vh` units scale with the
  tall capture window and do not help.
- **Never ship literal U+2028/U+2029 characters in a regex.** Write them as
  `\uXXXX` escapes: if the file is ever normalised, the raw characters become
  spaces and the code would then match every space in the structured data.

## Planned: testimonials/reviews section — not built, wait for the owner

The owner has not started collecting reviews yet. **Do not build this and do
not remind the owner about it** — only start once they say they have actual
reviews in hand. When that happens, this is the shape already agreed:

1. A new "Testimonials" collection in `site/admin/config.yml`, edited the same
   way products are: one entry per review (customer's words, optional star
   rating, optional photo). The owner collects these over WhatsApp after a
   delivery and pastes them in — there's no automated checkout to pull
   reviews from.
2. `tools/render.js`/`tools/card.js` grow a "What our customers say" block
   (homepage is the obvious spot) that reads that collection, following the
   existing pattern of one shared render function used by both the live
   build and the admin preview.
3. Once there are enough entries, add `aggregateRating` to the homepage
   `ClothingStore` schema block (`tools/render.js`, next to `sameAs` —
   see `s.google` below) computed from the stored ratings — this is the
   structured-data signal search engines and AI answers actually read for
   trust, not just decoration.
4. Separate from this: Google Business Profile reviews (once customers leave
   them there) show automatically on Google Search/Maps — nothing to build
   on this site for that half, beyond the "Find us on Google" link already
   wired in (see below).

## Google Business Profile — link wired in, profile not yet public

**2026-08-29** — the owner shared their Google Business Profile link
(`https://share.google/RuMkheJ03vZxCvLc9`). It's now stored as `google` in
`content/settings-contact.json` and flows to two places: a "Find us on
Google" card on the contact page (`tools/render.js`'s `cards` list) and the
homepage's `ClothingStore` schema `sameAs` array. Both fields are declared in
`site/admin/config.yml` so the owner can change the link or its wording later
without a code change. **Not yet verified live** — this was written and
tested locally; confirm the contact page shows the new card and the link
works once it deploys.

## Recent history

- **2026-09-01** — expanded the Google Merchant Center feed (`tools/feed.js`)
  from a handful of columns to Google's full product feed template,
  column-for-column. Fills in gender, age_group, material, color, pattern,
  product_detail and additional images from real product data where the site
  has it; leaves columns blank rather than guessing where it doesn't (gtin,
  mpn, energy/unit-pricing fields, etc. — see "Waiting on the owner" item 4
  for the one gap worth closing). Built on top of the feed first added
  2026-08-31/09-01 (below). `npm test` and `npm run build` green.
- **2026-08-31 to 2026-09-01** — a large content and SEO pass across many
  small merged PRs (#53–#75), the bulk of it: a Google Merchant Center feed
  published for the first time (`product-feed.csv`, auto-built from the same
  product model as the site) and then given a `product_type` column; the
  Google Analytics tag added to every page; category/subcategory
  reorganisation (new Ball Gowns and Flower Fairy Collection sections, Tutu
  Dresses and Skirts categories reshuffled, Accessory renamed to Accessory
  Collection); 73 more product files renamed so their URL matches their name
  (on top of the 35 from 2026-08-27), each with a matching `redirects.json`
  entry; a round of price fixes (fascinators standardized to PKR 1,100,
  Butterfly Princess Tiara corrected); Fabric/Fit specs hidden on accessory
  product pages; wording fixes (typos, "cape sleeves" → "drape", American
  spelling); an SEO rewrite of meta titles/descriptions and category blurbs,
  plus alt text added to every product image; and WhatsApp order message,
  homepage heading and category tab wording updates (#70). `npm test` and
  `npm run check` green throughout; nothing browser-side re-verified here.
- **2026-08-31** — rebuilt the phone navigation (PR #59, merged). Hamburger +
  drawer out; one scrolling tab strip in the header with a search button and
  two scroll arrows. Header no longer minimises on scroll (`data-min` latch
  removed, ~120 net lines of CSS gone). Instagram icon dropped from the
  header. Contact page social cards changed to a 3×2 grid. `npm test` green;
  checked in Chrome DevTools at phone and laptop widths.
- **2026-08-30** — migrated the admin from Decap CMS + DecapBridge to Sveltia
  CMS. Merged in PR #36; PR #42 then pinned Sveltia to 0.198.0 (0.200+ broke the
  list widget). Full detail under "The Sveltia migration" above. `npm run check`,
  `npm test` and `npm run build` all green; the browser side is unverifiable
  from here.
- **2026-08-05** — DecapBridge sign-in (so helpers need no repo access), a
  stored-XSS fix in the JSON-LD block, the ImageKit photo library, and the
  link-preview resizing. PR #5, merged.
- **2026-08-22** — the carousel became admin-controlled (choose the pieces and
  the number of slots); Site settings split into three pages (contact, product
  defaults, the site itself); section ids became file names so two sections can
  no longer share one; the README was rewritten as the orientation file for new
  sessions. A finished code review and the original Claude Design handoff note
  were deleted in the same pass — every item in the review was shipped, and the
  design note pointed at folders this repo does not contain.
- **2026-08-27** — mobile nav drawer (PR #24) and the header-icon split +
  shorter scroll story + 1:1 product gallery (PR #25). _The nav drawer and the
  header-icon split were both replaced on 2026-08-31 — see the top of this
  list._
- **2026-08-27** — dead-code and duplication sweep: deleted the unused
  `tools/seed-content.js`, trimmed a few unused exports and one dead CSS rule,
  and pulled the `money` / wa.me link / WhatsApp order-message helpers into
  `tools/shared.js` so the build and `site/app.js` share one copy (was two,
  hand-kept). `carousel-3d.js` now loads only on the home page. `docs/AUDITING.md`
  was added so the next audit does not re-flag the deliberate
  `render.js`/`card.js`/`content.js` duplication or the unused `tokens.css`
  entries. Note: the `render.js` / `styles.css` half of this landed early inside
  PR #25 (its `git add` swept up the then-uncommitted changes); this pass added
  the rest — `tools/shared.js` itself, the `build.js` copy step and the
  `card.js` / `app.js` / admin wiring — so the `/shared.js` that PR #25 pages
  reference actually exists.
- **2026-08-27** — renamed 35 product files so each slug matches its current
  name (the ~26 "shares almost no words with its own web address" warnings are
  gone). New `redirects.json` → `dist/_redirects` (written by `tools/build.js`)
  301s every old `/product/<slug>/` to its new address. Carousel picks in
  `content/settings.json` updated to the new slugs. This does **not** change the
  workflow problem — renaming in the admin still needs a matching redirect
  added, or a New Product instead.
