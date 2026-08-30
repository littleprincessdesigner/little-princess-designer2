# Visual / Mobile Rendering Audit — littleprincessdesigner.pk

**Scope:** Above-the-fold clarity, tap-target sizing, text legibility, and layout
integrity on the pages a mobile-first, WhatsApp-ordering shopper actually walks
through: the homepage (`/`), a product page, and the ordering/FAQ page
(`/contact/`). Desktop (1920×1080) and mobile (375×812, iPhone-class) screenshots
were captured for all three; full-page mobile captures were also taken to check
for issues further down the page.

**Data sources:** `capture_screenshot.py` (Playwright/Chromium) against the live
site, viewport-only and full-page, desktop + mobile, checked 2026-08-26.
Cross-referenced against `handoff.md` (this repo's own standing notes on what
headless-Chromium screenshots can and cannot prove) and this audit's
`technical.md` / `sxo.md` where a visual observation overlaps their findings.

**Visual Score: 62 / 100**

The template itself is clean, responsive, and legible, with no horizontal
scroll or broken breakpoints anywhere tested. The score is pulled down by one
real layout bug — a fixed "Contact us"/WhatsApp button that sits on top of
page content on first load on two of the three pages tested — plus a product
page where the price and the buy button (the entire point of a product page
for this business) are not visible without scrolling on a phone.

**Important caveat up front, per this project's own standing notes
(`handoff.md`):** *"Never claim a mobile fix is verified. Headless Chromium
ignores the viewport meta, does not reproduce scrolling, and does not fire the
URL-bar resize events... Only a real device confirms."* Everything below was
captured through headless Chromium, not a real phone. The findings are real
in the sense that they are visible in a repeatable screenshot at a documented
viewport size and scroll position — but exact severity (how often it happens
on a real phone's shrinking/growing address bar) is not proven. Treat the
"High" items as worth a two-minute check on an actual phone before scheduling
a fix, not as certified bugs.

---

## High

### 1. The fixed "Contact us" pill + WhatsApp bubble overlap page content on load, on 2 of 3 pages tested (mobile)
**Category:** Layout / overlapping elements
**Evidence:**
- Homepage, mobile, initial viewport (`screenshots/home/mobile.png` and
  `screenshots/home_full/…mobile.png`): the floating "Contact us" button and
  the green WhatsApp circle sit directly on top of the "Message on WhatsApp"
  feature card, covering part of its text.
- Contact page, mobile, initial viewport (`screenshots/contact/mobile.png`):
  the same two floating buttons cover the end of the third ordering-step
  card's text — "Delivery is charged separat[ely]" is cut off behind the
  "Contact us" pill.
- Not an isolated frame: the full-page mobile capture of the homepage
  (`screenshots/home_full/…mobile.png`) shows the same overlap, confirming
  it's the buttons' fixed position relative to the viewport, not a one-frame
  timing glitch.

**What this means in plain terms:** on a phone, right when someone lands on
the homepage or the ordering-info page, a floating "message us" button
covers up some of the words meant to explain that same WhatsApp option — a
visitor could squint at a half-covered sentence about delivery charges or
miss that "Message on WhatsApp" is a real, tappable feature, at the exact
moment they're deciding whether this shop looks trustworthy.

**Recommendation:** give the fixed contact bar a solid background (it
already has one) and either (a) reduce its footprint on mobile to a single
icon-only WhatsApp button, or (b) add bottom padding to whatever section sits
under the fold equal to the fixed bar's height, so it never sits over
in-flow text. This is a CSS-only fix (z-index/positioning), not a content
change.

### 2. On the product page, the price and the "Order on WhatsApp" button are not visible without scrolling on mobile
**Category:** Above-the-fold / conversion
**Evidence:** `screenshots/product/mobile.png` (viewport-only, 375×812) — the
visible area ends right at the "Select size" label; the price (PKR 16,500),
the product description, and the green "Order on WhatsApp" button are all
below the fold (confirmed in the full-page capture,
`screenshots/product_full/…mobile.png`, where they appear roughly 1,100px
down the page). The space above that point is spent on: the 3-row nav (see
Medium #3), a breadcrumb, a "← Back to Girls" pill, and a large hero photo.
**Why it matters:** this business takes orders over WhatsApp — the "Order on
WhatsApp" button is the entire commercial purpose of a product page. A
shopper has to scroll past nav, breadcrumb and photo before they even see a
price, let alone the button to act on it.
**Recommendation:** on mobile only, either shrink the hero photo's height
slightly or move the price up to sit directly under the product title
(before the size selector), so price + a lightweight CTA are visible in the
first screen, with the full "Order on WhatsApp" button reachable one short
scroll away. Even just showing the price above the fold (title + price
together) would meaningfully improve this without a redesign.

---

## Medium

### 3. Mobile navigation consumes roughly 40% of the initial screen before any page content appears
**Category:** Above-the-fold
**Evidence:** On mobile (375×812), the logo + 6 pill-shaped nav links
("Home," "Girls," "Boys," "Babies," "Ready to wear," "Contact us") wrap onto
three rows and occupy about 350px of vertical space before the page's own
heading starts (`screenshots/home/mobile.png`,
`screenshots/product/mobile.png`, `screenshots/contact/mobile.png` — same nav
block on all three). The H1 itself ("There is a princess in every girl") is
still visible without scrolling on the homepage, but the row of three feature
cards right under it ("See the collection," "Message on WhatsApp,"
"Customized and Ready to wear") is pushed down to the very bottom edge of the
screen, where it collides with the overlap bug in Finding #1.
**Recommendation:** consider a collapsed hamburger/menu-icon pattern on
mobile instead of six always-expanded pills, or reduce pill height slightly.
Freeing up 100-150px here would let the feature-card row clear the fold
cleanly and stop touching the fixed contact buttons.

### 4. Several homepage sections still show text placeholders instead of real photos
**Category:** Visual polish / trust
**Evidence:** `screenshots/home_full_desktop/…desktop.png` — the "Get yours
now" grid shows "GIRLS PHOTO," "BOYS PHOTO," "BABIES PHOTO," and "READY TO
WEAR PHOTO" as literal placeholder text instead of images, and the "We
started small..." section shows "STUDIO OR TEAM PHOTO" instead of a real
photo. This is not a loading glitch — it reproduces identically on both the
mobile full-page capture and the desktop full-page capture.
**Note:** this is not a new finding — `handoff.md` already documents it
("All four category card photos are still empty... This is why the home page
shows 'GIRLS PHOTO' placeholders") as an admin task waiting on the site
owner, not a code bug. Confirmed here only because it is still live as of
2026-08-26 and is directly visible in the screenshots this audit produced.
**Why it matters:** these sit below the fold, so they don't block the
primary above-fold CTA, but a first-time visitor who scrolls even one screen
further sees four grey boxes of placeholder text on a paid, handmade-goods
site — it reads as unfinished and can undercut the trust a parent needs
before paying a non-refundable deposit.
**Recommendation:** no code change needed — upload the four category card
photos and one studio/team photo through the existing admin panel
(`content/categories/*.json` → `card.image`, per `handoff.md`).

---

## Low / Informational

### 5. Large blank area in the desktop full-page screenshot is very likely a screenshot-capture artifact, not a live bug
**Category:** Capture methodology
**Evidence:** `screenshots/home_full_desktop/…desktop.png` shows an ~840px
solid-pink void between the hero feature cards and the "Just finished in the
studio" section. This lines up exactly with a note already in `handoff.md`:
the hero (`.lp-story`/`.lp-sticky`) is a scroll-linked section sized in `vh`
units, and *"Anchor-jump screenshots... do not work — headless Chromium
resets scroll... vh units scale with the tall capture window and do not
help."* A "full page" screenshot temporarily resizes the browser to the
entire document's height to capture it in one shot, which very likely
inflates this `vh`-based section far beyond its real, normally-scrolled
height.
**Why this is flagged as Low, not High:** the normal, viewport-sized
homepage screenshots (`screenshots/home/desktop.png`,
`screenshots/home/mobile.png`) — which do **not** resize the browser and
represent what a visitor actually sees on load and on ordinary scrolling —
show no such gap. This item exists only in the artificially-tall full-page
capture used to inspect below-the-fold sections, and matches a capture
limitation this project has already documented for itself.
**Recommendation:** none needed for the live site. If a true full-page
screenshot is needed again later, follow the workaround already written down
in `handoff.md` (a throwaway copy with a fixed-pixel height override on
`.lp-story`) rather than treating the blank space as a real defect.

### 6. Product-page screenshot was taken on a URL with a known slug/content mismatch (cross-reference only)
**Category:** Cross-skill note, not a visual finding
**Evidence:** The sitemap-listed URL `/product/blue-horizon-dress/` (the
most recently added product) currently 404s live, so this audit substituted
`/product/aurora-theme-dress/` for the product-page screenshots. That URL
correctly returns 200, but per `technical.md` Critical #1 and `sxo.md`, it is
one of 31 product pages where the slug and the on-page content no longer
match — it displays a product named "huda dress pink," not an "aurora"
themed dress. This does not change any layout/visual finding above (the
template renders correctly and consistently); it only means the product
*name* visible in the screenshots is not what the URL implies. See
`technical.md` Critical #1 for the mechanism and fix.

---

## Passed / no issues found

- **Viewport meta:** `width=device-width, initial-scale=1` present and
  correct on all three pages (previously confirmed; not re-litigated here).
- **No horizontal scroll:** none of the six screenshots (3 pages × 2
  viewports) show content overflowing the viewport width.
- **Responsive breakpoints:** the nav, hero, cards, product gallery, and
  footer all reflow sensibly between 1920px and 375px — no broken grid,
  no overlapping columns, no text collision from a broken breakpoint (the
  one overlap found, #1 above, is a fixed-position z-index issue, not a
  breakpoint failure).
- **Text legibility:** body copy renders at a comfortable size with good
  contrast (dark maroon/near-black text on cream/pink backgrounds) on both
  desktop and mobile; the hand-lettered display font used for headings is
  stylistically consistent and still legible at heading sizes.
- **Tap targets on real form controls:** already verified in `technical.md`
  ("`select`, filter buttons, range input... styled with `min-height:44px`,
  meeting the 44px touch-target guideline") — not re-tested pixel-by-pixel
  here, but consistent with what the screenshots show for the size-selector
  dropdown on the product page.
- **Product page (once scrolled to) has a clear, high-contrast, single
  primary CTA:** the green "Order on WhatsApp" button is unambiguous and
  well-sized once visible (see Finding #2 for the "once visible" caveat).
- **No web fonts / FOIT-FOUT risk:** consistent with `technical.md`'s
  finding that the site uses system fonts — nothing in the screenshots
  suggests a layout shift from late-loading fonts.

---

## Category scorecard

| Dimension | Status |
|---|---|
| Above-the-fold clarity (headline) | Pass — H1 visible without scrolling on mobile home |
| Above-the-fold clarity (primary CTA) | Fail — obscured on home (Finding #1), absent on product page (Finding #2) |
| Mobile responsiveness / no horizontal scroll | Pass |
| Tap target sizing | Pass (per `technical.md`; not independently re-measured) |
| Text legibility | Pass |
| Layout / overlap | Fail — fixed contact buttons overlap content (Finding #1) |
| Visual polish (imagery) | Needs improvement — placeholder photos still live (Finding #4) |

---

## Limitations

- All screenshots were produced by headless Chromium (Playwright), not a
  real device. Per this project's own `handoff.md`, headless Chromium does
  not reproduce a real mobile browser's address-bar show/hide resize
  behavior or real scroll physics — the overlap and above-the-fold findings
  above are real and repeatable *in this tool*, but should be spot-checked
  on an actual phone before being treated as fully confirmed, per this
  project's standing rule not to claim a mobile finding is verified from
  this environment.
- Only one product page was captured for the visual audit
  (`/product/aurora-theme-dress/`, chosen because the originally-planned
  `/product/blue-horizon-dress/` 404s live). Given `technical.md`'s finding
  that 41% of product pages have mismatched slugs/content, other product
  pages could render with different content lengths (longer/shorter
  descriptions) that shift exactly where the fold lands — Finding #2's
  general shape (price/CTA below the fold) is a template-level layout issue
  and should hold across products, but the precise scroll distance was only
  measured on this one page.
- No CLS (layout shift) measurement tool was run; "no layout shift" above
  refers only to the absence of visible mid-render jumps across the static
  screenshots taken, not a measured Cumulative Layout Shift score. A real
  CLS number would need `pagespeed_check.py`/Lighthouse, which is covered
  under `performance.md`, not this visual pass.
