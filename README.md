# Little Princess Designer

Handmade made-to-order kidswear, Lahore. A static website, live at
**https://littleprincessdesigner.pk**, with a [Decap CMS](https://decapcms.org)
admin page at `/admin/` so the shop's owner can add products, prices and photos
without a developer.

Repository: `littleprincessdesigner/little-princess-designer2`. Hosting:
Netlify, building from `main`.

---

## Start here (new session, no memory of this project)

This file is written to be the only one you have to read before starting work.
Read it, then read exactly what your task needs:

1. **`CLAUDE.md`** — the owner's standing instructions. Short, and binding:
   explain things in plain words (they are not a developer), and only open a
   pull request when asked — but once one is open, turn on auto-merge without
   being asked twice.
2. **`handoff.md`** — the state of play from previous sessions: what is live,
   what is unverified, what is waiting on the owner. It is dated; trust it over
   your assumptions, but not over what the code says today.
3. **The "Where to go for a given job" table below** — go straight to the two or
   three files that matter. You should not need to read the whole tree.

Then work on the branch the session names, and run `npm test` and
`npm run check` before pushing.

---

## The whole system in a paragraph

`content/` holds plain JSON — one file per product, one per subcategory, one per
category page, three settings files. `npm run build` reads that with
`tools/content.js`, renders every page with `tools/render.js`, and writes a
finished static site into `dist/`. Netlify runs that on every push to `main` and
serves `dist/`. The admin at `/admin/` is Decap CMS: an editor fills in a form,
Decap commits the JSON back to this repo, and that commit triggers the next
build. **There is no database, no server and no runtime dependency** — the whole
site is files, and the build is plain Node with nothing installed.

Editors sign in through [DecapBridge](https://decapbridge.com) with an email
address, so nobody but the developer needs a GitHub account; their name lands in
the commit message. Every pull request gets a Netlify preview deploy and a check
that has to go green — which is what the auto-merge instruction in `CLAUDE.md`
waits on.

```
content/*.json  ──►  npm run build  ──►  dist/  ──►  Netlify  ──►  the site
      ▲                                                                │
      └──────────────  Decap CMS at /admin/  ◄───────  an editor  ◄────┘
```

---

## Repo map

```
content/            ← what the admin edits. The source of truth for the site.
  settings.json           the site itself: business name, home page, footer
  settings-contact.json   phone, email, social links, the whole contact page
  settings-products.json  the wording and prices every product falls back on
  categories/             the four shop tabs — girls, boys, babies, ready
  subcategories/          the sections inside them, one file each
  products/               one file per product; the filename is its web address

site/               ← hand-written source, copied into dist/ as-is
  styles.css              all the site's styling
  tokens.css              the brand design system. Binding — do not edit values
  app.js                  filters, load more, size→price, gallery, hero scroll
  carousel-3d.js          the draggable 3D carousel on the home page
  assets/                 logo, hero images, self-hosted fonts, share card
  admin/
    index.html            the CMS shell; brand skin; pins decap-cms@3.15.1
    config.yml            EVERY field the CMS knows about (see rules below)
    preview.js            the live product-card preview panel in the admin
    imagekit.js           wires Decap's photo picker to the ImageKit library

tools/              ← the build. Plain Node, no dependencies.
  content.js              reads content/, validates it, returns one model
  render.js               model → HTML for every page
  card.js                 the product card — shared by the build AND the admin
  images.js               the one place any photo host is described (ImageKit)
  build.js                orchestrates a build; writes dist/
  check-config.js         fails the build if content/ and config.yml disagree
  yaml.js                 hand-rolled YAML reader used by the two above
  warm-previews.js        pre-builds the WhatsApp/Facebook share images
  test.js                 assertions over content.js, card.js and images.js
  fixtures/               small fake catalogues the tests run against
  serve.js                local static server for dist/
  build-preview.js        packs dist/ into one shareable preview.html
  seed-content.js         the original starter catalogue. Safe to delete
  share-card.html         source for the generic share image (see its comments)

docs/               ← prose. Index at the bottom of this file.
dist/               ← generated, not committed. What Netlify serves.
netlify.toml        ← build command, admin redirect, cache headers
CLAUDE.md           ← the owner's standing instructions. Read them.
handoff.md          ← state of play from previous sessions
```

---

## Where to go for a given job

| You want to… | Read / edit |
|---|---|
| Change what a page **looks like** | `site/styles.css` (never `site/tokens.css` values) |
| Change what a page **contains** | `tools/render.js` — every page is prerendered there |
| Change the **product card** | `tools/card.js` — one file, used by the site and the admin preview |
| Change **interactivity** (filters, gallery, sizes) | `site/app.js`. It never builds markup; it wires up what render.js emitted |
| Change the **3D carousel** behaviour | `site/carousel-3d.js` — it lays itself out from however many children it has |
| Change **which pieces spin** in the carousel | `chooseCarousel()` in `tools/content.js`; its settings live in `config.yml` under Site & home page |
| Add or change a **field an editor fills in** | `site/admin/config.yml` **and** the matching key in `content/` — both, always |
| Change how content is **read or validated** | `tools/content.js` — the wording cascade, price filtering, warnings |
| Change **photo handling, sizes or share images** | `tools/images.js`, then `tools/warm-previews.js` |
| Change what the **admin looks like** | `site/admin/index.html` — the skin is one long commented block |
| Change the **admin's preview panel** | `site/admin/preview.js` + `tools/card.js` |
| Change **build outputs, sitemap, robots** | `tools/build.js` |
| Add a **test** | `tools/test.js`, with fixtures in `tools/fixtures/` |
| Understand **what the owner sees** | `docs/ADMIN-GUIDE.md` — written for them, in their language |
| Understand the **CMS and sign-in setup** | `docs/CMS-SETUP.md` |

Two shapes worth knowing before you read any of it:

- **The model.** `content.load()` returns `{ settings, categories, subcategories,
  products, carousel, sizes, warnings, stats }`. The categories are fixed —
  `["girls", "boys", "babies", "ready"]`. A product's `id` is its filename,
  which is also its URL. `addedOn` drives "newest first" everywhere.
- **Settings are three files, one object.** The admin shows three pages so an
  editor is not scrolling past the hero headlines to change a phone number.
  `readSettings()` in `tools/content.js` merges them, and every consumer sees a
  single settings object exactly as it did when there was one file. The same key
  landing in two files is the one way this breaks, and the build warns by name
  if it happens.

---

## Commands

```bash
npm run build     # check-config → build dist/ → warm the share images
npm start         # build, then serve on http://localhost:8080
npm run cms       # local admin save-server (run alongside npm start)
npm run check     # verify content/ matches the CMS config — gates every build
npm test          # assertions over the build's content, card and image rules
npm run preview   # bundle the whole site into one shareable preview.html
```

Node 18+ (Netlify pins 20). Nothing to install — `npm test` and `npm run build`
work in a fresh clone with no `npm install`.

---

## Rules that bite

- **`site/admin/config.yml` must declare every field in `content/`.** Decap
  writes back *only* the fields it knows about, so an undeclared key is deleted
  the first time an editor presses Save — silently, with no error anywhere.
  `npm run check` enforces this and gates every build. Add a key to a content
  file, add it to the config in the same commit.
- **Zero runtime dependencies, on purpose.** The config check parses YAML with
  `tools/yaml.js`, hand-rolled. Anything added to `config.yml` has to survive
  that reader — run `npm run check` after editing it.
- **`site/tokens.css` is a binding design system.** Colours, type and spacing
  come from the brand's own system. Do not edit the values. The one deliberate
  difference is the font block: the same typefaces, self-hosted.
- **Pages are prerendered, not client-rendered.** `app.js` only wires up
  interactivity. A new section belongs in `tools/render.js`.
- **Hiding a product removes it from the build entirely.** No page, no JSON
  entry — it is not hidden with CSS.
- **Content problems warn; they do not fail.** The build prints named warnings —
  a piece with no photo, an orphaned product, a carousel pick that no longer
  exists — and still succeeds. Read them: they are how content mistakes surface.
- **Renaming a product changes its web address**, and anything holding that
  address — a carousel pick, a shared link, a search result — points at the old
  one.
- **Prices are per product, per size**, with the size vocabulary read out of
  `config.yml` itself so the admin and the build cannot drift apart.
- **Never claim a mobile fix is verified from a screenshot.** Headless Chromium
  ignores the viewport meta, does not reproduce scrolling and does not fire the
  URL-bar resize events. Phone-width captures are artifacts; only a real device
  confirms. This has burned this project before.

## What a sandbox session cannot verify

Say so plainly rather than implying otherwise:

- **The admin itself.** It loads `decap-cms` and the ImageKit widget from
  `unpkg.com`, which the agent proxy usually blocks. Config changes can be
  checked with `npm run check` and by parsing the YAML — never by opening the
  panel.
- **Photos.** They live in an ImageKit account no session can reach.
- **Anything on a phone.** See the rule above.

---

## Pages

Every page is generated; `npm run build` prints the current counts.

| URL | What it is |
|---|---|
| `/` | Home — scroll-driven hero, features, about, 3D carousel, category cards |
| `/girls/` `/boys/` `/babies/` `/ready/` | Shop, split into subcategory sections with filters and load-more |
| `/product/<name>/` | Product page — gallery, per-size price, accessory total, WhatsApp order |
| `/contact/` | Ordering steps, FAQs, social links, feedback |
| `/404.html` | Served by Netlify for anything that matches nothing else |

Each has its own title, meta description, share image and structured data. The
four shop tabs recolour the whole page: berry for girls, sky blue for boys,
peach for babies, gold for ready to wear.

---

## Docs index

| File | What it answers |
|---|---|
| `CLAUDE.md` | How the owner wants to be talked to, and the pull-request policy |
| `handoff.md` | What is live, what is waiting on the owner, what has never been verified, and which approaches are already known to fail |
| `docs/ADMIN-GUIDE.md` | How the owner uses the admin — the same tasks, in their language |
| `docs/CMS-SETUP.md` | The one-time CMS, DecapBridge and ImageKit setup |
