# Search Experience (SXO) Findings — littleprincessdesigner.pk

**Scope:** Does the page type Google rewards for this brand's core queries match what
the site actually serves, what a searcher actually needs when they arrive, and whether
different types of shoppers can get to a confident "yes, I'll pay the 25% advance"
decision. Homepage, one category page (`/girls/`), one product page
(`/product/first-birthday-baby-set/`), and the `/contact/` ordering/FAQ page were
audited from the perspective of five personas derived from SERP signals.

**Data sources:** `render_page.py` (auto + forced-render) and `parse_html.py` against
the live site, live JSON-LD extraction via `curl`, a full read of `content/products/*.json`
(76 files) and `content/settings*.json`, and `WebSearch` for the five target queries:
"kids party dress Lahore," "handmade kidswear Pakistan," "boys prince suit Pakistan,"
"baby romper set Pakistan," "made to order kids dress Pakistan." Checked live 2026-08-25/26.

**SXO Gap Score: 47 / 100** (separate from, and not comparable to, the SEO Health Score.
See `technical.md` for the 70/100 technical score and `ecommerce.md` for the 42/100
e-commerce/schema score — this document scores the *experience*, not the markup.)

---

## Lead finding: this is not a classic page-type mismatch — it's a content-integrity
## crisis sitting on top of an otherwise correctly-typed site

Before anything else: the taxonomy check came back cleaner than expected. Homepage uses
`ClothingStore` schema (brand/local-business type), `/girls/` uses `CollectionPage`
(category-listing type), `/product/*` uses `Product` + `AggregateOffer`, and `/contact/`
uses `FAQPage`. That is the *right* structural type for each URL relative to what ranks
for these queries (see SERP Analysis below) — so "page type" itself is **ALIGNED**, not
the primary problem.

The primary problem, confirmed live and already flagged at the technical/schema layer in
`technical.md` (Critical #1) and `ecommerce.md` (Critical #1–2), is that the *content
inside* the correctly-typed product template is frequently not the content its own URL,
title, and prior listing promised: 31 of 76 product URLs (41%) currently render a
different product than their slug implies, and 35 of 76 (46%) show implausible prices
(PKR 44–98) inherited from draft edits that were never finished. This document doesn't
re-derive that list — it translates what it does to the five personas below, because from
a search-experience standpoint a *correctly typed but untrustworthy* page is arguably
worse than a wrong page type: it gets the click, then breaks the promise at the moment
trust is being built.

**Concretely, for the persona journeys below:** a shopper who searches for, bookmarks, or
gets sent (via WhatsApp, Instagram, or a saved link) a URL like
`/product/first-birthday-baby-set/` today lands on a page titled *"aizal red frock"* — a
different, more expensive girls' occasion gown, not a baby set. For a brand whose entire
transaction model depends on a stranger paying a **non-refundable 25% advance on trust
alone**, this is close to worst-case for a first-time buyer's confidence.

---

## SERP Analysis

| Query | Dominant result type | Notes |
|---|---|---|
| kids party dress Lahore | E-commerce collection/product pages (Naqshi, Kashees, Tiny by Glam Glitz) + marketplace listings (OLX) | Grid layout, price shown per item, "Buy"/"Shop" CTA. No blog posts or how-to content ranking. |
| handmade kidswear Pakistan | Marketplace category pages (Etsy) + brand collection pages (Minnie Minors, Sanaulla, Rollover) | Etsy listings show seller review counts prominently — a direct trust-signal competitor. |
| boys prince suit Pakistan | Brand collection/category pages (Laam, edenrobe, Sanaulla, Saeed Ajmal) | "Node"/collection pages with size + price + occasion framing (wedding/Eid). |
| baby romper set Pakistan | Category listing pages (Chase Value, Cuddle Cradle, HipKids, Juniorscart) | Consistent pattern: multi-piece "set" framing, size/age labeling, clean price display. |
| made to order kids dress Pakistan | Etsy custom-listing pages + brand collection pages | "Made to order"/"custom" framing paired with turnaround-time expectations set on the listing itself. |

**SERP consensus:** ~90% of ranking results across all five queries are transactional
e-commerce category or product-listing pages (price + image + buy/contact CTA visible in
the grid itself), not blog or informational content. No PAA blocks or featured snippets
were prominent for these commercial queries — consistent with strong transactional
intent. **Dominant type: Product/Category Listing page — confidence ~90%.**

**Target site classification vs. consensus:**
- `/girls/` (category page): **ALIGNED** — `CollectionPage` schema, 50 images, 915 words,
  grid of products with prices. Structurally matches what ranks.
- `/product/*` (product page): **ALIGNED on type**, but severely undercut by the content-
  integrity issue above and by thinness (155 words on the audited page vs. competitor
  product pages that typically carry a size guide, fabric detail, and — per Etsy/Chase
  Value/Cuddle Cradle — a visible review count).
- Homepage: reasonable brand/story entry point (`ClothingStore` schema, "since 2015"
  narrative, WhatsApp CTA), but it is not itself competing for these product queries and
  shouldn't be treated as if it needs to — no action needed here beyond what's noted under
  Trust below.

**Mismatch severity: MEDIUM** — not a wrong-page-type problem, but the correct page type
is missing the specific trust and depth elements every real competitor in this SERP
(Etsy sellers with review counts, branded collection pages with clean pricing) already
has, and a meaningful share of product URLs currently fail even the basic promise of
"this URL shows the product it says it does."

---

## User Stories (derived from SERP signals + business model)

1. **As a parent searching "kids party dress Lahore" against a deadline** (birthday/
   wedding), I want to scan a price/size grid quickly, because I need to commit before the
   event date, **but I'm blocked by nonsensical prices** ("PKR 44" next to "PKR 100,000"
   on the same `/girls/` grid) that make me question whether the site works or is safe to
   order from. *(Signal: competitor SERP results — Naqshi, Kashees, Chase Value — all show
   clean, consistent per-item pricing in their grids; source data confirms 46% of this
   site's products carry a leftover sub-PKR-100 price.)*

2. **As a first-time visitor comparing "handmade kidswear Pakistan" against Etsy sellers**,
   I want to see reviews or star ratings before trusting a handmade/custom order, because
   custom-cut clothing can't be returned for size reasons alone, **but I'm blocked by zero
   reviews, ratings, or testimonials anywhere on the site** — the live `Product` JSON-LD
   has no `aggregateRating`/`review`, and no CMS content field exists for testimonials.
   *(Signal: Etsy listings — the direct competitor for "handmade"/"made to order" queries
   — foreground review counts as a primary trust signal.)*

3. **As a shopper who clicks a specific product result or a shared link**, I want the page
   to show the product its name/URL promised, because that's the entire reason I clicked,
   **but I'm blocked by a live bait-and-switch**: `/product/first-birthday-baby-set/`
   currently shows "aizal red frock," a different, pricier item. *(Signal: verified live —
   see Lead Finding above and `technical.md` Critical #1 for the full mechanism.)*

4. **As a parent deciding whether to pay a non-refundable 25% advance to an unfamiliar
   small studio**, I want delivery time, sizing method, and the refund policy answered
   *before* I commit, because real money is at risk, **but I'm blocked by that information
   living only on `/contact/`**, a separate page not linked from the product page at the
   moment of decision (the product page has no "how ordering works" or FAQ link/snippet).
   *(Signal: `/contact/` already has a well-built `FAQPage` schema answering exactly this —
   turnaround time, sizing-by-measurement, non-refundable-advance terms — but it's
   disconnected from the page where the decision actually gets made.)*

5. **As a repeat customer trying to reorder a past favorite by name**, I want the URL or
   product I remember to still show what I ordered before, because a low-friction repeat
   purchase is the reward for having trusted the brand once already, **but I'm blocked by
   silent slug/content swaps**: any bookmarked or WhatsApp-shared product link from before
   an admin edit may now show an unrelated item. *(Signal: 31 of 76 product files show
   slug/name mismatches introduced by in-place CMS edits, per repo history.)*

*(Stories 1–2 = awareness/consideration; 3–4 = decision; 5 = post-purchase/loyalty — spans
3 journey stages.)*

---

## Gap Analysis (100 pts)

| Dimension | Score | Evidence |
|---|---|---|
| Page Type (0-15) | 11/15 | Correct schema types per page (`ClothingStore`, `CollectionPage`, `Product`+`AggregateOffer`, `FAQPage`); docked for no `Organization`/`WebSite` schema tying the brand + social profiles together. |
| Content Depth (0-15) | 6/15 | Product page audited: 155 words, blank `specs`/`description` fields in the underlying JSON on many products (see `ecommerce.md` High #3 — 53% share one fallback description). |
| UX Signals (0-15) | 6/15 | Clear 3-step WhatsApp ordering flow exists (`/contact/`), but it's not surfaced on product pages; no size/measurement guide near the buy decision; pricing inconsistency undermines scannability. |
| Schema (0-15) | 8/15 | Good baseline types present; missing `aggregateRating`/`review`, `BreadcrumbList`, `Organization`/`WebSite` — several already flagged in `technical.md`/`ecommerce.md`. |
| Media (0-15) | 8/15 | Solid image counts (24 homepage / 50 category / 4-5 per product) with responsive `srcset`; no video despite an active TikTok presence — a missed differentiator for handmade/motion-heavy kidswear. |
| Authority (0-15) | 3/15 | No reviews, ratings, testimonials, press mentions, or visible customer gallery anywhere in the CMS content reviewed; "since 2015" is the only longevity signal. |
| Freshness (0-10) | 5/10 | Sitemap `lastmod` dates are current and commit cadence is active, but the live product page audited was still showing a stale price (PKR 55) roughly 45 minutes after a commit updated it to PKR 25,000 — **unverified whether this is normal deploy lag or a stuck build; flagged, not confirmed** (see Limitations). |
| **Total** | **47/100** | |

---

## Persona Scores

| Persona | Journey stage | Relevance | Clarity | Trust | Action | Total | Rating |
|---|---|---|---|---|---|---|---|
| First-time, risk-averse shopper (wary of the advance) | Decision | 14/25 | 12/25 | 6/25 | 16/25 | 48/100 | Needs Work |
| Budget-conscious comparison shopper | Consideration | 18/25 | 8/25 | 6/25 | 16/25 | 48/100 | Needs Work |
| Occasion-deadline parent (needs sizing + delivery time) | Awareness→Consideration | 16/25 | 10/25 | 8/25 | 14/25 | 48/100 | Needs Work |
| International/diaspora buyer | Consideration | 17/25 | 9/25 | 6/25 | 13/25 | 45/100 | Needs Work |
| Returning/repeat customer | Decision/Loyalty | 10/25 | 5/25 | 12/25 | 18/25 | 45/100 | Needs Work |

### Weakest personas: Returning Customer & International Buyer (45/100 each)

**Top issue (Returning Customer):** Clarity collapses to 5/25 because a remembered or
bookmarked product URL is not reliably the same product anymore (see Lead Finding). This
is the single most severe per-dimension score in the whole table, and it is a direct,
already-diagnosed, fixable bug — not a design gap.
**Recommended fix:** Stop editing a product's `name` in place on an existing file/slug
(per `technical.md` Recommendation #1); until the 31 flagged files are corrected or
redirected, prioritize fixing the ones most likely to have outstanding customer links
(products edited in the last 90 days).

**Top issue (International Buyer):** No shipping cost/time estimate or country selector;
everything is quoted in PKR with courier cost "quoted according to your city or district"
only after a WhatsApp conversation.
**Recommended fix:** Add one line to the `/contact/` FAQ and product page footer: typical
international courier cost/time bands (e.g., "UK/US: ~7-10 days, courier charged
separately, ask for a quote"), even without exact pricing.

### Systemic issue across all five personas: Trust (average 7.6/25)

Every persona scores 6-12/25 on Trust. Root cause is the same for all of them: **zero
reviews, ratings, or testimonials anywhere on the site**, combined (for the specific
product page audited) with the live content-integrity bug. This is the single highest-
leverage fix available — it moves the Trust dimension for every persona at once,
independent of the schema/content-integrity cleanup already tracked in `technical.md` and
`ecommerce.md`.

### Priority Actions (weakest persona first)

1. **Fix the URL-identity problem for at least the highest-traffic/most-recently-shared
   product URLs** (Returning Customer, Clarity 5/25) — cross-reference `technical.md`
   Critical #1 for the mechanism and full remediation steps; this skill flags the
   *experience* impact, that skill owns the *fix*.
2. **Add real social proof** (systemic Trust gap, 7.6/25 average): even 5-10 WhatsApp-
   collected customer photos/quotes with first names and city, displayed on the homepage
   and linked from product pages, would move every persona's Trust score meaningfully more
   than any schema change could.
3. **Surface the `/contact/` FAQ content (advance-payment terms, ~3-week turnaround,
   sizing method) directly on the product page**, not only on a separate page — a short
   "How ordering works" accordion or a link with the three FAQ answers closest to the buy
   decision, addressing the Occasion-Deadline and First-Time personas' Clarity gaps
   (10/25 and 12/25) at the exact moment they need it.
4. **Add a one-line international shipping expectation** to close the International
   Buyer's Clarity gap without needing a full courier-rate table.
5. **Resolve the pricing-display inconsistency** on `/girls/` and other category grids
   (already tracked as a Critical item in `ecommerce.md`) — this is also the single
   biggest Clarity blocker for the Budget-Conscious persona (8/25).

---

## Cross-Skill References

- `technical.md` — full mechanism and fix for the URL/content-integrity bug (Critical #1)
  referenced throughout this document.
- `ecommerce.md` — full list of the 35 affected low-price product files, the duplicate
  "unicorn tutu dress" listing, and the shared fallback meta description (Critical #1-2,
  High #3).
- **E-E-A-T gap (no reviews/testimonials/authority signals):** recommend `/seo content`
  for a deeper content-authority pass — this is the single highest-leverage systemic gap
  found in this audit.
- **Schema gaps** (`aggregateRating`, `BreadcrumbList`, `Organization`/`WebSite`):
  recommend `/seo schema` for generation — already itemized in `technical.md`/`ecommerce.md`.
- **Local intent** (Lahore-specific queries in the SERP): recommend `/seo local` for a
  Google Business Profile check — out of scope here.

---

## Limitations

- WebSearch results (not a live, rendered Google SERP) were used for SERP classification;
  exact ad density, PAA question text, and "related searches" could not be scraped
  directly and are inferred from result composition, not observed first-hand.
- Only one product page (`/product/first-birthday-baby-set/`) was deep-audited for
  persona scoring; it happens to be the most recently edited file in the repo and (per
  the Lead Finding) is itself mid-content-swap. Scores for "Content Depth" and "Media"
  would likely differ somewhat on a stable, correctly-labeled product page — treat the
  47/100 Gap Score as representative of the *median* experience, not a worst-case cherry-pick.
- The discrepancy between the repo's latest committed price (PKR 25,000) and the live
  page's displayed price (PKR 55) at time of testing is **reported but not confirmed** as
  a deploy-lag issue versus a stuck/failed build — this needs a look at the actual Netlify
  deploy log, which this audit did not have access to. Flagging plainly rather than
  guessing, per this project's own stated preference for not overclaiming what's "live."
- No Google Search Console or analytics access — actual keyword rankings, click-through
  rates, and real user behavior (bounce, time-on-page) could not be verified; all
  persona/UX scoring is based on static and rendered page inspection only.
- Mobile-specific rendering was not independently re-verified by this pass (screenshots
  already exist under `littleprincessdesigner.pk-audit/screenshots/`); this audit reused
  desktop-rendered HTML for word counts and schema checks.

---

Generate a PDF report? Use `/seo google report`
