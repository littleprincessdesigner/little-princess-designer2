/**
 * The Google Merchant Center product feed — a CSV built fresh on every
 * build from the same product model the shop pages come from, so it can
 * never drift out of sync the way a hand-maintained spreadsheet would.
 *
 * Published at SITE_URL + "/product-feed.csv" (see tools/build.js), so
 * Merchant Center's "scheduled fetch" can pull it on its own schedule —
 * no spreadsheet to re-upload, no API credentials to manage.
 *
 * Column set and order match Google's own product feed template exactly
 * (including its "is bundle" and "max_energy_efficiency" spellings), so a
 * template pasted over this file's output lines up column-for-column.
 * Columns with no honest source on this site — gtin, mpn, size_type,
 * size_system, video_link, virtual_model_link, cost_of_goods_sold,
 * mobile_link, availability_date, expiration_date, sale_price_effective_date,
 * product_highlight, multipack, "is bundle", and the energy/unit-pricing
 * fields (this is handmade clothing, not appliances) — are left blank
 * rather than guessed.
 */

"use strict";

const COLUMNS = [
  "id", "title", "description", "availability", "availability_date", "expiration_date",
  "link", "mobile_link", "image_link", "price", "sale_price", "sale_price_effective_date",
  "identifier_exists", "gtin", "mpn", "brand", "product_highlight", "product_detail",
  "additional_image_link", "condition", "adult", "color", "size", "size_type", "size_system",
  "gender", "material", "pattern", "age_group", "multipack", "is bundle",
  "unit_pricing_measure", "unit_pricing_base_measure", "energy_efficiency_class",
  "min_energy_efficiency_class", "max_energy_efficiency", "item_group_id", "video_link",
  "virtual_model_link", "cost_of_goods_sold"
];

/** RFC 4180: quote a field if it holds a comma, quote or newline; double up internal quotes. */
function csvField(value) {
  const s = String(value == null ? "" : value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Strips markup, in case a description is ever pasted in with some. */
function stripHtml(s) {
  return String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * "girls" → female, "boys" → male; "babies" and "ready-to-wear" carry both
 * — e.g. a "Muhammad Baby Romper" next to a "Pink Fairy Dress" — so neither
 * sex fits and Google's "unisex" is the honest answer, not a guess.
 */
function genderFor(tab) {
  if (tab === "girls") return "female";
  if (tab === "boys") return "male";
  return "unisex";
}

/**
 * Google's age_group bands (newborn/infant/toddler/children/adult) are cut
 * by month and year thresholds that don't line up with this site's sizing,
 * which runs in wide year bands up to "13–16 years". Rather than tag a
 * teen party dress "adult" at the literal 13-year cutoff, every size above
 * the youngest band is called "children" — the closer, more honest fit for
 * kids'/teen clothing. Confirmed with the site owner.
 */
function ageGroupFor(sizeLabel) {
  const years = parseInt(sizeLabel, 10);
  if (!Number.isFinite(years)) return "";
  return years <= 3 ? "toddler" : "children";
}

/**
 * The one size that stands in for the whole product on a single-row feed —
 * the middle of its size run, so the price and age_group Google sees are
 * the product's typical size, not its cheapest/youngest or priciest/oldest
 * extreme. Confirmed with the site owner.
 */
function representativeSize(sizes) {
  return sizes[Math.floor((sizes.length - 1) / 2)];
}

/**
 * Colour and pattern words to look for in a product's title and
 * description. Longest phrases first, so "Bright Blue" matches whole
 * rather than falling through to "Blue". Only used when exactly one
 * distinct word/phrase from the list turns up — several different colours
 * mentioned (e.g. a multi-colour trim called out in the description) is
 * treated as unclear and left blank rather than guessed.
 */
const COLOR_WORDS = [
  "Bright Blue", "Sky Blue", "Navy Blue", "Baby Blue", "Butter Yellow", "Rose Gold",
  "Blush Pink", "Hot Pink", "Deep Purple", "Royal Blue",
  "Red", "Blue", "Pink", "Purple", "Yellow", "Green", "White", "Black", "Gold", "Golden",
  "Silver", "Peach", "Magenta", "Ivory", "Cream", "Maroon", "Navy", "Turquoise", "Lavender",
  "Coral", "Mint", "Fuchsia", "Beige", "Orange", "Brown", "Grey", "Gray", "Teal", "Lilac",
  "Burgundy", "Mustard", "Emerald", "Ruby", "Champagne"
].sort((a, b) => b.length - a.length);

const PATTERN_WORDS = [
  "Polka Dot", "Animal Print", "Floral", "Striped", "Stripes", "Checkered", "Plaid",
  "Gingham", "Camouflage", "Paisley", "Leopard Print", "Star Print"
].sort((a, b) => b.length - a.length);

function findOneKeyword(words, texts) {
  for (const text of texts) {
    if (!text) continue;
    const found = new Set();
    for (const w of words) {
      if (new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(text)) {
        // A shorter word already matched as part of a longer phrase just
        // matched (e.g. "Blue" inside "Bright Blue") doesn't count twice.
        if (![...found].some(f => f.toLowerCase().includes(w.toLowerCase()))) found.add(w);
      }
    }
    if (found.size === 1) return [...found][0];
    if (found.size > 1) return null;
  }
  return null;
}

/** "section:attribute:value" triplets built from whichever specs a product has. */
function productDetail(specs) {
  const parts = [];
  if (specs.occasion) parts.push("Specifications:occasion:" + specs.occasion);
  if (specs.fit) parts.push("Specifications:fit:" + specs.fit);
  if (specs.care) parts.push("Specifications:care:" + specs.care);
  return parts.join(" | ");
}

function productRow(p, siteUrl) {
  const description = stripHtml([p.description, p.description2].filter(Boolean).join(" "));
  const image = p.images[0] ? p.images[0].src : "";
  const additionalImages = p.images.slice(1).map(i => i.src).join(",");
  const size = representativeSize(p.sizes);
  const onSale = Boolean(size.wasPrice);
  const texts = [p.name, description];

  return {
    id: p.id,
    title: p.name,
    description,
    availability: p.badge === "Sold out" ? "out_of_stock" : "in_stock",
    availability_date: "",
    expiration_date: "",
    link: siteUrl + p.href,
    mobile_link: "",
    image_link: image,
    price: (onSale ? size.wasPrice : size.price) + " PKR",
    sale_price: onSale ? size.price + " PKR" : "",
    sale_price_effective_date: "",
    identifier_exists: "no",
    gtin: "",
    mpn: "",
    brand: "Little Princess Designer",
    product_highlight: "",
    product_detail: productDetail(p.specs),
    additional_image_link: additionalImages,
    condition: "new",
    adult: "no",
    color: findOneKeyword(COLOR_WORDS, texts) || "",
    size: size.size,
    size_type: "",
    size_system: "",
    gender: genderFor(p.tab),
    material: p.specs.fabric || "",
    pattern: findOneKeyword(PATTERN_WORDS, texts) || "",
    age_group: ageGroupFor(size.size),
    multipack: "",
    "is bundle": "",
    unit_pricing_measure: "",
    unit_pricing_base_measure: "",
    energy_efficiency_class: "",
    min_energy_efficiency_class: "",
    max_energy_efficiency: "",
    item_group_id: "",
    video_link: "",
    virtual_model_link: "",
    cost_of_goods_sold: ""
  };
}

/** The full feed as CSV text, one row per live product. */
function productFeedCsv(model, siteUrl) {
  const lines = [COLUMNS.join(",")];
  for (const p of model.products) {
    const row = productRow(p, siteUrl);
    lines.push(COLUMNS.map(col => csvField(row[col])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

module.exports = { productFeedCsv, COLUMNS };
