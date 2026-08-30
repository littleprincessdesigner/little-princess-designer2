# Content Quality & E-E-A-T Findings — littleprincessdesigner.pk

Audit date: 2026-08-26
Score: **38 / 100**

## Plain-language summary

The site's *foundation* is better than most small handmade shops: it has real
structured data (schema), an honest three-step ordering process, a founding
story ("since 2015"), live social links, and an FAQ that actually answers the
questions a parent would ask (sizing, delivery, timelines). That's a genuine
head start.

But the actual words on most product pages aren't real content — they're a
fallback. Out of 76 product listings in the repo (64 currently live), **70 have
no description of their own at all**. When a product's own description field
is empty, the site fills the gap with a **canned paragraph that belongs to the
product's subcategory**, not the product. That single subcategory paragraph is
reused, word-for-word, on every product in that group — and one subcategory
("Luxury dresses," under Girls) holds 35 of the 76 products, so more than a
third of the entire catalogue can show the exact same "Product description"
text on different pages. That's duplicate content, and it's also a factual
accuracy problem: a boys' three-piece suit ("rameen miral dress," the internal
name for `prince-arthur-suit`) is filed under the *girls* Luxury-dresses
subcategory, so its inherited spec block claims a "boned waistband" for "a long
evening" and lists "flower-girl duties" as an occasion — none of which describes
a boy's suit. This is the same miscategorization bug already flagged in this
repo's own handoff notes for three other boys' pieces filed under Girls.

Two more things stand out. First, several product pages show names that read
like internal shorthand rather than product names a shopper or an AI answer
engine could cite cleanly — "ppl," "girrafe," "KS shoot dress," "huda dress
pink," "rameen miral dress." These look like a customer's first name or a
placeholder that was never renamed before publishing. Second, there is **no
return/exchange policy, no privacy policy, no terms of service, and no
reviews or testimonials anywhere on the site** — for an e-commerce store
taking upfront payment, that is the single biggest trust gap.

None of this needs a rewrite of the site's design or code — it's a content
job: write real, specific descriptions for the pieces that don't have one, fix
the boys-under-girls filing, rename the odd-sounding products, and add the
policy pages. The tone and quality of the writing that *does* exist (the
subcategory default paragraphs, and the six products with their own copy) is
genuinely good — specific, sensory, human-sounding, not generic AI filler. The
problem is coverage and reuse, not writing quality.

---

## 1. Site size and crawl scope

| Metric | Value |
|---|---|
| URLs in live sitemap | 70 (1 home, 1 contact, 4 category, 64 product) |
| Product files in repo (`content/products/*.json`) | 76 |
| Products in repo but not yet live | 14 — `blue-horizon-dress`, `dados-lil-man-romper`, `elephant`, `first-tooth-boy-outfit-knickers`, `first-tooth-outfit-dark-blue`, `first-tooth-romper`, `girrafe`, `half-birthday-romper`, `handcuffs-and-headband`, `huntrix-performance-dress`, `masha-and-the-bear-dress`, `welcome-home-daddy-romperr`, `yellow-beaded-tiara`, `ziva-dress` (consistent with the deploy-lag issue `schema.md` already flags) |
| Live product with no matching repo file | `peach-popper-shirt` — deleted from the repo (`git log`: commit `82ed24f "Delete Product 'peach-popper-shirt'"`) but still serving live at `/product/peach-popper-shirt/`. A discontinued product's page is still indexable and citable. |
| No dedicated About page, category pages beyond the top-level 4, or blog | Confirmed — `/about`, `/story`, `/shop` all return this site's 404 page |

This is a genuinely small catalog. That's not automatically a problem —
Google does not use word/page count as a ranking factor — but it does mean
there's very little topical surface area to begin with, so thin or duplicated
copy on 92% of it (see below) proportionally matters more than it would on a
large site.

## 2. Word counts vs. content minimums

| Page type | Minimum | Measured | Verdict |
|---|---|---|---|
| Homepage | 500 words | ~377 words (all copy, excl. nav/footer boilerplate) | Below floor. The page leans on visuals (sketch → colour → real-photo sequence, carousel) rather than text; that's a legitimate design choice, but the "About us" section that would normally carry the words is a 3-paragraph, ~110-word snippet, not a full story |
| Service/product page | 800 words (service) / 300–400+ (product) | Typically 150–220 words per product page (name, price table, one description paragraph, one follow-up paragraph, a 4-row spec list) | Meets the product-page floor on pages served by the subcategory fallback; falls short of "comprehensive coverage" in spirit since the same paragraph appears on many pages |
| Category page (`/girls/`, `/boys/`, `/babies/`, `/ready/`) | 500–600 words (treated as location/collection page) | ~60–80 words of unique copy per category, then the product grid | Below floor — categories carry almost no unique topical text of their own |
| Contact page | N/A (informational) | ~395 words, including 4 FAQs | Adequate for its purpose |

No page on the site reaches blog-post length because there is no blog or
buying-guide content (sizing charts, care guides, "how measurements work,"
fabric guides) — a missed opportunity for a made-to-order business, where
that kind of content is both genuinely useful to a first-time buyer and easy
to make unique per page.

## 3. Duplicate / near-duplicate content risk — High

**Root cause:** every product's `description`, `description2`, and `specs`
fields are optional. When empty, `content/subcategories/<slug>.json` supplies
a `defaultDescription`, `defaultDescription2`, and `defaultSpecs` block that
is rendered identically for every product in that subcategory.

| Finding | Detail |
|---|---|
| Products with an empty `description` field | 70 / 76 (92%) |
| Products with an empty `specs` block (all four sub-fields blank) | 76 / 76 (100%) — every single product relies on the subcategory default for fabric/occasion/fit/care |
| Largest shared-text group | `girls-luxury-dresses` — 35 products (46% of the catalog) can render the identical description + spec paragraph |
| Verified live duplicate | `/product/king-crown-prince-dress/` and `/product/king-crown-prince-dress-1/` ("brown") are colour variants of the same design. Both render **word-for-word identical** "Product description" and spec text — a textbook near-duplicate pair, both indexable, both in the sitemap |
| Verified miscategorization → factual inaccuracy | `content/products/prince-arthur-suit.json` (displayed name "rameen miral dress") has `"subcategory": "girls-luxury-dresses"`. It inherits that subcategory's default specs verbatim: *"Boned waistband holds the shape through a long evening"* and *"Occasion: Weddings, mehndi and walima, **flower-girl duties**"* — displayed on a page for a boys' three-piece prince suit. This is the same class of bug the repo's own `handoff.md` already names for three other boys' pieces filed under Girls → Luxury dresses |

This matters for two separate reasons: (1) Google can treat highly similar
pages as duplicate content and choose only one to rank, diluting the other;
(2) an AI answer engine quoting the "Occasion" or "Fit" line for the wrong
product is citing something false, which is precisely what the Sept 2025 QRG
flags as a low-quality/AI-content-risk marker, even though this text was not
generated by an LLM — it's a templating bug with the same symptom.

## 4. Product naming — Medium/High

Several live, indexable product pages use an H1/title that reads as internal
shorthand rather than a real product name:

| URL slug | Displayed name |
|---|---|
| `/product/aurora-theme-dress/` | "huda dress pink" |
| `/product/naming-day-gift-set/` | "ppl" |
| `/product/prince-arthur-suit/` | "rameen miral dress" |
| `/product/prince-zain-coat-suit/` | "KS shoot dress" |
| `/product/blossom-birthday-theme-dress/` | "amna dress pink" |
| `/product/clara-walima-gown/` | "amna dress purple" |
| `/product/blue-cloud-baby-shirt/` | "red" |

These look like a customer's first name, an internal code, or a colour label
left over from data entry, not a description a shopper searches for or an AI
engine could summarise sensibly ("ppl" as a gift set's name is not citable in
any useful way). This also undercuts expertise/authority signals — a shop
that looks meticulous about fabric and fit reads as careless when its product
titles don't match what's inside.

## 5. E-E-A-T breakdown

| Factor | Weight | Score | Why |
|---|---|---|---|
| Experience | 20% | 45/100 | Genuine signals exist: "since 2015" founding story, "we answer every WhatsApp message ourselves," a described two-fitting process, and an original sketch→colour→finished-photo sequence on the homepage that shows real design work. But there's no customer-facing proof of experience — no completed-order photos, no video of the studio, no dated project/case-study content, and the "About us" team photo is still a placeholder ("Studio or team photo") |
| Expertise | 25% | 30/100 | No named designer, tailor, or business owner anywhere on the site; no credentials, training, or craft specifics beyond generic "hand-finished" language; the well-written subcategory descriptions show fabric/construction knowledge, but it isn't attributed to anyone and is diluted by being reused across unrelated products (see §3) |
| Authoritativeness | 25% | 25/100 | No press mentions, no external citations or backlink-worthy content, no reviews, ratings, or testimonials anywhere on the site (checked homepage and contact page — zero occurrences). Active, linked Instagram/Facebook/TikTok profiles and consistent NAP (name/address/phone) are the only authority signal present |
| Trustworthiness | 30% | 40/100 | Positive: transparent ordering steps disclosed up front, including that the 25% advance is non-refundable once cutting starts (honest, not hidden); a working FAQ on delivery, sizing, and timelines; HTTPS via Netlify; real contact channels (email, phone, WhatsApp) with same-day response promised. Negative: **no return/exchange policy, no privacy policy, no terms of service found anywhere on the site** (checked homepage, footer, and contact page — only mention of "refund" is the advance-is-non-refundable clause); no street address (schema has only city/country); no reviews or trust badges |

**Weighted E-E-A-T score: ≈ 35/100**

## 6. AI citation readiness — 40/100

| Check | Result |
|---|---|
| Structured data present | Yes — `ClothingStore` (home), `CollectionPage` (category), `Product`/`Brand`/`AggregateOffer` (product), `FAQPage` (contact). All valid JSON-LD, `https://schema.org` context |
| Clear heading hierarchy | Yes on product pages (name → price → "Product description" → spec list) |
| Quotable, specific facts | Present where subcategory copy is genuinely unique to that group (e.g. "layered net over duchess satin, hand-worked beading"), but this same "fact" is not unique to the product being viewed (§3), so an AI engine citing it is citing something copy-pasted, and sometimes wrong (§3, `prince-arthur-suit`) |
| Consistent, citable entity name | **Fails** for the products listed in §4 — a name like "ppl" or "red" gives an AI engine nothing usable to cite |
| Freshness signals | `addedOn` dates exist per product in the repo but are not surfaced on the live page (no "added" or "updated" date visible to a crawler or reader) |
| FAQ content structured for extraction | Yes — `/contact/` FAQPage schema matches visible Q&A text 1:1 |

## 7. Readability and tone

Where original copy exists — the six products with their own `description`,
and the subcategory default blocks — the writing is specific, sensory, and
reads like it was written by someone who has actually made the pieces
("boned waistband keeps the shape through a long evening," "every button is
stitched on by hand"). This is a strength: it is the opposite of generic
AI-sounding filler, and Sept 2025 QRG explicitly credits this kind of
first-hand specificity.

One instance of unnatural, keyword-forward phrasing was found on the `/girls/`
category page: *"Search terms parents use for these pieces: handmade girls
dresses, made-to-order kidswear, flower-girl outfits, themed birthday dresses
and party skirts in Lahore."* This reads as a keyword list dressed as a
sentence rather than something written for a parent to read, and should be
rewritten as natural descriptive copy or removed.

## 8. Recommendations, in priority order

1. **Fix the miscategorized boys' products** (this and the three already named
   in `handoff.md`) so they stop inheriting girls'-specific spec text. This is
   a one-field change per product (`subcategory`) plus creating/using a
   correct boys' default block.
2. **Write a real, unique description for every product**, or at minimum for
   the 35 sharing the `girls-luxury-dresses` default — start with the
   highest-traffic or newest pieces. Even 2–3 sentences naming the actual
   fabric, colour, and occasion for that specific piece would remove the
   duplicate-content risk.
3. **Rename the products listed in §4** to real, descriptive names before
   they're indexed further — "ppl," "red," and customer first-names as
   product titles actively hurt both search and AI-citation quality.
4. **Publish a return/exchange policy and a privacy policy** (even a short,
   plain-language one). For a site collecting advance payment before making
   a custom garment, this is the highest-leverage trust fix available.
5. **Add real experience/expertise proof**: a real studio/team photo (the
   placeholder is still live), a few completed-order photos with permission,
   or short customer testimonials — even three or four would materially
   change the Authoritativeness score, since there are currently zero.
6. **Decide the fate of `peach-popper-shirt`**: either restore it or trigger a
   rebuild so its deleted page stops serving live.
7. **Rewrite the keyword-listing sentence on `/girls/`** (and check `/boys/`,
   `/babies/`, `/ready/` for the same pattern) into natural copy.
8. Longer-term: a short buying-guide/blog (measuring for made-to-order,
   fabric care, sizing by age) would give the site topical depth it currently
   has no path to reach, and each guide would be inherently unique content.

---

*Scoring model: this skill's internal E-E-A-T weighting (Experience 20% /
Expertise 25% / Authoritativeness 25% / Trustworthiness 30%). Google publishes
no official numeric weights for E-E-A-T; it states only that trust is the most
important component.*
