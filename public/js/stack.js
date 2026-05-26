// SPDX-License-Identifier: MIT
/**
 * EffectStack — the user-built chain of glitch effects.
 *
 * A stack is an ordered list of slots, each:
 *   { uid, effectId, intensity (0..100), rolled (param snapshot) }
 *
 * The stack owns:
 *   - structural mutations (add/remove/reorder/replace)
 *   - per-slot intensity / dice-reroll
 *   - building a Noisemaker DSL program for the current stack
 *   - building the live-params map for the renderer's
 *     applyStepParameterValues without a recompile
 *
 * Slot indexing into the renderer:
 *   media() is step_0. The first stack slot is step_1, second step_2, etc.
 */

import { EFFECTS, getEffect, lerpParams, emitEffectCall } from './effects.js'

let _uidCounter = 0
const nextUid = () => `slot_${++_uidCounter}`

export class EffectStack {
    constructor() {
        /** @type {Array<{uid:string, effectId:string, intensity:number, rolled:object}>} */
        this._slots = []
    }

    // ---------------------------------------------------------- shape

    get slots() { return this._slots.slice() }
    get length() { return this._slots.length }
    get isEmpty() { return this._slots.length === 0 }

    findIndex(uid) {
        return this._slots.findIndex(s => s.uid === uid)
    }

    /**
     * Build a new slot for `effectId`.
     *
     * If `rolled` is omitted, a fresh randomized snapshot is generated. If
     * supplied (e.g. when restoring from localStorage or a share URL), it
     * is used verbatim — defaults fill in any missing param names so an
     * older saved snapshot stays compatible with a newer catalog.
     */
    static makeSlot(effectId, intensity = 60, rolled = null) {
        const effect = getEffect(effectId)
        // Use saved `rolled` as-is when restoring; lerpParams handles missing keys
        // by falling back to defaults. (Don't merge with a fresh randomize — that
        // would add extra random keys to effects whose randomize() is sparse.)
        const snapshot = rolled ?? effect.randomize()
        return {
            uid: nextUid(),
            effectId,
            intensity,
            rolled: snapshot
        }
    }

    // ---------------------------------------------------------- mutate (structural)

    /** Append a new slot. Returns the slot. */
    add(effectId, intensity = 60) {
        const slot = EffectStack.makeSlot(effectId, intensity)
        this._slots.push(slot)
        return slot
    }

    remove(uid) {
        const i = this.findIndex(uid)
        if (i < 0) return false
        this._slots.splice(i, 1)
        return true
    }

    /** Move slot identified by uid to a new index. */
    move(uid, toIndex) {
        const from = this.findIndex(uid)
        if (from < 0) return false
        const [slot] = this._slots.splice(from, 1)
        const clamped = Math.max(0, Math.min(this._slots.length, toIndex))
        this._slots.splice(clamped, 0, slot)
        return true
    }

    /**
     * Replace the entire stack from a plain array of
     * `{effectId, intensity?, rolled?}`.
     *
     * When `rolled` is omitted, a fresh randomized snapshot is generated for
     * that slot — this is the normal path for starters and GLITCHIFY. When
     * `rolled` is supplied (persistence / share URL), it is restored verbatim
     * so the user gets the exact look back.
     */
    replace(specs) {
        this._slots = specs.map(spec =>
            EffectStack.makeSlot(
                spec.effectId,
                spec.intensity ?? 60,
                spec.rolled ?? null
            ))
    }

    /**
     * Restore a stack from a persistence snapshot (saved state / share URL).
     * Filters out specs whose effectId is no longer in the catalog so a
     * deprecated/renamed effect doesn't blow up boot.
     */
    replaceFromSnapshot(specs) {
        const safe = specs.filter(spec => {
            try { getEffect(spec.effectId); return true }
            catch { return false }
        })
        this.replace(safe)
    }

    clear() {
        this._slots = []
    }

    // ---------------------------------------------------------- mutate (live)

    setIntensity(uid, intensity) {
        const slot = this._slots[this.findIndex(uid)]
        if (!slot) return false
        slot.intensity = Math.max(0, Math.min(100, intensity))
        return true
    }

    /** Re-roll the snapshot for a single slot. */
    reroll(uid) {
        const slot = this._slots[this.findIndex(uid)]
        if (!slot) return false
        slot.rolled = getEffect(slot.effectId).randomize()
        return true
    }

    /** Re-roll snapshots for every slot in place. */
    rerollAll() {
        for (const slot of this._slots) {
            slot.rolled = getEffect(slot.effectId).randomize()
        }
    }

    // ---------------------------------------------------------- emit (renderer)

    /**
     * Build the Noisemaker DSL program for the current stack.
     *
     * Empty stack returns a pass-through that just renders the source.
     */
    buildDsl() {
        const head = 'search synth, filter, classicNoisedeck'
        if (this._slots.length === 0) {
            return [head, 'media().write(o0)', 'render(o0)'].join('\n\n')
        }
        const chain = this._slots
            .map(slot => emitEffectCall(getEffect(slot.effectId), this._computeLerp(slot)))
            .join('.')
        return [head, `media().${chain}.write(o0)`, 'render(o0)'].join('\n\n')
    }

    /**
     * Build a `{ step_1: {...}, step_2: {...} }` live-params map for the
     * current intensities + rolled snapshots. Pass to
     * renderer.setStepParameters() — no recompile required.
     */
    buildLiveParams() {
        const out = {}
        this._slots.forEach((slot, i) => {
            const params = this._computeLerp(slot)
            if (Object.keys(params).length === 0) return
            out[`step_${i + 1}`] = params
        })
        return out
    }

    /**
     * For UI use: a flat snapshot of effective params on each slot (the
     * actual values currently being sent to the GPU). Mostly for tests.
     */
    debugLiveSnapshot() {
        return this._slots.map(slot => ({
            uid: slot.uid,
            effectId: slot.effectId,
            intensity: slot.intensity,
            effective: this._computeLerp(slot)
        }))
    }

    _computeLerp(slot) {
        const effect = getEffect(slot.effectId)
        return lerpParams(effect, slot.rolled, slot.intensity / 100)
    }
}

// ---------------------------------------------------------- helpers

/**
 * Pick N distinct random effect ids from the catalog. Used by GLITCHIFY.
 */
export function pickRandomEffectIds(n) {
    const ids = Object.keys(EFFECTS)
    const out = []
    const pool = ids.slice()
    while (out.length < n && pool.length > 0) {
        const i = Math.floor(Math.random() * pool.length)
        out.push(pool.splice(i, 1)[0])
    }
    return out
}
