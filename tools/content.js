/**
 * Reads everything under content/ and turns it into one normalised model that
 * both the JSON emitter and the page renderer consume.
 *
 * Rules applied here (so neither the site nor the CMS has to care):
 *   - an image is `url` if set, else `upload`, else null (empty frame renders)
 *   - a product's blank description / spec fields inherit from its subcategory
 *   - `visible: false` products are dropped entirely — they never reach the site
 *   - products pointing at a deleted subcategory are dropped with a warning,
 *     so removing a subcategory can never take the whole build down
 */

const fs = require("fs");
const path = require("path");
const images = require("./images");
const { parseYaml } = require("./yaml");

const ROOT = path.join(__dirname, "..");
const CONTENT = path.join(ROOT, "content");

const CONFIG = path.join(ROOT, "site", "admin", "config.yml");

/**
 * How many age bands the admin is expected to offer.
 *
 * A tripwire, not a limit. The size list below is read out of config.yml, and
 * a reader that quietly returned the wrong thing — one entry, or none — would
 * strip prices from the whole site rather than fail. Changing the bands is
 * meant to be two edits: the dropdown in config.yml, and this number.
 */
const EXPECTED_SIZE_COUNT = 5;

/**
 * The canonical size vocabulary, read out of the admin's own dropdown so the
 * two cannot drift apart. It drives price-row validation, age-order sorting
 * and the shop filter chips; a size offered in the admin but missing here has
 * its prices silently discarded and can take a whole product off the site.
 *
 * Every failure here is fatal on purpose. Falling through to [] would build a
 * site with no prices on it, which looks like a content problem and is not.
 */
function readSizes() {
  const where = "site/admin/config.yml (products → Sizes and prices → Size → options)";
  const fail = why => {
    throw new Error(
      "Cannot read the size list from " + where + ": " + why + ".\n" +
      "  Every price row on the site is checked against this list, so building with\n" +
      "  the wrong one would strip prices site-wide. Fix the dropdown, or update\n" +
      "  EXPECTED_SIZE_COUNT in tools/content.js if the age bands really did change."
    );
  };

  const config = parseYaml(fs.readFileSync(CONFIG, "utf8"));
  const products = (config.collections || []).find(c => c.name === "products");
  if (!products) fail("no 'products' collection");

  const priceRows = (products.fields || []).find(f => f.name === "sizes");
  if (!priceRows) fail("the products collection has no 'sizes' field");

  const size = (priceRows.fields || []).find(f => f.name === "size");
  if (!size) fail("'sizes' has no 'size' field");

  if (!Array.isArray(size.options)) {
    fail("'options' is " + (size.options === undefined ? "missing" : "not a list"));
  }

  // Decap selects take either a bare string or {label, value}; the size list
  // uses bare strings today, and either reads the same from here.
  const list = size.options
    .map(o => (o && typeof o === "object" ? o.value : o))
    .filter(v => typeof v === "string" && v.trim());

  if (!list.length) fail("the option list is empty");
  if (list.length !== EXPECTED_SIZE_COUNT) {
    fail("it has " + list.length + " entries, not the expected " + EXPECTED_SIZE_COUNT);
  }
  return list;
}

const SIZES = readSizes();

/** Tab order across nav, footer and the "Get yours now" grid. */
const CATEGORY_ORDER = ["girls", "boys", "babies", "ready"];

const warnings = [];
// Silenced by load({ quiet: true }) so the test run reads as its own output
// rather than the site's content warnings.
let quiet = false;
const warn = msg => {
  warnings.push(msg);
  if (!quiet) console.warn("  warn: " + msg);
};

function readJson(file, { required = true } = {}) {
  if (!fs.existsSync(file)) {
    if (required) throw new Error("Missing required content file: " + path.relative(ROOT, file));
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error("Invalid JSON in " + path.relative(ROOT, file) + " — " + err.message);
  }
}

function readDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => ({ slug: f.replace(/\.json$/, ""), data: readJson(path.join(dir, f)) }));
}

/** True for addresses that already point somewhere on their own. */
const isAbsoluteSrc = src => /^(https?:)?\/\//i.test(src) || /^data:/i.test(src);

/**
 * An image address is either absolute — ImageKit and anything else pasted in
 * full — or a path on this site, which must start with "/". A value with
 * neither resolves against whatever page it happens to land on, and gets the
 * site origin glued straight onto it when building share tags. Force it
 * root-relative and say so: a visible 404 beats a silently malformed URL.
 */
function normaliseSrc(src) {
  if (isAbsoluteSrc(src) || src.startsWith("/")) return src;
  warn('image address "' + src + '" has no https:// and no leading "/" — ' +
       'treating it as "/' + src + '", which will not load. Paste the full ' +
       "address, or start it with a slash if it is a file on this site.");
  return "/" + src;
}

/** An image entry is `{url, upload, alt}`; a pasted URL wins over an upload. */
function resolveImage(img, fallbackAlt) {
  if (!img) return null;
  const src = (img.url || "").trim() || (img.upload || "").trim();
  if (!src) return null;
  return { src: normaliseSrc(src), alt: (img.alt || "").trim() || fallbackAlt || "" };
}

function resolveImages(list, fallbackAlt) {
  return (Array.isArray(list) ? list : [])
    .map(i => resolveImage(i, fallbackAlt))
    .filter(Boolean);
}

const nonEmpty = (...vals) => {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
};

/* --- site settings ------------------------------------------------------- */

/**
 * Site Settings is three files rather than one, because it is three jobs: the
 * shop's contact details, the wording every product falls back on, and
 * everything about the site itself. Decap shows one page per file, so an editor
 * changing a phone number is not scrolling past the hero headlines to find it.
 *
 * The rest of the build sees one settings object, exactly as it did when there
 * was one file — the split is an admin-side arrangement and nothing downstream
 * should have to know about it.
 *
 * Only the first file is required. A directory holding just settings.json still
 * loads, which is what tools/fixtures/content relies on, and what the site
 * itself would fall back to if a file were ever lost.
 */
const SETTINGS_FILES = ["settings.json", "settings-contact.json", "settings-products.json"];

function readSettings(dir) {
  const merged = {};
  const from = new Map();
  for (const file of SETTINGS_FILES) {
    const part = readJson(path.join(dir, file), { required: file === SETTINGS_FILES[0] });
    if (!part) continue;
    for (const [key, value] of Object.entries(part)) {
      // The same setting in two files is a split that has gone wrong: one of
      // the two pages in the admin is then editing a value the site ignores,
      // with nothing on screen to say so.
      if (from.has(key)) {
        warn('"' + key + '" is set in both content/' + from.get(key) + " and content/" + file +
             " — the site uses the one in content/" + file + ". Remove it from the other file, " +
             "and check site/admin/config.yml only declares it on one page");
      }
      from.set(key, file);
      merged[key] = value;
    }
  }
  return merged;
}

/* --- the home carousel --------------------------------------------------- */

/**
 * How many faces the ring spins when Site Settings does not say. Ten, because
 * that is how many the cylinder was drawn around — far fewer makes each face
 * wide and the ring sparse, far more makes them slivers.
 */
const CAROUSEL_SLOTS_DEFAULT = 10;

/** The range the ring still looks like a ring in. Anything outside is clamped. */
const CAROUSEL_SLOTS_MIN = 3;
const CAROUSEL_SLOTS_MAX = 20;

/** A pick can be the slug on its own, or an object holding it — accept both. */
function pickSlug(entry) {
  if (typeof entry === "string") return entry.trim();
  if (entry && typeof entry === "object") {
    return String(entry.product || entry.slug || entry.id || "").trim();
  }
  return "";
}

/**
 * How many faces to spin. Set in Site Settings; anything unreadable or outside
 * the range the ring survives is clamped and said out loud rather than
 * silently corrected, because a number typed into the admin that does nothing
 * looks like the setting is broken.
 */
function carouselSlots(settings) {
  const raw = settings.carouselSlots;
  if (raw === undefined || raw === null || raw === "") return CAROUSEL_SLOTS_DEFAULT;

  const n = Number(raw);
  if (!Number.isFinite(n)) {
    warn('the carousel slot count in Site Settings is "' + raw + '", which is not a number — ' +
         "using " + CAROUSEL_SLOTS_DEFAULT);
    return CAROUSEL_SLOTS_DEFAULT;
  }
  const clamped = Math.min(CAROUSEL_SLOTS_MAX, Math.max(CAROUSEL_SLOTS_MIN, Math.round(n)));
  if (clamped !== Math.round(n)) {
    warn("the carousel is set to " + Math.round(n) + " slots, which is outside " +
         CAROUSEL_SLOTS_MIN + "–" + CAROUSEL_SLOTS_MAX + " — using " + clamped + " instead");
  }
  return clamped;
}

/**
 * Which pieces spin in the home carousel.
 *
 * Two ways to fill it, both set in Site Settings:
 *   - "latest" (the default): the newest pieces, so new work reaches the home
 *     page with nobody having to maintain a list;
 *   - "chosen": exactly the pieces picked in the admin, in the order picked.
 *
 * Everything that can go wrong with a hand-picked list — a piece since hidden,
 * deleted or renamed, the same piece twice, an empty list, fewer picks than
 * slots — leaves the ring turning and says what happened, because the home page
 * losing its carousel is not a fair price for a stale pick.
 *
 * Exported so tools/test.js can put settings in front of it directly; the site
 * only ever reaches it through load().
 */
function chooseCarousel(settings, products) {
  const slots = carouselSlots(settings);
  const newest = [...products]
    .sort((a, b) => b.addedOn - a.addedOn || a.name.localeCompare(b.name));

  const mode = String(settings.carouselMode || "latest").trim() || "latest";
  if (mode !== "latest" && mode !== "chosen") {
    warn('Site Settings asks the carousel to be filled by "' + mode + '", which is not ' +
         "something this site knows how to do — showing the newest pieces instead");
    return newest.slice(0, slots);
  }
  if (mode === "latest") return newest.slice(0, slots);

  const byId = new Map(products.map(p => [p.id, p]));
  const chosen = [];
  const seen = new Set();
  for (const entry of Array.isArray(settings.carouselProducts) ? settings.carouselProducts : []) {
    const slug = pickSlug(entry);
    if (!slug) continue;
    const product = byId.get(slug);
    if (!product) {
      // Hidden, deleted, or renamed: renaming a product changes its address,
      // and the pick stores the address. All three read the same from here.
      warn('the carousel is set to show "' + slug + '", which is not a piece on the site — ' +
           "it may have been hidden, deleted or renamed. That slot is skipped; " +
           "pick it again in Site Settings → Pieces in the carousel");
      continue;
    }
    if (seen.has(slug)) {
      warn('"' + product.name + '" is in the carousel list twice — it spins once');
      continue;
    }
    seen.add(slug);
    chosen.push(product);
  }

  if (!chosen.length) {
    warn("the carousel is set to show chosen pieces, but no piece on the site is chosen — " +
         "showing the newest instead. Pick pieces in Site Settings → Pieces in the carousel, " +
         'or set "How the carousel is filled" back to the newest pieces');
    return newest.slice(0, slots);
  }
  if (chosen.length < slots) {
    warn("the carousel has " + slots + " slots but only " + chosen.length +
         " piece(s) chosen — the ring spins " + chosen.length + ". Pick more pieces, " +
         "or lower the slot count in Site Settings");
  }
  return chosen.slice(0, slots);
}

/**
 * Reads a content directory into the model.
 *
 * `dir` exists for tools/test.js, which runs this over small fixture
 * directories; the site always uses the default. `quiet` keeps those runs from
 * printing the warnings they are asserting on.
 */
function load({ dir = CONTENT, quiet: silent = false } = {}) {
  quiet = silent;
  // Reset rather than append: a second load() in the same process — which is
  // what the tests do — would otherwise inherit the first one's warnings.
  warnings.length = 0;

  const settings = readSettings(dir);

  // The CMS stores every photo as {url, upload, alt}; the renderer wants {src,
  // alt}. Products and category cards are converted further down — these two
  // are the settings-level photos, and they render as an empty <img> until
  // they go through the same step.
  if (settings.about) {
    settings.about.photo = resolveImage(settings.about.photo, settings.about.heading);
  }

  const categories = CATEGORY_ORDER.map(key => {
    const c = readJson(path.join(dir, "categories", key + ".json"));
    return Object.assign({}, c, {
      key,
      href: "/" + key + "/",
      card: Object.assign({}, c.card, {
        image: resolveImage(c.card && c.card.image, c.card && c.card.alt)
      }),
      subcategories: []
    });
  });
  const byKey = Object.fromEntries(categories.map(c => [c.key, c]));

  // --- subcategories ------------------------------------------------------
  const subs = [];
  for (const { slug, data } of readDir(path.join(dir, "subcategories"))) {
    const id = (data.id || slug).trim();
    if (!byKey[data.parent]) {
      warn('subcategory "' + id + '" has parent "' + data.parent + '", which is not a category — skipped');
      continue;
    }
    const sub = {
      id,
      parent: data.parent,
      name: nonEmpty(data.name, id),
      order: Number(data.order ?? 100),
      defaultDescription: data.defaultDescription || "",
      defaultDescription2: data.defaultDescription2 || "",
      defaultSpecs: data.defaultSpecs || {},
      products: []
    };
    subs.push(sub);
    byKey[data.parent].subcategories.push(sub);
  }
  for (const c of categories) c.subcategories.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  // Two subcategories sharing an id is silent damage, and the id is a free-text
  // field in the admin so one mistyped character does it. The lookup below is
  // last-one-wins, so every product pointing at that id is pulled out of the
  // first subcategory and into the second — the first then renders as empty
  // while its products appear under the wrong heading, and both emit the same
  // anchor. This is exactly what happened to boys "b2".
  const seenId = new Map();
  for (const s of subs) {
    const clash = seenId.get(s.id);
    if (clash) {
      warn('subcategory "' + s.name + '" uses the id "' + s.id + '", but subcategory "' +
        clash.name + '" already uses that id — one of them will show no products ' +
        'until you give it an id of its own');
    } else {
      seenId.set(s.id, s);
    }
  }

  const subById = Object.fromEntries(subs.map(s => [s.id, s]));

  // --- products -----------------------------------------------------------
  // The last rung of the wording cascade, editable in Site Settings. Missing
  // altogether is fine — every field falls back to "" exactly as it did before
  // this level existed.
  const siteDefaults = settings.productDefaults || {};
  const siteSpecs = siteDefaults.specs || {};

  const products = [];
  const noPhoto = [];
  let hiddenCount = 0;
  for (const { slug, data } of readDir(path.join(dir, "products"))) {
    const name = nonEmpty(data.name, slug);

    if (data.visible === false) { hiddenCount++; continue; }

    const sub = subById[data.subcategory];
    if (!sub) {
      warn('product "' + name + '" points at subcategory "' + data.subcategory +
           '", which no longer exists — hidden from the site until you reassign it');
      continue;
    }

    const sizes = (Array.isArray(data.sizes) ? data.sizes : [])
      .filter(s => s && s.available !== false)
      .map(s => ({
        size: String(s.size || "").trim(),
        price: Number(s.price),
        salePrice: Number(s.salePrice)
      }))
      .filter(s => {
        if (!SIZES.includes(s.size)) {
          warn('product "' + name + '" has unknown size "' + s.size + '" — that row is ignored');
          return false;
        }
        if (!Number.isFinite(s.price) || s.price <= 0) {
          warn('product "' + name + '" has no valid price for ' + s.size + ' — that row is ignored');
          return false;
        }
        return true;
      })
      // A sale row carries what the customer pays as `price`, so everything
      // downstream — the totals, the filters, the "from PKR" line, the price in
      // the WhatsApp message, the price search engines are shown — is the real
      // one without having to know a sale is on. `wasPrice` is the crossed-out
      // original, and is null on anything not discounted.
      .map(s => {
        const onSale = Number.isFinite(s.salePrice) && s.salePrice > 0 && s.salePrice < s.price;
        if (Number.isFinite(s.salePrice) && s.salePrice > 0 && !onSale) {
          warn('product "' + name + '" has a sale price for ' + s.size + ' that is not below the ' +
               'normal price (' + s.salePrice + ' vs ' + s.price + ') — the sale price is ignored');
        }
        return {
          size: s.size,
          price: onSale ? s.salePrice : s.price,
          wasPrice: onSale ? s.price : null
        };
      })
      .sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size));

    if (!sizes.length) {
      warn('product "' + name + '" has no size with a price — hidden from the site');
      continue;
    }

    // The badge and the sale prices are set in two different places on the
    // form, so it is easy to do one and forget the other. Neither half is
    // wrong on its own — a sale can be marked before it is priced, and a
    // quiet discount is a fair thing to want — but a "Sale" badge over
    // undiscounted prices is the one combination that misleads a customer.
    if (nonEmpty(data.badge) === "Sale" && !sizes.some(s => s.wasPrice)) {
      warn('product "' + name + '" is badged "Sale" but no size has a sale price — ' +
           'customers see the badge and the usual price');
    }

    const specsIn = data.specs || {};
    const specsDefault = sub.defaultSpecs || {};
    const images = resolveImages(data.images, name);

    const product = {
      id: slug,
      name,
      href: "/product/" + slug + "/",
      subcategory: sub.id,
      subcategoryName: sub.name,
      tab: sub.parent,
      tabLabel: byKey[sub.parent].label,
      badge: nonEmpty(data.badge),
      // Milliseconds, for sorting. Anything unparseable — a hand-edited file,
      // or a piece from before the field existed — sorts to the bottom rather
      // than to 1970-adjacent nonsense or NaN.
      addedOn: Date.parse(data.addedOn) || 0,
      sizes,
      minPrice: Math.min(...sizes.map(s => s.price)),
      // Absent counts as on, so every piece saved before this field existed
      // keeps offering the accessory exactly as it did.
      showAccessory: data.showAccessory !== false,
      accessoryPrice: Number(
        Number.isFinite(Number(data.accessoryPrice)) && Number(data.accessoryPrice) > 0
          ? data.accessoryPrice
          : settings.accessoryPriceDefault || 0
      ),
      // product → subcategory → site default. The third step exists so no
      // wording can resolve empty: leaving a piece and its subcategory both
      // blank is two clicks in the admin, and an empty description takes the
      // page summary with it.
      description: nonEmpty(data.description, sub.defaultDescription, siteDefaults.description),
      description2: nonEmpty(data.description2, sub.defaultDescription2, siteDefaults.description2),
      specs: {
        fabric: nonEmpty(specsIn.fabric, specsDefault.fabric, siteSpecs.fabric),
        occasion: nonEmpty(specsIn.occasion, specsDefault.occasion, siteSpecs.occasion),
        fit: nonEmpty(specsIn.fit, specsDefault.fit, siteSpecs.fit),
        care: nonEmpty(specsIn.care, specsDefault.care, siteSpecs.care)
      },
      images
    };

    if (!images.length) noPhoto.push(name);

    products.push(product);
    sub.products.push(product);
  }

  for (const s of subs) {
    // Newest first. `order` used to decide this and is gone from products; the
    // dates it was converted into reproduce exactly the sequence it gave.
    // Subcategories keep their own `order` — that is a layout choice, not a
    // recency one.
    s.products.sort((a, b) => b.addedOn - a.addedOn || a.name.localeCompare(b.name));
    if (!s.products.length) warn('subcategory "' + s.name + '" (' + s.id + ') has no visible products');
  }

  // A product's first photo becomes its link preview. WhatsApp and Facebook do
  // not render WebP previews, so those links share as bare text — which is
  // invisible from the admin and easy to leave broken for months.
  // Photos on a host that builds us a JPEG copy at preview size are exempt:
  // their original format never reaches WhatsApp. images.js knows which hosts
  // those are.
  const webpFirst = products
    .filter(p => p.images.length &&
      /\.webp(\?|$)/i.test(p.images[0].src) &&
      !images.preview(p.images[0].src))
    .map(p => p.name);
  if (webpFirst.length) {
    warn(webpFirst.length + " product(s) have a WebP first photo, which WhatsApp and " +
      "Facebook will not show when the link is shared: " +
      webpFirst.slice(0, 5).join(", ") + (webpFirst.length > 5 ? ", …" : "") +
      ". Use a JPEG or PNG for the first photo — photos uploaded to ImageKit are " +
      "converted for sharing automatically.");
  }

  // One line rather than one per product — with an empty catalogue this would
  // otherwise bury the warnings that actually need acting on.
  if (noPhoto.length) {
    warn(noPhoto.length + " product(s) have no photo yet and show an empty frame: " +
      noPhoto.slice(0, 5).join(", ") + (noPhoto.length > 5 ? ", …" : ""));
  }

  return {
    settings,
    sizes: SIZES,
    // Which pieces spin on the home page. Decided here rather than in the
    // renderer because it is a content rule — it reads Site Settings and the
    // catalogue, and every warning it raises belongs with the other content
    // warnings the build prints.
    carousel: chooseCarousel(settings, products),
    // A copy: the module-level list is cleared by the next load(), and callers
    // that hold the model should not have it emptied underneath them.
    warnings: warnings.slice(),
    categories,
    subcategories: subs,
    products,
    stats: {
      products: products.length,
      hidden: hiddenCount,
      subcategories: subs.length,
      warnings: warnings.length
    }
  };
}

module.exports = { load, SIZES, CATEGORY_ORDER, readSettings, chooseCarousel, warnings };
