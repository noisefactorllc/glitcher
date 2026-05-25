// SPDX-License-Identifier: MIT
/**
 * Glitcher — State-of-the-art glitch art tool powered by Noisemaker.
 */

import { GlitcherRenderer } from './noisemaker/index.js'
import { MediaSource } from './source.js'
import { PRESETS } from './presets.js'
import { capturePhoto, startVideoRecording } from './capture.js'
import { Gallery } from './gallery.js'
import { enableSwipe } from './swipe.js'
import { aboutDialog } from './about-dialog.js'

class GlitcherApp {
    constructor() {
        this._initialized = false
        this._source = new MediaSource()
        this._renderer = null
        this._gallery = null

        this._currentPresetIdx = 0
        this._intensity = 60
        this._mode = 'photo' // 'photo' | 'video'

        // Renderer lock — only one compile or source swap at a time.
        this._busy = false
        // Coalescing queue for preset requests that arrive while busy.
        // Whoever currently holds _busy drains this before releasing.
        this._pendingPresetIdx = null
        this._pendingPulse = false
        // Cached camera enumeration
        this._cameraCount = null

        this._recording = null
        this._timerInterval = null
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
        if (cameraStarted) {
            this._renderer.setSource(this._source.element)
        }

        this._buildPresetRail()
        this._wireControls()
        this._wireKeyboard()

        if (cameraStarted) {
            await this._applyPreset(this._currentPresetIdx, false)
            await this._checkMultipleCameras()
        }

        this._initialized = true
        console.log('[Glitcher] Ready')
    }

    // ============================================================
    // Preset rail
    // ============================================================

    _buildPresetRail() {
        const rail = document.getElementById('preset-rail')
        rail.innerHTML = ''
        PRESETS.forEach((preset, i) => {
            const btn = document.createElement('button')
            btn.className = 'preset-chip' + (i === 0 ? ' active' : '')
            btn.textContent = preset.name
            btn.dataset.index = i
            btn.setAttribute('role', 'tab')
            btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false')
            btn.addEventListener('click', () => this._applyPreset(i))
            rail.appendChild(btn)
        })
    }

    _setActiveChip(idx) {
        document.querySelectorAll('.preset-chip').forEach((el, i) => {
            const active = i === idx
            el.classList.toggle('active', active)
            el.setAttribute('aria-selected', active ? 'true' : 'false')
        })
        // Manually scroll only the rail, not the page
        const rail = document.getElementById('preset-rail')
        const active = rail.querySelector('.preset-chip.active')
        if (rail && active) {
            const railRect = rail.getBoundingClientRect()
            const chipRect = active.getBoundingClientRect()
            const offset = (chipRect.left + chipRect.right) / 2 - (railRect.left + railRect.right) / 2
            rail.scrollBy({ left: offset, behavior: 'smooth' })
        }
    }

    /**
     * Apply a preset. Rapid clicks coalesce — if the user clicks several
     * chips while a compile is in flight, only the latest request is acted
     * on once the in-flight work resolves. Keeps the user landed on the
     * chip they last tapped, not the first.
     */
    async _applyPreset(idx, pulse = true) {
        this._pendingPresetIdx = idx
        if (pulse) this._pendingPulse = true
        if (this._busy) return  // current owner of _busy will drain on release
        this._busy = true
        try {
            await this._drainPresetQueue()
        } finally {
            this._busy = false
        }
    }

    /** Apply every pending preset request in turn. Caller must hold _busy. */
    async _drainPresetQueue() {
        while (this._pendingPresetIdx !== null) {
            const target = this._pendingPresetIdx
            const shouldPulse = this._pendingPulse
            this._pendingPresetIdx = null
            this._pendingPulse = false

            const preset = PRESETS[target]
            if (!preset) continue
            this._currentPresetIdx = target
            this._setActiveChip(target)
            this._setEffectReadout(preset.name)
            try {
                await this._compileCurrent()
                if (shouldPulse) this._glitchPulse()
            } catch (err) {
                console.error('[Glitcher] Preset compile failed:', err)
            }
        }
    }

    /** Compile the currently selected preset against the current source.
     *  Always primes the renderer's live params from the preset so the
     *  intensity slider keeps the right step references. */
    async _compileCurrent() {
        const preset = PRESETS[this._currentPresetIdx]
        if (!preset || !this._renderer) return
        const i = this._intensity / 100
        this._renderer.clearStepParameters()
        this._renderer.setStepParameters(preset.liveParams(i))
        await this._renderer.compile(preset.build(i))
    }

    _setEffectReadout(name) {
        const el = document.getElementById('effect-readout')
        el.textContent = `▸ ${name}`
    }

    _onIntensityChanged(value) {
        this._intensity = value
        document.getElementById('intensity-value').textContent = String(value)
        const preset = PRESETS[this._currentPresetIdx]
        if (!preset) return
        const i = value / 100
        this._renderer.setStepParameters(preset.liveParams(i))
    }

    // ============================================================
    // Glitchify — random preset + random intensity
    // ============================================================

    async _glitchify() {
        // Pick a different preset if possible
        let next = this._currentPresetIdx
        if (PRESETS.length > 1) {
            while (next === this._currentPresetIdx) {
                next = Math.floor(Math.random() * PRESETS.length)
            }
        }
        // Slider drifts toward chaos but not always pinned
        const value = Math.floor(50 + Math.random() * 50)
        this._intensity = value
        const slider = document.getElementById('intensity')
        slider.value = String(value)
        document.getElementById('intensity-value').textContent = String(value)

        // Visual feedback even before compile finishes
        const btn = document.getElementById('glitchify-btn')
        btn.classList.remove('pulse')
        // Force reflow so re-adding the class restarts the animation
        void btn.offsetWidth
        btn.classList.add('pulse')

        await this._applyPreset(next, true)
    }

    _glitchPulse() {
        const overlay = document.createElement('div')
        overlay.className = 'glitch-pulse-overlay'
        document.body.appendChild(overlay)
        overlay.addEventListener('animationend', () => overlay.remove())
    }

    // ============================================================
    // Image upload / camera switching
    // ============================================================

    async _useUploadedImage(file) {
        if (this._busy) return
        this._busy = true
        try {
            await this._source.useImage(file)
            const w = this._source.width
            const h = this._source.height
            const canvas = document.getElementById('stage-canvas')
            canvas.width = w
            canvas.height = h
            this._renderer.resize(w, h)
            this._renderer.setSource(this._source.element)
            document.getElementById('camera-btn').classList.remove('active')
            document.getElementById('upload-btn').classList.add('active')
            document.getElementById('error-banner').classList.add('hidden')
            await this._compileCurrent()
            await this._drainPresetQueue()
        } catch (err) {
            console.error('[Glitcher] Image load failed:', err)
        } finally {
            this._busy = false
        }
    }

    async _useCamera() {
        if (this._busy) return
        this._busy = true
        try {
            if (!this._source.cameraActive) {
                await this._source.startCamera()
            } else {
                await this._source.resumeCamera()
            }
            const w = this._source.width
            const h = this._source.height
            const canvas = document.getElementById('stage-canvas')
            canvas.width = w
            canvas.height = h
            this._renderer.resize(w, h)
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
            this._busy = false
        }
    }

    async _switchCamera() {
        if (this._busy) return
        this._busy = true
        try {
            await this._source.switchFacingMode()
            this._renderer.setSource(this._source.element)
        } catch (err) {
            console.error('[Glitcher] Camera switch failed:', err)
        } finally {
            this._busy = false
        }
    }

    async _checkMultipleCameras() {
        if (this._cameraCount === null) {
            const devices = await MediaSource.listCameras()
            this._cameraCount = devices.length
        }
        const btn = document.getElementById('camera-flip-btn')
        btn.classList.toggle('hidden', this._cameraCount < 2)
    }

    // ============================================================
    // Capture
    // ============================================================

    async _capturePhoto() {
        if (this._busy) return
        this._busy = true
        try {
            const canvas = document.getElementById('stage-canvas')
            const blob = await capturePhoto(canvas, { countdown: false })
            const capture = await this._gallery.add('photo', blob, canvas)
            this._gallery.download(capture)
            console.log(`[Glitcher] Photo: ${(blob.size / 1024).toFixed(0)}KB`)
        } catch (err) {
            console.error('[Glitcher] Photo capture failed:', err)
        } finally {
            this._busy = false
        }
    }

    _toggleVideo() {
        if (this._recording) this._stopRecording()
        else this._startRecording()
    }

    _startRecording() {
        const canvas = document.getElementById('stage-canvas')
        this._recording = startVideoRecording(canvas)
        document.getElementById('shutter-btn').classList.add('recording')
        document.getElementById('recording-status').classList.remove('hidden')
        this._timerInterval = setInterval(() => {
            const secs = Math.floor(this._recording.elapsed())
            const mm = Math.floor(secs / 60)
            const ss = secs % 60
            document.getElementById('recording-timer').textContent =
                `${mm}:${String(ss).padStart(2, '0')}`
        }, 250)
    }

    async _stopRecording() {
        if (!this._recording) return
        clearInterval(this._timerInterval)
        const blob = await this._recording.stop()
        this._recording = null

        document.getElementById('shutter-btn').classList.remove('recording')
        document.getElementById('recording-status').classList.add('hidden')
        document.getElementById('recording-timer').textContent = '0:00'

        const canvas = document.getElementById('stage-canvas')
        const capture = await this._gallery.add('video', blob, canvas)
        this._gallery.download(capture)
        console.log(`[Glitcher] Video: ${(blob.size / 1024 / 1024).toFixed(1)}MB`)
    }

    // ============================================================
    // Controls
    // ============================================================

    _wireControls() {
        // Preset cycle via swipe on the canvas
        const canvasWrap = document.querySelector('.canvas-wrap')
        this._swipe = enableSwipe(canvasWrap, {
            onSwipeLeft: () => this._cyclePreset(1),
            onSwipeRight: () => this._cyclePreset(-1)
        })

        // GLITCHIFY
        document.getElementById('glitchify-btn').addEventListener('click', () => this._glitchify())

        // Intensity slider
        const slider = document.getElementById('intensity')
        slider.addEventListener('input', (e) => {
            this._onIntensityChanged(Number(e.target.value))
        })
        // Initialize value
        slider.value = String(this._intensity)
        document.getElementById('intensity-value').textContent = String(this._intensity)

        // Mode toggle
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._mode = btn.dataset.mode
                document.querySelectorAll('.mode-btn').forEach(b =>
                    b.classList.toggle('active', b === btn))
                document.querySelectorAll('.mode-btn').forEach(b =>
                    b.setAttribute('aria-selected', b === btn ? 'true' : 'false'))
                const shutter = document.getElementById('shutter-btn')
                shutter.classList.toggle('video-mode', this._mode === 'video')
            })
        })

        // Shutter
        document.getElementById('shutter-btn').addEventListener('click', () => {
            if (this._mode === 'photo') this._capturePhoto()
            else this._toggleVideo()
        })

        // Camera/upload
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

        // Mirror
        document.getElementById('mirror-btn').addEventListener('click', () => {
            document.getElementById('app').classList.toggle('mirrored')
            document.getElementById('mirror-btn').classList.toggle('active')
        })

        // About
        document.getElementById('about-btn').addEventListener('click', () => {
            aboutDialog.show()
        })

        // Pause render when tab hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this._renderer?.stop()
            else this._renderer?.resume()
        })
    }

    _cyclePreset(direction) {
        let next = this._currentPresetIdx + direction
        if (next < 0) next = PRESETS.length - 1
        if (next >= PRESETS.length) next = 0
        this._applyPreset(next)
    }

    _wireKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Don't capture when typing in inputs
            if (e.target.matches('input, textarea, select')) return

            switch (e.key.toLowerCase()) {
                case 'g':
                    this._glitchify()
                    e.preventDefault()
                    break
                case ' ':
                    if (this._mode === 'photo') this._capturePhoto()
                    else this._toggleVideo()
                    e.preventDefault()
                    break
                case 'arrowleft':
                    this._cyclePreset(-1)
                    e.preventDefault()
                    break
                case 'arrowright':
                    this._cyclePreset(1)
                    e.preventDefault()
                    break
                case 'm':
                    document.getElementById('mirror-btn').click()
                    e.preventDefault()
                    break
            }
        })
    }
}

const app = new GlitcherApp()
app.init().catch(err => console.error('[Glitcher] Init failed:', err))
