// SPDX-License-Identifier: MIT
/**
 * Glitcher effect catalog.
 *
 * Each entry is a single Noisemaker filter the user can drop into the stack.
 * For each effect we declare:
 *
 *   defaults      — neutral / barely-on params (the value at intensity=0)
 *   randomize()   — returns a rolled snapshot of params (the value at intensity=100)
 *   paramSpecs    — per-param { type, min, max } for safe lerp + clamping
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

/**
 * Spec helpers for paramSpecs. We deliberately tighten max values below
 * the Noisemaker hard caps in some cases so glitch ranges stay tasteful.
 */
const F = (min, max) => ({ type: 'float', min, max })
const I = (min, max) => ({ type: 'int', min, max })

export const EFFECTS = {

    corrupt: {
        id: 'corrupt',
        displayName: 'Corrupt',
        tagline: 'Scanline data corruption — datamosh',
        defaults: {
            intensity: 6, bandHeight: 6, sort: 0, shift: 0,
            channelShift: 0, melt: 0, scatter: 0, bits: 0, speed: 1
        },
        randomize: () => ({
            intensity: randInt(40, 100),
            bandHeight: randInt(4, 28),
            sort: randInt(0, 90),
            shift: randInt(0, 90),
            channelShift: randInt(0, 95),
            melt: randInt(0, 60),
            scatter: randInt(0, 50),
            bits: randInt(0, 30),
            speed: randInt(1, 4)
        }),
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

    crt: {
        id: 'crt',
        displayName: 'CRT',
        tagline: 'Phosphor + curvature',
        defaults: { alpha: 0.3, speed: 1 },
        randomize: () => ({
            alpha: randFloat(0.6, 1.0),
            speed: randFloat(0.5, 3.0)
        }),
        paramSpecs: { alpha: F(0, 1), speed: F(0, 5) },
        liveTunable: ['alpha', 'speed']
    },

    degauss: {
        id: 'degauss',
        displayName: 'Degauss',
        tagline: 'CRT magnetic pulse',
        defaults: { displacement: 0.02, direction: 0, speed: 1 },
        randomize: () => ({
            displacement: randFloat(0.06, 0.22),
            direction: randInt(-180, 180),
            speed: randFloat(0.5, 2.0)
        }),
        paramSpecs: { displacement: F(0, 0.25), direction: F(-180, 180), speed: F(0, 2) },
        liveTunable: ['displacement', 'direction', 'speed']
    },

    lensWarp: {
        id: 'lensWarp',
        displayName: 'Lens Warp',
        tagline: 'Noise-driven radial lens',
        defaults: { displacement: 0.015 },
        randomize: () => ({
            displacement: randFloat(0.08, 0.22)
        }),
        paramSpecs: { displacement: F(0, 0.25) },
        liveTunable: ['displacement']
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

    pinch: {
        id: 'pinch',
        displayName: 'Pinch',
        tagline: 'Fish-eye lens distortion',
        defaults: { strength: 0, rotation: 0 },
        randomize: () => ({
            strength: randInt(40, 95),
            rotation: randInt(-90, 90)
        }),
        paramSpecs: { strength: F(0, 100), rotation: F(-180, 180) },
        liveTunable: ['strength', 'rotation']
    },

    waves: {
        id: 'waves',
        displayName: 'Waves',
        tagline: 'Sine displacement',
        defaults: { strength: 2, scale: 1, speed: 1, rotation: 0 },
        randomize: () => ({
            strength: randInt(15, 70),
            scale: randFloat(1, 4),
            speed: randInt(-4, 4),
            rotation: randInt(-180, 180)
        }),
        paramSpecs: {
            strength: F(0, 100), scale: F(1, 5),
            speed: I(-5, 5), rotation: F(-180, 180)
        },
        liveTunable: ['strength', 'scale', 'speed', 'rotation']
    },

    spiral: {
        id: 'spiral',
        displayName: 'Spiral',
        tagline: 'Spiral lens vortex',
        defaults: { strength: 0, speed: 0, rotation: 0 },
        randomize: () => ({
            strength: randInt(-90, 90),
            speed: randInt(-3, 3),
            rotation: randInt(-180, 180)
        }),
        paramSpecs: {
            strength: F(-100, 100), speed: I(-5, 5),
            rotation: F(-180, 180)
        },
        liveTunable: ['strength', 'speed', 'rotation']
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
    'corrupt', 'pixelSort', 'scanlineError', 'snow',
    'chromaticAberration', 'crt', 'degauss', 'lensWarp',
    'convolutionFeedback', 'pinch', 'waves', 'spiral',
    'edge', 'invert', 'grain', 'lightLeak'
]

/** Lookup helper. Throws on unknown ids — never silently substitute. */
export function getEffect(id) {
    const e = EFFECTS[id]
    if (!e) throw new Error(`Unknown effect id: ${id}`)
    return e
}

/**
 * Interpolate from defaults toward rolled by t ∈ [0,1], honoring per-param
 * type (int → rounded) and clamping to paramSpecs bounds.
 */
export function lerpParams(effect, rolled, t) {
    const out = {}
    for (const name of Object.keys(effect.paramSpecs)) {
        const spec = effect.paramSpecs[name]
        const a = effect.defaults[name] ?? 0
        const b = rolled[name] ?? a
        let v = a + (b - a) * t
        v = Math.max(spec.min, Math.min(spec.max, v))
        if (spec.type === 'int') v = Math.round(v)
        out[name] = v
    }
    return out
}

/** Format a single param value as a DSL literal. ints emit unquoted ints. */
function formatLiteral(value, spec) {
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
