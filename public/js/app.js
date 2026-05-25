// SPDX-License-Identifier: MIT
/**
 * Glitcher — glitch-art tool powered by Noisemaker.
 *
 * Top-level coordinator. Owns the EffectStack and decides whether each
 * model change is "live" (push params to the renderer mid-stream) or
 * "structural" (recompile the DSL). Subsystems:
 *
 *   - source.js              MediaSource (camera + image upload)
 *   - noisemaker/renderer.js GlitcherRenderer (DSL compile + texture upload)
 *   - effects.js             Effect catalog (defaults, randomize, paramSpecs)
 *   - stack.js               EffectStack (slot list, DSL + live-params emit)
 *   - stack-editor.js        StackEditor (DOM view + interactions)
 *   - starter-chains.js      Curated multi-effect starting stacks
 *   - capture-controller.js  CaptureController (photo / video mode + recording)
 *   - keyboard.js            wireKeyboard (keyboard shortcuts)
 *   - gallery.js             Gallery (filmstrip + IndexedDB)
 *   - lock.js                Lock (serializes renderer access)
 */

import { GlitcherRenderer } from './noisemaker/index.js'
import { MediaSource } from './source.js'
import { EffectStack, pickRandomEffectIds } from './stack.js'
import { StackEditor } from './stack-editor.js'
import { STARTERS } from './starter-chains.js'
import { Gallery } from './gallery.js'
import { CaptureController } from './capture-controller.js'
import { wireKeyboard } from './keyboard.js'
import { Lock } from './lock.js'
import { aboutDialog } from './about-dialog.js'
import { mountThemePicker } from './handfish-theme.js'
import {
    saveLocal, loadLocal, consumeShareHash,
    buildShareUrl, copyToClipboard
} from './persistence.js'

class GlitcherApp {
    constructor() {
        this._initialized = false
        this._source = new MediaSource()
        this._renderer = null
        this._gallery = null
        this._editor = null
        this._capture = null
        this._lock = new Lock()

        this._stack = new EffectStack()

        // Coalescing flag: structural changes coming in while a recompile
        // is in flight are merged — the lock-holder re-checks _dirty on
        // each loop iteration and recompiles once more if it changed.
        this._dirty = false

        this._cameraCount = null

        // Debounce live-saves so dragging an intensity slider doesn't
        // hammer localStorage on every frame.
        this._saveTimer = null
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

        // Pick the initial stack: shared URL → localStorage → first starter.
        const sharedSpecs = consumeShareHash()
        const savedSpecs = sharedSpecs ?? loadLocal()
        if (savedSpecs && savedSpecs.length > 0) {
            this._stack.replaceFromSnapshot(savedSpecs)
        } else {
            this._stack.replace(STARTERS[0].slots)
        }

        this._editor = new StackEditor({
            stack: this._stack,
            starters: STARTERS,
            onIntensityInput: (uid, v) => this._onSlotIntensity(uid, v),
            onReroll:         (uid)    => this._onSlotReroll(uid),
            onRemove:         (uid)    => this._onSlotRemove(uid),
            onMove:           (uid, i) => this._onSlotMove(uid, i),
            onAdd:            (id)     => this._onAddEffect(id),
            onStarter:        (i)      => this._onStarter(i)
        })
        this._editor.init()

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
            onMirror:    () => document.getElementById('mirror-btn').click(),
            onRerollAll: () => this._rerollAll()
        })

        if (cameraStarted) {
            await this._recompile()
            await this._checkMultipleCameras()
        }

        this._initialized = true
        console.log('[Glitcher] Ready')
    }

    // ============================================================
    // Recompile path (structural changes — add/remove/reorder/starter)
    // ============================================================

    /**
     * Build the current DSL and push live params. Coalesces — if another
     * structural change lands while we're compiling, we loop again.
     */
    async _recompile() {
        this._dirty = true
        if (this._lock.isHeld()) return
        this._lock.acquire()
        try {
            while (this._dirty) {
                this._dirty = false
                const dsl = this._stack.buildDsl()
                this._renderer.clearStepParameters()
                this._renderer.setStepParameters(this._stack.buildLiveParams())
                try {
                    await this._renderer.compile(dsl)
                } catch (err) {
                    console.error('[Glitcher] Compile failed:', err)
                }
            }
        } finally {
            this._lock.release()
        }
    }

    /** Push current per-slot params live (no recompile). */
    _pushLive() {
        if (!this._renderer) return
        this._renderer.setStepParameters(this._stack.buildLiveParams())
    }

    /**
     * Persist the current stack to localStorage. Coalesces rapid calls
     * (intensity slider drag) into a single write 250ms after the last call.
     */
    _scheduleSave() {
        if (this._saveTimer) clearTimeout(this._saveTimer)
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null
            saveLocal(this._stack.slots)
        }, 250)
    }

    // ============================================================
    // Slot event handlers
    // ============================================================

    _onSlotIntensity(uid, value) {
        if (!this._stack.setIntensity(uid, value)) return
        this._pushLive()
        this._scheduleSave()
    }

    _onSlotReroll(uid) {
        if (!this._stack.reroll(uid)) return
        this._editor.pulseReroll(uid)
        this._pushLive()
        this._scheduleSave()
    }

    _onSlotRemove(uid) {
        if (!this._stack.remove(uid)) return
        this._editor.renderStack()
        this._recompile()
        this._scheduleSave()
    }

    _onSlotMove(uid, toIndex) {
        if (!this._stack.move(uid, toIndex)) return
        this._editor.renderStack()
        this._recompile()
        this._scheduleSave()
    }

    _onAddEffect(effectId) {
        this._stack.add(effectId, 60)
        this._editor.renderStack()
        this._recompile()
        this._scheduleSave()
    }

    _onStarter(starterIdx) {
        const starter = STARTERS[starterIdx]
        if (!starter) return
        this._stack.replace(starter.slots)
        this._editor.renderStack()
        this._recompile()
        this._scheduleSave()
    }

    // ============================================================
    // Global glitch actions
    // ============================================================

    /** Build a new random stack of 2-4 effects, then recompile. */
    async _glitchify() {
        const n = 2 + Math.floor(Math.random() * 3) // 2..4
        const ids = pickRandomEffectIds(n)
        const specs = ids.map(id => ({
            effectId: id,
            intensity: Math.floor(50 + Math.random() * 51)
        }))
        this._stack.replace(specs)
        this._editor.renderStack()
        this._editor.pulseGlitchifyButton()
        StackEditor.showGlitchPulse()
        await this._recompile()
        this._scheduleSave()
    }

    /** Re-roll every slot's snapshot without changing composition. */
    _rerollAll() {
        if (this._stack.isEmpty) return
        this._stack.rerollAll()
        for (const slot of this._stack.slots) this._editor.pulseReroll(slot.uid)
        this._pushLive()
        this._scheduleSave()
    }

    /**
     * Build a share URL for the current stack and copy to clipboard.
     * Shows a brief toast on success / failure so the user knows.
     */
    async _share() {
        if (this._stack.isEmpty) {
            this._toast('Nothing to share — add an effect first.')
            return
        }
        const url = buildShareUrl(this._stack.slots)
        const ok = await copyToClipboard(url)
        if (ok) {
            this._toast('Link copied to clipboard')
        } else {
            // Clipboard blocked — show the URL in a prompt so user can copy.
            this._toast('Couldn\'t copy automatically; URL in console')
            console.log('[Glitcher] Share URL:', url)
        }
    }

    /** Small transient banner near the share button. */
    _toast(message) {
        const el = document.createElement('div')
        el.className = 'glitch-toast'
        el.textContent = message
        document.body.appendChild(el)
        el.addEventListener('animationend', () => el.remove())
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
            const dsl = this._stack.buildDsl()
            this._renderer.clearStepParameters()
            this._renderer.setStepParameters(this._stack.buildLiveParams())
            await this._renderer.compile(dsl)
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
            const dsl = this._stack.buildDsl()
            this._renderer.clearStepParameters()
            this._renderer.setStepParameters(this._stack.buildLiveParams())
            await this._renderer.compile(dsl)
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
    // Top-level control wiring
    // ============================================================

    _wireControls() {
        document.getElementById('glitchify-btn').addEventListener('click', () => this._glitchify())
        document.getElementById('share-btn')?.addEventListener('click', () => this._share())

        document.getElementById('camera-btn').classList.add('active')
        document.getElementById('camera-btn').addEventListener('click', () => this._useCamera())
        document.getElementById('camera-flip-btn').addEventListener('click', () => this._switchCamera())
        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('file-input').click()
        })
        document.getElementById('file-input').addEventListener('change', (e) => {
            const file = e.target.files?.[0]
            if (file) this._useUploadedImage(file)
            e.target.value = ''
        })

        document.getElementById('mirror-btn').addEventListener('click', () => {
            document.getElementById('app').classList.toggle('mirrored')
            document.getElementById('mirror-btn').classList.toggle('active')
        })

        document.getElementById('about-btn').addEventListener('click', () => aboutDialog.show())

        // Settings dialog (native <dialog>). The inline <script> in index.html
        // already applied the saved theme before paint, so the picker only
        // needs to wire the dropdown UI for changes the user makes here.
        const settingsDialog = document.getElementById('settings-dialog')
        const themeHost = document.getElementById('theme-picker-host')
        if (themeHost) mountThemePicker({ container: themeHost, storageKey: 'glitcher.theme.v1', defaultTheme: 'synthwave' })
        document.getElementById('settings-btn').addEventListener('click', () => {
            settingsDialog?.showModal()
        })
        document.getElementById('settings-close').addEventListener('click', () => {
            settingsDialog?.close()
        })

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this._renderer?.stop()
            else this._renderer?.resume()
        })
    }
}

const app = new GlitcherApp()
app.init().catch(err => console.error('[Glitcher] Init failed:', err))
