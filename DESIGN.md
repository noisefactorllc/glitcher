# Glitcher — Design

Glitch-art tool. Build a stack of glitch effects, dial each one, re-roll any of them, or hit GLITCHIFY for chaos.

## Concept

Glitcher is **layered destruction**. The user picks effects one at a time and stacks them. Each slot has a slider that lerps between the effect's neutral defaults and a randomized snapshot of its parameters; a dice button rerolls just that effect's snapshot. The stack is the API — presets are just one-tap stack populators.

Aims for the response *"yeah"* from a glitch-art person, not *"looks like an Instagram filter."*

## Inputs

- Live camera (default)
- Uploaded image (still input replaces camera)
- Front/rear camera switch where available

## Output

- Photo (PNG)
- Video (WebM)
- Filmstrip + IndexedDB persistence; download to disk
- Everything stays local

## Effects (glitch catalog)

Glitch only — no spatial distortions, warps, twirls, lens displacements.
"Lens effects" here means color/optical aberrations and light leaks, not
camera-warp tricks.

| Effect | Vibe |
| --- | --- |
| `corrupt` | Datamosh — scanline data corruption |
| `pixelSort` | Brightness-sorted glitch |
| `scanlineError` | VHS horizontal tears |
| `snow` | TV static |
| `chromaticAberration` | RGB fringing |
| `prismaticAberration` | Hue-rotating prism split |
| `invert` | Color inversion |
| `posterize` | Color quantization |
| `dither` | Bayer dither + retro palettes |
| `glyphMap` | ASCII / glyph art |
| `crt` | CRT phosphor + scanlines |
| `convolutionFeedback` | Sharpen/blur feedback datamosh |
| `edge` | Edge-detect outlines |
| `sobel` | Classic Sobel edges |
| `glowingEdge` | Neon edge outlines |
| `grain` | Film grain |
| `lightLeak` | Analog film burn |

Each entry declares:

- `defaults` — neutral / barely-on parameter values (the value at intensity=0)
- `randomize()` — returns a rolled snapshot of params (the value at intensity=100)
- `paramSpecs` — per-param `{ type, min, max }` for safe lerp + clamping

## Stack

A stack is an ordered list of slots:

```
{ uid, effectId, intensity (0..100), rolled (param snapshot) }
```

At any moment, the params sent to the GPU for a slot are `lerp(effect.defaults, slot.rolled, slot.intensity / 100)`.

Slot indexing into the renderer: `media()` is `step_0`. The first stack slot is `step_1`, second `step_2`, etc. Live param updates land via `renderer.setStepParameters({ step_N: { ... } })` — no shader recompile.

### Recompile vs live

The Noisemaker renderer supports `applyStepParameterValues` mid-stream. That covers:

- Intensity slider drag (per slot)
- Dice re-roll (per slot or all-at-once)

Recompile (slow path, under the `Lock`) is required when the chain itself changes:

- Add effect
- Remove effect
- Reorder
- Replace via starter chain
- GLITCHIFY (rebuilds composition)

The `Lock` coalesces structural changes the same way preset clicks used to.

## Persistence + share

The current stack auto-saves to `localStorage` (debounced 250ms for slider drags) so a reload restores the last state.

A SHARE button copies a `#s=...` URL to the clipboard that encodes the entire stack — slot ids, intensities, and rolled snapshots — as URL-safe base64 JSON. Opening that URL restores the exact look, then clears the hash so subsequent edits flow into localStorage instead.

## Starter chains

A small set of curated multi-effect starting points that populate the stack as a starting state. They are not the API — the stack is.

Datamosh • Mosh+ • Dead Tape • CRT • Slice • Static • Phantom • Edges • Negative • ASCII • Pico • Halftone • Lo-Fi • Neon

## UI

Layout (desktop):

```
+-------------------------------------------+
|             [Stage: full canvas]          |
|                                           |
+-------------------------------------------+
| [GLITCHIFY]      [RE-ROLL ALL]  [SHARE]   |
+-------------------------------------------+
| STACK            [+ ADD EFFECT]           |
|  ⋮ Corrupt     🎲 ━━●━━━ 60  ×           |
|  ⋮ PixelSort   🎲 ●━━━━━ 18  ×           |
|  ⋮ CRT         🎲 ━━━━●━ 90  ×           |
+-------------------------------------------+
| START  Datamosh • Dead Tape • CRT • …     |
+-------------------------------------------+
| [📷|🎥] [shutter] [upload] [filmstrip]    |
+-------------------------------------------+
```

- Drag handle (`⋮`) reorders within the stack
- 🎲 rerolls the slot's snapshot (live)
- × removes the slot (recompile)
- `+ ADD EFFECT` opens a picker of all effects
- Starter chips replace the whole stack (recompile)

Mobile: stack rows keep their grid; starters scroll horizontally; the stack section can scroll vertically if it overflows.

## Keyboard

| Key | Action |
|-----|--------|
| `g` | GLITCHIFY (rebuild random stack) |
| `r` | Re-roll all slots (composition unchanged) |
| Space | Shutter (capture) |
| `m` | Mirror flip |

## Architecture

```
glitcher/
├── package.json
├── README.md
├── DESIGN.md
├── docs/superpowers/specs/    Design history
└── public/
    ├── index.html
    ├── manifest.json
    ├── icon.svg
    ├── css/
    │   ├── colors.css
    │   ├── layout.css
    │   └── components.css
    └── js/
        ├── app.js              Top-level coordinator
        ├── source.js           MediaSource (camera + image upload)
        ├── effects.js          Effect catalog (defaults + randomize + specs)
        ├── stack.js            EffectStack (slot list + DSL emit + lerp)
        ├── stack-editor.js     DOM view + interactions
        ├── starter-chains.js   Curated multi-effect starting stacks
        ├── persistence.js      localStorage + URL-share encoding
        ├── capture-controller.js
        ├── capture.js
        ├── gallery.js
        ├── db.js
        ├── keyboard.js
        ├── lock.js
        ├── about-dialog.js
        └── noisemaker/
            ├── index.js
            ├── bundle.js
            └── renderer.js
```

## Tech

- Pure client-side, vanilla ES modules
- Noisemaker via `shaders.noisedeck.app` CDN
- Handfish design tokens + AboutDialog via `handfish.noisefactor.io`
- `http-server` for `npm run dev`
- Playwright for smoke tests

## License

MIT.
