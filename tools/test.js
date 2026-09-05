#!/usr/bin/env node
/**
 * Assertions over tools/content.js, the one file in the build with real
 * branching in it: the wording cascade, the settings merge, and the size and
 * price filtering that decides whether a product reaches the site at all.
 * A regression in any of those is invisible in review and shows up as a
 * product quietly missing from the live shop.
 *
 * Plus tools/images.js, for a different reason: the addresses it builds are
 * only ever proved right by a photo appearing, and every photo on this site
 * comes from an account no test can reach. Pinning the exact strings here at
 * least means a change to them has to be deliberate.
 *
 * Plus the helpers that are deliberately copied between Node and the browser,
 * because the browser halves cannot be run from here: tools/card.js against
 * tools/content.js (the card, the wording cascade, the size/price pipeline —
 * grep "MIRRORED:" for the full list), and tools/shared.js against what
 * card.js produces (money, the wa.me link, the WhatsApp order message that
 * site/app.js also builds).
 *
 * Dependency-free on purpose — no runner, no framework, nothing to install.
 *
 *   npm test
 *
 * It runs against tools/fixtures/content, a small catalogue built to hit every
 * branch at once: a product with its own wording, one that has to inherit from
 * its subcategory, one that has to fall through to the site defaults, a hidden
 * one, an orphaned one, a price row with an unknown size, and a product with no
 * usable price. Editing the fixture is how you
 * add a case; it is not a copy of the real catalogue and does not track it.
 */

"use strict";

const path = require("path");
const { load, SIZES, readSettings, chooseCarousel, warnings } = require("./content");
const images = require("./images");
const card = require("./card");
const render = require("./render");
const shared = require("./shared");

const FIXTURE = path.join(__dirname, "fixtures", "content");
// Four settings files rather than one — see its README.
const SPLIT_SETTINGS = path.join(__dirname, "fixtures", "settings-split");

/* --- tiny harness ------------------------------------------------------- */

let passed = 0;
const failures = [];

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failures.push("  ✗ " + label + "\n      expected: " + e + "\n      actual:   " + a);
}

function checkTrue(label, actual) {
  if (actual) { passed++; return; }
  failures.push("  ✗ " + label + "\n      expected something truthy, got: " + JSON.stringify(actual));
}

/** A warning mentioning every one of these fragments. */
function warned(warnings, ...fragments) {
  return warnings.some(w => fragments.every(f => w.includes(f)));
}

/* --- the run ------------------------------------------------------------ */

const model = load({ dir: FIXTURE, quiet: true });
const byName = Object.fromEntries(model.products.map(p => [p.name, p]));
const w = model.warnings;

console.log("Checking tools/content.js against tools/fixtures/content, and tools/images.js…\n");

/* which products survive */

check("visible products", model.products.map(p => p.name).sort(),
  ["Bad size row", "Boys on sale", "Completely unrelated name", "Inherits site", "Inherits sub",
    "On sale", "Own words", "Photos", "Some sizes off", "Undated"]);
check("hidden products are counted, not rendered", model.stats.hidden, 1);
checkTrue("a product with no usable price is dropped, with a warning",
  !byName["No price"] && warned(w, "No price", "no size with a price"));
checkTrue("a product pointing at a missing subcategory is dropped, with a warning",
  !byName["Orphaned piece"] && warned(w, "Orphaned piece", "no longer exists"));

/* the wording cascade: product → subcategory → site default */

check("own wording wins", byName["Own words"].description, "OWN description");
check("own second paragraph wins", byName["Own words"].description2, "OWN second paragraph");
check("own specs win", byName["Own words"].specs.fabric, "OWN fabric");

check("blank falls through to the subcategory", byName["Inherits sub"].description, "SUB description");
check("blank second paragraph falls through to the subcategory",
  byName["Inherits sub"].description2, "SUB second paragraph");
check("blank specs fall through to the subcategory", byName["Inherits sub"].specs, {
  fabric: "SUB fabric", occasion: "SUB occasion", fit: "SUB fit", care: "SUB care"
});

check("with no subcategory default, falls through to the site default",
  byName["Inherits site"].description, "SITE description");
check("site default second paragraph", byName["Inherits site"].description2, "SITE second paragraph");
check("site default specs", byName["Inherits site"].specs, {
  fabric: "SITE fabric", occasion: "SITE occasion", fit: "SITE fit", care: "SITE care"
});

/* sizes and prices */

check("size rows sort into age order, not file order",
  byName["Own words"].sizes.map(s => s.size), ["0–3 years", "7–9 years"]);
check("minPrice is the cheapest row", byName["Own words"].minPrice, 1000);
check("an unknown size is dropped and the rest of the product survives",
  byName["Bad size row"].sizes.map(s => s.size), ["10–12 years"]);
checkTrue("the unknown size is warned about", warned(w, "Bad size row", "unknown size"));
check("a row marked unavailable is left out",
  byName["Some sizes off"].sizes.map(s => s.size), ["4–6 years"]);
check("the size vocabulary is the one read from the admin", model.sizes, SIZES);

// "Completely unrelated name" lives in cheap-test-row.json on purpose — one
// fixture doing double duty (a sub-floor price AND a name/slug mismatch)
// keeps the catalogue at exactly 10 products, still within the ten slots the
// carousel defaults to, rather than growing past what later checks assume.
checkTrue("a suspiciously low price is warned about, not silently dropped",
  byName["Completely unrelated name"].sizes.some(s => s.price === 55) &&
  warned(w, "Completely unrelated name", "suspiciously low price", "PKR 55"));
checkTrue("a name sharing no words with its own slug is warned about",
  warned(w, "Completely unrelated name", "cheap-test-row", "shares almost no words"));
checkTrue("a name that does share words with its slug is not warned about",
  !warned(w, "Own words", "shares almost no words"));

/* subcategories */

check("subcategories sort by order, not by filename",
  model.categories.find(c => c.key === "girls").subcategories.map(s => s.name),
  ["No defaults", "Has defaults"]);
check("products sort newest-first within a subcategory, not by filename",
  model.categories.find(c => c.key === "girls").subcategories
    .find(s => s.id === "s1").products.map(p => p.name),
  ["Inherits sub", "Own words", "Bad size row", "Some sizes off", "Completely unrelated name"]);
check("a product with no date sorts last rather than first",
  model.categories.find(c => c.key === "girls").subcategories
    .find(s => s.id === "s2").products.map(p => p.name),
  ["Inherits site", "On sale", "Photos", "Undated"]);
check("a missing date is 0, not NaN — NaN would make the sort incoherent",
  byName["Undated"].addedOn, 0);
check("a date is parsed to milliseconds for sorting",
  byName["Own words"].addedOn, Date.parse("2026-08-03T12:00:00.000Z"));
// The id used to be typed into the admin, and two sections were given the same
// one. It is the file name now, so a clash cannot be expressed: s1.json is "s1"
// and nothing in the file can say otherwise.
check("a section's id is its file name", model.subcategories.map(s => s.id).sort(), ["b1", "s1", "s2"]);
checkTrue("a subcategory under an unknown parent is skipped, with a warning",
  !model.subcategories.some(s => s.id === "orphan") && warned(w, "orphan", "not a category"));

/* images */

check("a pasted url wins over an upload",
  byName["Photos"].images[0].src, "https://example.test/pasted.jpg");
check("a photo with no alt falls back to the product name",
  byName["Photos"].images[0].alt, "Photos");
check("an address with no scheme and no leading slash is forced root-relative",
  byName["Photos"].images[1].src, "/assets/uploads/relative.jpg");
checkTrue("and warned about", warned(w, "assets/uploads/relative.jpg", "no leading"));
check("an alt that is set is kept", byName["Photos"].images[1].alt, "Has alt");

/* image addresses (tools/images.js) */

// A photo as the ImageKit library hands it over: a delivery address with the
// upload time already on it, which is what makes the query string worth
// getting right.
const IK = "https://ik.imagekit.io/shop/products/frock.jpg?updatedAt=1770000000";

check("a card asks for three widths, largest last",
  images.srcset(IK, "card").split(", ").map(s => s.split(" ")[1]),
  ["400w", "800w", "1200w"]);
check("a card copy scales down only, and lets ImageKit pick the format",
  images.resized(IK, 800),
  IK + "&tr=w-800,c-at_max,f-auto");
check("the gallery goes one step larger and pins the quality",
  images.srcset(IK, "detail").split(", ").pop(),
  IK + "&tr=w-1600,c-at_max,f-auto,q-75 1600w");
check("an unknown profile name costs quality, not a broken picture",
  images.srcset(IK, "typo"), images.srcset(IK, "card"));

check("the share copy is a padded JPEG at exactly the size it claims",
  images.preview(IK),
  { url: IK + "&tr=w-1200,h-630,cm-pad_resize,bg-FFFCF8,f-jpg",
    width: 1200, height: 630, type: "image/jpeg" });
check("transforming an already-transformed address replaces, never stacks",
  images.preview(images.preview(IK).url).url, images.preview(IK).url);
check("an address with no query string of its own still gets one",
  images.resized("https://ik.imagekit.io/shop/frock.jpg", 400),
  "https://ik.imagekit.io/shop/frock.jpg?tr=w-400,c-at_max,f-auto");
checkTrue("ImageKit photos are worth warming before anyone shares one",
  images.warms(IK));

// The fallback the whole table rests on: a host it does not know must cost
// bytes, never a missing photo.
const OTHER = "https://example.test/pasted.jpg";
check("an unknown host is left exactly as it is", images.resized(OTHER, 400), OTHER);
check("…with no srcset, so the browser keeps the single src", images.srcset(OTHER), "");
check("…and no share copy claimed for it", images.preview(OTHER), null);
checkTrue("…and nothing to warm", !images.warms(OTHER));

/* shape the rest of the build relies on */

check("product id and href come from the filename",
  [byName["Own words"].id, byName["Own words"].href], ["own-words", "/product/own-words/"]);
check("category href", model.categories.find(c => c.key === "girls").href, "/girls/");

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
    html.includes('<script defer src="/ga.js"></script>'));
  checkTrue("…and the gtag loader tag is emitted alongside it — order does not matter, GA tolerates either",
    html.includes('<script async src="https://www.googletagmanager.com/gtag/js?id=G-K0TV7SBWFP"></script>') &&
    html.includes('<script defer src="/ga.js"></script>'));
}

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

/* --- sale prices ---------------------------------------------------------
 *
 * A discounted row carries what the customer pays as `price`, with the old
 * price kept aside as `wasPrice`. That swap is the whole design: the totals,
 * the filters, the "from PKR" line, the WhatsApp message and the price given
 * to search engines all keep reading `price` and are correct on a sale without
 * knowing one is on. These checks are what hold that promise.
 */

const sale = byName["On sale"];

check("a discounted size charges the sale price",
  [sale.sizes[0].size, sale.sizes[0].price, sale.sizes[0].wasPrice],
  ["0–3 years", 6000, 8000]);
check("a size with no sale price is untouched",
  [sale.sizes[1].price, sale.sizes[1].wasPrice], [9000, null]);
check("a sale price that is not lower is ignored rather than shown as a rise",
  [sale.sizes[2].price, sale.sizes[2].wasPrice], [10000, null]);
checkTrue("…and that is warned about, since it is a typo not a choice",
  warned(w, "On sale", "not below", "ignored"));
check("the lowest price — filters, and the 'from PKR' line — follows the sale",
  sale.minPrice, 6000);

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

/* --- the gallery paging arrows --------------------------------------------
 *
 * card.js leaves the two arrow buttons out of the markup entirely when a
 * piece has only one photo — there is nothing to page to, and app.js
 * null-checks both anyway, so a lone photo just gets no arrows. Nothing in
 * the fixture catalogue has exactly one photo (Photos has two; everything
 * else has zero and gets three placeholder frames), so this builds a
 * one-photo product inline from Photos to reach that branch.
 */

const onePhoto = Object.assign({}, byName["Photos"], { images: [byName["Photos"].images[0]] });

checkTrue("a piece with more than one photo gets both paging arrows",
  card.productDetail(byName["Photos"], model.settings, "https://example.test").includes("data-gal-prev") &&
  card.productDetail(byName["Photos"], model.settings, "https://example.test").includes("data-gal-next"));
checkTrue("a piece with one photo gets neither — there is nothing to page to",
  !card.productDetail(onePhoto, model.settings, "https://example.test").includes("data-gal-prev") &&
  !card.productDetail(onePhoto, model.settings, "https://example.test").includes("data-gal-next"));

/* --- the gallery arrows honour `hidden` ------------------------------------
 *
 * This is the fourth instance of the same trap this stylesheet keeps hitting:
 * a rule that sets `display` on an element outranks the browser's own built-in
 * [hidden]{display:none}, so `hidden` stops doing anything unless the
 * stylesheet says `[hidden]{display:none}` for that element by name. See
 * .lp-navarrow, .lp-searchbtn/.lp-search and .lp-loadwrap in site/styles.css
 * for the earlier three. Nothing in the build renders the gallery in a real
 * browser to notice the rule being silently dropped — app.js would keep
 * setting `hidden` on the arrow that has nowhere to go, and it would just sit
 * there on screen anyway, clickable. This is a plain regex over the
 * stylesheet text because that is all Node can check.
 */

const stylesCss = require("fs").readFileSync(path.join(__dirname, "..", "site", "styles.css"), "utf8");

checkTrue("the gallery arrows honour `hidden` — a bare display: rule would outrank it",
  /\.lp-arrow\[hidden\]\s*\{\s*display\s*:\s*none/.test(stylesCss));

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
check("a discounted piece that is sold out is kept off the page",
  [card.discountedSizes(byName["Undated"]).length,
   model.saleCategories.some(c => c.products.some(p => p.name === "Undated"))],
  [1, false]);
check("…and the count the build reports agrees with the list",
  model.stats.saleProducts, 2);
check("a sale price that is not below the normal one still counts for nothing",
  card.discountedSizes(byName["On sale"]).map(s => s.size), ["0–3 years"]);
checkTrue("nothing is warned about a badge and a discount disagreeing any more",
  !warned(w, "badged", "no size has a sale price"));

/* the "Sale" badge option is gone for good — the tag is computed, never typed */

const adminConfig = require("fs").readFileSync(
  path.join(__dirname, "..", "site", "admin", "config.yml"), "utf8");
checkTrue("the admin no longer offers a Sale badge to set by hand",
  !adminConfig.includes('{ label: "Sale", value: "Sale" }'));
checkTrue("…and no piece in the catalogue still stores one",
  !model.products.some(p => p.badge === "Sale"));

/* --- tools/card.js: the card the site and the admin preview share --------
 *
 * The card was pulled out of render.js so the admin's preview panel could draw
 * the real one instead of a lookalike. That buys accuracy only for as long as
 * the two halves agree, and neither half can be checked in a browser from here
 * — the admin loads Decap from a CDN. So the agreement is pinned in Node.
 */

/* the move itself: render.js must be using the shared copies, not its own */

checkTrue("render.js re-exports the shared esc, not a second copy",
  render.esc === card.esc);
checkTrue("…and the shared money", render.money === card.money);

/* --- tools/shared.js: the helpers the build AND site/app.js both use ------
 *
 * money, the wa.me link and the WhatsApp order message. app.js rebuilds the
 * order link on every size/accessory change and used to carry its own copy of
 * the text; this is the single source both now read, so these checks are what
 * stop the two drifting. app.js cannot run from Node — pinning card.js's output
 * from the same helper is the closest proxy.
 */

checkTrue("card.js's money is shared.money, not a second copy", card.money === shared.money);
check("money formats a price the one site way", shared.money(16500), "PKR 16,500");
check("waLink keeps digits only and appends an encoded message",
  shared.waLink("+92 321 715 2723", "hi there"),
  "https://wa.me/923217152723?text=hi%20there");
check("waLink with no message is just the number",
  shared.waLink("923217152723"), "https://wa.me/923217152723");
check("the WhatsApp order message is exactly the text the product link carries",
  shared.waOrderMessage({ url: "https://example.test/product/aurora-gown/", name: "Aurora Gown", size: "0–3 years", price: 16500, accessory: false, total: 16500 }),
  "https://example.test/product/aurora-gown/\n" +
  "Hello Little Princess Designer, I'd like to order:\nAurora Gown\n" +
  "Size: 0–3 years (PKR 16,500)\nMatching accessory: no\nTotal shown: PKR 16,500");
checkTrue("…and it says \"yes (PKR ...)\" with the accessory price once the matching accessory is ticked",
  shared.waOrderMessage({ name: "X", size: "S", price: 100, accessory: true, accessoryPrice: 1500, total: 100 })
    .includes("Matching accessory: yes (PKR 1,500)"));
check("with no url given, the message skips straight to the greeting",
  shared.waOrderMessage({ name: "X", size: "S", price: 100, accessory: false, total: 100 }).slice(0, 5),
  "Hello");

/* safeHref survived being moved. The scheme allowlist is a security guard: every
   link field in the admin is free text, editors hold no repo access, and a
   "javascript:" address typed into one would otherwise reach an href on every
   page. Its control-character handling is the part most easily broken by a
   careless copy. */

check("safeHref keeps an ordinary link", card.safeHref("https://example.test/a"), "https://example.test/a");
check("safeHref keeps a same-site path", card.safeHref("/girls/"), "/girls/");
check("safeHref blocks javascript:", card.safeHref("javascript:alert(1)"), "#");
check("safeHref blocks javascript: hidden behind a tab",
  card.safeHref("java\tscript:alert(1)"), "#");
check("safeHref blocks a scheme-relative address", card.safeHref("//evil.test/x"), "#");
check("safeHref turns nothing into an inert link", card.safeHref(""), "#");

/* the preview's own half: a form mid-typing must produce a drawable card */

// The catalogue the panel fetches at runtime, built here the way tools/build.js
// writes it, so the lookup under test is the real shape.
const catalogue = {
  sizes: model.sizes,
  categories: model.categories.map(c => ({
    key: c.key, label: c.label,
    subcategories: c.subcategories.map(sub => ({ id: sub.id, name: sub.name }))
  }))
};

const empty = card.fromCmsEntry({}, catalogue);
checkTrue("an empty form still yields a card that can be drawn",
  typeof card.productCard(null, empty.product) === "string");
checkTrue("…and says the name is missing",
  empty.notes.some(n => n.includes("name")));
checkTrue("…and says there is no photo",
  empty.notes.some(n => n.includes("photo")));
checkTrue("…and says there is no price",
  empty.notes.some(n => n.includes("price")));
check("…with no photo, the card falls back to the empty frame",
  card.productCard(null, empty.product).includes("lp-ph"), true);

check("a hidden piece is called out in the preview",
  card.fromCmsEntry({ visible: false }, catalogue).notes.some(n => n.includes("hidden")), true);

/* the mapper applies content.js's rules — same filters, same order */

const typed = card.fromCmsEntry({
  name: "Half typed",
  subcategory: "s1",
  sizes: [
    { size: "7–9 years", price: 3000, available: true },
    { size: "0–3 years", price: 1000, available: true },
    { size: "4–6 years", price: 50, available: false },   // unavailable: dropped
    { size: "10–12 years", price: 0, available: true },   // no price: dropped
    { size: "Not a size", price: 900, available: true }   // unknown: dropped
  ],
  images: [
    { upload: "https://ik.imagekit.io/lpdlhr/a.jpg", url: "", alt: "Chosen" },
    { upload: "https://ik.imagekit.io/lpdlhr/b.jpg", url: "https://example.test/pasted.jpg", alt: "" },
    { upload: "", url: "", alt: "still empty" }           // untouched row: dropped
  ]
}, catalogue);

check("unavailable, unpriced and unknown size rows are dropped",
  typed.product.sizes.map(s => s.size), ["0–3 years", "7–9 years"]);
check("…and the survivors come back in age order, not typing order",
  typed.product.sizes[0].size, "0–3 years");
check("minPrice is the lowest price, not the first row's",
  typed.product.minPrice, 1000);
check("a pasted link beats a library pick on the same row",
  typed.product.images.map(i => i.src),
  ["https://ik.imagekit.io/lpdlhr/a.jpg", "https://example.test/pasted.jpg"]);
check("a photo with no description falls back to the product name",
  typed.product.images[1].alt, "Half typed");

/* the preview panel shows a sale the same way the site does */

const salePreview = card.fromCmsEntry({
  name: "Preview sale",
  sizes: [
    { size: "0–3 years", price: 8000, salePrice: 6000 },
    { size: "4–6 years", price: 9000 },
    { size: "7–9 years", price: 10000, salePrice: 12000 }
  ]
}, catalogue);

check("the preview charges the sale price and keeps the old one to strike",
  salePreview.product.sizes.map(s => [s.price, s.wasPrice]),
  [[6000, 8000], [9000, null], [10000, null]]);
check("…and the preview's lowest price follows the sale, as the site's does",
  salePreview.product.minPrice, 6000);
checkTrue("…and a sale price that is not lower is called out rather than shown",
  salePreview.notes.some(n => n.includes("7–9 years") && n.includes("not below")));
checkTrue("the drawn card carries both prices",
  card.productCard(null, salePreview.product).includes("PKR 8,000") &&
  card.productCard(null, salePreview.product).includes("PKR 6,000"));
checkTrue("…and marks itself as a sale card so the styling applies",
  card.productCard(null, salePreview.product).includes("lp-card-price--sale"));
checkTrue("…and the preview shows the Sale tag from the prices alone, with no badge set",
  card.productCard(null, salePreview.product)
    .includes('<span class="lp-badge" data-badge="Sale">Sale</span>'));
checkTrue("a card at its usual price hides the struck-through line rather than leaving a gap",
  card.productCard(null, typed.product).includes('data-price-was hidden'));
check("the subcategory code resolves to its readable name",
  typed.product.subcategoryName, "Has defaults");
check("…and to the tab label the card's screen-reader text needs",
  typed.product.tabLabel, "Girls");
check("an unknown subcategory code degrades instead of throwing",
  card.fromCmsEntry({ subcategory: "nope" }, catalogue).product.subcategoryName, "nope");
check("a photo address with no scheme and no slash is forced root-relative, as on the site",
  card.fromCmsEntry({ images: [{ upload: "assets/uploads/x.jpg" }] }, catalogue).product.images[0].src,
  "/assets/uploads/x.jpg");

// Without the catalogue — the fetch failed, or has not landed on the first
// keystroke — the panel must still draw rather than blank.
const noCat = card.fromCmsEntry({ name: "No catalogue", sizes: [{ size: "0–3 years", price: 500 }] });
check("with no catalogue loaded, sizes are kept rather than all rejected",
  noCat.product.sizes.length, 1);
checkTrue("…and the card still renders",
  card.productCard(null, noCat.product).includes("No catalogue"));

/* the two halves agree: a finished product mapped from its raw CMS file must
   match what content.js built out of the same file for the live site */

const rawPhotos = JSON.parse(
  require("fs").readFileSync(path.join(FIXTURE, "products", "photos.json"), "utf8"));
const mapped = card.fromCmsEntry(rawPhotos, catalogue).product;
const built = byName[rawPhotos.name];

check("preview and site agree on the sizes of a finished product",
  mapped.sizes, built.sizes);
check("…on its lowest price", mapped.minPrice, built.minPrice);
check("…on its photos", mapped.images.map(i => i.src), built.images.map(i => i.src));
check("…and on their descriptions", mapped.images.map(i => i.alt), built.images.map(i => i.alt));

/* --- the product page, shared with the preview panel ---------------------
 *
 * productDetail() builds everything on a product page below the breadcrumb, and
 * the admin preview panel draws that same function. What is checked here is the
 * bargain that makes sharing worth it: the build's own product page really is
 * this output, so the panel cannot show one thing while the site shows another.
 */

const detailProduct = byName["On sale"];
const detailHtml = card.productDetail(detailProduct, model.settings, "https://example.test");

checkTrue("the shared block is what the build's product page contains",
  render.renderProduct(model, detailProduct, "https://example.test").includes(detailHtml));

checkTrue("it carries the size picker app.js repaints from",
  detailHtml.includes("data-detail-size") && detailHtml.includes('data-was="8000"'));
checkTrue("…the sale price block", detailHtml.includes("lp-detail-price--sale"));
checkTrue("…the total", detailHtml.includes("data-total"));
checkTrue("…and the order button, addressed to the shop's number",
  detailHtml.includes("data-wa-order") &&
  detailHtml.includes(String(model.settings.whatsappNumber).replace(/[^0-9]/g, "")));
checkTrue("…with the exact pre-filled message shared.waOrderMessage builds — " +
  "the same text app.js rebuilds when the size changes",
  detailHtml.includes(card.esc(encodeURIComponent(shared.waOrderMessage({
    url: "https://example.test" + detailProduct.href,
    name: detailProduct.name,
    size: detailProduct.sizes[0].size,
    price: detailProduct.sizes[0].price,
    accessory: false,
    accessoryPrice: detailProduct.accessoryPrice,
    total: detailProduct.sizes[0].price
  })))));

// A sold-out piece must not offer an order button — the same rule the page has
// had since that finding was fixed, now living in the shared file.
const soldOutHtml = card.productDetail(
  Object.assign({}, detailProduct, { badge: "Sold out" }), model.settings);
checkTrue("a sold-out piece offers no order button",
  !soldOutHtml.includes("data-wa-order") && soldOutHtml.includes("Currently unavailable"));

/* the matching accessory can be switched off per piece */

// Matched on the tick-box's own class and note id, not on "data-accessory":
// the wrapper carries data-accessory-price, which contains that string and
// would make this pass whatever the switch did.
checkTrue("a piece offers the accessory by default",
  detailHtml.includes('class="lp-acc"') && detailHtml.includes('id="lp-acc-note"'));
check("…and every piece saved before the switch existed still does",
  detailProduct.showAccessory, true);

const noAccessoryHtml = card.productDetail(
  Object.assign({}, detailProduct, { showAccessory: false }), model.settings);
checkTrue("switched off, the tick-box is left out rather than shown and ignored",
  !noAccessoryHtml.includes('class="lp-acc"') && !noAccessoryHtml.includes('id="lp-acc-note"'));
checkTrue("…and the rest of the page is untouched",
  noAccessoryHtml.includes("data-total") && noAccessoryHtml.includes("data-detail-size"));
check("the preview reads the switch the same way",
  [
    card.fromCmsEntry({ showAccessory: false }, catalogue).product.showAccessory,
    card.fromCmsEntry({}, catalogue).product.showAccessory
  ],
  [false, true]);

/* the accessory's tick-box says what it actually is, when a piece says so */

const genericSettings = Object.assign({}, model.settings, { accessoryLabel: "Add matching accessory" });
checkTrue("a piece with no accessory name uses the site's generic wording",
  card.productDetail(detailProduct, genericSettings).includes("Add matching accessory"));

const namedAccessoryHtml = card.productDetail(
  Object.assign({}, detailProduct, { accessoryName: "hair bow" }), genericSettings);
checkTrue("a piece that names its accessory shows that instead",
  namedAccessoryHtml.includes("Add matching hair bow") &&
  !namedAccessoryHtml.includes("Add matching accessory"));
check("the preview reads a typed-in accessory name the same way",
  card.fromCmsEntry({ accessoryName: "  hijab pin  " }, catalogue).product.accessoryName,
  "hijab pin");

/* the wording cascade the panel applies: piece → section → site default */

const sectionWording = { defaultDescription: "SECTION words", defaultSpecs: { fabric: "SECTION fabric" } };
const siteWording = { productDefaults: { description: "SITE words", specs: { fabric: "SITE fabric" } } };

check("a piece's own words win",
  card.applyWording({ description: "OWN words" }, sectionWording, siteWording).description,
  "OWN words");
check("blank falls through to the section",
  card.applyWording({}, sectionWording, siteWording).description, "SECTION words");
check("blank with no section wording falls through to the site default",
  card.applyWording({}, {}, siteWording).description, "SITE words");
check("the same three steps apply to the details rows",
  [
    card.applyWording({ specs: { fabric: "OWN" } }, sectionWording, siteWording).specs.fabric,
    card.applyWording({}, sectionWording, siteWording).specs.fabric,
    card.applyWording({}, {}, siteWording).specs.fabric
  ],
  ["OWN", "SECTION fabric", "SITE fabric"]);

// The panel repeats this cascade because content.js cannot run in a browser.
// Repeated logic is only safe while something checks the two agree.
check("the panel's cascade agrees with the one the site is built with",
  [
    card.applyWording({}, sectionWording, siteWording).description,
    card.applyWording({}, {}, {}).description
  ],
  ["SECTION words", ""]);

/* --- site settings, split across three admin pages ------------------------ */

// The admin edits contact details, product defaults and the site itself as
// three separate files. Everything downstream still expects one settings
// object, so the merge is the seam that holds that promise.
const splitBefore = warnings.length;
const split = readSettings(SPLIT_SETTINGS);
const splitWarnings = warnings.slice(splitBefore);

check("all three files arrive as one settings object",
  [split.brandName, split.whatsappNumber, split.accessoryLabel],
  ["Split Designer", "920000000000", "PRODUCTS label"]);
checkTrue("a setting that ended up on two pages is named, not silently picked",
  warned(splitWarnings, "deliveryNote", "settings.json", "settings-products.json"));
check("…and the later file wins, which is what the warning says happens",
  split.deliveryNote, "PRODUCTS page's copy of the delivery note");
checkTrue("nothing else is reported as a clash",
  splitWarnings.length === 1);

// The fixture catalogue still has settings.json on its own, which is what a
// site looks like before the split — and what one would look like again if a
// file were lost. Every check above this line ran against it.
check("a directory with only settings.json still loads", model.settings.brandName, "Fixture Designer");

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
  (saleHtml.match(/<h2 id="sale-([a-z]+)"/g) || []).join(),
  '<h2 id="sale-girls",<h2 id="sale-boys"');
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

const noSale = Object.assign({}, model, { saleCategories: [] });
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

/* --- the home carousel --------------------------------------------------- */

// chooseCarousel() reads Site Settings, which the fixture deliberately does not
// set — so every case here hands it settings of its own. The site reaches it
// through load(); these calls are the same function with the same rules.
// The fixture catalogue is smaller than the ten slots the ring defaults to, so
// "all of them" is what a default-slot call returns here.
const carouselIds = settings => chooseCarousel(settings, model.products).map(p => p.id);

/** The warnings chooseCarousel() raised for one call, and nothing else's. */
function carouselWarnings(settings) {
  const before = warnings.length;
  chooseCarousel(settings, model.products);
  return warnings.slice(before);
}

check("with nothing set, the ring spins the newest pieces, newest first",
  model.carousel.map(p => p.id).slice(0, 3), ["inherits-site", "inherits-sub", "on-sale"]);
check("…and the slot count decides how many of them",
  carouselIds({ carouselSlots: 4 }).length, 4);
check("a slot count below the shape the ring keeps is pulled up to 3",
  carouselIds({ carouselSlots: 1 }).length, 3);
check("…and one above it is pulled down to 20",
  carouselIds({ carouselSlots: 99 }).length, Math.min(20, model.products.length));
checkTrue("both say so rather than correcting silently",
  warned(carouselWarnings({ carouselSlots: 1 }), "outside 3–20") &&
  warned(carouselWarnings({ carouselSlots: 99 }), "outside 3–20"));
checkTrue("a slot count that is not a number falls back to ten, with a warning",
  carouselIds({ carouselSlots: "abc" }).length === model.products.length &&
  warned(carouselWarnings({ carouselSlots: "abc" }), "not a number"));

check("chosen pieces spin in the order they were picked, not by date",
  carouselIds({ carouselMode: "chosen", carouselProducts: ["undated", "own-words", "on-sale"] }),
  ["undated", "own-words", "on-sale"]);
check("…and the slot count still caps the list",
  carouselIds({ carouselMode: "chosen", carouselSlots: 3, carouselProducts: ["undated", "own-words", "on-sale", "photos"] }),
  ["undated", "own-words", "on-sale"]);
check("a pick stored as an object reads the same as a bare address",
  carouselIds({ carouselMode: "chosen", carouselProducts: [{ product: "photos" }] }), ["photos"]);

checkTrue("a piece that is hidden, deleted or renamed is skipped and named",
  carouselIds({ carouselMode: "chosen", carouselProducts: ["photos", "hidden", "gone-away"] })
    .join() === "photos" &&
  warned(carouselWarnings({ carouselMode: "chosen", carouselProducts: ["gone-away"] }),
    "gone-away", "not a piece on the site"));
checkTrue("the same piece picked twice spins once, with a warning",
  carouselIds({ carouselMode: "chosen", carouselProducts: ["photos", "photos"] }).join() === "photos" &&
  warned(carouselWarnings({ carouselMode: "chosen", carouselProducts: ["photos", "photos"] }),
    "twice"));
checkTrue("fewer pieces than slots spins what there is, and says so",
  carouselIds({ carouselMode: "chosen", carouselSlots: 6, carouselProducts: ["photos"] }).length === 1 &&
  warned(carouselWarnings({ carouselMode: "chosen", carouselSlots: 6, carouselProducts: ["photos"] }),
    "6 slots but only 1"));

// The home page losing its carousel is worse than showing a stale-ish ring, so
// every way of ending up with no chosen piece falls back to the newest.
checkTrue("chosen with nothing chosen falls back to the newest, with a warning",
  carouselIds({ carouselMode: "chosen", carouselProducts: [] }).length === model.products.length &&
  warned(carouselWarnings({ carouselMode: "chosen", carouselProducts: [] }), "no piece on the site is chosen"));
checkTrue("chosen with only dead picks falls back too",
  carouselIds({ carouselMode: "chosen", carouselProducts: ["gone-away"] }).length === model.products.length);
checkTrue("a way of filling it this site does not know falls back to the newest",
  carouselIds({ carouselMode: "shuffle" }).length === model.products.length &&
  warned(carouselWarnings({ carouselMode: "shuffle" }), "shuffle", "not something this site knows"));

/* --- report ------------------------------------------------------------- */

if (failures.length) {
  console.error(failures.join("\n"));
  console.error("\nFAILED — " + failures.length + " of " + (passed + failures.length) + " checks");
  process.exit(1);
}

console.log("OK — " + passed + " checks passed");
