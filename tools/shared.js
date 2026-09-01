/**
 * The few string helpers that both the build AND the browser need, in one
 * place so they cannot drift.
 *
 * `tools/card.js` (the product card and detail block) requires this under Node
 * and reads it off the window in the admin. `site/app.js` reads it off the
 * window on every public page — the price on a card and the pre-filled WhatsApp
 * order message are both rebuilt client-side as the size dropdown changes, and
 * before this file existed that rebuild was a second, hand-kept copy of what
 * `card.js` had already written into the page. Any wording change to the order
 * message meant editing it in two languages with nothing checking they matched;
 * `tools/test.js` now pins `waOrderMessage` instead.
 *
 * Nothing here touches `fs` or the DOM, which is what lets the one file serve
 * both. Same dual export as `tools/images.js` / `tools/card.js`, and the same
 * reason the global is named `LPShared` rather than something plain: loaded as
 * ordinary <script> tags these files share one top-level scope, so a `const` of
 * the same name in two of them is a redeclaration error that kills whichever
 * loads second.
 */

"use strict";

/** A price, formatted the one way the whole site formats prices. */
const money = n => "PKR " + Number(n).toLocaleString("en-US");

/**
 * A wa.me link, digits only, with an optional pre-filled message. Running it
 * over a number that already has spaces or a leading + is fine — everything
 * outside 0-9 is stripped.
 */
const waLink = (num, text) =>
  "https://wa.me/" + String(num).replace(/[^0-9]/g, "") +
  (text ? "?text=" + encodeURIComponent(text) : "");

/**
 * The message a customer sends to order a piece. Built here for the initial
 * link `card.js` writes into the product page, and rebuilt with the same text
 * by `app.js` when the size or the matching-accessory tick-box changes.
 */
const waOrderMessage = ({ url, name, size, accessory, accessoryPrice, total }) =>
  (url ? url + "\n" : "") +
  "Hello Little Princess Designer, I'd like to order:\n" + name +
  "\nSize: " + size +
  "\nMatching accessory: " + (accessory ? "yes (" + money(accessoryPrice) + ")" : "no") +
  "\nTotal shown: " + money(total);

const SHARED_API = { money, waLink, waOrderMessage };

if (typeof module === "object" && module.exports) {
  module.exports = SHARED_API;
} else {
  (typeof globalThis !== "undefined" ? globalThis : self).LPShared = SHARED_API;
}
