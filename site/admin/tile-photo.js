/**
 * Keeps the hidden "tile photo" copy of a product's first Photos row in sync,
 * so the CMS grid/tiles view has something to show.
 *
 * WHY THIS EXISTS
 *
 * The grid view draws its thumbnail from one plain field sitting directly on
 * the entry (config.yml's `thumbnail: image`), and cannot look inside "Photos",
 * which is a list on purpose so a piece can carry more than one picture. The
 * photo rows are also plain address strings now, not picture fields, so nothing
 * there is recognised as an image. Left alone the tiles view would show every
 * product with an empty square.
 *
 * Runs on the CMS `preSave` event — an API Decap defined and Sveltia keeps.
 * Best-effort: if a future Sveltia release changes the event shape, the worst
 * case is a blank tile, and the list view (the primary view) is unaffected.
 *
 * Asking whoever is editing a piece to fill in a second copy of the same
 * photo by hand would fix the empty tile, but it would also be one more thing
 * to remember and one more way for the tile to go stale — get busy, change
 * the real photo, forget the copy, and the tile now shows the wrong piece.
 *
 * So this does the copying instead of the person: every time a product is
 * saved, `preSave` below runs first, reads whichever image is actually first
 * in the Photos list right now, and writes it into the plain "image" field
 * declared in config.yml purely for this. The tiles view reads that field;
 * nothing else does — the real site still reads Photos, exactly as before.
 *
 * WHAT CANNOT GO WRONG
 *
 * The entry being saved is handed back completely untouched — same data, no
 * "image" key added or changed — the moment anything here is not exactly
 * what is expected: no Photos list, no first photo yet, any error at all.
 * The worst this can do is leave a tile blank, which is the state before this
 * file existed.
 */

(function () {
  "use strict";

  if (!window.CMS || !window.CMS.registerEventListener) return;

  /** The same rule tools/content.js and card.js use: a pasted link wins over
   *  a library pick when a Photos row somehow has both. */
  function firstPhotoUrl(images) {
    var list = images && typeof images.toJS === "function" ? images.toJS() : images;
    if (!Array.isArray(list)) return "";
    for (var i = 0; i < list.length; i++) {
      var row = list[i] || {};
      var src = String(row.url || "").trim() || String(row.upload || "").trim();
      if (src) return src;
    }
    return "";
  }

  window.CMS.registerEventListener({
    name: "preSave",
    handler: function (args) {
      var entry = args && args.entry;
      var data = entry && typeof entry.get === "function" ? entry.get("data") : null;

      // Only a product has a "Photos" list shaped this way — subcategories,
      // categories and site settings do not, so this is what tells products
      // apart from every other collection without depending on the entry's
      // own idea of which collection it belongs to.
      if (!data || typeof data.get !== "function") return data;
      var images = data.get("images");
      if (typeof images === "undefined") return data;

      try {
        var cover = firstPhotoUrl(images);
        return cover ? data.set("image", cover) : data;
      } catch (e) {
        if (window.console) console.warn("[lp] tile photo not synced: " + e);
        return data;
      }
    }
  });
})();
