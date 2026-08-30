# Handoff: Little Princess Designer

_Last updated: 2026-08-22. Read `README.md` first — it explains how the repo
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
- **Never claim a mobile fix is verified.** Headless Chromium ignores the
  viewport meta, does not reproduce scrolling, and does not fire the URL-bar
  resize events. Phone-width screenshots are capture artifacts — the existing
  contact page "overflows" identically. Only a real device confirms.

## Current state

**Live** at `https://littleprincessdesigner.pk` — a custom domain added in
August 2026; `littleprincessdesigner.netlify.app` redirects to it. Preview
deploys still answer on `.netlify.app` addresses of their own, which is correct:
a custom domain serves the live deploy only.

Build succeeds: 75 live products, 82 pages, 13 sections (as of 2026-08-27).
Every product still has at least one photo. The build prints 4 content warnings
now (three suspiciously-low prices and one empty section — see "Waiting on the
owner"); the ~26 slug/name mismatches were resolved by renaming the files.

**Admin: migrated to Sveltia CMS on the `sveltia-cms-migration` branch
(2026-08-30) — NOT yet merged or verified live.** See "The Sveltia migration"
below. Under the old Decap setup, two people (Rimaz, Javeria) saved edits
through DecapBridge with their names in the commit messages, and the ImageKit
photo picker + resizing were confirmed working by the owner on 2026-08-05.

## Waiting on the owner — all admin jobs, no code can fix them

_Refreshed 2026-08-27 against the current catalogue._

1. **All four category card photos are still empty** (`content/categories/*.json`,
   `card.image`). This is why category links preview with the generic card and
   why the home page shows "GIRLS PHOTO" placeholders.
2. **Renaming a product in the admin still changes its web address.** The ~26
   products whose slug no longer matched their name were renamed to match
   (2026-08-27), and `redirects.json` → `dist/_redirects` now points every old
   `/product/<old-slug>/` at its new address so shared links and search results
   keep working. **From here on**, if a product is renamed in the admin, add its
   old→new path to `redirects.json` when the slug is next tidied up — or better,
   create a **New Product** instead of editing an existing one into a different
   piece. A few of the resulting URLs are as rough as the names the owner
   typed (`/product/red/`, `/product/ppl/`, `/product/purplyyyy/`); rename those
   properly in the admin if wanted, and add the redirect.
3. **One empty section**: `content/subcategories/girls-tutu-dresses.json`
   ("Tutu Dresses") has no products and prints an empty heading with a "New
   pieces … on the way" line on the Girls page. Fill it or delete it. (The five
   sections this list used to name are all populated now.) Two different product
   files are both named "unicorn tutu dress" and both filed under Girls → Luxury
   dresses — `unicorn-tutu-dress.json` and the one now at
   `unicorn-tutu-dress-2.json` (was `soft-cotton-baby-shirt.json`). Merge or
   delete one.
4. **Placeholder prices still live** — the build flags "suspiciously low price"
   on "pink faie" (PKR 55), "unicorn tutu dress" (PKR 55 / 40 / 44) and
   "welcome home daddy romperr" (PKR 33). Set real prices or hide the pieces.
5. **`welcome-home-daddy-romperr.json`'s first photo is a `.heic` file**
   (`1000641071.heic`). Browsers can't display HEIC — the card shows an empty
   frame. Re-upload it as a JPEG through the ImageKit library.
6. **`content/settings-products.json` `accessoryPriceDefault` is `95`**, which
   looks like leftover test data (real per-product accessory prices are
   250–7500). Set it to the intended default.

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

## The Sveltia migration (2026-08-30, branch `sveltia-cms-migration`)

The owner asked to move off Decap + DecapBridge. Sveltia CMS is the successor
and reads the same `config.yml`. Three conflicts were resolved with the owner
before any code changed:

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
3. **Preview panel.** `site/admin/preview.js` used Decap's React preview API,
   which Sveltia does not reliably support. Chosen: **Sveltia's built-in
   preview.** `preview.js` and `imagekit.js` were deleted; the admin copies of
   `shared.js`/`images.js`/`card.js` are no longer built.

Also: the `<style>` skin in `index.html` was dropped (Sveltia's Svelte UI can't
be re-skinned — it has its own themed UI with dark mode); `local_backend` and
the `npm run cms` script are gone (Sveltia edits local files via the browser's
File System Access API instead); `auth:` and the DecapBridge `commit_messages`
wording were removed.

**Still to do before this is live:** owner completes `docs/CMS-SETUP.md` steps
1–4, we test sign-in + a save on the branch preview deploy, then merge. After
merge, `tile-photo.js`'s `preSave` hook and the `thumbnail: image` collection
option need a real check in the browser — both are best-effort and the list
view works without them.

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

- **2026-08-30** — migrated the admin from Decap CMS + DecapBridge to Sveltia
  CMS on branch `sveltia-cms-migration` (not yet merged). Full detail under "The
  Sveltia migration" above. `npm run check`, `npm test` and `npm run build` all
  green after the change; the browser side is unverifiable from here.
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
  shorter scroll story + 1:1 product gallery (PR #25).
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
