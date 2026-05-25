// SPDX-License-Identifier: MIT
/**
 * Keyboard shortcut bindings for Glitcher.
 *
 *   g        — GLITCHIFY (rebuild random stack)
 *   space    — capture (photo or video toggle, depending on mode)
 *   m        — mirror flip
 *   r        — re-roll all snapshots in current stack (keeps composition)
 *
 * Ignores key events that originate inside input/textarea/select so users
 * can type freely if a future feature adds a text field.
 */

const HANDLERS = {
    'g':  a => a.onGlitchify?.(),
    ' ':  a => a.onCapture?.(),
    'm':  a => a.onMirror?.(),
    'r':  a => a.onRerollAll?.()
}

export function wireKeyboard(actions) {
    const handler = (e) => {
        if (e.target.matches('input, textarea, select')) return
        const key = e.key.toLowerCase()
        const action = HANDLERS[key]
        if (!action) return
        e.preventDefault()
        action(actions)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
}
