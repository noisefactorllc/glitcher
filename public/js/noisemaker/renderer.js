// SPDX-License-Identifier: MIT
/**
 * GlitcherRenderer — wraps CanvasRenderer with support for video OR image sources.
 *
 * The source texture is uploaded every frame (always re-upload videos; for
 * images we still re-upload so a swap from camera -> image just works).
 *
 * Effect-step parameters can be tweaked live via setStepParameters() without
 * recompiling — this is how the intensity slider stays smooth.
 */

import { CanvasRenderer, extractEffectNamesFromDsl, getAllEffects } from './bundle.js'

const SHADER_CDN = 'https://shaders.noisedeck.app/1'

export class GlitcherRenderer {
    constructor(canvas, options = {}) {
        this._canvas = canvas
        this.width = options.width || canvas?.width || 1280
        this.height = options.height || canvas?.height || 720

        this._renderer = new CanvasRenderer({
            canvas,
            canvasContainer: canvas?.parentElement || null,
            width: this.width,
            height: this.height,
            basePath: SHADER_CDN,
            preferWebGPU: false,
            useBundles: true,
            bundlePath: `${SHADER_CDN}/effects`,
            alpha: false,
            preserveDrawingBuffer: options.preserveDrawingBuffer ?? true,
            onError: options.onError
        })

        this._initialized = false
        this._source = null
        this._sourceKind = null // 'video' | 'image' | 'canvas'
        this._animRAF = null
        this._currentDsl = ''
        this._liveParams = {}
        // Last imageSize pushed to step_0, so the per-frame upload loop only
        // re-pushes the uniform when the dimensions actually change (or after a
        // recompile, which resets step uniforms — see _invalidateImageSize).
        this._lastImageW = -1
        this._lastImageH = -1
    }

    /**
     * Force the next _uploadSourceTexture() to re-push step_0's imageSize.
     * Call after anything that resets the program's step uniforms (compile)
     * or changes the source dimensions (resize).
     */
    _invalidateImageSize() {
        this._lastImageW = -1
        this._lastImageH = -1
    }

    async init() {
        if (this._initialized) return
        await this._renderer.loadManifest()
        this._initialized = true
    }

    /**
     * Set the texture source.
     * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement} source
     */
    setSource(source) {
        this._source = source
        if (source instanceof HTMLVideoElement) this._sourceKind = 'video'
        else if (source instanceof HTMLImageElement) this._sourceKind = 'image'
        else if (source instanceof HTMLCanvasElement) this._sourceKind = 'canvas'
        else this._sourceKind = null
    }

    /** Compile a DSL program and start rendering. */
    async compile(dsl) {
        if (!this._initialized) throw new Error('Renderer not initialized')
        this._currentDsl = dsl

        const effectData = extractEffectNamesFromDsl(dsl, this._renderer.manifest || {})
        const registered = getAllEffects()
        const toLoad = effectData
            .map(e => e.effectId)
            .filter(id => {
                const dotKey = id.replace('/', '.')
                return !registered.has(id) && !registered.has(dotKey)
            })
        if (toLoad.length > 0) await this._renderer.loadEffects(toLoad)

        await this._renderer.compile(dsl)
        this._renderer.start()
        this._applyLiveParams()
        // A fresh compile rebuilds the program, resetting step_0's imageSize
        // uniform — force the upload below to re-push it.
        this._invalidateImageSize()
        this._uploadSourceTexture()
        this._startLoop()
    }

    /**
     * Apply a parameter values map of the form
     *   { step_0: { strength: 50 }, step_1: { speed: 100 } }
     * Stored so subsequent compile() calls re-apply them.
     */
    setStepParameters(values) {
        Object.assign(this._liveParams, values)
        this._applyLiveParams()
    }

    /** Clear any stored live parameter overrides (call before compile of new preset) */
    clearStepParameters() {
        this._liveParams = {}
    }

    _applyLiveParams() {
        if (!this._renderer.applyStepParameterValues) return
        if (Object.keys(this._liveParams).length === 0) return
        try {
            this._renderer.applyStepParameterValues(this._liveParams)
        } catch (e) {
            console.warn('[Glitcher] applyStepParameterValues failed:', e)
        }
    }

    _uploadSourceTexture() {
        if (!this._source) return
        if (this._sourceKind === 'video' && this._source.readyState < 2) return

        this._renderer.updateTextureFromSource?.('imageTex_step_0', this._source, { flipY: false })
        // imageSize only changes on resize/recompile, so skip the redundant
        // per-frame uniform push when it hasn't moved since the last upload.
        if (this.width !== this._lastImageW || this.height !== this._lastImageH) {
            this._renderer.applyStepParameterValues?.({ step_0: { imageSize: [this.width, this.height] } })
            this._lastImageW = this.width
            this._lastImageH = this.height
        }
    }

    _startLoop() {
        if (this._animRAF) return
        const tick = () => {
            this._uploadSourceTexture()
            this._animRAF = requestAnimationFrame(tick)
        }
        this._animRAF = requestAnimationFrame(tick)
    }

    resume() {
        if (!this._currentDsl) return
        // No _invalidateImageSize() here: start()/stop() only toggle the render
        // loop, not the compiled program, so step_0's imageSize uniform survives
        // a visibility toggle. (A GL context loss while hidden would wipe it —
        // along with the program and textures — but there's no context-restore
        // path anywhere, so that's a pre-existing limitation, not one this adds.)
        this._renderer.start()
        this._uploadSourceTexture()
        this._startLoop()
    }

    stop() {
        if (this._animRAF) {
            cancelAnimationFrame(this._animRAF)
            this._animRAF = null
        }
        this._renderer.stop?.()
    }

    resize(width, height) {
        this.width = width
        this.height = height
        this._invalidateImageSize()
        this._renderer.resize?.(width, height)
    }

    destroy() {
        this.stop()
        // CanvasRenderer exposes `dispose()`, not `destroy()` — calling the
        // latter optionally-chained silently no-oped and leaked the GL context.
        // dispose() is async; teardown failure shouldn't reject into the caller.
        Promise.resolve(this._renderer.dispose?.()).catch(e =>
            console.warn('[Glitcher] Renderer dispose failed:', e))
        this._source = null
    }
}
