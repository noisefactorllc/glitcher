// SPDX-License-Identifier: MIT
/**
 * StackEditor — DOM view for the EffectStack.
 *
 * Renders one row per slot, plus an "+ ADD EFFECT" trigger that opens a
 * picker popover, plus a starter-chain rail.
 *
 * View-only. The controller (app.js) owns the EffectStack model and
 * decides what each event means for the renderer (live update vs recompile).
 */

import { EFFECTS, EFFECT_ORDER, getEffect } from './effects.js'

export class StackEditor {
    /**
     * @param {object} opts
     * @param {object} opts.stack                  EffectStack instance
     * @param {Array} opts.starters                STARTERS array
     * @param {(uid:string, v:number) => void} opts.onIntensityInput
     * @param {(uid:string) => void} opts.onReroll
     * @param {(uid:string) => void} opts.onRemove
     * @param {(uid:string, toIndex:number) => void} opts.onMove
     * @param {(effectId:string) => void} opts.onAdd
     * @param {(starterIdx:number) => void} opts.onStarter
     */
    constructor(opts) {
        this._stack = opts.stack
        this._starters = opts.starters
        this._cb = {
            onIntensityInput: opts.onIntensityInput,
            onReroll: opts.onReroll,
            onRemove: opts.onRemove,
            onMove: opts.onMove,
            onAdd: opts.onAdd,
            onStarter: opts.onStarter
        }

        this._pickerOpen = false
        this._dragUid = null
        this._dragOverUid = null
    }

    init() {
        this._renderStarters()
        this._renderStack()
        this._wirePicker()
    }

    /** Re-render stack rows (after structural change: add/remove/reorder/replace). */
    renderStack() { this._renderStack() }

    /**
     * Update only an intensity readout for a single slot (no rerender).
     * Avoids losing input focus or interrupting a drag.
     */
    setSlotIntensity(uid, value) {
        const row = this._row(uid)
        if (!row) return
        row.querySelector('.slot-intensity-slider').value = String(value)
        row.querySelector('.slot-intensity-value').textContent = String(value)
    }

    /** Brief animation on the dice button when a slot is rerolled. */
    pulseReroll(uid) {
        const btn = this._row(uid)?.querySelector('.slot-dice')
        if (!btn) return
        btn.classList.remove('rolling')
        void btn.offsetWidth
        btn.classList.add('rolling')
    }

    /** Full-screen glitch flash for a successful glitchify. */
    static showGlitchPulse() {
        const overlay = document.createElement('div')
        overlay.className = 'glitch-pulse-overlay'
        document.body.appendChild(overlay)
        overlay.addEventListener('animationend', () => overlay.remove())
    }

    /** Restart the GLITCHIFY button shake. */
    pulseGlitchifyButton() {
        const btn = document.getElementById('glitchify-btn')
        if (!btn) return
        btn.classList.remove('pulse')
        void btn.offsetWidth
        btn.classList.add('pulse')
    }

    // ---------------------------------------------------------- internals

    _row(uid) {
        return document.querySelector(`.stack-slot[data-uid="${uid}"]`)
    }

    _renderStarters() {
        const rail = document.getElementById('starter-rail')
        rail.innerHTML = ''
        this._starters.forEach((starter, i) => {
            const chip = document.createElement('button')
            chip.className = 'starter-chip'
            chip.type = 'button'
            chip.textContent = starter.name
            chip.dataset.index = i
            chip.addEventListener('click', () => this._cb.onStarter(i))
            rail.appendChild(chip)
        })
    }

    _renderStack() {
        const list = document.getElementById('stack-list')
        list.innerHTML = ''

        const slots = this._stack.slots
        if (slots.length === 0) {
            const empty = document.createElement('div')
            empty.className = 'stack-empty'
            empty.textContent = 'Empty stack — add an effect or tap a starter.'
            list.appendChild(empty)
        } else {
            slots.forEach((slot, i) => list.appendChild(this._renderSlot(slot, i)))
        }
    }

    _renderSlot(slot, index) {
        const effect = getEffect(slot.effectId)
        const row = document.createElement('div')
        row.className = 'stack-slot'
        row.dataset.uid = slot.uid
        row.dataset.index = String(index)

        // Drag handle — the only drag initiator. Pointer events here
        // unify mouse + touch; HTML5 drag/drop is intentionally not used
        // because it doesn't fire on touch.
        const handle = document.createElement('span')
        handle.className = 'slot-handle'
        handle.setAttribute('role', 'button')
        handle.setAttribute('aria-label', `Drag ${effect.displayName} to reorder`)
        handle.textContent = '⋮⋮'
        this._wireHandleDrag(handle, slot)
        row.appendChild(handle)

        // Effect name
        const name = document.createElement('span')
        name.className = 'slot-name'
        name.textContent = effect.displayName
        row.appendChild(name)

        // Intensity slider + readout
        const intensity = document.createElement('label')
        intensity.className = 'slot-intensity'
        intensity.setAttribute('aria-label', `${effect.displayName} intensity`)
        const slider = document.createElement('input')
        slider.type = 'range'
        slider.min = '0'
        slider.max = '100'
        slider.value = String(slot.intensity)
        slider.className = 'slot-intensity-slider'
        slider.addEventListener('input', (e) => {
            const v = Number(e.target.value)
            row.querySelector('.slot-intensity-value').textContent = String(v)
            this._cb.onIntensityInput(slot.uid, v)
        })
        intensity.appendChild(slider)

        const value = document.createElement('span')
        value.className = 'slot-intensity-value'
        value.textContent = String(slot.intensity)
        intensity.appendChild(value)
        row.appendChild(intensity)

        // Dice (re-roll snapshot)
        const dice = document.createElement('button')
        dice.type = 'button'
        dice.className = 'slot-dice'
        dice.title = 'Re-roll this effect'
        dice.setAttribute('aria-label', `Re-roll ${effect.displayName}`)
        dice.innerHTML = diceSvg()
        dice.addEventListener('click', () => this._cb.onReroll(slot.uid))
        row.appendChild(dice)

        // Remove
        const remove = document.createElement('button')
        remove.type = 'button'
        remove.className = 'slot-remove'
        remove.title = 'Remove'
        remove.setAttribute('aria-label', `Remove ${effect.displayName}`)
        remove.textContent = '×'
        remove.addEventListener('click', () => this._cb.onRemove(slot.uid))
        row.appendChild(remove)

        return row
    }

    /**
     * Pointer-event drag for stack reordering. Works on mouse + touch.
     * Drag starts after 4px movement so a single tap doesn't grab; on
     * pointerup we commit the move (or no-op if not enough movement).
     *
     * `setPointerCapture` keeps move/up events flowing to the handle even
     * after the pointer leaves it.
     */
    _wireHandleDrag(handle, slot) {
        const THRESHOLD = 4
        let state = null  // null | { startY, startX, captured, started, row }

        handle.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return
            const row = handle.closest('.stack-slot')
            if (!row) return
            state = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                started: false,
                row
            }
            // Capture so move/up arrive even outside the handle. Capture
            // can fail for synthetic events; we still want to track manually.
            try { handle.setPointerCapture(e.pointerId) } catch {}
        })

        handle.addEventListener('pointermove', (e) => {
            if (!state || e.pointerId !== state.pointerId) return
            const dy = e.clientY - state.startY
            const dx = e.clientX - state.startX
            if (!state.started && Math.hypot(dx, dy) < THRESHOLD) return
            if (!state.started) {
                state.started = true
                this._dragUid = slot.uid
                state.row.classList.add('dragging')
            }
            this._updateDropTarget(e.clientY, slot.uid)
            this._maybeAutoScroll(e.clientY)
        })

        const finish = (e) => {
            if (!state || e.pointerId !== state.pointerId) return
            const started = state.started
            const dropTarget = this._dropTarget
            try { handle.releasePointerCapture(state.pointerId) } catch {}
            this._clearDropHighlights()
            state.row.classList.remove('dragging')
            state = null
            this._dragUid = null
            this._dropTarget = null
            if (!started) return
            if (!dropTarget || dropTarget.uid === slot.uid) return

            const targetIdx = this._stack.findIndex(dropTarget.uid)
            if (targetIdx < 0) return
            const movingFrom = this._stack.findIndex(slot.uid)
            let to = dropTarget.before ? targetIdx : targetIdx + 1
            // If moving downward past the source's own slot, adjust for the removal.
            if (movingFrom >= 0 && movingFrom < to) to -= 1
            this._cb.onMove(slot.uid, to)
        }

        handle.addEventListener('pointerup', finish)
        handle.addEventListener('pointercancel', finish)
    }

    _updateDropTarget(clientY, draggingUid) {
        this._clearDropHighlights()
        const rows = document.querySelectorAll('.stack-slot')
        for (const row of rows) {
            const uid = row.dataset.uid
            if (uid === draggingUid) continue
            const rect = row.getBoundingClientRect()
            if (clientY < rect.top || clientY > rect.bottom) continue
            const before = (clientY - rect.top) < rect.height / 2
            row.classList.toggle('drag-over-top', before)
            row.classList.toggle('drag-over-bottom', !before)
            this._dropTarget = { uid, before }
            return
        }
        // Edge case: pointer above first row → drop before first non-self row
        const firstNonSelf = Array.from(rows).find(r => r.dataset.uid !== draggingUid)
        if (firstNonSelf) {
            const rect = firstNonSelf.getBoundingClientRect()
            if (clientY < rect.top) {
                firstNonSelf.classList.add('drag-over-top')
                this._dropTarget = { uid: firstNonSelf.dataset.uid, before: true }
                return
            }
            // Or below the last
            const last = Array.from(rows).reverse().find(r => r.dataset.uid !== draggingUid)
            if (last && clientY > last.getBoundingClientRect().bottom) {
                last.classList.add('drag-over-bottom')
                this._dropTarget = { uid: last.dataset.uid, before: false }
                return
            }
        }
        this._dropTarget = null
    }

    _clearDropHighlights() {
        document.querySelectorAll('.stack-slot').forEach(r => {
            r.classList.remove('drag-over-top', 'drag-over-bottom')
        })
    }

    /**
     * If dragging near the top or bottom edge of the scrollable stack
     * container, gently scroll so the user can reach off-screen slots.
     */
    _maybeAutoScroll(clientY) {
        const section = document.getElementById('stack-section')
        if (!section) return
        const rect = section.getBoundingClientRect()
        const edge = 36
        if (clientY < rect.top + edge) {
            section.scrollBy({ top: -10 })
        } else if (clientY > rect.bottom - edge) {
            section.scrollBy({ top: 10 })
        }
    }

    _wirePicker() {
        const trigger = document.getElementById('add-effect-btn')
        const popover = document.getElementById('effect-picker')

        // Build picker once
        popover.innerHTML = ''
        EFFECT_ORDER.forEach(id => {
            const effect = EFFECTS[id]
            const item = document.createElement('button')
            item.type = 'button'
            item.className = 'effect-picker-item'
            item.dataset.effectId = id
            item.innerHTML =
                `<span class="picker-name">${effect.displayName}</span>` +
                `<span class="picker-tag">${effect.tagline}</span>`
            item.addEventListener('click', () => {
                this._cb.onAdd(id)
                this._closePicker()
            })
            popover.appendChild(item)
        })

        trigger.addEventListener('click', (e) => {
            e.stopPropagation()
            this._pickerOpen ? this._closePicker() : this._openPicker()
        })

        // Click outside closes
        document.addEventListener('click', (e) => {
            if (!this._pickerOpen) return
            if (popover.contains(e.target)) return
            if (trigger.contains(e.target)) return
            this._closePicker()
        })

        // Esc closes
        document.addEventListener('keydown', (e) => {
            if (this._pickerOpen && e.key === 'Escape') this._closePicker()
        })
    }

    _openPicker() {
        document.getElementById('effect-picker').classList.add('open')
        document.getElementById('add-effect-btn').classList.add('active')
        this._pickerOpen = true
    }

    _closePicker() {
        document.getElementById('effect-picker').classList.remove('open')
        document.getElementById('add-effect-btn').classList.remove('active')
        this._pickerOpen = false
    }
}

function diceSvg() {
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/>
        <circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>
        <circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none"/>
        <circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/>
    </svg>`
}
