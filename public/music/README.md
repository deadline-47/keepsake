# Background music

Drop up to 3 songs in this folder, named exactly:

```
public/music/track-1.mp3
public/music/track-2.mp3
public/music/track-3.mp3
```

They play in that order — track 1, then 2, then 3 — then loop back to
track 1, for as long as she's on the book page. It only plays there, never
on the homepage, and only starts once she interacts with the book (flips a
page or taps an arrow) — browsers block audio from starting on its own
before that.

## Want more or fewer than 3?

Open `src/pages/Book.jsx` and edit this line near the top:

```js
const BACKGROUND_TRACKS = ['/music/track-1.mp3', '/music/track-2.mp3', '/music/track-3.mp3']
```

Add or remove paths (and matching files) — any number works.

## Volume

Set by `BACKGROUND_VOLUME` right below that line in the same file
(currently `0.14`, i.e. quite soft). Raise it toward `1` for louder, lower
it toward `0` for quieter.

## One thing worth knowing

This is a personal project so use whatever songs you like — but once a
file is here, it's served as a plain public URL on your site (the same way
the PDF itself is). That's a reasonable trade-off for a private link sent
to one person, just noting it's not access-locked the way it would need to
be for, say, a commercial app distributing music.

## Where to get MP3s of songs you already have

If you own the song (bought it, ripped it from a CD, etc.), you can
convert it to MP3 with any local converter — the file just needs to end up
named `track-1.mp3` etc. and be under a few MB so it loads quickly.
