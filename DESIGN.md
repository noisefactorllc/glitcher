# Glitcher — Design

State-of-the-art glitch art application. Uses Noisemaker's corrupt/glitch/feedback/lens effects with camera and media input.

## Concept

A focused glitch-art tool. Unlike Photobox (single effect per photo), Glitcher's identity is **layered destruction**:
multiple effects stacked into chaotic chains, dialed by intensity, randomized at the tap of a button.

## Inputs

- Live camera (default)
- Uploaded image (still input replaces camera)
- Front/rear camera switch where available

## Output

- Photo (PNG)
- Video (WebM)
- Filmstrip + IndexedDB persistence; download to disk
- Everything stays local

## Effects (Noisemaker)

Pulled from the corruption-class end of `noisemaker/shaders/effects/filter/`:

| Effect | Role |
| --- | --- |
| `chromaticAberration` | RGB color fringing |
| `corrupt` | Scanline data corruption (bands, sort, shift, channelShift) |
| `crt` | CRT monitor simulation |
| `scanlineError` | VHS-style horizontal tears |
| `snow` | TV static |
| `grain` | Film grain |
| `degauss` | CRT degauss pulse |
| `lensWarp` | Noise-driven radial lens distortion |
| `pixelSort` | Brightness-sorted pixel glitch |
| `convolutionFeedback` | Sharpen/blur feedback (datamosh feel) |
| `lightLeak` | Analog film burn |
| `bloom` / `waves` / `spiral` / `seamless` / `flipMirror` / `edge` / `celShading` / `grade` / `invert` / `pinch` | Polish & shape |

## Glitch Presets

15 presets, each a multi-effect DSL chain:

- **Datamosh** — `corrupt` + `chromaticAberration`
- **Dead Tape** — `scanlineError` + `snow` + `grain`
- **CRT** — `crt` + `chromaticAberration`
- **Drift** — `waves` × 2 + `chromaticAberration`
- **Slice** — `pixelSort` + `chromaticAberration`
- **Hexed** — `seamless` + `spiral` + `chromaticAberration`
- **Burnout** — `bloom` + `lightLeak` + `grain`
- **Phantom** — `convolutionFeedback` + `chromaticAberration`
- **Static** — `degauss` + `snow` + `grain`
- **Pinch** — `pinch` + `chromaticAberration`
- **Wormhole** — `lensWarp` + `spiral` + `chromaticAberration`
- **Mirrors** — `flipMirror` + `waves` + `chromaticAberration`
- **Edges** — `edge` + `chromaticAberration`
- **Noir** — `celShading` + `grade(preset: noir)` + `chromaticAberration`
- **Invert** — `invert` + `scanlineError` + `chromaticAberration`

## UI

Layout (desktop):

```
+-------------------------------------------+
|             [Stage: full canvas]          |
|                                           |
|                                           |
+-------------------------------------------+
| [GLITCHIFY] [intensity: ============o ]   |
+-------------------------------------------+
| [Datamosh] [Dead Tape] [CRT] [Drift] ...  |  <- horizontal preset rail
+-------------------------------------------+
| [📷|🎥] [shutter] [upload] [filmstrip]    |
+-------------------------------------------+
```

Layout (mobile): same components stacked. Preset rail scrolls horizontally.

## Architecture

```
glitcher/
├── package.json
├── README.md
├── DESIGN.md
└── public/
    ├── index.html
    ├── manifest.json
    ├── icon.svg
    ├── css/
    │   ├── colors.css        Tokens
    │   ├── layout.css        Page layout
    │   └── components.css    Buttons, sliders, chips
    └── js/
        ├── app.js            Main controller
        ├── source.js         Camera + image upload source manager
        ├── presets.js        Glitch preset definitions
        ├── glitchify.js      Random preset/intensity generator
        ├── capture.js        Photo / video capture (lifted from photobox)
        ├── gallery.js        Filmstrip + IndexedDB (lifted from photobox)
        ├── db.js             IndexedDB helpers (lifted from photobox)
        ├── swipe.js          Swipe gestures (lifted from photobox)
        ├── about-dialog.js   About modal
        └── noisemaker/       Renderer wrapper (lifted from photobox)
            ├── index.js
            ├── bundle.js
            └── renderer.js
```

## Intensity

Each preset declares a list of `intensityParams` — effect-step parameter
references that scale with the intensity slider. Updating the slider calls
`applyStepParameterValues` on the renderer without recompiling, so it feels
live.

## Glitchify

Picks a random preset, randomizes intensity (50–100), and applies. Also
adds a subtle screen flash (the "act of glitching").

## Tech

- Pure client-side, vanilla ES modules
- Noisemaker via `shaders.noisedeck.app` CDN
- Handfish design system tokens + AboutDialog via `handfish.noisefactor.io`
- `http-server` for `npm run dev`
- Playwright for tests (not implemented in initial cut — TODO)

## License

MIT. Open source.
