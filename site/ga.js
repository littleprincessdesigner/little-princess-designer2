/**
 * The Google Analytics setup, moved out of an inline <script> in the page head
 * and served from this site instead. The enforced Content-Security-Policy in
 * netlify.toml keeps script-src at 'self' plus the gtag loader, with no
 * 'unsafe-inline', so an inline setup block would be refused by the browser and
 * analytics would silently stop recording. The contents below are the gtag
 * boilerplate verbatim. tools/render.js emits the gtag.js loader tag just
 * above the <script defer src="/ga.js"> tag, but the loader is `async` and
 * this file is `defer`, so the two can execute in either order — and GA
 * tolerates that. gtag.js primes window.dataLayer and replaces
 * dataLayer.push with its own processor, so the gtag('js') / gtag('config')
 * calls below are consumed whichever script runs first, and `function
 * gtag(){}` is a global function declaration either way.
 */
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-K0TV7SBWFP');
