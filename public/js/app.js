// SPDX-License-Identifier: MIT
/**
 * Glitcher — State-of-the-art glitch art tool powered by Noisemaker.
 *
 * This module is the top-level coordinator. Subsystems live in:
 *   - source.js              MediaSource (camera + image upload)
 *   - noisemaker/renderer.js GlitcherRenderer (DSL compile + texture upload)
 *   - presets.js             Preset definitions (DSL builders + liveParams)
 *   - preset-rail.js         PresetRail (chip rail / readout / slider view)
 *   - capture-controller.js  CaptureController (photo / video mode + recording)
 *   - keyboard.js            wireKeyboard (keyboard shortcuts)
 *   - gallery.js             Gallery (filmstrip + IndexedDB)
 *   - lock.js                Lock (serializes renderer access)
 */

import { GlitcherRenderer } from './noisemaker/index.js'
import { MediaSource } from './source.js'
import { PRESETS } from './presets.js'
import { PresetRail } from './preset-rail.js'
import { Gallery } from './gallery.js'
import { CaptureController } from './capture-controller.js'
import { wireKeyboard } from './keyboard.js'
import { enableSwipe } from './swipe.js'
import { Lock } from './lock.js'
import { aboutDialog } from './about-dialog.js'

class GlitcherApp {
    constructor() {
        this._initialized = false
        this._source = new MediaSource()
        this._renderer = null
        this._gallery = null
        this._rail = null
        this._capture = null
        this._lock = new Lock()

        this._currentPresetIdx = 0
        this._intensity = 60

        // Coalescing queue: rapid preset clicks land here while the renderer
        // lock is busy. Whoever currently holds the lock drains the queue
        // before releasing it, so the user lands on the last tap, not the first.
        this._pendingPresetIdx = null
        this._pendingPulse = false

        this._cameraCount = null
        this._swipe = null
    }

    async init() {
        if (this._initialized) return
        console.log('[Glitcher] Initializing...')

        const errorBanner = document.getElementById('error-banner')
        let cameraStarted = false
        try {
            await this._source.startCamera()
            cameraStarted = true
            console.log(`[Glitcher] Camera ${this._source.width}x${this._source.height}`)
        } catch (err) {
            console.warn('[Glitcher] Camera unavailable, awaiting image upload:', err)
            errorBanner.classList.remove('hidden')
        }

        this._gallery = new Gallery(document.getElementById('filmstrip-thumbs'))
        await this._gallery.init()

        const canvas = document.getElementById('stage-canvas')
        const w = this._source.width || 1280
        const h = this._source.height || 720
        canvas.width = w
        canvas.height = h

        this._renderer = new GlitcherRenderer(canvas, {
            width: w,
            height: h,
            preserveDrawingBuffer: true,
            onError: (e) => console.warn('[Glitcher] Renderer error:', e)
        })
        await this._renderer.init()
        if (cameraStarted) this._renderer.setSource(this._source.element)

        this._rail = new PresetRail({
            presets: PRESETS,
            onChipClick: (idx) => this._applyPreset(idx),
            onIntensityInput: (v) => this._onIntensityChanged(v)
        })
        this._rail.init(this._intensity)

        this._capture = new CaptureController({
            canvas,
            gallery: this._gallery,
            lock: this._lock
        })
        this._capture.wire()

        this._wireControls()

        wireKeyboard({
            onGlitchify: () => this._glitchify(),
            onCapture:   () => this._capture.trigger(),
            onPrev:      () => this._cyclePreset(-1),
            onNext:      () => this._cyclePreset(1),
            onMirror:    () => document.getElementById('mirror-btn').click()
        })

        if (cameraStarted) {
            await this._applyPreset(this._currentPresetIdx, false)
            await this._checkMultipleCameras()
        }

        this._initialized = true
        console.log('[Glitcher] Ready')
    }

    // ============================================================
    // Preset application + coalescing queue
    // ============================================================

    /** Compile the currently selected preset against the current source. */
    async _compileCurrent() {
        const preset = PRESETS[this._currentPresetIdx]
        if (!preset || !this._renderer) return
        const i = this._intensity / 100
        this._renderer.clearStepParameters()
        this._renderer.setStepParameters(preset.liveParams(i))
        await this._renderer.compile(preset.build(i))
    }

    /**
     * Apply a preset. Rapid clicks coalesce — if the user clicks several
     * chips while a compile is in flight, the latest request is applied
     * once the in-flight work resolves.
     */
    async _applyPreset(idx, pulse = true) {
        this._pendingPresetIdx = idx
        if (pulse) this._pendingPulse = true
        if (this._lock.isHeld()) return
        this._lock.acquire()
        try {
            await this._drainPresetQueue()
        } finally {
            this._lock.release()
        }
    }

    /** Apply every pending preset request. Caller must hold the lock. */
    async _drainPresetQueue() {
        while (this._pendingPresetIdx !== null) {
            const target = this._pendingPresetIdx
            const shouldPulse = this._pendingPulse
            this._pendingPresetIdx = null
            this._pendingPulse = false

            const preset = PRESETS[target]
            if (!preset) continue
            this._currentPresetIdx = target
            this._rail.setActiveChip(target)
            this._rail.setReadout(preset.name)
            try {
                await this._compileCurrent()
                if (shouldPulse) PresetRail.showGlitchPulse()
            } catch (err) {
                console.error('[Glitcher] Preset compile failed:', err)
            }
        }
    }

    _onIntensityChanged(value) {
        this._intensity = value
        this._rail.setIntensity(value)
        const preset = PRESETS[this._currentPresetIdx]
        if (!preset) return
        this._renderer.setStepParameters(preset.liveParams(value / 100))
    }

    _cyclePreset(direction) {
        let next = this._currentPresetIdx + direction
        if (next < 0) next = PRESETS.length - 1
        if (next >= PRESETS.length) next = 0
        this._applyPreset(next)
    }

    async _glitchify() {
        let next = this._currentPresetIdx
        if (PRESETS.length > 1) {
            while (next === this._currentPresetIdx) {
                next = Math.floor(Math.random() * PRESETS.length)
            }
        }
        const value = Math.floor(50 + Math.random() * 50)
        this._intensity = value
        this._rail.setIntensity(value)
        this._rail.pulseGlitchifyButton()
        await this._applyPreset(next, true)
    }

    // ============================================================
    // Source switching (camera ↔ image upload)
    // ============================================================

    async _useUploadedImage(file) {
        if (this._lock.isHeld()) return
        this._lock.acquire()
        try {
            await this._source.useImage(file)
            this._resizeForSource()
            this._renderer.setSource(this._source.element)
            document.getElementById('camera-btn').classList.remove('active')
            document.getElementById('upload-btn').classList.add('active')
            document.getElementById('error-banner').classList.add('hidden')
            await this._compileCurrent()
            await this._drainPresetQueue()
        } catch (err) {
            console.error('[Glitcher] Image load failed:', err)
        } finally {
            this._lock.release()
        }
    }

    async _useCamera() {
        if (this._lock.isHeld()) return
        this._lock.acquire()
        try {
            if (!this._source.cameraActive) await this._source.startCamera()
            else await this._source.resumeCamera()
            this._resizeForSource()
            this._renderer.setSource(this._source.element)
            document.getElementById('upload-btn').classList.remove('active')
            document.getElementById('camera-btn').classList.add('active')
            document.getElementById('error-banner').classList.add('hidden')
            await this._checkMultipleCameras()
            await this._compileCurrent()
            await this._drainPresetQueue()
        } catch (err) {
            console.error('[Glitcher] Camera start failed:', err)
            document.getElementById('error-banner').classList.remove('hidden')
        } finally {
            this._lock.release()
        }
    }

    async _switchCamera() {
        if (this._lock.isHeld()) return
        this._lock.acquire()
        try {
            await this._source.switchFacingMode()
            this._renderer.setSource(this._source.element)
        } catch (err) {
            console.error('[Glitcher] Camera switch failed:', err)
        } finally {
            this._lock.release()
        }
    }

    _resizeForSource() {
        const w = this._source.width
        const h = this._source.height
        const canvas = document.getElementById('stage-canvas')
        canvas.width = w
        canvas.height = h
        this._renderer.resize(w, h)
    }

    async _checkMultipleCameras() {
        if (this._cameraCount === null) {
            const devices = await MediaSource.listCameras()
            this._cameraCount = devices.length
        }
        document.getElementById('camera-flip-btn').classList.toggle('hidden', this._cameraCount < 2)
    }

    // ============================================================
    // Top-level control wiring (everything not owned by a subsystem)
    // ============================================================

    _wireControls() {
        // Swipe on the canvas cycles presets
        this._swipe = enableSwipe(document.querySelector('.canvas-wrap'), {
            onSwipeLeft: () => this._cyclePreset(1),
            onSwipeRight: () => this._cyclePreset(-1)
        })

        // GLITCHIFY
        document.getElementById('glitchify-btn').addEventListener('click', () => this._glitchify())

        // Source buttons
        document.getElementById('camera-btn').classList.add('active')
        document.getElementById('camera-btn').addEventListener('click', () => this._useCamera())
        document.getElementById('camera-flip-btn').addEventListener('click', () => this._switchCamera())
        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('file-input').click()
        })
        document.getElementById('file-input').addEventListener('change', (e) => {
            const file = e.target.files?.[0]
            if (file) this._useUploadedImage(file)
            e.target.value = '' // allow re-selecting the same file
        })

        // Mirror flip
        document.getElementById('mirror-btn').addEventListener('click', () => {
            document.getElementById('app').classList.toggle('mirrored')
            document.getElementById('mirror-btn').classList.toggle('active')
        })

        // About
        document.getElementById('about-btn').addEventListener('click', () => aboutDialog.show())

        // Pause renderer when tab is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this._renderer?.stop()
            else this._renderer?.resume()
        })
    }
}

const app = new GlitcherApp()
app.init().catch(err => console.error('[Glitcher] Init failed:', err))
