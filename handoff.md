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
  Decap silently deletes it on save. `npm run check` enforces this.
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

Build clean: 64 live products, 71 pages, 12 sections. Every product now has at
least one photo — the "no photo yet" warning that used to run to five names is
gone.

Admin works end to end: two people (Rimaz, Javeria) have saved edits through
DecapBridge, and their names land in the commit messages as intended. The photo
library is ImageKit — `media_library: imagekit` in `site/admin/config.yml`,
wired to ImageKit's embeddable widget by `site/admin/imagekit.js`, since Decap
ships no ImageKit library of its own. No keys anywhere: each editor signs in to
ImageKit inside the panel. Uploads and resizing were confirmed working by the
owner on 2026-08-05.

## Waiting on the owner — all admin jobs, no code can fix them

1. **All four category card photos are still empty** (`content/categories/*.json`,
   `card.image`). This is why category links preview with the generic card and
   why the home page shows "GIRLS PHOTO" placeholders.
2. **Three boys pieces are filed under Girls → Luxury dresses** — Cotton-Silk
   Three Piece, Eid Waistcoat Set and Junior Waistcoat Set. They were orphaned
   when subcategory `b2` was deleted, and were reassigned to a girls section
   rather than a boys one. They are live, on the wrong page.
3. **Five sections have no products**, and each prints an empty heading on its
   shop page: Casual dresses and Accessory (Girls), Theme dresses (Boys),
   Shirts and Rompers (Babies). Either fill them or delete them.

## Never verified from this environment

The proxy blocks `unpkg.com`, `*.netlify.app`, `littleprincessdesigner.pk`,
`ik.imagekit.io`, `res.cloudinary.com` and `docs.netlify.com` (403 on CONNECT),
so a session cannot open the admin, the deploy preview or the live site. Do not
promise to check them. What that leaves unproved:

- **The admin panel itself**, including the live product-card preview in
  `site/admin/preview.js`. Config changes can only be checked with
  `npm run check` and by parsing the YAML.
- **Link previews in WhatsApp.** `og:image` asks ImageKit for a resized JPEG
  copy (`w-1200,h-630,cm-pad_resize,bg-FFFCF8,f-jpg`) because WhatsApp will not
  render WebP and skips images over roughly 300 KB. Testing it needs a real
  share on `littleprincessdesigner.pk` — not a `<deploy-id>--…netlify.app`
  snapshot — with `?1` appended to defeat WhatsApp's per-URL preview cache.
- **Anything on a phone.** See the constraint above.

To check what an npm package actually does, download its tarball from
`registry.npmjs.org` and read `dist/*.js.map` `sourcesContent`. Every Decap
claim in this repo was confirmed that way.

## Roads already found to be closed

- **Do not add a `netlify-identity-widget` script tag.** Most git-gateway
  tutorials call for it. `decap-cms-ui-auth` only defers to
  `window.netlifyIdentity` when that global exists, so adding it would hijack
  login and point it at the retired Netlify Identity service.
- **`add_repo` for `decaporg/decap-cms` was denied by the user.** Don't retry;
  use the npm tarball route.
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

## Recent history

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
