# Mistakes this project keeps repeating

Read this before starting work. Every entry below is something that **actually
went wrong here at least once**, most of them more than once, and each one cost
a round of review, a broken deploy, or a fix commit that should never have been
needed. They are grouped by when they bite you.

This file is not the state of the project (`handoff.md`), not the map of the
code (`README.md`), and not the "don't delete this, it's deliberate" list
(`docs/AUDITING.md`). It is only the list of traps.

**How to use it:** skim the table, then read the two or three entries that touch
what you are about to change. If you hit a *new* trap, add it here in the same
shape — occurrence, rule, guard — rather than leaving a comment in one file that
only the next person to read that exact line will see. That failure mode is
itself entry 1.

---

## Quick reference

| # | Trap | Bites when you are… |
|---|---|---|
| 1 | A warning comment does not stop the next occurrence | fixing a bug the code already documents |
| 2 | `display:` in CSS silently defeats the `hidden` attribute | hiding or showing anything from JavaScript |
| 3 | Browser files share one global scope; a duplicate `const` kills a whole file | editing `tools/shared.js`, `card.js`, `images.js`, `app.js` |
| 4 | The local checkout is behind `origin/main` | auditing, reviewing, or reporting on repo content |
| 5 | Renaming a product changes its public URL | renaming anything under `content/products/` |
| 6 | A field missing from `config.yml` is dropped on the next CMS save | adding any field to `content/` |
| 7 | Claiming a browser/phone fix is verified when it is not | reporting any visual or responsive change |
| 8 | A test suite that has only ever passed proves nothing | writing checks after the fix already exists |
| 9 | Writing a confident comment about behaviour nobody verified | explaining *why* in a comment or doc |
| 10 | Two controls encoding one fact will disagree | designing anything with a status, badge or flag |
| 11 | A brief's "verbatim" test and "verbatim" fixture can contradict | executing a written plan literally |
| 12 | Owner-facing docs go stale silently | changing behaviour the owner reads about |
| 13 | Deleting "duplicate" or "unused" code that is load-bearing | tidying, deduping, or sweeping dead code |
| 14 | Processes left running; unbounded searches | anything involving a server, watcher, or `find` |

---

## 1. A warning comment does not stop the next occurrence

**What happened:** `site/styles.css` needs a specific guard on **seven**
elements (entry 2 below). Six of them had it, each with an increasingly
emphatic comment — the sixth literally reads *"That exact trap already cost this
project once"* and names the earlier victim. The seventh, the product-gallery
arrows, did not have it and shipped broken. Three rounds of "document it so it
doesn't happen again" produced three warnings and a fourth bug.

**Why comments fail here:** a comment only reaches someone already looking at
that line. The person who introduces occurrence N+1 is by definition editing
somewhere else in the file.

**The rule:** when the bug you are fixing is one the codebase has *already
documented*, the fix is not finished until a command fails on it. Occurrence
two is where "add a check" becomes the default and "add another comment"
becomes the exception that needs justifying.

**When the obvious check looks impossible:** this repo has no browser in its
tests and no dependencies to add one. A **plain text assertion over the source
file** is nearly always still available and catches the drift that matters.
Precedent already existed and was overlooked for three rounds — `tools/test.js`
string-checks `netlify.toml`, a file no build step exercises. The gallery-arrow
guard is now five lines of regex in the same file.

---

## 2. `display:` in CSS silently defeats the `hidden` attribute

**What happened, four times:** JavaScript sets `el.hidden = true`, the element
stays on screen. The browser's own rule is `[hidden]{display:none}`, but *any*
author rule that sets `display` on that element outranks it. So the element is
correctly marked hidden and remains visible and clickable.

Known victims, all in `site/styles.css`:

| Element | Symptom when unguarded |
|---|---|
| `.lp-loadwrap` | "Load more" stayed on screen with nothing left to load |
| `.lp-price-was` | An empty struck-through line above every full price |
| `.lp-searchbtn`, `.lp-search` | The search panel `app.js` hides stayed open |
| `.lp-navarrow` | Header tab arrows shown when the strip does not overflow |
| `.lp-grid > [hidden]` | Filtered-out cards still occupying the grid |
| `.lp-arrow` | **Shipped broken.** Both gallery arrows on screen at the first and last photo |

**The rule:** if you write a rule that sets `display` on an element, and any
JavaScript anywhere toggles `.hidden` on it, you owe it a matching
`.thing[hidden]{display:none}` in the same block. Same for `:not([hidden])`
scoping when the default state is hidden.

**Guard:** `tools/test.js` now regexes `site/styles.css` for the `.lp-arrow`
rule. That guard covers one element, not the class of bug — adding an eighth
`display:`-carrying element that JS hides needs its own guard.

**Grep before you add one:** `grep -n "\[hidden\]" site/styles.css`.

---

## 3. Browser files share one global scope

**What happened:** `tools/shared.js`, `images.js`, `card.js` and `preview.js`
load in the admin as ordinary `<script>` tags. They therefore share **one
top-level scope**. `card.js` aliased `const money` when `shared.js` already
declared it — a redeclaration error that **kills the entire second file** and
never sets its global. The failure is silent everywhere except the browser
console. It shipped in the 2026-08-27 shared-helpers split and was only found
when the Sveltia preview panel surfaced it, weeks later.

**Why the tests missed it:** `npm test` loads these files with Node `require`,
which gives each file its own scope. The convenient load path is not the
shipping load path.

**The rule:** in any file that loads as a classic `<script>` alongside the
others, use `shared.money` / `shared.waLink` at the call site. Never alias them
to a bare `const`. Read the comments at `tools/card.js:67-74` and
`tools/images.js:245-253` before touching either.

**How to verify:** concatenate the files in load order and run `node --check`
over the result. Nothing else reproduces the real scope.

---

## 4. The local checkout is behind `origin/main`

**What happened:** a full product-catalogue audit was delivered against a local
`main` that was **211 commits behind** the remote. A merged branch had already
fixed nearly every issue reported — placeholder prices, missing descriptions,
junk slugs, missing alt text. The entire report was fiction.

This repo makes it worse than usual: the owner edits through the CMS, so
`main` gains commits with no developer involved and no reason for you to expect
them. In this session `main` was **18 commits ahead** of a branch created days
earlier.

**The rule:** `git fetch origin && git status` before reading content to report
on it. Say in the report which revision you read.

---

## 5. Renaming a product changes its public URL

**Inherent, not a bug:** the filename under `content/products/` *is* the URL.
Rename in the admin, and every existing link, share and search result 404s.

Two large rename batches have gone through (35 products on 2026-08-27, 73 more
on 2026-09-01), and one-off slug fixes keep appearing since — the most recent as
its own PR.

**The rule:** any product rename ships with a matching old→new line in
`redirects.json` **in the same change**. `tools/build.js` writes that into
`dist/_redirects` so the old address 301s. If the piece is genuinely a different
product, create a **New Product** instead of editing an existing one into it.

---

## 6. A field missing from `config.yml` is dropped on the next save

Every field in `content/` must be declared in `site/admin/config.yml`, or the
CMS may silently delete it the first time an editor saves that item. `npm run
check` enforces this and gates the build.

**The rule:** add a field to `content/`, add it to `config.yml` in the same
change, and run `npm run check`. Note that `check-config.js` parses YAML with a
hand-rolled reader — anything you add has to survive *that*, not just be valid
YAML.

---

## 7. Claiming a browser or phone fix is verified when it is not

**What happened, repeatedly:** a plain headless-Chromium screenshot is a capture
artifact. It ignores the viewport meta tag and does not reproduce scrolling, so
"phone-width" shots prove almost nothing — the old contact page "overflows"
identically in one. Separately, `mcp__chrome-devtools__resize_page` silently
clamps to the platform window size, so the width you asked for is not
necessarily the width you got.

**What is actually trustworthy, in order:**

1. **A real device.** The only final word.
2. **Playwright with a real device profile** (`isMobile`, `hasTouch`,
   `deviceScaleFactor`), or `chrome-devtools`' `emulate` with a viewport string
   like `390x844x3,mobile,touch`. These honour the viewport meta and scroll
   properly. Note **Firefox rejects `isMobile`/`hasTouch`** — it gets viewport
   size only, so say so rather than implying full parity.
3. **A raw screenshot at a narrow width.** Nearly worthless on its own.

**Still not reproducible by any of them:** the phone URL bar sliding in and out
and the resize events that fire with it. Anything depending on those is unproven
until the owner looks at it.

**The rule:** state the method and its limits in the report. "Checked at 390px"
is not a claim; "checked in Playwright's iPhone profile in three engines; the
URL-bar resize is still unverified" is.

**Also unreachable from a session:** the proxy blocks `*.netlify.app`,
`littleprincessdesigner.pk`, `ik.imagekit.io` and `unpkg.com`. Do not promise to
check the live site, the deploy preview, or the admin. And a local
`tools/serve.js` sends **no Content-Security-Policy header** — that only exists
on Netlify, so local green says nothing about the deployed headers.

---

## 8. A test suite that has only ever passed proves nothing

**What happened:** a 96-assertion cross-browser suite came back 96/96 on its
first run. Green on a first run is equally consistent with assertions that can
*never* fail — a selector that quietly returns "absent", a check written against
the already-fixed DOM, a timing window that always settles the same way.

**The rule:** before reporting a suite written *after* the fix as evidence, run
it once against a deliberately broken build and confirm it fails on the
assertions that target the defect, with failure text naming the real symptom.

**The safe way to break something on purpose here:** `dist/` is gitignored and
regenerated by one command. Invert the fix **in the build output**, re-run, then
`npm run build` to restore. The source tree is never touched, so there is
nothing to accidentally commit. Doing this proved both the CSS fix (24 failures,
`display=flex`) and the anti-flicker fix (6 failures) genuinely discriminate.

---

## 9. Writing confident comments about behaviour nobody verified

**What happened:** a code review found a comment in `netlify.toml` citing a
precedent *that does not exist*, and a comment in `site/ga.js` asserting a
load-order guarantee that `async` does not actually provide. Both read as
authoritative. Both were invented reasoning that later sessions would have
trusted.

This repo's comments are unusually long and explanatory, which is a strength —
and exactly what makes a wrong one expensive.

**The rule:** a comment that states *why* something works must be traceable to
something you checked. If it is an assumption, write it as one ("assumed;
unverified"). The genuinely unverified assumptions belong in `handoff.md` under
"Never verified from this environment", not buried in a confident code comment.

---

## 10. Two controls encoding one fact will disagree

**What happened:** the Sale design had a per-product "Sale" badge dropdown *and*
per-size sale-price fields — two independent controls for one concept, set in
different places, with nothing keeping them in sync. The build could only warn
about the contradiction.

The fix was to delete one: the badge is now **computed** from the prices, so the
tag and the prices cannot disagree. See `card.js`'s `effectiveBadge`.

**The rule:** when a design has two controls that can contradict, propose
collapsing them into one **before** spec'ing rules for each combination. Writing
a reconciliation rule for every A/B pairing is the tell that they should be one.

---

## 11. A brief's "verbatim" test and "verbatim" fixture can contradict

**What happened:** a task brief pinned both an exact test assertion and the
exact config string meant to satisfy it. They were mutually inconsistent — the
assertion could not pass against the fixture as written.

**The rule:** when a plan pins both an assertion and the data it runs against,
mentally execute the assertion over the literal fixture before trusting the
predicted result. Watch greedy `[^"]*` and `.*`. Resolve toward the brief's
intent with a semantically-inert edit, get to green, and flag the contradiction
in the report rather than silently picking one side.

---

## 12. Owner-facing docs go stale silently

A review found **three** owner-facing files stale in one pass. `handoff.md`,
`README.md`, `docs/ADMIN-GUIDE.md` and `docs/CMS-SETUP.md` describe behaviour;
when the behaviour changes and the file does not, the owner acts on a false map.
`config.yml` field hints count too — a review caught one disagreeing with the
admin guide.

**The rule:** changing behaviour the owner reads about means updating the doc in
the same change. When you finish a piece of work, grep the docs for the thing
you changed before calling it done.

---

## 13. Deleting "duplicate" or "unused" code that is load-bearing

`docs/AUDITING.md` exists **because this happened**. Read it before deleting
anything on duplication or dead-code grounds. The short version:

- The `content.js` / `card.js` / `shared.js` overlap is **deliberate** — those
  files straddle the Node/browser line. Every copy is marked `MIRRORED:` and
  pinned by `npm test`. `grep -rn "MIRRORED:" tools/`.
- Unused entries in `site/tokens.css` are **expected**; it is a full design
  system, not dead weight. Do not edit its values.
- A CSS class used only in `tools/render.js` or `tools/card.js` is still live —
  all the markup is generated in `tools/`, so grepping only `site/` gives a
  false "unused".

---

## 14. Processes left running, and unbounded searches

**What happened:** a `find /` from a previous session ran for **26 hours** at
full core before anyone noticed, alongside detached servers and stranded
watchers. Nothing cleaned them up because nothing was tracking them.

**The rules:**

- Never run an unbounded filesystem search. Bound it to the project directory,
  add `-maxdepth`, or use Glob/Grep, which are indexed and bounded.
- Never detach a server with `(cmd &)` or `nohup` — that hides it from the
  harness so nothing can stop it. Use the Bash tool's `run_in_background`, which
  stays tracked and killable, and stop it by task id when done.
- **`pkill -f "tools/serve.js"` kills its own shell** — the pattern matches the
  bash command line running it. Use `pkill -f "serve[.]js"`, or stop the tracked
  background task instead.
- Name anything still running, and its port, at the end of the turn.

---

## Closed roads — do not re-attempt

Short list; the reasoning is in `handoff.md` under "Roads already found to be
closed".

- **Do not add a `netlify-identity-widget` script tag.** It hijacks login and
  points it at the retired Netlify Identity service.
- **Do not `add_repo` the Decap or Sveltia repositories** — refused before. To
  confirm what a package does, download its tarball from `registry.npmjs.org`
  and read `dist/*.js.map` `sourcesContent`. Every Decap claim in this repo was
  confirmed that way.
- **ffmpeg cannot decode WebP here.** Render and screenshot with headless
  Chromium instead; `tools/share-card.html` carries the exact commands.
- **Anchor-jump screenshots (`#about`) do not work** — headless Chromium resets
  scroll. Inject a fixed-**pixel** height override into a throwaway copy in
  `dist/`; `vh` units scale with the capture window and do not help.
- **Never ship literal U+2028/U+2029 characters in a regex.** Write them as
  `\uXXXX` escapes — if the file is ever normalised the raw characters become
  spaces, and the pattern would then match every space.
- **Sveltia is pinned to 0.198.0** on purpose; 0.200+ broke the list widget.
  "Pinned" is not safety by itself — the *choice* of version is the safety.

---

## Before you say you are done

1. `npm test` and `npm run check` pass — output read, not assumed.
2. `npm run build` succeeds, and you have read the content warnings it prints.
3. Anything you claim to have verified in a browser names the method and its
   limits (entry 7).
4. Any check you wrote after the fix has been seen to fail (entry 8).
5. Docs touched by the behaviour you changed are updated (entry 12).
6. Nothing is left running (entry 14).
7. A pull request only if asked — and once one is open, turn on auto-merge
   without waiting to be asked again (`CLAUDE.md`).
