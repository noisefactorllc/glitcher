// SPDX-License-Identifier: MIT
/**
 * Lightweight horizontal swipe detection.
 *
 * @param {HTMLElement} element - element to listen on
 * @param {object} callbacks - { onSwipeLeft, onSwipeRight }
 * @param {object} options - { threshold: minimum px distance }
 * @returns {{ destroy: () => void }}
 */
export function enableSwipe(element, callbacks, options = {}) {
    const threshold = options.threshold || 50
    let startX = 0
    let startY = 0
    let tracking = false

    function onTouchStart(e) {
        const touch = e.touches[0]
        startX = touch.clientX
        startY = touch.clientY
        tracking = true
    }

    function onTouchEnd(e) {
        if (!tracking) return
        tracking = false

        const touch = e.changedTouches[0]
        const dx = touch.clientX - startX
        const dy = touch.clientY - startY

        // Ignore if vertical swipe is dominant
        if (Math.abs(dy) > Math.abs(dx)) return

        if (dx > threshold) {
            callbacks.onSwipeRight?.()
        } else if (dx < -threshold) {
            callbacks.onSwipeLeft?.()
        }
    }

    function onTouchCancel() {
        tracking = false
    }

    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchend', onTouchEnd, { passive: true })
    element.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return {
        destroy() {
            element.removeEventListener('touchstart', onTouchStart)
            element.removeEventListener('touchend', onTouchEnd)
            element.removeEventListener('touchcancel', onTouchCancel)
        }
    }
}
