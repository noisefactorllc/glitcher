// SPDX-License-Identifier: MIT
/**
 * A trivial advisory lock used to serialize renderer access across the app.
 * Callers that want to skip when the lock is held use `isHeld()` /
 * `acquire()` / `release()` directly. Calls that want classic critical-
 * section semantics can use `with(fn)`, which returns false if the lock was
 * already held.
 */

export class Lock {
    constructor() { this._held = false }
    isHeld() { return this._held }
    acquire() { this._held = true }
    release() { this._held = false }
    async with(fn) {
        if (this._held) return false
        this._held = true
        try { await fn() } finally { this._held = false }
        return true
    }
}
