// SPDX-License-Identifier: MIT
/**
 * CaptureController — owns photo/video capture state.
 *
 * Responsibilities:
 *   - mode toggle (Photo / Video)
 *   - shutter click + spacebar handler
 *   - video recording lifecycle (start / stop / timer ticker)
 *   - delivers captured blobs to the Gallery
 *
 * Holds the renderer lock through `lock` while a photo is being captured
 * (so capture and compile don't race). Video recording is non-blocking;
 * frames keep flowing while the MediaRecorder accumulates.
 */

import { capturePhoto, startVideoRecording } from './capture.js'

export class CaptureController {
    /**
     * @param {object} opts
     * @param {HTMLCanvasElement} opts.canvas
     * @param {{ add: function, download: function }} opts.gallery
     * @param {{ acquire: function, release: function, isHeld: function }} opts.lock
     */
    constructor({ canvas, gallery, lock }) {
        this._canvas = canvas
        this._gallery = gallery
        this._lock = lock
        this._mode = 'photo' // 'photo' | 'video'
        this._recording = null
        this._stopping = false
        this._timerInterval = null
    }

    wire() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => this._setMode(btn.dataset.mode))
        })
        document.getElementById('shutter-btn').addEventListener('click', () => this.trigger())
    }

    /** Called from the shutter button or keyboard. */
    trigger() {
        if (this._mode === 'photo') this._capturePhoto()
        else this._toggleVideo()
    }

    /** Stop any active recording without saving (used on view exit). */
    cancelRecording() {
        if (this._recording) return this._stopRecording()
    }

    _setMode(mode) {
        if (mode !== 'photo' && mode !== 'video') return
        this._mode = mode
        document.querySelectorAll('.mode-btn').forEach(btn => {
            const active = btn.dataset.mode === mode
            btn.classList.toggle('active', active)
            btn.setAttribute('aria-selected', active ? 'true' : 'false')
        })
        document.getElementById('shutter-btn').classList.toggle('video-mode', mode === 'video')
    }

    async _capturePhoto() {
        if (this._lock.isHeld()) return
        this._lock.acquire()
        try {
            const blob = await capturePhoto(this._canvas, { countdown: false })
            const capture = await this._gallery.add('photo', blob, this._canvas)
            this._gallery.download(capture)
            console.log(`[Glitcher] Photo: ${(blob.size / 1024).toFixed(0)}KB`)
        } catch (err) {
            console.error('[Glitcher] Photo capture failed:', err)
        } finally {
            this._lock.release()
        }
    }

    _toggleVideo() {
        // Ignore shutter taps while a stop is mid-flush — otherwise a quick
        // double-tap-to-stop would fall through and start a new recording.
        if (this._stopping) return
        if (this._recording) this._stopRecording()
        else this._startRecording()
    }

    _startRecording() {
        this._recording = startVideoRecording(this._canvas)
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
        // Clear the handle synchronously and gate re-entry (_stopping) so a
        // second shutter press during the async stop() can't stop the same
        // recorder twice (throws) or double-save the clip.
        const recording = this._recording
        this._recording = null
        this._stopping = true
        clearInterval(this._timerInterval)

        // Reset the recording UI immediately — the user asked to stop.
        document.getElementById('shutter-btn').classList.remove('recording')
        document.getElementById('recording-status').classList.add('hidden')
        document.getElementById('recording-timer').textContent = '0:00'

        let blob
        try {
            blob = await recording.stop()
        } finally {
            // Re-open the shutter once the flush is done; the gallery save
            // below is independent and shouldn't block starting a new clip.
            this._stopping = false
        }
        const capture = await this._gallery.add('video', blob, this._canvas)
        this._gallery.download(capture)
        console.log(`[Glitcher] Video: ${(blob.size / 1024 / 1024).toFixed(1)}MB`)
    }
}
