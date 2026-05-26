// SPDX-License-Identifier: MIT
/**
 * Starter chains for Glitcher.
 *
 * A starter is just a stack-populator: "here's a place to start, now mess
 * with it." Each entry is an ordered list of `{ effectId, intensity }`.
 * Clicking a starter replaces the user's current stack with these slots,
 * each with a freshly rolled snapshot.
 *
 * Curated so each one reads as a distinct glitch vibe — signal corruption,
 * VHS dropout, RGB tear, ASCII'd, dithered down — without needing the
 * user to know what the effects do.
 */

export const STARTERS = [
    {
        name: 'Datamosh',
        slots: [
            { effectId: 'corrupt',              intensity: 70 },
            { effectId: 'lensDistortion',  intensity: 55 }
        ]
    },
    {
        name: 'Mosh+',
        slots: [
            { effectId: 'corrupt',              intensity: 75 },
            { effectId: 'convolutionFeedback',  intensity: 70 },
            { effectId: 'lensDistortion',  intensity: 55 }
        ]
    },
    {
        name: 'Classic',
        slots: [
            { effectId: 'glitch',         intensity: 75 },
            { effectId: 'lensDistortion', intensity: 40 }
        ]
    },
    {
        name: 'Dead Tape',
        slots: [
            { effectId: 'scanlineError', intensity: 75 },
            { effectId: 'snow',          intensity: 60 },
            { effectId: 'grain',         intensity: 55 }
        ]
    },
    {
        name: 'CRT',
        slots: [
            { effectId: 'crt',                 intensity: 75 },
            { effectId: 'lensDistortion', intensity: 50 },
            { effectId: 'grain',               intensity: 35 }
        ]
    },
    {
        name: 'Slice',
        slots: [
            { effectId: 'pixelSort',           intensity: 80 },
            { effectId: 'lensDistortion', intensity: 45 }
        ]
    },
    {
        name: 'Static',
        slots: [
            { effectId: 'snow',          intensity: 90 },
            { effectId: 'scanlineError', intensity: 55 },
            { effectId: 'grain',         intensity: 60 }
        ]
    },
    {
        name: 'Phantom',
        slots: [
            { effectId: 'convolutionFeedback', intensity: 70 },
            { effectId: 'lensDistortion', intensity: 50 }
        ]
    },
    {
        name: 'Edges',
        slots: [
            { effectId: 'edge',                intensity: 75 },
            { effectId: 'lensDistortion', intensity: 55 }
        ]
    },
    {
        name: 'Negative',
        slots: [
            { effectId: 'invert',              intensity: 100 },
            { effectId: 'scanlineError',       intensity: 60 },
            { effectId: 'lensDistortion', intensity: 55 }
        ]
    },
    {
        name: 'ASCII',
        slots: [
            { effectId: 'glyphMap',            intensity: 70 },
            { effectId: 'lensDistortion', intensity: 40 }
        ]
    },
    {
        name: 'Pico',
        slots: [
            { effectId: 'dither',        intensity: 90 },
            { effectId: 'scanlineError', intensity: 45 }
        ]
    },
    {
        name: 'Halftone',
        slots: [
            { effectId: 'dither',    intensity: 85 },
            { effectId: 'posterize', intensity: 70 },
            { effectId: 'grain',     intensity: 50 }
        ]
    },
    {
        name: 'Lo-Fi',
        slots: [
            { effectId: 'posterize',     intensity: 70 },
            { effectId: 'scanlineError', intensity: 60 },
            { effectId: 'grain',         intensity: 55 }
        ]
    },
    {
        name: 'Neon',
        slots: [
            { effectId: 'glowingEdge',         intensity: 80 },
            { effectId: 'lensDistortion', intensity: 55 },
            { effectId: 'grain',               intensity: 35 }
        ]
    }
]
