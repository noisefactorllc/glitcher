# Glitcher — Glitch-Centric Identity

Date: 2026-05-24
Status: in-progress (autonomous build, local-only until reviewed)

## The shift

Glitcher today is a reskin of Photobox: pick a preset chip, drag one intensity slider that maps to a hand-tuned lerp inside that one preset. Glitch art folks would call this a filter app. The point of *this* tool is **layered destruction**: stack arbitrary glitch effects, each one randomizable, the stack itself randomizable.

The model becomes:

- **Effect stack** — an ordered list of effects the user assembled (Photoshop adjustment layers, but for glitch).
- **Per-effect intensity** — each slot has its own slider. `0` = the effect's *neutral defaults* (barely on); `100` = a *rolled snapshot* of randomized params for that effect. Slider lerps between them per-param.
- **Per-effect dice (re-roll)** — clicking the die on a slot rerolls just that effect's randomized snapshot. The slider position stays, so the user sees a smooth re-lerp into the new chaos.
- **GLITCHIFY** — global "I don't know what I want" button. Rebuilds the stack with 2-4 random effects, rerolls everything, sets intensities to random 50-100.
- **Starter chains** — a small set of curated multi-effect starting points (Datamosh, Dead Tape, CRT, Static, Slice, Wormhole) that just *populate the stack* as a starting point. They're not the API; the stack is.

## Effect catalog (glitch-focused)

Cull the polish/filter effects (bloom, celShading, grade, seamless, flipMirror, edge-as-illustration). Keep the destruction/lens canon:

| ID | Notes |
|---|---|
| `corrupt` | Datamoshing — scanline data corruption |
| `pixelSort` | Brightness-sorted glitch |
| `scanlineError` | VHS horizontal tears |
| `snow` | TV static |
| `chromaticAberration` | RGB fringing |
| `crt` | CRT sim |
| `degauss` | CRT pulse |
| `lensWarp` | Noise-driven lens |
| `convolutionFeedback` | Sharpen/blur feedback (datamosh feel) |
| `pinch` | Fish-eye lens |
| `waves` | Sine displacement |
| `spiral` | Spiral lens |
| `edge` | Edge detect (glitch-aesthetic) |
| `invert` | Color invert |
| `grain` | Film grain |
| `lightLeak` | Analog film burn |

Each effect declares:
- `id`, `displayName`
- `defaults` — neutral/barely-on param values (so intensity=0 is "this slot is present but doing very little")
- `randomize(rng)` — returns a rolled-snapshot params object inside glitch-art-y ranges
- `paramSpecs` — per-param `{ type: 'int' | 'float', min, max }` for safe lerping/clamping

Effects with no continuous params (e.g. `invert`) just declare `defaults={}` and `randomize()` returns `{}` — intensity is effectively on/off (presence in stack).

## Live model

Each stack slot stores:
```
{ uid: 'slot_3', id: 'corrupt', intensity: 60, rolled: { intensity: 92, bandHeight: 18, ... } }
```

At any moment, the renderer-facing params for a slot are computed:
```
params = lerp(effect.defaults, slot.rolled, slot.intensity / 100)
```

Per `paramSpecs.type`, ints get `Math.round`. Output goes into the renderer's `setStepParameters({ step_N: { ... } })` map.

## Recompile vs live

The Noisemaker renderer supports `applyStepParameterValues` mid-stream (no shader recompile). Use it for:
- Intensity slider drag
- Dice re-roll
- GLITCHIFY's re-roll *if* the stack structure didn't change

Recompile (slow path) is needed only when the chain structure changes:
- Add effect
- Remove effect
- Reorder
- GLITCHIFY when it changes the stack length / composition

Wrap recompile under the existing `Lock` with the same coalescing pattern used for preset clicks.

## UI

```
+----------------------------------+
|        [stage canvas]            |
|        (effect readout)          |
+----------------------------------+
| [GLITCHIFY]                      |
+----------------------------------+
| STACK                            |
|  ┌──────────────────────────┐    |
|  │ ⋮ Corrupt    🎲 ━●━ 60 ×│    |
|  │ ⋮ PixelSort  🎲 ●━━ 18 ×│    |
|  │ ⋮ CRT        🎲 ━━● 92 ×│    |
|  └──────────────────────────┘    |
|  [+ ADD EFFECT]                  |
+----------------------------------+
| STARTERS: Datamosh • Dead Tape … |  (one-tap stack populators)
+----------------------------------+
| [📷] [shutter] [upload] [film]  |
+----------------------------------+
```

- Drag handle (`⋮`) reorders within the stack.
- `🎲` rerolls the slot's snapshot (live, no recompile).
- `×` removes the slot (recompile).
- `+ ADD EFFECT` opens a popover of all glitch effects to append.
- Starters tap to *replace* the stack with that chain (recompile).

Mobile: stack rows stack vertically; starters scroll horizontally.

## Files

New:
- `public/js/effects.js` — catalog
- `public/js/stack.js` — stack state + DSL emit + lerp
- `public/js/stack-editor.js` — UI
- `public/js/starter-chains.js` — curated starting stacks

Modified:
- `public/js/app.js` — coordinate stack instead of preset
- `public/index.html` — replace preset rail + global intensity with stack editor + starter rail + effect picker
- `public/css/components.css`, `layout.css` — stack-editor styling
- `public/js/keyboard.js` — drop arrow cycling (no presets to cycle); keep G (glitchify) and Space (shutter)
- `DESIGN.md` — new model
- `tests/smoke.spec.js` — exercise the stack editor (add, dice, remove, glitchify)

Deleted:
- `public/js/presets.js`
- `public/js/preset-rail.js`

## Out of scope

- Saving/loading user-built stacks (would be nice; not in this pass)
- A "share this stack" URL encoder
- Effect param expert-mode panel (each slot stays one slider — power without complexity)
- Effects that aren't glitch-flavored (bloom, kaleido, color grade, etc.)
