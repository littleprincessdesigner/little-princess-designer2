# Auditing this repo for dead / duplicate code

Read this before deleting a "duplicate" helper or a "dead" token. Some of what
looks like cruft is load-bearing, and the build already guards it.

## Duplication that is deliberate — do not "dedupe" it

`tools/content.js` runs only under Node (it reads the `content/` directory).
`tools/card.js` and `tools/shared.js` also run in the browser — `card.js` draws
the live preview in the admin, and `app.js` reads `shared.js` on every page. So
a handful of small helpers are copied on purpose rather than shared across the
Node/browser line.

Find the full set:

```
grep -rn "MIRRORED:" tools/
```

Each marked spot names its twin and says the agreement is pinned by
`tools/test.js`. If you change one side, `npm test` fails until the other
matches. That is the design — leave it.

`tools/shared.js` is the one case where sharing *was* worth the wiring (the
WhatsApp order message was drifting): it loads as a Node module and as a browser
global, the same trick `card.js` and `images.js` use.

## `site/tokens.css` — unused entries are expected

`tokens.css` is a full brand design system. `styles.css` only consumes part of
it today (a lot of values are still hard-coded). The unused custom properties
are a reference for the rest of the system, not dead weight to prune — and the
file's values are binding regardless. Leave it alone.

## The three guardrails

| Command | Catches |
|---|---|
| `npm run check` | a field in `content/` that `site/admin/config.yml` doesn't declare — the CMS would silently delete it on the next save |
| `npm test` | the mirrored-helper agreement above, plus the content rules (wording cascade, sale prices, size filtering, carousel picks) |
| `npm run build` | prints content warnings — suspiciously low prices, a product whose name no longer matches its slug, an orphaned piece, a WebP first photo that won't share |

## Checking for genuinely dead code

- **Unused export**: grep the symbol name across the whole repo. If it only
  appears in its own file (definition + the export object), drop it from the
  export object; keep it if used internally.
- **Unused CSS class**: grep it in `tools/render.js`, `tools/card.js`,
  `site/app.js` and `site/carousel-3d.js` — *not* just `site/`. All the markup
  is generated in `tools/`, so a class used only there is still live. Watch for
  classes built by string concatenation and state classes toggled by JS.
- **Unreferenced script**: check `package.json` scripts and every `require()`
  before concluding a `tools/*.js` file is orphaned.
