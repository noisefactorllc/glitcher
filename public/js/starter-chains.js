// SPDX-License-Identifier: MIT
/**
 * Starter chains for Glitcher.
 *
 * A starter is just a stack-populator: "here's a place to start, now mess
 * with it." Each entry is an ordered list of `{ effectId, intensity }`.
 * Clicking a starter replaces the user's current stack with these slots,
 * each with a freshly rolled snapshot.
 *
 * Curated so each one reads as a distinct vibe without needing the
 * user to know what the effects do.
 */

export const STARTERS = [
    {
        name: 'Datamosh',
        slots: [
            { effectId: 'corrupt',              intensity: 70 },
            { effectId: 'chromaticAberration',  intensity: 55 }
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
            { effectId: 'chromaticAberration', intensity: 50 },
            { effectId: 'grain',               intensity: 35 }
        ]
    },
    {
        name: 'Slice',
        slots: [
            { effectId: 'pixelSort',           intensity: 80 },
            { effectId: 'chromaticAberration', intensity: 45 }
        ]
    },
    {
        name: 'Static',
        slots: [
            { effectId: 'degauss', intensity: 55 },
            { effectId: 'snow',    intensity: 80 },
            { effectId: 'grain',   intensity: 60 }
        ]
    },
    {
        name: 'Wormhole',
        slots: [
            { effectId: 'lensWarp',            intensity: 70 },
            { effectId: 'spiral',              intensity: 50 },
            { effectId: 'chromaticAberration', intensity: 60 }
        ]
    },
    {
        name: 'Phantom',
        slots: [
            { effectId: 'convolutionFeedback', intensity: 70 },
            { effectId: 'chromaticAberration', intensity: 50 }
        ]
    },
    {
        name: 'Edges',
        slots: [
            { effectId: 'edge',                intensity: 75 },
            { effectId: 'chromaticAberration', intensity: 55 }
        ]
    },
    {
        name: 'Negative',
        slots: [
            { effectId: 'invert',              intensity: 100 },
            { effectId: 'scanlineError',       intensity: 60 },
            { effectId: 'chromaticAberration', intensity: 55 }
        ]
    },
    {
        name: 'Drift',
        slots: [
            { effectId: 'waves',               intensity: 60 },
            { effectId: 'chromaticAberration', intensity: 55 }
        ]
    }
]
