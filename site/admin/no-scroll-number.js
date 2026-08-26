/**
 * Stops the mouse wheel from changing a number field's value.
 *
 * A browser's built-in behaviour for <input type="number"> is to nudge the
 * value up or down whenever the wheel turns while that field is focused. That
 * is convenient for a spinner meant to be scrolled, but every number field in
 * this admin (a price, a sale price, a sort order) is meant to be typed once —
 * so clicking into "Price", typing 18500, and then scrolling the page to see
 * the rest of the form silently changes the number, with nothing on screen to
 * say it happened.
 *
 * The fix is to take focus off the field the instant a wheel event reaches it,
 * before the browser applies its own change — that happens fast enough that
 * the value never moves. Nothing here calls preventDefault(), so the same
 * scroll then carries on and moves the page exactly as it would anywhere else.
 */
(function () {
  "use strict";
  document.addEventListener("wheel", function (e) {
    var el = document.activeElement;
    if (el && el.tagName === "INPUT" && el.type === "number") el.blur();
  }, { passive: true, capture: true });
})();
