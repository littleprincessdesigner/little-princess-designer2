# Setting up the admin page

The site uses **Sveltia CMS** for its admin page at `yoursite.com/admin/`.
Sveltia is a drop-in successor to Decap CMS — same form, same config file — but
editors sign in with a **GitHub account** instead of an email address.

You need to do the setup below **once**. After that, adding a product is just
opening `/admin/` and filling in a form.

If you are migrating from the old Decap + DecapBridge setup, see
**"Migrating from the old email sign-in"** at the bottom.

---

## What you need

- The site already on **GitHub** (`littleprincessdesigner/little-princess-designer2`) and **Netlify** — both already true.
- A **GitHub account** for every person who will edit the site. Free, 2 minutes to make at [github.com](https://github.com).
- About 20–30 minutes for the one-time setup below.

---

## 1. Add each editor as a collaborator

Every editor needs write access to the repository. This is what lets their
saves become commits.

1. Go to the repository on GitHub → **Settings** → **Collaborators and teams**
   (or, for an organisation repo, **People** in the org settings).
2. **Add people** → type their GitHub username → choose the **Write** role.
3. They get an email invite and click **Accept**.

Do this for yourself and for anyone else (e.g. Javeria). Nobody needs more than
**Write** — they never touch anything but the admin form.

---

## 2. Create a GitHub OAuth app

This is the thing that shows the "Sign in with GitHub" button and lets it work.
You only make one, and it is shared by everyone.

1. On GitHub, click your avatar → **Settings** → scroll down to **Developer
   settings** (bottom of the left menu) → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name:** `Little Princess Designer CMS`
   - **Homepage URL:** `https://littleprincessdesigner.pk`
   - **Authorization callback URL:** depends on which sign-in broker you use in
     step 3:
     - Using **Netlify** (step 3a): `https://api.netlify.com/auth/done`
     - Using **Cloudflare** (step 3b): `https://YOUR-WORKER.workers.dev/callback`
       (you will know the worker address after step 3b — you can edit this
       field afterwards)
3. **Register application.**
4. On the next screen, note the **Client ID**, then **Generate a new client
   secret** and copy it somewhere safe. You will paste both into step 3.
   The secret is shown once — if you lose it, generate another.

---

## 3. Set up the sign-in broker

Pick **one** of these. Try 3a first; if Netlify's screen doesn't have the
option any more, use 3b.

### 3a. Netlify as the broker (nothing new to sign up for)

1. In Netlify, open the site → **Site configuration** → **Access & security**
   (older layouts: **Access control**) → scroll to **OAuth**.
2. **Install provider** → **GitHub** → paste the **Client ID** and **Client
   secret** from step 2 → **Install**.
3. Done. `site/admin/config.yml` already has the matching `backend:` block
   (`name: github`, no `base_url` line), so nothing to change in the code.

### 3b. A Cloudflare worker as the broker (free, ~5 minutes)

Use this if Netlify no longer shows the OAuth "Install provider" option.

1. Make a free account at [cloudflare.com](https://cloudflare.com).
2. Deploy the official **sveltia-cms-auth** worker — the one-click and manual
   instructions are at
   <https://github.com/sveltia/sveltia-cms-auth>. During setup it asks for the
   **Client ID** and **Client secret** from step 2, and for
   `ALLOWED_DOMAINS` — set that to `littleprincessdesigner.pk`.
3. It gives you a worker address like
   `https://sveltia-cms-auth.YOURNAME.workers.dev`.
4. Go back to your GitHub OAuth app (step 2) and set the **Authorization
   callback URL** to `https://sveltia-cms-auth.YOURNAME.workers.dev/callback`.
5. Add one line to `site/admin/config.yml`, under `branch: main` in the
   `backend:` block:

   ```yaml
   backend:
     name: github
     repo: littleprincessdesigner/little-princess-designer2
     branch: main
     base_url: https://sveltia-cms-auth.YOURNAME.workers.dev
   ```

6. Commit and push that change.

---

## 4. Log in

Go to `https://littleprincessdesigner.pk/admin/` and press **Sign in with
GitHub**. Authorise the app once. You land on **Products**, with
**Subcategories**, **Category pages** and **Site settings** in the sidebar.

Every change you save becomes a commit under your GitHub name, Netlify
rebuilds, and the website updates in a minute or two.

---

## 5. Photos — the ImageKit library

Photos are **not** stored in this repository. Each photo row on a product has a
**Photo address** box. You fill it with a web address from the shop's
[ImageKit](https://imagekit.io) account (`lpdlhr`).

**To add a photo:**

1. Open [imagekit.io](https://imagekit.io) in another tab and sign in to the
   shop's account.
2. Upload your photo (drag it into the Media Library), or find one you uploaded
   before.
3. Click the photo → **Copy URL** (or the copy icon next to its address). It
   looks like `https://ik.imagekit.io/lpdlhr/blush-frock.jpg`.
4. Back in the admin, paste that into the **Photo address** box. Add a **photo
   description** too.

Two reasons it works this way:

- Anything committed to git stays in its history **forever**, even after it is
  deleted. Hundreds of camera photos would sit in this repository permanently.
- ImageKit resizes on delivery. The site asks it for a 400-, 800-, 1200- or
  1600-pixel copy depending on the screen, so a phone never downloads the
  4,000-pixel original. That rewriting lives in `tools/images.js`.

**Why not a photo picker inside the form?** Sveltia CMS does not support
ImageKit's in-page picker (it ignores custom photo libraries). The old Decap
setup had one; this is the trade-off for the switch. If the copy-paste step
becomes annoying, the site could move to Cloudinary, which Sveltia *does* have a
built-in picker for — ask a developer.

### Everyone who edits photos needs their own ImageKit login

Invite them from the ImageKit dashboard, the same way they were added as a
GitHub collaborator. There is no shared password and no API key anywhere in
this repository.

### The "…or another image link" box

Each photo row also has a second box for a full `https://` address from
somewhere other than ImageKit — for a photo hosted elsewhere. If both boxes are
filled, this one wins. A non-ImageKit photo is served exactly as it is (full
size), so keep those under ~1600px on the long edge.

### The three hero images

`dress-sketch-tall.webp`, `dress-colour-tall.webp` and `dress-real-tall.webp`
stay as files in `site/assets/`. They are part of the page design, not
catalogue content, so they are not editable in the admin — replace the files
directly to change them.

### The size chart PDF

Every product page has a **Size Chart** button next to Order on WhatsApp. It
opens whatever address is in **Site settings → Product defaults → Size chart
link**.

The PDF lives on ImageKit, not in this repository, for the same two reasons the
photos do. To replace the chart:

1. Upload the new PDF to ImageKit, exactly as you would a photo.
2. Copy its address.
3. Paste it into **Size chart link** and save.

Because the new PDF gets its own address, customers see the new chart
immediately — there is no cached old copy to wait out.

Two things worth knowing:

- **Leaving the box empty removes the button** from every product page. That is
  deliberate: it is how the chart is switched off, and it means a half-finished
  paste never leaves a button that goes nowhere.
- **A sold-out piece keeps its Size Chart button** even though it loses the
  order button — someone who cannot buy that piece may still be sizing another.

After pasting a new address, open it once in a browser to check the PDF
displays rather than downloading. Nothing else on this site serves a non-image
file from ImageKit, so this is the one step that has not been proven in
advance.

---

## 6. Optional: let someone else edit

1. They make a free GitHub account.
2. You add them as a **Write** collaborator (step 1).
3. You invite them to the ImageKit account (step 5).
4. They go to `/admin/`, sign in with GitHub, and can edit straight away.

Because each save is committed by that person's own GitHub account, the history
shows exactly who changed what — automatically, with no extra configuration.

---

## Working on it locally

You do not need any of the above to try the admin on your own machine:

```bash
npm run build      # generate dist/
npm start          # serve it at http://localhost:8080
```

Then open <http://localhost:8080/admin/> **in Chrome or Edge** and click
**"Work with local repository"**. Sveltia edits the files in `content/`
directly on your disk. Run `npm run build` again to see the changes on the
site. (There is no `npm run cms` step any more — Sveltia does not use a local
save-server.)

---

## If something goes wrong

**The admin is stuck on "Opening the admin…"**
The CMS script did not load. Reload; check your internet connection. If it keeps
happening, `unpkg.com` (where the script comes from) may be blocked on your
network.

**"Sign in with GitHub" does nothing, or returns an error**
The OAuth broker (step 3) is not set up, or the callback URL in the GitHub
OAuth app (step 2) does not match the broker. Double-check both.

**Signed in, but saving fails with a permissions error**
That GitHub account is not a **Write** collaborator on the repository (step 1),
or the invite was never accepted.

**I saved a change but the website looks the same**
Netlify needs a minute to rebuild. Check **Deploys** in Netlify — if the build
failed, the log says why, and names the product at fault.

**A product is not showing up**
Check three things in the admin: **Show on website** is on, it has at least one
size with a price, and its subcategory still exists.

**A photo shows on the website but the WhatsApp preview has no picture**
Check the photo is an `ik.imagekit.io` address, not pasted from somewhere else.
WhatsApp drops preview images over roughly 300 KB, and the sized-down copy it
needs can only be made for photos on ImageKit or under `/assets/uploads/`.

**The build failed with "exists in the JSON but is NOT declared in config.yml"**
Someone hand-edited a file in `content/` and added a field the admin does not
know about. Either add that field to `config.yml` or remove it from the JSON.

---

## Migrating from the old email sign-in (Decap + DecapBridge)

If the site is still on the old setup, the switch is:

1. Do steps 1–4 above (GitHub collaborators, OAuth app, broker, test login).
2. The code changes are already on the `sveltia-cms-migration` branch:
   `config.yml` backend swapped to `github`, the ImageKit picker turned into a
   paste box, the admin colour skin and `imagekit.js` removed, `npm run cms`
   dropped. The product-page preview panel is kept (adapted for Sveltia).
3. Test the admin on that branch's Netlify **preview deploy** first — sign in,
   open a product, change something trivial, save, confirm the commit lands.
4. Merge the branch. The live admin switches over on the next deploy.
5. In DecapBridge, you can delete the site — it is no longer used. The
   subscription, if any, can be cancelled.

Nothing about the live website, the product content, or the photos changes in
this switch — only how the admin is reached and how photos are added.
