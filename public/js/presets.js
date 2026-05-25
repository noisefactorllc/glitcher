// SPDX-License-Identifier: MIT
/**
 * Glitch presets for Glitcher.
 *
 * Each preset is a multi-effect Noisemaker DSL chain.
 *
 *   search synth, filter, classicNoisedeck
 *   media().effectA(...).effectB(...).write(o0)
 *   render(o0)
 *
 * Each preset declares:
 *   - build(i)      -> DSL string at compile time. `i` is normalized 0..1.
 *   - liveParams(i) -> step-parameter overrides applied via
 *                       renderer.setStepParameters({ step_N: {...} })
 *                       without recompiling, so the slider feels instant.
 *
 * Step indexing convention:
 *   media() is step_0. The first chained effect is step_1, the second
 *   step_2, etc. `liveParams` keys MUST match the chain emitted in `build`.
 *
 * All parameter names and ranges are verified against
 * /noisemaker/shaders/effects/filter/<effect>/definition.js.
 */

const lerp = (a, b, i) => a + (b - a) * i
const r = v => Math.round(v)
/** Clamp to range [lo, hi] */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export const PRESETS = [

    // ---------------------------------------------------------
    // DATAMOSH — corruption + RGB split + feedback
    //   filter/corrupt:       intensity 0-100, bandHeight 1-100, sort 0-100,
    //                         shift 0-100, channelShift 0-100, speed 0-5
    //   filter/chromaticAberration: aberration 0-100, passthru 0-100
    // ---------------------------------------------------------
    {
        name: 'Datamosh',
        build(i) {
            return [
                'search synth, filter',
                `media().corrupt(intensity: ${r(lerp(20, 95, i))}, bandHeight: ${r(lerp(8, 22, i))}, sort: ${r(lerp(0, 80, i))}, shift: ${r(lerp(0, 80, i))}, channelShift: ${r(lerp(0, 90, i))}, speed: 2).chromaticAberration(aberration: ${r(lerp(10, 80, i))}, passthru: ${r(lerp(80, 30, i))}).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: {
                    intensity: r(lerp(20, 95, i)),
                    bandHeight: r(lerp(8, 22, i)),
                    sort: r(lerp(0, 80, i)),
                    shift: r(lerp(0, 80, i)),
                    channelShift: r(lerp(0, 90, i))
                },
                step_2: {
                    aberration: r(lerp(10, 80, i)),
                    passthru: r(lerp(80, 30, i))
                }
            }
        }
    },

    // ---------------------------------------------------------
    // DEAD TAPE — VHS scanline tears + snow + grain
    //   filter/scanlineError: distortion 0-3, noise 0-3, speed 0-5
    //   filter/snow:           alpha 0-1, density 0-100
    //   filter/grain:          alpha 0-1
    // ---------------------------------------------------------
    {
        name: 'Dead Tape',
        build(i) {
            return [
                'search synth, filter',
                `media().scanlineError(distortion: ${(0.5 + i * 2.5).toFixed(2)}, noise: ${(0.4 + i * 2.0).toFixed(2)}, speed: 1).snow(alpha: ${(0.05 + i * 0.4).toFixed(2)}, density: ${r(lerp(40, 95, i))}).grain(alpha: ${(0.1 + i * 0.45).toFixed(2)}).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: {
                    distortion: 0.5 + i * 2.5,
                    noise: 0.4 + i * 2.0
                },
                step_2: {
                    alpha: 0.05 + i * 0.4,
                    density: r(lerp(40, 95, i))
                },
                step_3: { alpha: 0.1 + i * 0.45 }
            }
        }
    },

    // ---------------------------------------------------------
    // CRT — CRT curvature + chromatic aberration + scanlines
    //   filter/crt:            alpha 0-1, speed 0-5
    //   filter/chromaticAberration
    // ---------------------------------------------------------
    {
        name: 'CRT',
        build(i) {
            return [
                'search synth, filter',
                `media().crt(alpha: ${(0.3 + i * 0.7).toFixed(2)}, speed: 1).chromaticAberration(aberration: ${r(lerp(15, 75, i))}, passthru: 60).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: { alpha: 0.3 + i * 0.7 },
                step_2: { aberration: r(lerp(15, 75, i)), passthru: 60 }
            }
        }
    },

    // ---------------------------------------------------------
    // DRIFT — wave displacement + RGB split
    //   filter/waves:          strength 0-..., speed, rotation
    //   filter/chromaticAberration
    // ---------------------------------------------------------
    {
        name: 'Drift',
        build(i) {
            return [
                'search synth, filter',
                `media().waves(strength: ${r(lerp(2, 18, i))}, speed: 4, rotation: -45).waves(strength: ${r(lerp(2, 14, i))}, speed: 5, rotation: 45).chromaticAberration(aberration: ${r(lerp(20, 90, i))}, passthru: 70).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: { strength: r(lerp(2, 18, i)) },
                step_2: { strength: r(lerp(2, 14, i)) },
                step_3: { aberration: r(lerp(20, 90, i)), passthru: 70 }
            }
        }
    },

    // ---------------------------------------------------------
    // SLICE — pixel sorting + RGB shimmer
    //   filter/pixelSort:      angled -180..180
    //   filter/chromaticAberration
    // ---------------------------------------------------------
    {
        name: 'Slice',
        build(i) {
            const angle = r(lerp(0, 90, i))
            return [
                'search synth, filter',
                `media().pixelSort(angled: ${angle}).chromaticAberration(aberration: ${r(lerp(20, 80, i))}, passthru: 65).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: { angled: r(lerp(0, 90, i)) },
                step_2: { aberration: r(lerp(20, 80, i)) }
            }
        }
    },

    // ---------------------------------------------------------
    // HEXED — kaleido tile + spiral + RGB
    // ---------------------------------------------------------
    {
        name: 'Hexed',
        build(i) {
            return [
                'search synth, filter',
                `media().seamless(blend: 0.5, repeat: ${r(lerp(1, 4, i))}).spiral(strength: ${r(lerp(0, -60, i))}, speed: 1).chromaticAberration(aberration: ${r(lerp(20, 80, i))}, passthru: 70).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: { repeat: r(lerp(1, 4, i)) },
                step_2: { strength: r(lerp(0, -60, i)) },
                step_3: { aberration: r(lerp(20, 80, i)) }
            }
        }
    },

    // ---------------------------------------------------------
    // BURNOUT — analog warmth: bloom + lightLeak + grain
    //   filter/bloom, filter/lightLeak (alpha 0-1), filter/grain
    // ---------------------------------------------------------
    {
        name: 'Burnout',
        build(i) {
            return [
                'search synth, filter',
                `media().bloom(threshold: ${(0.55 - i * 0.25).toFixed(2)}, intensity: ${(0.25 + i * 0.5).toFixed(2)}, radius: 69, taps: 25, softKnee: 0.1).lightLeak(alpha: ${(0.15 + i * 0.5).toFixed(2)}).grain(alpha: ${(0.1 + i * 0.4).toFixed(2)}).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: {
                    threshold: 0.55 - i * 0.25,
                    intensity: 0.25 + i * 0.5
                },
                step_2: { alpha: 0.15 + i * 0.5 },
                step_3: { alpha: 0.1 + i * 0.4 }
            }
        }
    },

    // ---------------------------------------------------------
    // PHANTOM — convolution feedback + RGB shimmer
    //   filter/convolutionFeedback: sharpenRadius 1-10, sharpenAmount 0-3,
    //                                blurRadius 1-10, blurAmount 0-1, feedback 0-1
    //   filter/chromaticAberration
    // ---------------------------------------------------------
    {
        name: 'Phantom',
        build(i) {
            return [
                'search synth, filter',
                `media().convolutionFeedback(sharpenRadius: 5, sharpenAmount: ${(0.5 + i * 2.0).toFixed(2)}, blurRadius: 4, blurAmount: ${(0.2 + i * 0.6).toFixed(2)}, intensity: ${(0.5 + i * 0.4).toFixed(2)}).chromaticAberration(aberration: ${r(lerp(20, 90, i))}, passthru: 60).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: {
                    sharpenAmount: 0.5 + i * 2.0,
                    blurAmount: 0.2 + i * 0.6,
                    intensity: 0.5 + i * 0.4
                },
                step_2: { aberration: r(lerp(20, 90, i)) }
            }
        }
    },

    // ---------------------------------------------------------
    // STATIC — pure noise: snow + grain + degauss pulse
    //   filter/degauss: displacement 0-0.25, direction -180..180
    // ---------------------------------------------------------
    {
        name: 'Static',
        build(i) {
            return [
                'search synth, filter',
                `media().degauss(displacement: ${(0.02 + i * 0.13).toFixed(3)}, direction: 0).snow(alpha: ${(0.1 + i * 0.55).toFixed(2)}, density: 80).grain(alpha: ${(0.15 + i * 0.5).toFixed(2)}).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: { displacement: 0.02 + i * 0.13 },
                step_2: { alpha: 0.1 + i * 0.55 },
                step_3: { alpha: 0.15 + i * 0.5 }
            }
        }
    },

    // ---------------------------------------------------------
    // PINCH — fish-eye with RGB
    // ---------------------------------------------------------
    {
        name: 'Pinch',
        build(i) {
            return [
                'search synth, filter',
                `media().pinch(strength: ${r(lerp(0, 90, i))}).chromaticAberration(aberration: ${r(lerp(10, 75, i))}, passthru: 65).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: { strength: r(lerp(0, 90, i)) },
                step_2: { aberration: r(lerp(10, 75, i)) }
            }
        }
    },

    // ---------------------------------------------------------
    // WORMHOLE — noise-driven lens warp + spiral (spiral.strength min -100)
    //   filter/lensWarp:   displacement 0-0.25
    //   filter/spiral:     strength -100..100, speed -5..5
    // ---------------------------------------------------------
    {
        name: 'Wormhole',
        build(i) {
            return [
                'search synth, filter',
                `media().lensWarp(displacement: ${(0.02 + i * 0.18).toFixed(3)}).spiral(strength: ${r(lerp(0, -95, i))}, speed: ${clamp(r(lerp(1, 4, i)), -5, 5)}).chromaticAberration(aberration: ${r(lerp(10, 85, i))}, passthru: 60).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: { displacement: 0.02 + i * 0.18 },
                step_2: {
                    strength: r(lerp(0, -95, i)),
                    speed: clamp(r(lerp(1, 4, i)), -5, 5)
                },
                step_3: { aberration: r(lerp(10, 85, i)) }
            }
        }
    },

    // ---------------------------------------------------------
    // MIRRORS — kaleido-like flip with waves
    // ---------------------------------------------------------
    {
        name: 'Mirrors',
        build(i) {
            return [
                'search synth, filter',
                `media().flipMirror(mode: mirrorRtoL).waves(strength: ${r(lerp(0, 10, i))}, speed: 3, rotation: 0).chromaticAberration(aberration: ${r(lerp(20, 80, i))}, passthru: 70).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_2: { strength: r(lerp(0, 10, i)) },
                step_3: { aberration: r(lerp(20, 80, i)) }
            }
        }
    },

    // ---------------------------------------------------------
    // EDGES — edge-detect outlines + RGB
    //   filter/edge: threshold 0-100 (lower = more edges)
    // ---------------------------------------------------------
    {
        name: 'Edges',
        build(i) {
            return [
                'search synth, filter',
                `media().edge(threshold: ${r(lerp(40, 8, i))}).chromaticAberration(aberration: ${r(lerp(20, 90, i))}, passthru: 70).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: { threshold: r(lerp(40, 8, i)) },
                step_2: { aberration: r(lerp(20, 90, i)) }
            }
        }
    },

    // ---------------------------------------------------------
    // NOIR — comic shading + noir grade + heavy aberration
    // ---------------------------------------------------------
    {
        name: 'Noir',
        build(i) {
            return [
                'search synth, filter',
                `media().celShading(mix: ${(0.4 + i * 0.5).toFixed(2)}, edgeThreshold: ${(0.4 - i * 0.3).toFixed(2)}).grade(preset: noir).chromaticAberration(aberration: ${r(lerp(0, 60, i))}, passthru: 70).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_1: {
                    mix: 0.4 + i * 0.5,
                    edgeThreshold: 0.4 - i * 0.3
                },
                step_3: { aberration: r(lerp(0, 60, i)) }
            }
        }
    },

    // ---------------------------------------------------------
    // INVERT — color inversion + RGB shimmer + scanlines
    // ---------------------------------------------------------
    {
        name: 'Invert',
        build(i) {
            return [
                'search synth, filter',
                `media().invert().scanlineError(distortion: ${(0.2 + i * 1.0).toFixed(2)}, noise: ${(0.2 + i * 0.8).toFixed(2)}, speed: 1).chromaticAberration(aberration: ${r(lerp(15, 70, i))}, passthru: 70).write(o0)`,
                'render(o0)'
            ].join('\n\n')
        },
        liveParams(i) {
            return {
                step_2: {
                    distortion: 0.2 + i * 1.0,
                    noise: 0.2 + i * 0.8
                },
                step_3: { aberration: r(lerp(15, 70, i)) }
            }
        }
    }
]
