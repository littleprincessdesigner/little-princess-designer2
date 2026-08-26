#!/usr/bin/env node
/**
 * Tells Bing and Yandex about every URL in the sitemap the moment a deploy
 * finishes, instead of waiting for them to crawl and notice on their own —
 * IndexNow (https://www.indexnow.org) is a free, no-signup protocol both
 * search engines support: publish a key file, then POST the URL list and the
 * key that proves you control the site.
 *
 * The key is a fixed value rather than one generated per build. IndexNow
 * checks the submitted key against the key file actually published on the
 * site, so a key that changes every deploy would only ever match the build
 * that generated it — every submission is verified against whatever is live
 * *right now*, not against history, so one fixed key works for every future
 * submission too.
 *
 * Follows the same shape as warm-previews.js: reads what it needs out of
 * dist/ after the real build has already written it, skips itself off
 * Netlify (nothing to tell Bing about from a laptop), and can never fail the
 * build — an IndexNow submission that doesn't happen costs nothing beyond
 * Bing/Yandex finding the change on their own schedule instead of instantly,
 * which is exactly where the site was before this file existed.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const DIST = path.join(__dirname, "..", "dist");
const KEY = "46f96200ec9e6ac548c26a30f685e9d7";
const TIMEOUT_MS = 10000;

/** Every <loc> in the built sitemap, in document order. */
function readSitemapUrls() {
  const file = path.join(DIST, "sitemap.xml");
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}

function post(url, body) {
  return new Promise((resolve) => {
    const started = Date.now();
    const payload = JSON.stringify(body);
    const req = https.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload) }
    }, (res) => {
      res.resume();
      res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, ms: Date.now() - started }));
    });
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      resolve({ ok: false, status: "timeout", ms: Date.now() - started });
    });
    req.on("error", (err) => resolve({ ok: false, status: err.code || err.message, ms: Date.now() - started }));
    req.write(payload);
    req.end();
  });
}

async function main() {
  const urls = readSitemapUrls();
  if (!urls.length) {
    console.log("\nIndexNow: no dist/sitemap.xml to read — skipped.");
    return;
  }

  // The key file itself is written unconditionally — it costs nothing to
  // publish and a search engine may check it independently of any push this
  // script makes. Written into dist/ directly since build.js has already run
  // by the time this file executes (see the npm run build chain).
  fs.writeFileSync(path.join(DIST, KEY + ".txt"), KEY + "\n");

  const host = new URL(urls[0]).host;

  const forced = process.argv.includes("--force");
  if (!process.env.NETLIFY && !forced) {
    console.log("\nIndexNow: key file written, " + urls.length + " url(s) ready — submission skipped off Netlify.");
    console.log("  (run `node tools/indexnow.js --force` to submit from here)");
    return;
  }

  console.log("\nIndexNow: submitting " + urls.length + " url(s) for " + host + "…");
  const r = await post("https://api.indexnow.org/indexnow", {
    host,
    key: KEY,
    keyLocation: "https://" + host + "/" + KEY + ".txt",
    urlList: urls
  });

  if (r.ok) {
    console.log("  accepted (" + r.status + ", " + r.ms + "ms)");
  } else {
    console.log("  warn: not accepted (" + r.status + ") — this deploy still went out fine, " +
      "Bing/Yandex will just find it on their own schedule instead of instantly");
  }
}

main().catch((err) => {
  // Same rule as warm-previews.js: this is an optimisation, never a reason
  // to fail a deploy.
  console.log("\nIndexNow: skipped (" + (err && err.message) + ")");
});
