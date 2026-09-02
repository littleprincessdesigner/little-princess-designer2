# Using the admin page

Go to `yoursite.com/admin/` and press **Sign in with GitHub** — authorise it
once, and you are brought straight back. Everything you save becomes live on the
website about a minute later.

(The admin is Sveltia CMS. You sign in with a GitHub account; if you do not have
one yet, see `docs/CMS-SETUP.md`.)

There are four things in the sidebar:

| | What it's for |
|---|---|
| **Products** | Every piece in the shop |
| **Subcategories** | The sections inside each tab — "Casual dresses", "Rompers" |
| **Category pages** | The wording at the top of Girls / Boys / Babies / Ready to wear |
| **Site settings** | Four pages: **Contact details**, **Product defaults**, **Site & home page**, **Sale page** |

**Site settings** is split into four pages so you are not scrolling past the
hero headlines to change a phone number:

| Page | What's on it |
|---|---|
| **Contact details** | Phone number, email, social links, and the whole contact page |
| **Product defaults** | The wording and prices every product falls back on |
| **Site & home page** | Business name, hero, features, banner, about, carousel, footer |
| **Sale page** | The wording at the top of the `/sale/` page, and the line it shows when nothing is reduced. It does **not** decide which pieces are on sale — that comes from the pieces themselves (see "How a sale works" below) |

---

## Add a product

**Products → New Product.**

Only four things are required:

1. **Product name** — what customers see, e.g. "Aurora Luxury Gown"
2. **Subcategory** — pick from the dropdown
3. **Sizes and prices** — one row per age band you make it in
4. **Photos** — at least one

Everything else has a sensible default. Press **Publish** when done.

### Sizes and prices

Each row is one age band and its price:

```
0–3 years      18500
4–6 years      19400
7–9 years      20300
```

The price on the website changes when the customer picks a size. Type numbers
only — `18500`, not `18,500` or `PKR 18500`.

- To **stop offering a size**, either untick **Available** or delete the row.
- To **change a price**, just type over it and publish.
- A product needs **at least one** size with a price, or it will not appear on
  the site.

### Photos

Photos live in the shop's **ImageKit** library, not in the admin. For each photo
row:

1. Open [imagekit.io](https://imagekit.io) in another tab, sign in to the shop's
   account, and upload your photo (or find one already there).
2. Click the photo and press **Copy URL**.
3. Paste that address into the **Photo address** box.

The address looks like `https://ik.imagekit.io/lpdlhr/blush-frock.jpg`, and
ImageKit shrinks it for phones automatically.

The **…or another image link** box is only for a photo hosted somewhere other
than ImageKit. If both boxes are filled, that one wins.

The **first photo** is the one shown on the card in the shop. The product page
shows up to three, so front / side / back works well.

Please add a **photo description** for each one. It is what appears if the image
fails to load, what screen readers read out, and what Google uses to understand
the picture. "Blush pink net party frock, hand-beaded bodice" is much better
than "dress1".

> **Keep photos small.** Around 1600px wide and under 300 KB. A photo straight
> off a phone is often 4–8 MB, which makes the site slow on mobile data.

### Descriptions

Leave **Description** blank and the product uses its subcategory's standard
description. That is usually what you want — write it once on the subcategory
instead of retyping it for every dress.

Fill it in when a particular piece deserves its own words: an unusual fabric, a
specific colour, special handwork.

The same applies to **Details** (fabric, occasion, fit, care). Blank fields fall
back to the subcategory.

---

## Hide a product without deleting it

Open the product and turn **Show on website** off, then publish.

It disappears from the shop immediately, and everything you typed stays exactly
where it is. Turn it back on whenever you like.

Use this for pieces that are out of season, sold out for good, or not
photographed yet. **Delete** is for mistakes — it is permanent.

If you want a piece to stay visible but marked as unavailable, leave it on and
set **Badge** to "Sold out" instead.

---

## How a sale works

You put a piece on sale by filling in a **sale price** on the size that is
reduced, in the **Sizes and prices** list — nothing else. There is no "Sale"
badge to pick any more; that option is gone.

Once a size has a sale price below its normal one:

- a pink **SALE** label appears on its own — on the card in the shop, on the
  product page, and on the **`/sale/` page**, which gathers every reduced piece
  in one place. A "Sale" tab appears in the site header while anything is on
  sale, and disappears when nothing is.
- the product page and the card show the old price struck through next to the
  new one.

**Clear the sale price and all of it goes away together** — the label, the
struck-through price, and the piece's spot on the Sale page.

One exception: a piece whose **Badge** is set to "Sold out" is kept off the
Sale page even if it is discounted (there is nothing to buy), though its
struck-through prices still show on its own product page.

---

## Change a price

**Products** → click the product → change the number in the **Sizes and prices**
list → **Publish**.

To change several products' prices, do them one at a time; each publish is
separate.

---

## Add or remove a subcategory

**Subcategories → New Subcategory.**

There is no code to fill in. The section is filed under its tab and its name —
a section called "Party skirts" under Girls is stored as `girls-party-skirts` —
and the CMS keeps that unique for you, so two sections can never end up sharing
one. (Two girls sections were both saved as `g1` when the code was typed by
hand, and one of them stopped showing its products.)

- **Name** — the heading shown on the page, e.g. "Party skirts". Safe to rename
  whenever you like: the filing stays as it was, so every product in the section
  stays put.
- **Tab** — which of the four shop tabs it belongs to.
- **Sort order** — lower numbers appear higher up the page.
- **Standard description / details** — used by every product in this section
  that doesn't have its own.

**To remove one:** delete it — but move its products to another subcategory
first. A product whose subcategory no longer exists disappears from the website
until you reassign it. Nothing is lost, but it is invisible in the meantime.

---

## Change your phone number, email or social links

**Site settings → Contact details.**

Everything about reaching the shop is on this one page — the phone number,
email, the Instagram, Facebook and TikTok links, and all the wording on the
contact page (ordering steps, FAQs, the social cards, the feedback block).

The WhatsApp number is used by every WhatsApp button on the site — the floating
button, the product pages, the contact page. Changing it here changes all of
them.

Enter it as digits only, with the country code and no `+` or spaces:
`923217152723`.

---

## Change the wording on the home page

**Site settings → Site & home page.** The sections are in the order they appear
on the site:

- **Hero headlines** — the three hand-lettered lines that fade in over the dress
- **Hero buttons** — the three cards under it
- **Features** — the four berry cards
- **Banner** — the pink strip. Wrap words in `**double asterisks**` to bold them
- **About us** — leave a blank line between paragraphs
- **Carousel** — the heading and hint over the spinning ring, and what spins
  in it (its own section below)
- **Categories row heading** and **Footer line** at the bottom

The contact page's wording is on the **Contact details** page instead, next to
the phone number it goes with: ordering steps, FAQs, the social cards and the
feedback block. FAQs are also published in a format Google understands, so they
can appear directly in search results — worth keeping them accurate.

---

## Change what a product says when you leave it blank

**Site settings → Product defaults.**

Nothing on this page shows anywhere a product has been filled in properly. It is
the last fallback: a piece uses its own words first, then its subcategory's
standard wording, then these. It means no product can end up with a blank
description, however quickly it was added.

Also here: the matching-accessory charge and its wording, and the delivery note
in the small print under a product's total.

---

## Choose what spins in the carousel

**Site settings → Site & home page**, in the carousel section.

The ring on the home page can be filled two ways:

- **The newest pieces, automatically** — how it has always worked. Whatever you
  added last is what spins, and you never have to touch it.
- **Only the pieces I choose below** — you decide. Use this to put your best
  work, or a season's pieces, on the home page however old they are.

To choose your own:

1. Set **How the carousel is filled** to *Only the pieces I choose below*.
2. In **Pieces in the carousel**, press **Add Piece** and start typing a product
   name — pick it from the list that appears.
3. Add as many as you want. They spin in the order listed, and you can drag a
   row to move it.
4. **Publish**.

**Number of slots** is how many pieces the ring holds — ten by default. Fewer
makes each piece bigger on screen, more makes them narrower. Three is the fewest
and twenty the most; anything outside that is pulled back into range.

The two settings work together: on *newest*, the slot count is how many recent
pieces show. On *pieces I choose*, it is a limit — if you list more than the
slot count, the extra rows sit unused until you raise it.

A few things worth knowing:

- **Leave the list empty and the newest pieces show instead.** The home page is
  never left with an empty ring.
- **Choose fewer pieces than slots and the ring simply spins fewer.** It still
  works; it is just a smaller ring.
- **Renaming a product drops it out of the ring.** The list remembers a piece by
  its web address, and renaming changes that address. Hiding or deleting a piece
  does the same thing. Just pick it again.

---

## Common questions

**I published something and the site hasn't changed.**
Give it a minute or two — the site rebuilds after each change. If it still
hasn't, check Netlify's **Deploys** tab for a failed build.

**My product isn't showing up.**
Check: **Show on website** is on, it has at least one size with a price, and its
subcategory still exists.

**I made a mistake — can I undo it?**
Yes. Every change is saved in the repository's history on GitHub, so nothing is
ever truly lost. Ask whoever set the site up to roll it back. Each entry in that
history carries the GitHub name of whoever made the change.

**Can I let someone else add products?**
Yes. They need a free GitHub account, and you add them as a collaborator on the
repository and invite them to the ImageKit account — the steps are in
`docs/CMS-SETUP.md`. They can only reach this admin form, nothing else in the
repository.

**Can two people edit at once?**
Yes, but avoid both editing the *same* product simultaneously — the second save
may complain about a conflict. Different products are completely fine.
