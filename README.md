# fishes11 — IchthyoMorph

Photo-measured procedural fish anatomy generator (React + Vite + Tailwind + Three.js).

## Layout note: split files

Every file in this repo is kept at or below 30,000 bytes. Four source files
exceed that as single files, so they are stored as numbered parts and
reassembled automatically before dev/build:

| Generated file | Parts |
| --- | --- |
| `src/data/species1.ts` (40,626 B) | `src/data/parts/species1.part01.txt` (28,959 B), `species1.part02.txt` (11,667 B) |
| `src/data/species2.ts` (34,317 B) | `src/data/parts/species2.part01.txt` (28,786 B), `species2.part02.txt` (5,531 B) |
| `src/data/species3.ts` (37,343 B) | `src/data/parts/species3.part01.txt` (28,930 B), `species3.part02.txt` (8,413 B) |
| `src/engine/build.ts` (54,597 B) | `src/engine/parts/build.part01.txt` (28,835 B), `build.part02.txt` (25,762 B) |

Concatenating each part set in order reproduces the original file byte for
byte. `tools/reassemble.mjs` does this and refuses to build if any part
exceeds 30,000 bytes; it runs via the `predev` / `prebuild` / `prepreview`
npm hooks, or manually with `npm run reassemble`. The generated files are
gitignored. Edit the parts, not the generated files.

## Run

```sh
npm install
npm run dev     # or: npm run build
```

`package-lock.json` is not committed; `npm install` regenerates it.
