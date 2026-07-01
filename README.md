# Keepsake — PDF to Flipbook

Turn a PDF into a page-turning flipbook with its own private link. Upload once,
share the link, done — no accounts, no server to run.

**Stack:** React 19 + Vite, Tailwind CSS (CDN), `react-pageflip` (StPageFlip)
for the 3D page-turn, `pdf.js` to rasterize PDF pages in the browser, and
Supabase (Storage + Postgres) as the entire backend. There is no custom
server — the React app talks to Supabase directly using its public `anon`
key, which is safe because access is controlled by the Row Level Security
policies in `supabase/schema.sql`.

---

## 1. How it works

1. **Upload** — On the home page you drop a PDF. The browser uploads the raw
   file straight to a Supabase Storage bucket called `pdfs`, and inserts one
   row into a `books` table: `{ id, title, file_path }`. `id` is a random
   UUID — that UUID *is* the shareable link.
2. **Route** — The app navigates to `/book/:id`.
3. **View** — The book page looks up the row for `:id`, gets the PDF's
   public URL from Storage, and uses `pdf.js` to render every page to an
   image entirely in the visitor's browser. Those images are fed into
   `react-pageflip` to produce the 3D page-turn.
4. **Share** — The wax-seal button copies `window.location.href` to the
   clipboard.

Because rendering happens client-side, there's nothing to run on a server —
the whole app is static files, which is why it deploys for free to Vercel,
Netlify, or GitHub Pages.

---

## 2. Set up Supabase (free tier is enough)

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick any
   name/region and a database password (you won't need the password again).
2. **Create the storage bucket.** In the dashboard sidebar, go to
   **Storage → New bucket**. Name it exactly `pdfs` and toggle **Public
   bucket** on, then create it.
3. **Create the table and permissions.** Go to **SQL Editor → New query**,
   paste in the entire contents of [`supabase/schema.sql`](supabase/schema.sql)
   from this repo, and click **Run**. This creates the `books` table and the
   Row Level Security policies that let the app read/write it with only the
   public key. (It also re-applies the "public bucket" setting in case you
   skipped step 2 — but creating the bucket by hand first is the reliable
   path, since bucket creation via SQL needs elevated privileges.)
4. **Grab your API keys.** Go to **Settings → API**. You'll need:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (a long JWT — *not* the `service_role` key)

That's the entire backend. No servers, no queues, nothing else to configure.

---

## 3. Run it locally

```bash
git clone <this-repo-url> keepsake
cd keepsake
npm install
cp .env.example .env
```

Open `.env` and paste in the two values from step 2.4:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Then:

```bash
npm run dev
```

Visit the printed local URL, drop in a PDF, and it should redirect you to
`/book/<uuid>` with the flipbook rendering live.

---

## 4. Deploy for free

The build output is fully static (`npm run build` → `dist/`), so any static
host works. Pick one:

### Option A — Vercel (recommended, zero config needed beyond env vars)

1. Push this project to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) → **Add New… → Project** → import
   the repo. Vercel auto-detects Vite; leave the defaults (`npm run build`,
   output directory `dist`).
3. Before the first deploy, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. Click **Deploy**. `vercel.json` in this repo already tells Vercel to
   rewrite every route to `index.html`, so `/book/<id>` links work on
   refresh and when shared directly.

### Option B — Netlify

1. Push this project to GitHub.
2. Go to [netlify.com](https://netlify.com) → **Add new site → Import an
   existing project** → pick the repo. Build command: `npm run build`.
   Publish directory: `dist`.
3. Go to **Site configuration → Environment variables** and add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as above.
4. Deploy. The `public/_redirects` file in this repo (copied into `dist` on
   build) already routes all paths to `index.html` so deep links work.

### Option C — GitHub Pages

GitHub Pages serves static files but doesn't support env vars at build
time from the UI the way Vercel/Netlify do, so you inject them via GitHub
Actions secrets:

1. Push this project to a GitHub repository.
2. Go to **Settings → Secrets and variables → Actions** and add repository
   secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Add `.github/workflows/deploy.yml`:

   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   permissions:
     contents: read
     pages: write
     id-token: write
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
         - run: npm install
         - run: npm run build
           env:
             VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
             VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
             VITE_BASE: /${{ github.event.repository.name }}/
         - uses: actions/upload-pages-artifact@v3
           with:
             path: dist
     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```

4. In `vite.config.js`, set `base: process.env.VITE_BASE || '/'` so assets
   resolve correctly under `https://<user>.github.io/<repo>/`.
5. In **Settings → Pages**, set the source to **GitHub Actions**.
6. GitHub Pages doesn't rewrite unknown paths to `index.html` by default,
   which breaks direct links to `/book/<id>`. The simplest fix is copying
   `dist/index.html` to `dist/404.html` as an extra build step (GitHub Pages
   serves `404.html` for unmatched routes, and this SPA reads the real path
   from the URL once it loads) — add `cp dist/index.html dist/404.html`
   right after the build step above.

Vercel or Netlify is the easier path — both handle SPA routing and env vars
natively with no extra workaround.

---

## 5. Project structure

```
pdf-flipbook/
├── index.html                 Tailwind CDN + fonts + design tokens
├── src/
│   ├── main.jsx                App entry, router setup
│   ├── App.jsx                 Routes: "/" and "/book/:id"
│   ├── index.css               Base styles
│   ├── lib/
│   │   ├── supabaseClient.js   Supabase client + config check
│   │   ├── pdfToImages.js      Renders a PDF into page images with pdf.js
│   │   └── sound.js             Synthesized page-turn sound (Web Audio API)
│   ├── components/
│   │   ├── UploadZone.jsx      Drag-and-drop "book cover" upload target
│   │   ├── BookStage.jsx       The react-pageflip 3D book
│   │   ├── ShareSeal.jsx       Wax-seal "copy link" button
│   │   └── ProgressRibbon.jsx  Slim progress indicator
│   └── pages/
│       ├── Home.jsx            Upload page
│       └── Book.jsx            Flipbook viewer page
├── supabase/schema.sql         Table + RLS + storage bucket policies
├── vercel.json                 SPA rewrite rule for Vercel
├── public/_redirects           SPA rewrite rule for Netlify
└── .env.example
```

---

## 6. Notes, limits, and things to customize

- **File size limit:** the upload zone rejects PDFs over 50MB
  (`MAX_FILE_MB` in `src/components/UploadZone.jsx`). Supabase's free tier
  allows larger files, so raise this if you need to.
- **Privacy model:** any book is viewable by anyone who has the link — there
  is no password. The link itself (a random UUID) is the access control,
  which matches the brief of "send a private link to one person." If you
  need real access control later, add Supabase Auth and tighten the RLS
  policies in `supabase/schema.sql`.
- **Rendering cost:** pages are rasterized in the *visitor's* browser, not
  on a server, so there's no compute bill for you as traffic grows — the
  tradeoff is a short "turning pages into paper" moment the first time each
  visitor opens a book.
- **Sound:** the page-turn sound is synthesized with the Web Audio API
  (`src/lib/sound.js`) rather than an audio file, so there's no asset to
  license or host. Visitors can mute it with the speaker icon.
- **Fonts:** display type is Cormorant Garamond, UI type is Instrument
  Sans, both loaded from Google Fonts in `index.html`.
