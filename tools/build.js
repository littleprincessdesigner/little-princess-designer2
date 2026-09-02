#!/usr/bin/env node
/**
 * Builds dist/ from content/ + site/.
 *
 *   site/     hand-written sources (CSS, app.js, assets, admin) — committed
 *   content/  what the CMS (Sveltia) edits — committed
 *   dist/     build output served by Netlify — NOT committed
 *
 * Because every page is regenerated from scratch on each build, a product that
 * is deleted or hidden in the CMS simply stops having a page. Nothing goes stale.
 *
 * Env:
 *   SITE_URL   canonical origin, no trailing slash. Netlify's own URL is used
 *              automatically when this is unset.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const content = require("./content");
const render = require("./render");
const feed = require("./feed");
const { waLink, effectiveBadge } = require("./card");

const ROOT = path.join(__dirname, "..");
const SITE = path.join(ROOT, "site");
const DIST = path.join(ROOT, "dist");
// This directory. The admin preview is served three files from here — see the
// copy step below.
const TOOLS = __dirname;

const SITE_URL = (
  process.env.SITE_URL ||
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  "http://localhost:8080"
).replace(/\/+$/, "");

/* --- sitemap dates ------------------------------------------------------ */

/**
 * When each file under content/ last actually changed, for <lastmod>.
 *
 * Deliberately not file mtimes. The site is built from a fresh clone, and a
 * clone stamps every file with the moment it was checked out — so mtimes would
 * date every page "today" on every deploy. A sitemap that claims the whole
 * site changed each time is worse than one with no dates at all: it is the
 * signal search engines learn to ignore.
 *
 * So the dates come from git, in one call for the whole directory. A shallow
 * clone cannot answer the question — it holds one commit, and would date
 * everything to that — so it returns nothing and every URL goes out without a
 * <lastmod>, which is valid and honest. If the deployed sitemap has no dates,
 * that is what happened: give the build a full clone.
 */
function contentDates() {
  const dates = new Map();
  try {
    const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"],
      { cwd: ROOT, encoding: "utf8" }).trim();
    if (shallow !== "false") return dates;

    // %cI is the committer date, ISO 8601. --name-only lists the files each
    // commit touched, so one pass gives every file its newest commit.
    const log = execFileSync("git",
      ["log", "--format=%cI", "--name-only", "--", "content"],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

    let current = null;
    for (const line of log.split("\n")) {
      const value = line.trim();
      if (!value) continue;
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) { current = value.slice(0, 10); continue; }
      // Newest first, so the first date a file is seen with is the one to keep.
      if (current && !dates.has(value)) dates.set(value, current);
    }
  } catch {
    // No git, or no history to read. Dates are an optimisation; the sitemap is
    // still correct without them.
  }
  return dates;
}

/* --- fs helpers --------------------------------------------------------- */

/** Every .html written, so the build summary counts rather than guesses. */
const pagesWritten = [];

function writeFile(rel, body) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  if (rel.endsWith(".html")) pagesWritten.push(rel);
}

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

/* --- build ------------------------------------------------------------- */

console.log("Little Princess Designer — build");
console.log("  site url: " + SITE_URL);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

console.log("Reading content/…");
const model = content.load();
const s = model.settings;

// 1. passthrough sources
for (const entry of ["tokens.css", "styles.css", "app.js", "carousel-3d.js", "ga.js", "assets", "admin"]) {
  const from = path.join(SITE, entry);
  if (fs.existsSync(from)) copyRecursive(from, path.join(DIST, entry));
}

// 1b. build code that also has to run in a browser, so it needs an address.
// These live in tools/ (required above) and are copied out rather than kept in
// site/ so there is exactly one copy in the repository: edit tools/card.js and
// the site AND the admin preview panel move with it. Order matters at load time
// (card.js reads shared.js and images.js off the window), which index.html and
// render.js fix.
//   · shared.js — every public page loads /shared.js (render.js emits it), and
//     the admin preview loads /admin/shared.js, so it goes to both places.
//   · images.js, card.js — the admin preview panel (site/admin/preview.js).
copyRecursive(path.join(TOOLS, "shared.js"), path.join(DIST, "shared.js"));
for (const entry of ["shared.js", "images.js", "card.js"]) {
  copyRecursive(path.join(TOOLS, entry), path.join(DIST, "admin", entry));
}

// 2. data files — the CMS-to-site contract, also handy for any future consumer
writeFile("data/products.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  sizes: model.sizes,
  categories: model.categories.map(c => ({
    key: c.key, label: c.label, href: c.href,
    subcategories: c.subcategories.map(sub => ({
      id: sub.id, name: sub.name, order: sub.order,
      // The section's standard wording travels with it, because the admin's
      // preview panel needs the same fallback chain the site uses — a piece
      // with a blank description shows its section's words, then the site
      // defaults from settings.json. The form holds only the piece's own
      // fields, so without these the panel would show a gap where the live
      // page shows a paragraph.
      defaultDescription: sub.defaultDescription || "",
      defaultDescription2: sub.defaultDescription2 || "",
      defaultSpecs: sub.defaultSpecs || {},
      products: sub.products.map(p => p.id)
    }))
  })),
  // The tag a visitor actually sees, not the field on the form — the header
  // search reads this file and would otherwise say "Sale" only for pieces that
  // still had the retired badge stored on them.
  products: model.products.map(p => Object.assign({}, p, { badge: effectiveBadge(p) }))
}, null, 2) + "\n");

writeFile("data/settings.json", JSON.stringify(s, null, 2) + "\n");

// 3. pages
writeFile("index.html", render.renderHome(model, SITE_URL));
writeFile("contact/index.html", render.renderContact(model, SITE_URL));
// Netlify serves this for any address that matches nothing else.
writeFile("404.html", render.render404(model, SITE_URL));
// Always written, even with nothing reduced: /sale/ is a permanent address
// that gets shared and linked, and a page that 404s between sales is worse
// than one that says there is nothing on right now.
writeFile("sale/index.html", render.renderSale(model, SITE_URL));
for (const cat of model.categories) {
  writeFile(cat.key + "/index.html", render.renderShop(model, cat, SITE_URL));
}
for (const p of model.products) {
  writeFile("product/" + p.id + "/index.html", render.renderProduct(model, p, SITE_URL));
}

// 4. robots + sitemap
// Each URL is dated by the content file it is built from: a product by its own
// JSON, a category page by its category file, and the two settings pages by
// whichever of the three settings files holds most of what they show — the home
// page by the site one, the contact page by the contact one.
const urls = [
  ["/", "content/settings.json"],
  ["/contact/", "content/settings-contact.json"],
  ["/sale/", "content/settings-sale.json"],
  ...model.categories.map(c => [c.href, "content/categories/" + c.key + ".json"]),
  ...model.products.map(p => [p.href, "content/products/" + p.id + ".json"])
];
const dates = contentDates();
writeFile("sitemap.xml",
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(([u, file]) => {
    const on = dates.get(file);
    return "  <url><loc>" + SITE_URL + u + "</loc>" +
      (on ? "<lastmod>" + on + "</lastmod>" : "") + "</url>";
  }).join("\n") +
  "\n</urlset>\n"
);
// The wildcard rule below already allows every crawler, AI ones included —
// naming the major ones explicitly changes nothing a crawler does, it just
// makes the policy self-documenting for the next person (or audit) reading
// this file, rather than relying on the wildcard's intent being obvious.
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];
writeFile("robots.txt",
  "User-agent: *\nAllow: /\nDisallow: /admin/\n\n" +
  AI_CRAWLERS.map(name => "User-agent: " + name + "\nAllow: /\n").join("\n") +
  "\nSitemap: " + SITE_URL + "/sitemap.xml\n"
);

// 4b. redirects — old web addresses kept alive after a page is renamed. Renaming
// a product in the admin changes its URL, and every shared link, bookmarked
// page and search result still points at the old one. redirects.json at the
// repo root maps old path → new path (hand-maintained: add a line whenever a
// slug changes); Netlify serves dist/_redirects. Each entry is emitted twice,
// with and without the trailing slash, so both forms are one hop.
let redirectMap = {};
try {
  redirectMap = JSON.parse(fs.readFileSync(path.join(ROOT, "redirects.json"), "utf8")).redirects || {};
} catch { /* no redirects.json — nothing to emit */ }
const redirectLines = Object.entries(redirectMap).flatMap(([from, to]) => {
  const bare = from.replace(/\/$/, "");
  const line = t => t + " " + to + " 301";
  return bare && bare !== from ? [line(from), line(bare)] : [line(from)];
});
if (redirectLines.length) writeFile("_redirects", redirectLines.join("\n") + "\n");

// 4c. Google Merchant Center product feed — regenerated from the same model
// as the shop pages on every build, so it never drifts from what the site
// actually shows. Point Merchant Center's "scheduled fetch" at
// SITE_URL + "/product-feed.csv" once, and it stays current on its own.
writeFile("product-feed.csv", feed.productFeedCsv(model, SITE_URL));

// A short, plain-English "about this site" file some AI assistants read
// directly. Not required by any major crawler and ignored by Google Search
// specifically, but costs nothing to publish. Built from the same settings
// the rest of the site already shows, not new copy of its own.
writeFile("llms.txt",
  "# " + s.brandName + "\n\n" +
  "> " + s.seo.description + "\n\n" +
  (s.contact && s.contact.intro ? s.contact.intro + "\n\n" : "") +
  "## Sections\n\n" +
  model.categories.map(c => "- " + c.label + ": " + SITE_URL + c.href).join("\n") + "\n" +
  "- Sale: " + SITE_URL + "/sale/\n\n" +
  "## Contact\n\n" +
  "- How to order / FAQ: " + SITE_URL + "/contact/\n" +
  "- WhatsApp: " + waLink(s.whatsappNumber) + "\n" +
  "- Email: " + s.email + "\n" +
  (s.instagram ? "- Instagram: " + s.instagram + "\n" : "") +
  (s.facebook ? "- Facebook: " + s.facebook + "\n" : "") +
  (s.tiktok ? "- TikTok: " + s.tiktok + "\n" : "")
);

// A contact channel for a security researcher, per RFC 9116. Expires a year
// out — a stale, long-past-expiry security.txt is treated as absent by tools
// that check it, so this needs the build to naturally refresh the date on
// every deploy rather than picking one once and forgetting it.
const securityExpires = new Date();
securityExpires.setUTCFullYear(securityExpires.getUTCFullYear() + 1);
writeFile(".well-known/security.txt",
  "Contact: mailto:" + s.email + "\n" +
  "Expires: " + securityExpires.toISOString() + "\n" +
  "Canonical: " + SITE_URL + "/.well-known/security.txt\n"
);

/* --- report ------------------------------------------------------------ */

const st = model.stats;
console.log("\nBuilt:");
console.log("  " + pagesWritten.length + " pages" +
  "  (home, contact, 404, sale, " + model.categories.length + " category, " +
  model.products.length + " product)");
console.log("  " + st.subcategories + " subcategories, " + st.products + " live products" +
  (st.hidden ? ", " + st.hidden + " hidden by the admin" : ""));
console.log("  " + st.saleProducts + " product(s) on sale" +
  (st.saleProducts ? " across " + model.saleCategories.length + " categor" +
    (model.saleCategories.length === 1 ? "y" : "ies") : " — the Sale tab is hidden"));
console.log("  " + urls.length + " urls in sitemap.xml");
if (redirectLines.length) console.log("  " + redirectLines.length + " lines in _redirects");
console.log("  " + model.products.length + " products in product-feed.csv");

if (st.warnings) {
  console.log("\n" + st.warnings + " content warning(s) above — the build still succeeded.");
  console.log("They are safe to ignore while the catalogue is being filled in.");
}
console.log("\nOutput: dist/  (serve it with `npm start`)");
