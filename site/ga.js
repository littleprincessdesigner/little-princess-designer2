/**
 * The Google Analytics setup, moved out of an inline <script> in the page head
 * and served from this site instead. The enforced Content-Security-Policy in
 * netlify.toml keeps script-src at 'self' plus the gtag loader, with no
 * 'unsafe-inline', so an inline setup block would be refused by the browser and
 * analytics would silently stop recording. The contents below are the gtag
 * boilerplate verbatim; the loader tag that defines gtag.js is emitted by
 * tools/render.js immediately above the <script src="/ga.js"> tag, so the
 * ordering the boilerplate expects still holds.
 */
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-K0TV7SBWFP');
