# Only When Alone

A short browser horror game inspired by the 2026 film *Leviticus* (dir. Adrian Chiarella). Built for a class project on sound design.

## Play

Open `dist/index.html` in Chrome, or visit the deployed Vercel link.

## Build from source

```
npm install
node build.mjs
```

This bundles `src/` and `template.html` into a single file at `dist/index.html`.

## Structure

- `src/main.js`: scenes, story and game systems
- `src/audio.js`: Web Audio sound design (all synthesized)
- `src/core.js`: renderer, PS1-style post effects, models
- `src/title.js`: title screen art
- `template.html`: HTML and CSS
