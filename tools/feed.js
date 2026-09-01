/**
 * The Google Merchant Center product feed — a CSV built fresh on every
 * build from the same product model the shop pages come from, so it can
 * never drift out of sync the way a hand-maintained spreadsheet would.
 *
 * Published at SITE_URL + "/product-feed.csv" (see tools/build.js), so
 * Merchant Center's "scheduled fetch" can pull it on its own schedule —
 * no spreadsheet to re-upload, no API credentials to manage.
 */

"use strict";

/** Google's required column names, in the order Merchant Center expects. */
const COLUMNS = [
  "id", "title", "description", "link", "image_link",
  "availability", "price", "brand", "condition", "identifier_exists"
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

function productRow(p, siteUrl) {
  const description = stripHtml([p.description, p.description2].filter(Boolean).join(" "));
  const image = p.images[0] ? p.images[0].src : "";
  return {
    id: p.id,
    title: p.name,
    description,
    link: siteUrl + p.href,
    image_link: image,
    availability: p.badge === "Sold out" ? "out_of_stock" : "in_stock",
    price: p.minPrice + " PKR",
    brand: "Little Princess Designer",
    condition: "new",
    identifier_exists: "no"
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
