// SPDX-License-Identifier: MIT
/**
 * Capture module — photo and video capture from canvas
 */

/**
 * Capture a photo from a canvas with countdown and flash.
 * @param {HTMLCanvasElement} canvas - the canvas to capture from
 * @param {object} options - { countdown: boolean }
 * @returns {Promise<Blob>} the captured image blob
 */
export async function capturePhoto(canvas, options = {}) {
    const countdown = options.countdown !== false

    if (countdown) {
        await showCountdown()
    }

    // Flash
    showFlash()

    // Capture
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to capture photo'))
        }, 'image/png')
    })
}

/** Show 3-2-1 countdown overlay */
function showCountdown() {
    return new Promise(resolve => {
        const overlay = document.createElement('div')
        overlay.className = 'countdown-overlay'
        document.body.appendChild(overlay)

        let count = 3
        const tick = () => {
            if (count <= 0) {
                overlay.remove()
                resolve()
                return
            }
            overlay.innerHTML = `<span class="countdown-number">${count}</span>`
            count--
            setTimeout(tick, 1000)
        }
        tick()
    })
}

/** Show white flash overlay */
function showFlash() {
    const flash = document.createElement('div')
    flash.className = 'flash-overlay'
    document.body.appendChild(flash)
    flash.addEventListener('animationend', () => flash.remove())
}

/** Pick the best supported video MIME type for MediaRecorder */
function pickVideoMimeType() {
    const candidates = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
    ]
    for (const mime of candidates) {
        if (MediaRecorder.isTypeSupported(mime)) return mime
    }
    return ''
}

/**
 * Start video recording from a canvas.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ stop: () => Promise<Blob>, elapsed: () => number }}
 */
export function startVideoRecording(canvas) {
    const stream = canvas.captureStream(30)
    const chunks = []
    const mimeType = pickVideoMimeType()
    const options = mimeType ? { mimeType } : {}
    const recorder = new MediaRecorder(stream, options)
    const startTime = Date.now()

    recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onerror = (e) => {
        console.error('[Capture] Recording error:', e.error)
    }

    recorder.start(100) // 100ms timeslice

    return {
        /** Elapsed recording time in seconds */
        elapsed: () => (Date.now() - startTime) / 1000,

        /** Stop recording and return the video blob */
        stop: () => new Promise(resolve => {
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
                resolve(blob)
            }
            recorder.stop()
        })
    }
}
