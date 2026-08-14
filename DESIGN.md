# glitchin' out — Design

Glitch-art tool. Build a stack of glitch effects, dial each one, re-roll any of them, or hit GLITCHIFY for chaos.

## Concept

glitchin' out is **layered destruction**. The user picks effects one at a time and stacks them. Each slot has a slider that lerps between the effect's neutral defaults and a randomized snapshot of its parameters; a dice button rerolls just that effect's snapshot. The stack is the API — presets are just one-tap stack populators.

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

Glitch-forward. The catalog favors signal corruption, color/optical
aberration, quantization, and analog texture over heavy spatial warps. The
lens warps on offer — `lensDistortion`'s optional barrel/pincushion
`distortion`, and `glitch`'s — are rolled sparingly (off most of the time)
so they read as a lens artifact, not a funhouse mirror. `parallax` is the
one displacement warp, and it earns its place by being driven entirely by
the image's own luminosity: it reads as a depth/displacement glitch rather
than a geometric distortion of the frame.

Listed in picker order (see `EFFECT_ORDER` in `effects.js`):

| Effect | Vibe |
| --- | --- |
| `glitch` | Chonky pixel tears + scanlines + snow |
| `corrupt` | Scanline data corruption — datamosh |
| `pixelSort` | Brightness-sorted pixel slip |
| `scanlineError` | VHS horizontal tears |
| `snow` | TV static — dead channel |
| `lensDistortion` | Lens warp + RGB / prism aberration |
| `parallax` | Pseudo-3D relief — bright pixels lean off dark ones |
| `temporalAberration` | Per-channel temporal frame delay — RGB time trails |
| `invert` | Color inversion |
| `posterize` | Color quantization |
| `dither` | Bayer dither + retro palettes |
| `glyphMap` | ASCII / glyph art conversion |
| `crt` | CRT phosphor + scanlines |
| `convolutionFeedback` | Sharpen/blur feedback datamosh |
| `edge` | Edge-detect outlines |
| `sobel` | Classic edge detection |
| `glowingEdge` | Neon edge outlines |
| `grain` | Film grain texture |
| `lightLeak` | Analog film burn |

Each entry declares:

- `defaults` — neutral / barely-on parameter values (the value at intensity=0)
- `randomize()` — returns a rolled snapshot of params (the value at intensity=100)
- `paramSpecs` — per-param `{ type, min, max }` for safe lerp + clamping
  (`float` / `int` / `vec3`, plus `choice` for discrete enum params; `vec3`
  lerps and clamps component-wise and emits as a DSL `vec3(x, y, z)` call)

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

Datamosh • Mosh+ • Classic • Dead Tape • CRT • Slice • Static • Phantom • Edges • Negative • ASCII • Pico • Halftone • Lo-Fi • Neon

## UI

Layout — the control panel, top to bottom. On mobile this is the whole
page (a single column below the stage). On desktop (≥901px) the same panel
is a fixed 500px column to the *left* of the canvas, with the title bar
spanning the top (landscape split, matching noisedeck).

```
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
| [Photo|Video] [mirror] · (shutter) · [upload] [camera] [film] |
+-------------------------------------------+
```

- Drag handle (`⋮`) reorders within the stack
- 🎲 rerolls the slot's snapshot (live)
- × removes the slot (recompile)
- `+ ADD EFFECT` opens a picker of all effects
- Starter chips replace the whole stack (recompile)
- Bottom bar: mode toggle + mirror on the left, shutter centered, source
  switchers (upload / camera, + flip when a second camera exists) and the
  filmstrip on the right

Mobile: the stage sits on top; stack rows keep their grid; starters scroll
horizontally; the stack section can scroll vertically if it overflows.

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
        ├── handfish-theme.js   Runtime theme picker (Handfish themes)
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
