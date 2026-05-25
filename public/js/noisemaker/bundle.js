// SPDX-License-Identifier: MIT
/**
 * ESM bundle loader for Noisemaker Shaders Core
 *
 * Dynamically imports from the appropriate ESM bundle:
 * - Non-minified for local development (localhost, 127.0.0.1, file://)
 * - Minified for production
 */

const SHADER_CDN = 'https://shaders.noisedeck.app/1'

const isLocalDev = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:'
)

const bundlePath = isLocalDev
    ? `${SHADER_CDN}/noisemaker-shaders-core.esm.js`
    : `${SHADER_CDN}/noisemaker-shaders-core.esm.min.js`

const bundle = await import(bundlePath)
console.debug(`[bundle.js] Noisemaker bundle loaded from ${bundlePath}`)

export const {
    CanvasRenderer,
    ProgramState,
    registerEffect,
    getEffect,
    getAllEffects,
    compile,
    validate,
    extractEffectNamesFromDsl,
    extractEffectsFromDsl,
    cloneParamValue,
    stdEnums
} = bundle

export const _bundle = bundle
