// SPDX-License-Identifier: MIT
/**
 * Gallery — filmstrip of captured photos/videos.
 *
 * Stores captures in memory + IndexedDB for persistence.
 * Supports thumbnail click (download), and delete.
 */

import { saveCapture, deleteCapture, loadAllCaptures, getMaxId } from './db.js'

const FILENAME_PREFIX = 'glitcher'

export class Gallery {
    /**
     * @param {HTMLElement} container - the filmstrip container element
     */
    constructor(container) {
        this._container = container
        this._captures = []
        this._nextId = 1
    }

    async init() {
        try {
            const saved = await loadAllCaptures()
            this._nextId = (await getMaxId()) + 1
            for (const capture of saved) {
                this._captures.push(capture)
                this._addThumbElement(capture)
            }
            if (saved.length > 0) {
                console.log(`[Gallery] Restored ${saved.length} captures from IndexedDB`)
            }
        } catch (err) {
            console.warn('[Gallery] Failed to load from IndexedDB:', err)
        }
    }

    /**
     * Add a capture.
     * @param {'photo'|'video'} type
     * @param {Blob} blob
     * @param {HTMLCanvasElement} sourceCanvas
     */
    async add(type, blob, sourceCanvas) {
        const id = this._nextId++
        const gl = sourceCanvas.getContext('webgl2') || sourceCanvas.getContext('webgl')
        if (gl) gl.finish()
        const thumbUrl = this._generateThumbnail(sourceCanvas)

        const capture = { id, type, blob, thumbUrl }
        this._captures.push(capture)
        this._addThumbElement(capture)

        this._container.scrollLeft = this._container.scrollWidth

        saveCapture({ id, type, blob, thumbUrl }).catch(err =>
            console.warn('[Gallery] Failed to persist:', err)
        )

        return capture
    }

    _generateThumbnail(sourceCanvas) {
        const thumbCanvas = document.createElement('canvas')
        thumbCanvas.width = 56
        thumbCanvas.height = 56
        const ctx = thumbCanvas.getContext('2d')

        const sw = sourceCanvas.width
        const sh = sourceCanvas.height
        const size = Math.min(sw, sh)
        const sx = (sw - size) / 2
        const sy = (sh - size) / 2
        ctx.drawImage(sourceCanvas, sx, sy, size, size, 0, 0, 56, 56)

        return thumbCanvas.toDataURL('image/jpeg', 0.7)
    }

    _addThumbElement(capture) {
        const wrapper = document.createElement('div')
        wrapper.className = 'filmstrip-item'
        wrapper.dataset.id = capture.id

        const thumb = document.createElement('img')
        thumb.className = 'filmstrip-thumb'
        thumb.src = capture.thumbUrl
        thumb.title = `${capture.type === 'photo' ? 'Photo' : 'Video'} ${capture.id}`

        if (capture.type === 'video') {
            thumb.style.border = '2px solid var(--accent-magenta)'
        }

        thumb.addEventListener('click', () => this.download(capture))

        const deleteBtn = document.createElement('button')
        deleteBtn.className = 'filmstrip-delete'
        deleteBtn.textContent = '×'
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            this._delete(capture.id)
        })

        wrapper.appendChild(thumb)
        wrapper.appendChild(deleteBtn)
        this._container.appendChild(wrapper)
    }

    _delete(id) {
        this._captures = this._captures.filter(c => c.id !== id)
        const wrapper = this._container.querySelector(`.filmstrip-item[data-id="${id}"]`)
        if (wrapper) wrapper.remove()
        deleteCapture(id).catch(err =>
            console.warn('[Gallery] Failed to delete from IndexedDB:', err)
        )
    }

    download(capture) {
        const url = URL.createObjectURL(capture.blob)
        const a = document.createElement('a')
        a.href = url
        const ext = capture.type === 'photo' ? 'png'
            : capture.blob.type.includes('mp4') ? 'mp4' : 'webm'
        a.download = `${FILENAME_PREFIX}-${capture.id}.${ext}`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    get count() { return this._captures.length }
}
