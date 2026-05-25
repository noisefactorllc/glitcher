// SPDX-License-Identifier: MIT
/**
 * Stack persistence + share-URL encoding.
 *
 * Two storage mechanisms:
 *
 *   localStorage   — keeps the user's last stack so reload restores it.
 *                    Saved on every mutation (intensity drags are debounced).
 *
 *   URL hash       — `#s=<base64url>` lets users share a stack as a link.
 *                    Read on boot (takes precedence over localStorage); the
 *                    hash is cleared once consumed so subsequent localStorage
 *                    writes take over.
 *
 * Wire format (URL-safe base64 of JSON):
 *   { v: 1, s: [{ e: 'corrupt', i: 75, r: { intensity: 87, ... } }, ...] }
 *
 * Short keys keep URLs compact for sharing.
 */

const LS_KEY = 'glitcher.stack.v1'

/** URL-safe base64 (no padding, +/ swapped). */
function toB64Url(str) {
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(str) {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/')
        + '=='.slice(0, (4 - str.length % 4) % 4)
    return decodeURIComponent(escape(atob(padded)))
}

/** Convert internal slot list → wire format. Slots are {uid, effectId, intensity, rolled}. */
function slotsToWire(slots) {
    return {
        v: 1,
        s: slots.map(slot => ({
            e: slot.effectId,
            i: Math.round(slot.intensity),
            r: slot.rolled
        }))
    }
}

/** Convert wire format → spec list usable by EffectStack.replace(). */
function wireToSpecs(wire) {
    if (!wire || wire.v !== 1 || !Array.isArray(wire.s)) {
        throw new Error('Invalid stack payload')
    }
    return wire.s.map(item => ({
        effectId: String(item.e),
        intensity: Number(item.i ?? 60),
        rolled: item.r && typeof item.r === 'object' ? item.r : undefined
    }))
}

/** Encode a stack to a share token (URL-safe base64 of JSON). */
export function encodeStack(slots) {
    return toB64Url(JSON.stringify(slotsToWire(slots)))
}

/** Decode a share token back to a spec list. Throws on malformed input. */
export function decodeStack(token) {
    const json = fromB64Url(token)
    const wire = JSON.parse(json)
    return wireToSpecs(wire)
}

// ---------------------------------------------------------- localStorage

/** Persist the current stack to localStorage. Safe to call frequently. */
export function saveLocal(slots) {
    try {
        const json = JSON.stringify(slotsToWire(slots))
        localStorage.setItem(LS_KEY, json)
    } catch (e) {
        console.warn('[Glitcher] localStorage save failed:', e)
    }
}

/** Read the saved stack, or null if none / unreadable. */
export function loadLocal() {
    try {
        const raw = localStorage.getItem(LS_KEY)
        if (!raw) return null
        return wireToSpecs(JSON.parse(raw))
    } catch (e) {
        console.warn('[Glitcher] localStorage load failed:', e)
        return null
    }
}

// ---------------------------------------------------------- URL hash

/** Pop `#s=...` off the URL and return decoded specs, or null if absent. */
export function consumeShareHash() {
    if (!location.hash) return null
    const m = location.hash.match(/^#s=([A-Za-z0-9_-]+)/)
    if (!m) return null
    try {
        const specs = decodeStack(m[1])
        // Clear the hash so reloads use localStorage, and the URL bar
        // returns to clean state. replaceState avoids a history entry.
        history.replaceState(null, '', location.pathname + location.search)
        return specs
    } catch (e) {
        console.warn('[Glitcher] Share hash decode failed:', e)
        return null
    }
}

/** Build a full share URL for the current stack. */
export function buildShareUrl(slots) {
    const token = encodeStack(slots)
    return `${location.origin}${location.pathname}#s=${token}`
}

// ---------------------------------------------------------- clipboard

/**
 * Copy text to the system clipboard.
 * @returns {Promise<boolean>} true on success, false if blocked.
 */
export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return true
        }
    } catch (e) {
        // fall through to legacy path
    }
    try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        return ok
    } catch {
        return false
    }
}
