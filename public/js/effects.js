// SPDX-License-Identifier: MIT
/**
 * Glitcher effect catalog.
 *
 * Glitch-only — no spatial distortions, warps, twirls, lens displacements.
 * The "lens" half of glitch art means color aberrations and light leaks,
 * not pinch / spiral / waves / zoom blur. If you want camera warps, build
 * them somewhere else.
 *
 * Each entry is a single Noisemaker filter the user can drop into the stack.
 * For each effect we declare:
 *
 *   defaults      — neutral / barely-on params (the value at intensity=0)
 *   randomize()   — returns a rolled snapshot of params (the value at intensity=100)
 *   paramSpecs    — per-param spec for lerp + emit:
 *                     { type: 'float'|'int', min, max }
 *                     { type: 'choice', choices: ['a','b',...] }   discrete snap
 *   liveTunable   — subset of param names that can be tweaked via
 *                   applyStepParameterValues without a recompile. (Anything
 *                   outside this list forces a recompile when changed.)
 *   tagline       — one-line vibe blurb for the picker
 *
 * Ranges below are verified against
 *   /noisemaker/shaders/effects/filter/<effect>/definition.js
 */

const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1))
const randFloat = (min, max) => min + Math.random() * (max - min)
const randPick = arr => arr[Math.floor(Math.random() * arr.length)]
const randPickN = (arr, n) => {
    const pool = arr.slice()
    const out = []
    while (out.length < n && pool.length) {
        out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
    }
    return out
}

/**
 * Spec helpers for paramSpecs. We deliberately tighten max values below
 * the Noisemaker hard caps in some cases so glitch ranges stay tasteful.
 */
const F = (min, max) => ({ type: 'float', min, max })
const I = (min, max) => ({ type: 'int', min, max })
const C = (...choices) => ({ type: 'choice', choices })

export const EFFECTS = {

    corrupt: {
        id: 'corrupt',
        displayName: 'Corrupt',
        tagline: 'Scanline data corruption — datamosh',
        defaults: {
            intensity: 6, bandHeight: 6, sort: 0, shift: 0,
            channelShift: 0, melt: 0, scatter: 0, bits: 0, speed: 1
        },
        // Always roll `intensity` (master); pick 2-3 flavor knobs to roll, leave
        // the rest at default. lerpParams falls back to defaults for omitted keys.
        randomize: () => {
            const rollers = {
                bandHeight: () => randInt(4, 28),
                sort: () => randInt(0, 90),
                shift: () => randInt(0, 90),
                channelShift: () => randInt(0, 95),
                melt: () => randInt(0, 60),
                scatter: () => randInt(0, 50),
                bits: () => randInt(0, 30),
                speed: () => randInt(1, 4)
            }
            const out = { intensity: randInt(40, 100) }
            for (const k of randPickN(Object.keys(rollers), randInt(2, 3))) {
                out[k] = rollers[k]()
            }
            return out
        },
        paramSpecs: {
            intensity: F(0, 100), bandHeight: F(1, 100), sort: F(0, 100),
            shift: F(0, 100), channelShift: F(0, 100), melt: F(0, 100),
            scatter: F(0, 100), bits: F(0, 100), speed: I(0, 5)
        },
        liveTunable: ['intensity', 'bandHeight', 'sort', 'shift', 'channelShift', 'melt', 'scatter', 'bits', 'speed']
    },

    pixelSort: {
        id: 'pixelSort',
        displayName: 'Pixel Sort',
        tagline: 'Brightness-sorted pixel slip',
        defaults: { angled: 0, alpha: 0.3 },
        randomize: () => ({
            angled: randPick([0, 0, 90, -90, randInt(-180, 180)]),
            alpha: randFloat(0.5, 1.0)
        }),
        paramSpecs: { angled: F(-180, 180), alpha: F(0, 1) },
        liveTunable: ['alpha'],
        // `angled` triggers a multi-pass GPGPU rebuild path on each value
        // change, so we treat it as live-tunable too (Noisemaker re-runs the
        // pipeline) but flag it via heavy: true if perf becomes an issue.
        heavyParams: ['angled']
    },

    scanlineError: {
        id: 'scanlineError',
        displayName: 'Scanline Error',
        tagline: 'VHS horizontal tears',
        defaults: { distortion: 0.4, noise: 0.3, speed: 1 },
        randomize: () => ({
            distortion: randFloat(1.0, 3.0),
            noise: randFloat(0.6, 2.5),
            speed: randFloat(0.5, 3.0)
        }),
        paramSpecs: { distortion: F(0, 3), noise: F(0, 3), speed: F(0, 5) },
        liveTunable: ['distortion', 'noise', 'speed']
    },

    snow: {
        id: 'snow',
        displayName: 'Snow',
        tagline: 'TV static — dead channel',
        defaults: { alpha: 0.08, density: 60 },
        randomize: () => ({
            alpha: randFloat(0.3, 0.95),
            density: randInt(50, 100)
        }),
        paramSpecs: { alpha: F(0, 1), density: F(0, 100) },
        liveTunable: ['alpha', 'density']
    },

    chromaticAberration: {
        id: 'chromaticAberration',
        displayName: 'Chrom. Aberration',
        tagline: 'RGB fringing',
        defaults: { aberration: 10, passthru: 80 },
        randomize: () => ({
            aberration: randInt(40, 95),
            passthru: randInt(30, 80)
        }),
        paramSpecs: { aberration: F(0, 100), passthru: F(0, 100) },
        liveTunable: ['aberration', 'passthru']
    },

    prismaticAberration: {
        id: 'prismaticAberration',
        displayName: 'Prism',
        tagline: 'Hue-rotating prism split',
        defaults: { aberration: 10, hueRotation: 0, hueRange: 0, saturation: 0, passthru: 80 },
        randomize: () => ({
            aberration: randInt(45, 95),
            hueRotation: randInt(-180, 180),
            hueRange: randInt(30, 100),
            saturation: randInt(-40, 80),
            passthru: randInt(25, 70)
        }),
        paramSpecs: {
            aberration: F(0, 100), hueRotation: F(-180, 180),
            hueRange: F(0, 100), saturation: F(-100, 100), passthru: F(0, 100)
        },
        liveTunable: ['aberration', 'hueRotation', 'hueRange', 'saturation', 'passthru']
    },

    crt: {
        id: 'crt',
        displayName: 'CRT',
        tagline: 'Phosphor + scanlines',
        defaults: { alpha: 0.3, speed: 1 },
        randomize: () => ({
            alpha: randFloat(0.6, 1.0),
            speed: randFloat(0.5, 3.0)
        }),
        paramSpecs: { alpha: F(0, 1), speed: F(0, 5) },
        liveTunable: ['alpha', 'speed']
    },

    convolutionFeedback: {
        id: 'convolutionFeedback',
        displayName: 'Feedback',
        tagline: 'Sharpen/blur feedback datamosh',
        defaults: {
            sharpenRadius: 3, sharpenAmount: 0.5,
            blurRadius: 2, blurAmount: 0.15,
            intensity: 0.4
        },
        randomize: () => ({
            sharpenRadius: randInt(4, 9),
            sharpenAmount: randFloat(1.5, 3.0),
            blurRadius: randInt(2, 6),
            blurAmount: randFloat(0.15, 0.7),
            intensity: randFloat(0.65, 0.95)
        }),
        paramSpecs: {
            sharpenRadius: I(1, 10), sharpenAmount: F(0, 3),
            blurRadius: I(1, 10), blurAmount: F(0, 1),
            intensity: F(0, 1)
        },
        liveTunable: ['sharpenAmount', 'blurAmount', 'intensity'],
        heavyParams: ['sharpenRadius', 'blurRadius']
    },

    edge: {
        id: 'edge',
        displayName: 'Edge',
        tagline: 'Edge-detect outlines',
        defaults: { amount: 80, threshold: 0, mix: 30 },
        randomize: () => ({
            amount: randInt(150, 400),
            threshold: randInt(0, 25),
            mix: randInt(60, 100)
        }),
        paramSpecs: { amount: F(0, 500), threshold: F(0, 100), mix: F(0, 100) },
        liveTunable: ['amount', 'threshold', 'mix']
    },

    sobel: {
        id: 'sobel',
        displayName: 'Sobel',
        tagline: 'Classic edge detection',
        defaults: { amount: 0.3, alpha: 0.4 },
        randomize: () => ({
            amount: randFloat(1.0, 4.0),
            alpha: randFloat(0.7, 1.0)
        }),
        paramSpecs: { amount: F(0.1, 5), alpha: F(0, 1) },
        liveTunable: ['amount', 'alpha']
    },

    glowingEdge: {
        id: 'glowingEdge',
        displayName: 'Glow Edge',
        tagline: 'Neon edge outlines',
        defaults: { shape: 'circle', width: 1, alpha: 0.3 },
        randomize: () => ({
            shape: randPick(['circle', 'diamond', 'square', 'star']),
            width: randInt(2, 5),
            alpha: randFloat(0.7, 1.0)
        }),
        paramSpecs: {
            shape: C('circle', 'diamond', 'square', 'star'),
            width: I(0, 10),
            alpha: F(0, 1)
        },
        liveTunable: ['shape', 'width', 'alpha']
    },

    posterize: {
        id: 'posterize',
        displayName: 'Posterize',
        tagline: 'Color quantization',
        defaults: { levels: 12, gamma: 1.0 },
        randomize: () => ({
            levels: randInt(2, 6),
            gamma: randFloat(0.5, 2.0)
        }),
        paramSpecs: { levels: I(2, 32), gamma: F(0.1, 3) },
        liveTunable: ['levels', 'gamma']
    },

    dither: {
        id: 'dither',
        displayName: 'Dither',
        tagline: 'Bayer dither + retro palettes',
        defaults: {
            type: 'bayer4x4', palette: 'input',
            matrixScale: 2, threshold: 0, levels: 8, mix: 0.05
        },
        randomize: () => ({
            type: randPick(['bayer2x2', 'bayer4x4', 'bayer8x8', 'dot', 'line', 'crosshatch', 'noise']),
            palette: randPick(['input', 'monochrome', 'dotMatrixGreen', 'amberMonitor', 'pico8', 'commodore64', 'cgaPalette1', 'zxSpectrum', 'appleII', 'ega']),
            matrixScale: randInt(1, 4),
            threshold: randFloat(-0.2, 0.2),
            levels: randInt(2, 8),
            mix: randFloat(0.5, 1.0)
        }),
        paramSpecs: {
            type: C('bayer2x2', 'bayer4x4', 'bayer8x8', 'dot', 'line', 'crosshatch', 'noise'),
            palette: C('input', 'monochrome', 'dotMatrixGreen', 'amberMonitor', 'pico8', 'commodore64', 'cgaPalette1', 'zxSpectrum', 'appleII', 'ega'),
            matrixScale: I(1, 8),
            threshold: F(-0.5, 0.5),
            levels: I(2, 16),
            mix: F(0, 1)
        },
        liveTunable: ['type', 'palette', 'matrixScale', 'threshold', 'levels', 'mix']
    },

    glyphMap: {
        id: 'glyphMap',
        displayName: 'Glyph Map',
        tagline: 'ASCII / glyph art conversion',
        defaults: { cellSize: 24, colorMode: 'rgb' },
        randomize: () => ({
            cellSize: randInt(8, 22),
            colorMode: randPick(['mono', 'rgb', 'rgb', 'rgb'])
        }),
        paramSpecs: {
            cellSize: I(4, 32),
            colorMode: C('mono', 'rgb')
        },
        liveTunable: ['cellSize', 'colorMode']
    },

    invert: {
        id: 'invert',
        displayName: 'Invert',
        tagline: 'Color inversion',
        defaults: {},
        randomize: () => ({}),
        paramSpecs: {},
        liveTunable: []
    },

    grain: {
        id: 'grain',
        displayName: 'Grain',
        tagline: 'Film grain texture',
        defaults: { alpha: 0.1 },
        randomize: () => ({
            alpha: randFloat(0.3, 0.7)
        }),
        paramSpecs: { alpha: F(0, 1) },
        liveTunable: ['alpha']
    },

    lightLeak: {
        id: 'lightLeak',
        displayName: 'Light Leak',
        tagline: 'Analog film burn',
        defaults: { alpha: 0.15, speed: 0.4 },
        randomize: () => ({
            alpha: randFloat(0.4, 0.85),
            speed: randFloat(0.3, 2.0)
        }),
        paramSpecs: { alpha: F(0, 1), speed: F(0, 5) },
        liveTunable: ['alpha', 'speed']
    }
}

/** Stable display order for the add-effect picker and starters UI. */
export const EFFECT_ORDER = [
    // signal corruption
    'corrupt', 'pixelSort', 'scanlineError', 'snow',
    // color / RGB aberration
    'chromaticAberration', 'prismaticAberration', 'invert',
    // quantize / dither / glyph
    'posterize', 'dither', 'glyphMap',
    // CRT
    'crt',
    // feedback / edge work
    'convolutionFeedback', 'edge', 'sobel', 'glowingEdge',
    // analog texture
    'grain', 'lightLeak'
]

/** Lookup helper. Throws on unknown ids — never silently substitute. */
export function getEffect(id) {
    const e = EFFECTS[id]
    if (!e) throw new Error(`Unknown effect id: ${id}`)
    return e
}

/**
 * Interpolate from defaults toward rolled by t ∈ [0,1], honoring per-param
 * spec. Continuous (int/float) params lerp + clamp. Choice params snap:
 * at t=0 they return the default; at any t>0 they return the rolled value.
 */
export function lerpParams(effect, rolled, t) {
    const out = {}
    for (const name of Object.keys(effect.paramSpecs)) {
        const spec = effect.paramSpecs[name]
        const a = effect.defaults[name]
        const b = rolled[name] ?? a
        if (spec.type === 'choice') {
            out[name] = (t > 0) ? b : a
            continue
        }
        const aN = a ?? 0
        const bN = b ?? aN
        let v = aN + (bN - aN) * t
        v = Math.max(spec.min, Math.min(spec.max, v))
        if (spec.type === 'int') v = Math.round(v)
        out[name] = v
    }
    return out
}

/** Format a single param value as a DSL literal. */
function formatLiteral(value, spec) {
    if (spec.type === 'choice') return String(value)   // unquoted name token
    if (spec.type === 'int') return String(Math.round(value))
    if (Number.isInteger(value)) return value.toFixed(1)
    return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0')
}

/**
 * Emit a single DSL effect call: `corrupt(intensity: 50, ...)`.
 * Used by stack.js to build the chained DSL program.
 */
export function emitEffectCall(effect, paramValues) {
    const names = Object.keys(effect.paramSpecs)
    if (names.length === 0) return `${effect.id}()`
    const args = names
        .map(n => `${n}: ${formatLiteral(paramValues[n], effect.paramSpecs[n])}`)
        .join(', ')
    return `${effect.id}(${args})`
}
