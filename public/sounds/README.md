# Page-turn sound

Drop a file named exactly **`page-turn.mp3`** in this folder
(`public/sounds/page-turn.mp3`) and the app will use it automatically —
`src/lib/sound.js` loads it from `/sounds/page-turn.mp3`.

Until you add one, the app plays a synthesized paper-flutter sound instead
(built with the Web Audio API, no file needed), so nothing breaks — it just
sounds a bit more "generated" than a real recording.

## Where to get a good one (free, no attribution required)

Both of these let you preview in-browser before downloading, so you can
pick one that actually sounds right rather than guessing from a filename:

- **Pixabay Sound Effects** — https://pixabay.com/sound-effects/search/page%20flip/
  Royalty-free, no attribution required, includes a commercial-use license.
- **Mixkit Sound Effects** — https://mixkit.co/free-sound-effects/page/
  Free for commercial and personal projects, attribution appreciated but
  not required.

Look for something described as a soft single "book page turn" or "paper
flip" (roughly 0.3–1 second long) rather than a long rustling loop — the
app plays it once per page turn, so a short, crisp sample reads best.

## Steps

1. Preview a few and download the one you like as an `.mp3`.
2. Rename it to `page-turn.mp3`.
3. Put it in this folder, replacing nothing (there's no file here yet).
4. Redeploy — see the README's Vercel section for how to push updates.

That's it — no code changes needed, the path is already wired up.
