// SPDX-License-Identifier: MIT
/**
 * An advisory lock used to serialize renderer access across the app.
 * Callers that want to skip when the lock is held use `isHeld()` /
 * `acquire()` / `release()` directly. Calls that want classic critical-
 * section semantics can use `with(fn)`, which returns false if the lock was
 * already held. Callers that must run eventually use `acquireWhenFree()`.
 */

export class Lock {
    constructor() {
        this._held = false
        this._waiters = []
    }
    isHeld() { return this._held }
    acquire() { this._held = true }
    acquireWhenFree() {
        if (!this._held) {
            this._held = true
            return Promise.resolve()
        }
        return new Promise(resolve => this._waiters.push(resolve))
    }
    release() {
        const next = this._waiters.shift()
        if (next) next()
        else this._held = false
    }
    async with(fn) {
        if (this._held) return false
        this._held = true
        try { await fn() } finally { this.release() }
        return true
    }
}
