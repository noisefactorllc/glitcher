// SPDX-License-Identifier: MIT
/**
 * MediaSource — switchable input: live camera OR uploaded image.
 *
 * Wraps a video element (for the camera) and an image element (for uploads).
 * The renderer asks for the active element via .element/.width/.height.
 */

const DEFAULT_IMAGE_W = 1280
const DEFAULT_IMAGE_H = 720

export class MediaSource {
    constructor() {
        this._video = document.createElement('video')
        this._video.playsInline = true
        this._video.muted = true
        this._video.autoplay = true

        this._image = new Image()
        this._image.crossOrigin = 'anonymous'

        this._stream = null
        this._facingMode = 'user'
        this._kind = 'camera'   // 'camera' | 'image'
        this._lastImageUrl = null
    }

    /** The active source element, suitable for the renderer */
    get element() {
        return this._kind === 'camera' ? this._video : this._image
    }

    get kind() { return this._kind }
    get facingMode() { return this._facingMode }
    get cameraActive() { return this._stream !== null }

    get width() {
        if (this._kind === 'camera') return this._video.videoWidth || 0
        return this._image.naturalWidth || DEFAULT_IMAGE_W
    }

    get height() {
        if (this._kind === 'camera') return this._video.videoHeight || 0
        return this._image.naturalHeight || DEFAULT_IMAGE_H
    }

    /** Start the camera and switch to it as the active source. */
    async startCamera(options = {}) {
        if (this._stream) this._stopStream()
        this._facingMode = options.facingMode || this._facingMode || 'user'

        const constraints = {
            video: {
                facingMode: this._facingMode,
                width: { ideal: options.width || 1280 },
                height: { ideal: options.height || 720 }
            },
            audio: false
        }
        if (options.deviceId) {
            constraints.video = { deviceId: { exact: options.deviceId } }
        }

        this._stream = await navigator.mediaDevices.getUserMedia(constraints)
        this._video.srcObject = this._stream
        await this._video.play()

        await new Promise(resolve => {
            if (this._video.videoWidth > 0) { resolve(); return }
            this._video.addEventListener('loadedmetadata', resolve, { once: true })
        })

        this._kind = 'camera'
    }

    async switchFacingMode() {
        const next = this._facingMode === 'user' ? 'environment' : 'user'
        await this.startCamera({ facingMode: next })
    }

    /**
     * Use an uploaded image as the active source.
     * @param {File|Blob|string} fileOrUrl
     */
    async useImage(fileOrUrl) {
        const isExternalUrl = typeof fileOrUrl === 'string'
        const url = isExternalUrl ? fileOrUrl : URL.createObjectURL(fileOrUrl)

        try {
            await new Promise((resolve, reject) => {
                this._image.onload = () => resolve()
                this._image.onerror = () => reject(new Error('Failed to load image'))
                this._image.src = url
            })
        } catch (err) {
            if (!isExternalUrl) URL.revokeObjectURL(url)
            throw err
        }

        // Revoke the previous blob URL we owned (if any) only after the new
        // image has decoded — releasing too early can cause the texture to flicker.
        if (this._lastImageUrl) URL.revokeObjectURL(this._lastImageUrl)
        this._lastImageUrl = isExternalUrl ? null : url

        this._kind = 'image'
        if (this._stream) this._video.pause()
    }

    /** Resume the camera as the active source (used after viewing an image). */
    async resumeCamera() {
        if (!this._stream) {
            await this.startCamera({ facingMode: this._facingMode })
            return
        }
        await this._video.play()
        this._kind = 'camera'
    }

    /** Stop the camera and release the stream. */
    stopCamera() {
        this._stopStream()
        this._video.srcObject = null
    }

    _stopStream() {
        if (this._stream) {
            this._stream.getTracks().forEach(t => t.stop())
            this._stream = null
        }
    }

    /** List available video input devices. */
    static async listCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            return devices.filter(d => d.kind === 'videoinput')
        } catch {
            return []
        }
    }
}
